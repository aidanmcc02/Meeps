const db = require("../config/db");
const { postMessageToChannel } = require("../websocket/websocketServer");

const MATCHES_CHANNEL = "matches";
const SENDER_NAME = "Diana";

function getSecret(req) {
  const header = req.headers["x-diana-secret"];
  if (header) return header;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

/** Build embed payload from Diana MessagePayload. Fallback markdown for legacy display. */
function buildEmbed(body) {
  const embed = {
    title: body.title,
    description: body.description,
    url: body.url,
    colorHex: body.colorHex,
    thumbnailUrl: body.thumbnailUrl,
    fields: Array.isArray(body.fields) ? body.fields : [],
    footer: body.footer,
    text: body.text,
    timestamp: body.timestamp
  };
  return embed;
}

/** Fallback markdown when embed cannot be used */
function payloadToMarkdown(body) {
  const parts = [];
  if (body.title) parts.push(`**${body.title}**`);
  if (body.description) parts.push(body.description);
  if (body.text) parts.push(body.text);
  if (Array.isArray(body.fields) && body.fields.length > 0) {
    body.fields.forEach((f) => {
      const name = (f.name || "").replace(/\*\*/g, "").trim();
      const value = (f.value || "").replace(/\*\*/g, "").trim();
      if (name && value) parts.push(`**${name}** ${value}`);
    });
  }
  if (body.url) parts.push(`[Link](${body.url})`);
  return parts.join("\n\n");
}

exports.notify = async (req, res, next) => {
  const secret = process.env.DIANA_WEBHOOK_SECRET;
  const receivedSecret = getSecret(req);
  if (!secret) {
    return res.status(503).json({ error: "Diana notifications not configured" });
  }
  if (receivedSecret !== secret) {
    return res.status(401).json({ error: "Invalid Diana webhook secret" });
  }

  const body = req.body || {};
  const content = payloadToMarkdown(body) || body.text || "(No content)";
  const embed = buildEmbed(body);

  try {
    const userResult = await db.query(
      "SELECT id FROM users WHERE user_type = $1 AND display_name = $2 LIMIT 1",
      ["bot", SENDER_NAME]
    );
    const dianaBotId = userResult.rows[0]?.id ?? null;

    const payload = await postMessageToChannel(
      MATCHES_CHANNEL,
      dianaBotId,
      SENDER_NAME,
      content,
      embed
    );
    if (!payload) {
      return res.status(500).json({ error: "Failed to post message" });
    }
    return res.status(201).json({ ok: true, channel: MATCHES_CHANNEL, id: payload.id });
  } catch (err) {
    console.error("[diana-notify] Error:", err.message);
    return next(err);
  }
};
