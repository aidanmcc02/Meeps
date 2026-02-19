const db = require("../config/db");

const UPLOAD_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

// GET /api/messages?channel=general
exports.listMessages = async (req, res, next) => {
  const channel = req.query.channel || "general";
  const apiBase = `${req.protocol}://${req.get("host")}`;

  try {
    let result;
    try {
      result = await db.query(
        "SELECT id, channel, sender_name, sender_id, content, created_at FROM messages WHERE channel = $1 ORDER BY created_at ASC LIMIT 200",
        [channel]
      );
    } catch (selectErr) {
      if (selectErr.code === "42703" || selectErr.message?.includes("sender_id")) {
        result = await db.query(
          "SELECT id, channel, sender_name, content, created_at FROM messages WHERE channel = $1 ORDER BY created_at ASC LIMIT 200",
          [channel]
        );
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
      createdAt: row.created_at,
      attachments: []
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
          [ids, cutoff]
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
            url: `${apiBase}/api/files/${r.public_id}`
          });
        }
        messages.forEach((m) => {
          m.attachments = byMessage[m.id] || [];
        });
      }
    } catch (_) {
      // message_attachments or uploads table may not exist
    }

    return res.json({ channel, messages });
  } catch (err) {
    return next(err);
  }
};

