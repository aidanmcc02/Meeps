const { WebSocketServer } = require("ws");
const db = require("../config/db");

let wssInstance = null;
const presenceByUserId = new Map();
const socketsByUserId = new Map();
const voiceRooms = new Map(); // roomId -> Set<userId>
let idleCheckInterval = null;

const IDLE_AFTER_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds

function startWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wssInstance = wss;

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
    // eslint-disable-next-line no-console
    console.log("WebSocket client connected");

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
      // eslint-disable-next-line no-console
      console.log("WebSocket client disconnected");
      if (socket.userId) {
        const userId = socket.userId;
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

        // Remove from all voice rooms
        for (const [roomId, members] of voiceRooms.entries()) {
          if (members.has(userId)) {
            members.delete(userId);
            if (members.size === 0) {
              voiceRooms.delete(roomId);
            } else {
              broadcastVoiceParticipants(roomId);
            }
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

  if (!content) {
    console.log("Empty message, ignoring");
    return;
  }

  let savedMessage = {
    id: null,
    channel,
    sender,
    senderId: senderId || undefined,
    content,
    createdAt: new Date().toISOString()
  };

  try {
    console.log("Saving message to database:", { channel, sender, senderId, content });
    try {
      const result = await db.query(
        "INSERT INTO messages (channel, sender_name, sender_id, content) VALUES ($1, $2, $3, $4) RETURNING id, created_at, sender_id",
        [channel, sender, senderId || null, content]
      );
      const row = result.rows[0];
      savedMessage = {
        id: row.id,
        channel,
        sender,
        senderId: row.sender_id ?? undefined,
        content,
        createdAt: row.created_at
      };
      console.log("Message saved successfully:", savedMessage);
    } catch (insertErr) {
      // Old DBs may lack sender_id column (e.g. 42703 = undefined_column)
      if (insertErr.code === "42703" || insertErr.message?.includes("sender_id")) {
        const result = await db.query(
          "INSERT INTO messages (channel, sender_name, content) VALUES ($1, $2, $3) RETURNING id, created_at",
          [channel, sender, content]
        );
        const row = result.rows[0];
        savedMessage = {
          id: row.id,
          channel,
          sender,
          senderId: undefined,
          content,
          createdAt: row.created_at
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
    status: p.status
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
    status: entry.status
  });
}

function handlePresenceActivity(socket, payload) {
  const userId = Number(payload.userId || socket.userId);
  if (!userId) return;

  const now = Date.now();
  const existing = presenceByUserId.get(userId);

  if (!existing) {
    const entry = {
      id: userId,
      displayName: payload.displayName || "Meeps User",
      status: "online",
      lastActivity: now
    };
    presenceByUserId.set(userId, entry);
    broadcastPresenceUpdate({
      id: entry.id,
      displayName: entry.displayName,
      status: entry.status
    });
    return;
  }

  existing.lastActivity = now;
  if (existing.status !== "online") {
    existing.status = "online";
    broadcastPresenceUpdate({
      id: existing.id,
      displayName: existing.displayName,
      status: existing.status
    });
  }

  presenceByUserId.set(userId, existing);
}

function handleVoiceJoin(_socket, payload) {
  const userId = Number(payload.userId);
  const roomId = payload.roomId;
  if (!userId || !roomId) return;

  let members = voiceRooms.get(roomId);
  if (!members) {
    members = new Set();
    voiceRooms.set(roomId, members);
  }
  members.add(userId);

  broadcastVoiceParticipants(roomId);
}

function handleVoiceLeave(_socket, payload) {
  const userId = Number(payload.userId);
  const roomId = payload.roomId;
  if (!userId || !roomId) return;

  const members = voiceRooms.get(roomId);
  if (!members) return;

  members.delete(userId);
  if (members.size === 0) {
    voiceRooms.delete(roomId);
  }
  broadcastVoiceParticipants(roomId);
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
  if (!wssInstance) return;

  const outbound = JSON.stringify({
    type: "voice:participants",
    payload: {
      roomId,
      participants
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
    socket.send(
      JSON.stringify({
        type: "voice:participants",
        payload: { roomId, participants }
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

module.exports = { startWebSocketServer, broadcastProfileUpdate, broadcastMessagePayload };
