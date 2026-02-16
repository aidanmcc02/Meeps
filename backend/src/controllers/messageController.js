const db = require("../config/db");

// GET /api/messages?channel=general
exports.listMessages = async (req, res, next) => {
  const channel = req.query.channel || "general";

  try {
    const result = await db.query(
      "SELECT id, channel, sender_name, content, created_at FROM messages WHERE channel = $1 ORDER BY created_at ASC LIMIT 200",
      [channel]
    );

    return res.json({
      channel,
      messages: result.rows.map((row) => ({
        id: row.id,
        channel: row.channel,
        sender: row.sender_name,
        content: row.content,
        createdAt: row.created_at
      }))
    });
  } catch (err) {
    return next(err);
  }
};

