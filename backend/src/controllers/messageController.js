const db = require("../config/db");
const { createSignedFilePath } = require("./uploadController");

const UPLOAD_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

const PAGE_SIZE = 100; // per text channel

// GET /api/messages?channel=general&before=123 (optional: load messages older than id 123)
exports.listMessages = async (req, res, next) => {
  const channel = req.query.channel || "general";
  const beforeId =
    req.query.before != null ? parseInt(req.query.before, 10) : null;
  const isOlderPage = Number.isInteger(beforeId) && beforeId > 0;

  try {
    let result;
    try {
      if (isOlderPage) {
        result = await db.query(
          `SELECT id, channel, sender_name, sender_id, content, embed, created_at, reply_to_id
           FROM messages
           WHERE channel = $1 AND id < $2
           ORDER BY id DESC
           LIMIT $3`,
          [channel, beforeId, PAGE_SIZE],
        );
        result.rows.reverse();
      } else {
        result = await db.query(
          `SELECT id, channel, sender_name, sender_id, content, embed, created_at, reply_to_id
           FROM (
             SELECT id, channel, sender_name, sender_id, content, embed, created_at, reply_to_id
             FROM messages
             WHERE channel = $1
             ORDER BY created_at DESC
             LIMIT $2
           ) sub
           ORDER BY created_at ASC`,
          [channel, PAGE_SIZE],
        );
      }
    } catch (selectErr) {
      const needsLegacy =
        selectErr.code === "42703" &&
        (selectErr.message?.includes("sender_id") ||
          selectErr.message?.includes("embed") ||
          selectErr.message?.includes("reply_to_id"));
      if (needsLegacy) {
        if (isOlderPage) {
          result = await db.query(
            `SELECT id, channel, sender_name, sender_id, content, created_at
             FROM messages
             WHERE channel = $1 AND id < $2
             ORDER BY id DESC
             LIMIT $3`,
            [channel, beforeId, PAGE_SIZE],
          );
          result.rows.reverse();
        } else {
          result = await db.query(
            `SELECT id, channel, sender_name, sender_id, content, created_at
             FROM (
               SELECT id, channel, sender_name, sender_id, content, created_at
               FROM messages
               WHERE channel = $1
               ORDER BY created_at DESC
               LIMIT $2
             ) sub
             ORDER BY created_at ASC`,
            [channel, PAGE_SIZE],
          );
        }
      } else {
        throw selectErr;
      }
    }

    const messages = result.rows.map((row) => ({
      id: row.id,
      channel: row.channel,
      sender: row.sender_name,
      senderId: row.sender_id ?? undefined,
      content: row.content,
      embed: row.embed ?? undefined,
      createdAt: row.created_at,
      replyToId: row.reply_to_id ?? undefined,
      attachments: [],
      reactions: {},
    }));

    try {
      const cutoff = new Date(Date.now() - UPLOAD_MAX_AGE_MS);
      const ids = messages.map((m) => m.id).filter(Boolean);
      if (ids.length > 0) {
        const attachResult = await db.query(
          `SELECT ma.message_id, u.id AS upload_id, u.public_id, u.filename, u.mime_type, u.size_bytes, u.created_at
           FROM message_attachments ma
           JOIN uploads u ON u.id = ma.upload_id
           WHERE ma.message_id = ANY($1::int[]) AND u.created_at > $2
           ORDER BY ma.message_id, ma.upload_id`,
          [ids, cutoff],
        );
        const byMessage = {};
        for (const r of attachResult.rows) {
          if (!byMessage[r.message_id]) byMessage[r.message_id] = [];
          byMessage[r.message_id].push({
            id: r.upload_id,
            publicId: r.public_id,
            filename: r.filename,
            mimeType: r.mime_type,
            size: r.size_bytes,
            url: createSignedFilePath(r.public_id),
          });
        }
        messages.forEach((m) => {
          m.attachments = byMessage[m.id] || [];
        });
      }
    } catch (_) {
      // message_attachments or uploads table may not exist
    }

    // Reply previews for messages that have reply_to_id
    const replyToIds = [
      ...new Set(messages.map((m) => m.replyToId).filter(Boolean)),
    ];
    let replyPreviewById = {};
    if (replyToIds.length > 0) {
      try {
        const replyResult = await db.query(
          `SELECT id, sender_name, content FROM messages WHERE id = ANY($1::int[])`,
          [replyToIds],
        );
        for (const r of replyResult.rows) {
          const content = r.content || "";
          replyPreviewById[r.id] = {
            id: r.id,
            sender: r.sender_name,
            content:
              content.length > 100 ? content.slice(0, 97) + "..." : content,
          };
        }
      } catch (_) {}
      messages.forEach((m) => {
        if (m.replyToId && replyPreviewById[m.replyToId]) {
          m.replyTo = replyPreviewById[m.replyToId];
        }
      });
    }

    // Reactions: message_id -> { emoji -> [userId, ...] }
    try {
      const reactResult = await db.query(
        `SELECT message_id, user_id, emoji FROM message_reactions WHERE message_id = ANY($1::int[])`,
        [messages.map((m) => m.id)],
      );
      const byMessage = {};
      for (const r of reactResult.rows) {
        if (!byMessage[r.message_id]) byMessage[r.message_id] = {};
        if (!byMessage[r.message_id][r.emoji])
          byMessage[r.message_id][r.emoji] = [];
        byMessage[r.message_id][r.emoji].push(r.user_id);
      }
      messages.forEach((m) => {
        m.reactions = byMessage[m.id] || {};
      });
    } catch (_) {
      // message_reactions may not exist yet
    }

    return res.json({ channel, messages });
  } catch (err) {
    return next(err);
  }
};
