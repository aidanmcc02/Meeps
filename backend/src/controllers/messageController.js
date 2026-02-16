const db = require("../config/db");

// GET /api/messages?channel=general
exports.listMessages = async (req, res, next) => {
  const channel = req.query.channel || "general";

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
      createdAt: row.created_at
    }));

    return res.json({ channel, messages });
  } catch (err) {
    return next(err);
  }
};

