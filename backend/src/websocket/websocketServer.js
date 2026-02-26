const { WebSocketServer } = require("ws");
const db = require("../config/db");
const { createSignedFilePath } = require("../controllers/uploadController");
const pushService = require("../services/pushService");

const UPLOAD_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

async function getAttachmentsForMessage(messageId) {
  try {
    const result = await db.query(
      `SELECT u.id, u.public_id, u.filename, u.mime_type, u.size_bytes, u.created_at
       FROM message_attachments ma
       JOIN uploads u ON u.id = ma.upload_id
       WHERE ma.message_id = $1 AND u.created_at > $2
       ORDER BY ma.upload_id`,
      [messageId, new Date(Date.now() - UPLOAD_MAX_AGE_MS)]
    );
    return result.rows.map((r) => ({
      id: r.id,
      publicId: r.public_id,
      filename: r.filename,
      mimeType: r.mime_type,
      size: r.size_bytes,
      url: createSignedFilePath(r.public_id)
    }));
  } catch (_) {
    return [];
  }
}

let wssInstance = null;
const presenceByUserId = new Map();
const socketsByUserId = new Map();
const voiceRooms = new Map(); // roomId -> Set<userId> (for broadcast; insertion order = join order)
const voiceRoomSockets = new Map(); // roomId -> Map<userId, Set<socket>> (per-socket membership for multi-device)
let idleCheckInterval = null;

/** Remove one socket from a voice room. Only removes userId from room when this is their last socket in the room. */
function removeSocketFromVoiceRoom(socket, roomId, userId) {
  const roomMap = voiceRoomSockets.get(roomId);
  if (!roomMap) return;
  const userSockets = roomMap.get(userId);
  if (!userSockets) return;
  userSockets.delete(socket);
    if (userSockets.size === 0) {
    roomMap.delete(userId);
    const members = voiceRooms.get(roomId);
    if (members) {
      members.delete(userId);
      if (members.size === 0) {
        voiceRooms.delete(roomId);
        voiceRoomSockets.delete(roomId);
      } else {
        broadcastVoiceParticipants(roomId);
      }
    }
  }
}

const IDLE_AFTER_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
const WS_PING_INTERVAL_MS = 25 * 1000; // 25 seconds – keep connections alive so proxies don't drop after ~10–15 min
const MAX_MISSED_PINGS = 2; // Allow 2 missed pongs before terminating (~50s grace for network blips)

let heartbeatInterval = null;

function startWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wssInstance = wss;

  // Ping all clients periodically so connections are not considered idle (prevents proxy/load balancer timeouts)
  if (!heartbeatInterval) {
    heartbeatInterval = setInterval(() => {
      if (!wssInstance) return;
      wssInstance.clients.forEach((socket) => {
        if (socket.isAlive === false) {
          socket.missedPings = (socket.missedPings || 0) + 1;
          if (socket.missedPings >= MAX_MISSED_PINGS) {
            socket.terminate();
            return;
          }
        } else {
          socket.missedPings = 0;
        }
        socket.isAlive = false;
        socket.ping();
      });
    }, WS_PING_INTERVAL_MS);
  }

  if (!idleCheckInterval) {
    idleCheckInterval = setInterval(() => {
      const now = Date.now();
      for (const [, entry] of presenceByUserId.entries()) {
        if (entry.status === "offline") continue;
        if (now - entry.lastActivity >= IDLE_AFTER_MS && entry.status !== "idle") {
          entry.status = "idle";
          presenceByUserId.set(entry.id, entry);
          broadcastPresenceUpdate({
            id: entry.id,
            displayName: entry.displayName,
            status: entry.status
          });
        }
      }
    }, IDLE_CHECK_INTERVAL_MS);
  }

  wss.on("connection", (socket) => {
    socket.isAlive = true;
    socket.missedPings = 0;
    socket.on("pong", () => {
      socket.isAlive = true;
      socket.missedPings = 0;
    });

    socket.on("message", async (data) => {
      let parsed;
      try {
        parsed = JSON.parse(data.toString());
      } catch (_err) {
        // Ignore non-JSON messages
        return;
      }

      if (parsed.type === "message") {
        await handleIncomingChatMessage(parsed, wss);
      } else if (parsed.type === "message:edit") {
        await handleMessageEdit(parsed, socket, wss);
      } else if (parsed.type === "message:delete") {
        await handleMessageDelete(parsed, socket, wss);
      } else if (parsed.type === "presence:hello") {
        handlePresenceHello(socket, parsed);
      } else if (parsed.type === "presence:activity") {
        handlePresenceActivity(socket, parsed);
      } else if (parsed.type === "voice:join") {
        handleVoiceJoin(socket, parsed);
      } else if (parsed.type === "voice:leave") {
        handleVoiceLeave(socket, parsed);
      } else if (parsed.type === "voice:signal") {
        handleVoiceSignal(parsed);
      } else if (parsed.type === "voice:get_participants") {
        handleVoiceGetParticipants(socket, parsed);
      }
    });

    socket.on("close", () => {
      if (socket.userId) {
        const userId = socket.userId;

        // Remove only this socket from its voice room (so other devices stay in the call)
        if (socket.voiceRoomId) {
          removeSocketFromVoiceRoom(socket, socket.voiceRoomId, userId);
          socket.voiceRoomId = null;
        }

        const entry = presenceByUserId.get(userId);
        if (entry) {
          entry.status = "offline";
          presenceByUserId.set(userId, entry);
          broadcastPresenceUpdate({
            id: entry.id,
            displayName: entry.displayName,
            status: entry.status
          });
        }

        const sockets = socketsByUserId.get(userId);
        if (sockets) {
          sockets.delete(socket);
          if (sockets.size === 0) {
            socketsByUserId.delete(userId);
          }
        }
      }
    });
  });

  return wss;
}

async function handleIncomingChatMessage(parsed, wss) {
  console.log("Received message:", parsed);
  const channel = parsed.channel || "general";
  const sender = parsed.sender || "Anonymous";
  const senderId = parsed.senderId != null ? Number(parsed.senderId) : null;
  const content =
    typeof parsed.content === "string" ? parsed.content.trim() : "";

  const attachmentIds = Array.isArray(parsed.attachmentIds)
    ? parsed.attachmentIds.map((a) => Number(a)).filter((n) => !Number.isNaN(n))
    : [];

  if (!content && attachmentIds.length === 0) {
    console.log("Empty message (no content or attachments), ignoring");
    return;
  }

  let savedMessage = {
    id: null,
    channel,
    sender,
    senderId: senderId || undefined,
    content,
    createdAt: new Date().toISOString(),
    attachments: []
  };

  const contentToSave = content || (attachmentIds.length > 0 ? " " : "");
  try {
    console.log("Saving message to database:", { channel, sender, senderId, content: contentToSave, attachmentIds });
    try {
      const result = await db.query(
        "INSERT INTO messages (channel, sender_name, sender_id, content, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING id, created_at, sender_id",
        [channel, sender, senderId || null, contentToSave]
      );
      const row = result.rows[0];
      const messageId = row.id;

      if (attachmentIds.length > 0) {
        const threeDaysAgo = new Date(Date.now() - UPLOAD_MAX_AGE_MS);
        for (const uploadId of attachmentIds) {
          const ok = await db.query(
            "SELECT id FROM uploads WHERE id = $1 AND created_at > $2",
            [uploadId, threeDaysAgo]
          );
          if (ok.rows.length > 0) {
            await db.query(
              "INSERT INTO message_attachments (message_id, upload_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
              [messageId, uploadId]
            );
          }
        }
      }

      savedMessage.attachments = await getAttachmentsForMessage(messageId);
      savedMessage = {
        id: row.id,
        channel,
        sender,
        senderId: row.sender_id ?? undefined,
        content: contentToSave,
        createdAt: row.created_at,
        attachments: savedMessage.attachments
      };
      console.log("Message saved successfully:", savedMessage);
    } catch (insertErr) {
      if (insertErr.code === "42P01") {
        // relation "message_attachments" or "uploads" does not exist yet
        const result = await db.query(
          "INSERT INTO messages (channel, sender_name, sender_id, content, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING id, created_at, sender_id",
          [channel, sender, senderId || null, content]
        );
        const row = result.rows[0];
        savedMessage = {
          id: row.id,
          channel,
          sender,
          senderId: row.sender_id ?? undefined,
          content: contentToSave,
          createdAt: row.created_at,
          attachments: []
        };
      } else if (insertErr.code === "42703" || insertErr.message?.includes("sender_id")) {
        const result = await db.query(
          "INSERT INTO messages (channel, sender_name, content, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING id, created_at",
          [channel, sender, contentToSave]
        );
        const row = result.rows[0];
        savedMessage = {
          id: row.id,
          channel,
          sender,
          senderId: undefined,
          content: contentToSave,
          createdAt: row.created_at,
          attachments: []
        };
        console.log("Message saved (legacy schema):", savedMessage);
      } else {
        throw insertErr;
      }
    }
  } catch (err) {
    console.error("Failed to save message:", err.message);
    console.error("Full error:", err);
  }

  const outbound = JSON.stringify({
    type: "message",
    payload: savedMessage
  });

  console.log("Broadcasting message to", wss.clients.size, "clients");
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(outbound);
    }
  }

  // Push notifications for all users with push subscriptions who are not connected (e.g. app closed on iPhone)
  if (pushService.isConfigured() && (content || attachmentIds.length > 0)) {
    try {
      const allPushUserIds = await getUserIdsWithPushSubscriptions();
      const connectedIds = new Set(socketsByUserId.keys());
      const toNotify = allPushUserIds.filter(
        (id) => Number(id) !== Number(senderId) && !connectedIds.has(Number(id))
      );
      if (toNotify.length > 0) {
        const bodyPreview = content || (attachmentIds.length > 0 ? "sent an attachment" : "New message");
        pushService
          .sendMessagePushToUsers(toNotify, {
            channel,
            sender,
            body: bodyPreview
          })
          .catch((err) => console.error("[push] sendMessagePushToUsers error:", err.message));
      }
    } catch (err) {
      console.error("[push] getUserIdsWithPushSubscriptions error:", err.message);
    }
  }
}

/**
 * Get all user IDs that have push subscriptions (for notifying on any new message).
 * @returns {Promise<number[]>} User IDs with push subscriptions
 */
async function getUserIdsWithPushSubscriptions() {
  try {
    const result = await db.query("SELECT DISTINCT user_id FROM push_subscriptions");
    return result.rows.map((r) => Number(r.user_id));
  } catch (_) {
    return [];
  }
}

async function handleMessageEdit(parsed, socket, wss) {
  const messageId = parsed.messageId != null ? Number(parsed.messageId) : null;
  const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
  const userId = socket.userId != null ? Number(socket.userId) : null;
  const senderName = typeof parsed.senderName === "string" ? parsed.senderName.trim() : null;

  if (!messageId || !content) return;

  try {
    let getResult;
    try {
      getResult = await db.query(
        "SELECT id, sender_id, sender_name FROM messages WHERE id = $1",
        [messageId]
      );
    } catch (selectErr) {
      if (selectErr.code === "42703" || selectErr.message?.includes("sender_id")) {
        getResult = await db.query(
          "SELECT id, sender_name FROM messages WHERE id = $1",
          [messageId]
        );
      } else {
        throw selectErr;
      }
    }
    const row = getResult.rows[0];
    if (!row) return;
    const rowSenderId = row.sender_id != null ? Number(row.sender_id) : null;
    const ownedByUserId = rowSenderId !== null && rowSenderId === userId;
    const ownedBySenderName = (rowSenderId === null || row.sender_id === undefined) && senderName && row.sender_name === senderName;
    if (!ownedByUserId && !ownedBySenderName) return;

    let result;
    try {
      result = await db.query(
        "UPDATE messages SET content = $2 WHERE id = $1 RETURNING id, channel, sender_name, sender_id, content, created_at",
        [messageId, content]
      );
    } catch (updateErr) {
      if (updateErr.code === "42703" || updateErr.message?.includes("sender_id")) {
        result = await db.query(
          "UPDATE messages SET content = $2 WHERE id = $1 RETURNING id, channel, sender_name, content, created_at",
          [messageId, content]
        );
      } else {
        throw updateErr;
      }
    }
    const updated = result.rows[0];
    const payload = {
      id: updated.id,
      channel: updated.channel,
      sender: updated.sender_name,
      senderId: updated.sender_id ?? undefined,
      content: updated.content,
      createdAt: updated.created_at
    };
    const outbound = JSON.stringify({ type: "message:updated", payload });
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.send(outbound);
    }
  } catch (err) {
    console.error("Message edit failed:", err.message);
  }
}

async function handleMessageDelete(parsed, socket, wss) {
  const messageId = parsed.messageId != null ? Number(parsed.messageId) : null;
  const userId = socket.userId != null ? Number(socket.userId) : null;
  const senderName = typeof parsed.senderName === "string" ? parsed.senderName.trim() : null;

  if (!messageId) return;

  try {
    let getResult;
    try {
      getResult = await db.query(
        "SELECT id, sender_id, sender_name FROM messages WHERE id = $1",
        [messageId]
      );
    } catch (selectErr) {
      if (selectErr.code === "42703" || selectErr.message?.includes("sender_id")) {
        getResult = await db.query(
          "SELECT id, sender_name FROM messages WHERE id = $1",
          [messageId]
        );
      } else {
        throw selectErr;
      }
    }
    const row = getResult.rows[0];
    if (!row) return;
    const rowSenderId = row.sender_id != null ? Number(row.sender_id) : null;
    const ownedByUserId = rowSenderId !== null && rowSenderId === userId;
    const ownedBySenderName = (rowSenderId === null || row.sender_id === undefined) && senderName && row.sender_name === senderName;
    if (!ownedByUserId && !ownedBySenderName) return;

    await db.query("DELETE FROM messages WHERE id = $1", [messageId]);
    const outbound = JSON.stringify({
      type: "message:deleted",
      payload: { id: messageId }
    });
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.send(outbound);
    }
  } catch (err) {
    console.error("Message delete failed:", err.message);
  }
}

function handlePresenceHello(socket, payload) {
  const userId = Number(payload.userId);
  if (!userId) return;

  const displayName = payload.displayName || "Meeps User";
  const now = Date.now();

  socket.userId = userId;

  let sockets = socketsByUserId.get(userId);
  if (!sockets) {
    sockets = new Set();
    socketsByUserId.set(userId, sockets);
  }
  sockets.add(socket);

  const entry = {
    id: userId,
    displayName,
    status: "online",
    lastActivity: now
  };

  presenceByUserId.set(userId, entry);

  // Send current presence state to this client
  const snapshot = Array.from(presenceByUserId.values()).map((p) => ({
    id: p.id,
    displayName: p.displayName,
    status: p.status,
    ...(p.activity != null ? { activity: p.activity } : {})
  }));

  socket.send(
    JSON.stringify({
      type: "presence:state",
      payload: snapshot
    })
  );

  // Broadcast this user's presence to everyone
  broadcastPresenceUpdate({
    id: entry.id,
    displayName: entry.displayName,
    status: entry.status,
    ...(entry.activity != null ? { activity: entry.activity } : {})
  });
}

function normalizeActivity(activity) {
  if (activity == null) return null;
  if (typeof activity !== "object") return null;
  const type = activity.type === "game" ? "game" : "app";
  const name = typeof activity.name === "string" ? activity.name.trim() : "";
  if (!name) return null;
  const details = typeof activity.details === "string" ? activity.details.trim() : undefined;
  return { type, name, ...(details ? { details } : {}) };
}

function handlePresenceActivity(socket, payload) {
  const userId = Number(payload.userId || socket.userId);
  if (!userId) return;

  const now = Date.now();
  const activity = normalizeActivity(payload.activity);
  const existing = presenceByUserId.get(userId);

  if (!existing) {
    const entry = {
      id: userId,
      displayName: payload.displayName || "Meeps User",
      status: "online",
      lastActivity: now,
      ...(activity != null ? { activity } : {})
    };
    presenceByUserId.set(userId, entry);
    broadcastPresenceUpdate({
      id: entry.id,
      displayName: entry.displayName,
      status: entry.status,
      ...(entry.activity != null ? { activity: entry.activity } : {})
    });
    return;
  }

  existing.lastActivity = now;
  const activityChanged = activity !== undefined;
  if (activityChanged) {
    existing.activity = activity || undefined;
    if (activity === null) delete existing.activity;
  }
  const wasOfflineOrIdle = existing.status !== "online";
  if (wasOfflineOrIdle) {
    existing.status = "online";
  }
  presenceByUserId.set(userId, existing);
  if (activityChanged || wasOfflineOrIdle) {
    const payload = {
      id: existing.id,
      displayName: existing.displayName,
      status: existing.status
    };
    if (existing.activity != null) payload.activity = existing.activity;
    else if (activityChanged) payload.activity = null;
    broadcastPresenceUpdate(payload);
  }
}

function handleVoiceJoin(socket, payload) {
  const userId = Number(payload.userId);
  const roomId = payload.roomId;
  if (!userId || !roomId) return;

  // Per-socket membership: so closing mobile doesn't kick desktop from the call
  let roomMap = voiceRoomSockets.get(roomId);
  if (!roomMap) {
    roomMap = new Map();
    voiceRoomSockets.set(roomId, roomMap);
  }
  let userSockets = roomMap.get(userId);
  if (!userSockets) {
    userSockets = new Set();
    roomMap.set(userId, userSockets);
  }
  userSockets.add(socket);
  socket.voiceRoomId = roomId;

  let members = voiceRooms.get(roomId);
  if (!members) {
    members = new Set();
    voiceRooms.set(roomId, members);
  }
  members.add(userId);

  broadcastVoiceParticipants(roomId);
}

function handleVoiceLeave(socket, payload) {
  const userId = Number(payload.userId) || socket.userId;
  const roomId = payload.roomId || socket.voiceRoomId;
  if (!userId || !roomId) return;

  removeSocketFromVoiceRoom(socket, roomId, userId);
  socket.voiceRoomId = null;
}

/** Host = first user to join the channel (Set preserves insertion order). */
function getVoiceHost(roomId) {
  const members = voiceRooms.get(roomId);
  if (!members || members.size === 0) return null;
  return [...members][0];
}

function getVoiceRoomParticipants(roomId) {
  const members = voiceRooms.get(roomId);
  if (!members) return [];
  const participants = [];
  for (const userId of members.values()) {
    const presence = presenceByUserId.get(userId);
    participants.push({
      id: userId,
      displayName: presence ? presence.displayName : `User ${userId}`
    });
  }
  return participants;
}

function broadcastVoiceParticipants(roomId) {
  const participants = getVoiceRoomParticipants(roomId);
  const hostUserId = getVoiceHost(roomId);
  if (!wssInstance) return;

  const outbound = JSON.stringify({
    type: "voice:participants",
    payload: {
      roomId,
      participants,
      hostUserId: hostUserId != null ? hostUserId : undefined
    }
  });

  for (const client of wssInstance.clients) {
    if (client.readyState === client.OPEN) {
      client.send(outbound);
    }
  }
}

function handleVoiceGetParticipants(socket, parsed) {
  if (socket.readyState !== socket.OPEN) return;
  let roomIds = parsed.roomId
    ? [parsed.roomId]
    : Array.isArray(parsed.roomIds)
      ? parsed.roomIds
      : [];
  // If no rooms specified, send all known voice rooms so client can show who's where
  if (roomIds.length === 0 && voiceRooms.size > 0) {
    roomIds = [...voiceRooms.keys()];
  }
  for (const roomId of roomIds) {
    const participants = getVoiceRoomParticipants(roomId);
    const hostUserId = getVoiceHost(roomId);
    socket.send(
      JSON.stringify({
        type: "voice:participants",
        payload: {
          roomId,
          participants,
          hostUserId: hostUserId != null ? hostUserId : undefined
        }
      })
    );
  }
}

function handleVoiceSignal(message) {
  const { roomId, fromUserId, toUserId, signalType, data } = message;
  if (!roomId || !fromUserId || !toUserId || !signalType) return;

  const members = voiceRooms.get(roomId);
  if (!members || !members.has(toUserId) || !members.has(fromUserId)) {
    return;
  }

  const sockets = socketsByUserId.get(toUserId);
  if (!sockets) return;

  const outbound = JSON.stringify({
    type: "voice:signal",
    payload: {
      roomId,
      fromUserId,
      signalType,
      data
    }
  });

  for (const socket of sockets.values()) {
    if (socket.readyState === socket.OPEN) {
      socket.send(outbound);
    }
  }
}

function broadcastProfileUpdate(profile) {
  if (!wssInstance) return;

  const outbound = JSON.stringify({
    type: "profileUpdated",
    payload: profile
  });

  for (const client of wssInstance.clients) {
    if (client.readyState === client.OPEN) {
      client.send(outbound);
    }
  }
}

function broadcastPresenceUpdate(presence) {
  if (!wssInstance) return;

  const outbound = JSON.stringify({
    type: "presence:updated",
    payload: presence
  });

  for (const client of wssInstance.clients) {
    if (client.readyState === client.OPEN) {
      client.send(outbound);
    }
  }
}

function broadcastMessagePayload(payload) {
  if (!wssInstance) return;
  const outbound = JSON.stringify({ type: "message", payload });
  for (const client of wssInstance.clients) {
    if (client.readyState === client.OPEN) {
      client.send(outbound);
    }
  }
}


/**
 * Insert a message into a channel and broadcast to all clients (e.g. Valorant match updates).
 * @param {string} channel - Channel id (e.g. "matches")
 * @param {number} senderId - Meeps user id
 * @param {string} senderName - Display name
 * @param {string} content - Message content (markdown)
 * @param {object} [embed] - Optional Diana-style embed payload (title, description, url, colorHex, thumbnailUrl, fields, footer, timestamp)
 * @returns {Promise<object|null>} Saved message or null
 */
async function postMessageToChannel(channel, senderId, senderName, content, embed = null) {
  const embedJson = embed ? JSON.stringify(embed) : null;
  try {
    const result = await db.query(
      `INSERT INTO messages (channel, sender_name, sender_id, content, embed, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, CURRENT_TIMESTAMP)
       RETURNING id, channel, sender_name, sender_id, content, embed, created_at`,
      [channel, senderName || "Meeps", senderId || null, content || "", embedJson]
    );
    const row = result.rows[0];
    if (!row) return null;
    const payload = {
      id: row.id,
      channel: row.channel,
      sender: row.sender_name,
      senderId: row.sender_id ?? undefined,
      content: row.content,
      embed: row.embed ?? undefined,
      createdAt: row.created_at,
      attachments: []
    };
    broadcastMessagePayload(payload);
    return payload;
  } catch (err) {
    if (err.code === "42703" || err.message?.includes("embed")) {
      const result = await db.query(
        "INSERT INTO messages (channel, sender_name, sender_id, content, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING id, channel, sender_name, sender_id, content, created_at",
        [channel, senderName || "Meeps", senderId || null, content || ""]
      );
      const row = result.rows[0];
      if (!row) return null;
      const payload = {
        id: row.id,
        channel: row.channel,
        sender: row.sender_name,
        senderId: row.sender_id ?? undefined,
        content: row.content,
        createdAt: row.created_at,
        attachments: []
      };
      broadcastMessagePayload(payload);
      return payload;
    }
    if (err.code === "42703" || err.message?.includes("sender_id")) {
      const result = await db.query(
        "INSERT INTO messages (channel, sender_name, content, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING id, channel, sender_name, content, created_at",
        [channel, senderName || "Meeps", content || ""]
      );
      const row = result.rows[0];
      if (!row) return null;
      const payload = {
        id: row.id,
        channel: row.channel,
        sender: row.sender_name,
        senderId: undefined,
        content: row.content,
        createdAt: row.created_at,
        attachments: []
      };
      broadcastMessagePayload(payload);
      return payload;
    }
    throw err;
  }
}

module.exports = {
  startWebSocketServer,
  broadcastProfileUpdate,
  broadcastMessagePayload,
  postMessageToChannel
};
