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

/** Extract League of Legends username from Diana payload (for matching users to use their banner). */
function extractLeagueUsername(body) {
  const direct = body.summonerName || body.gameName || body.summoner_name || body.game_name;
  if (direct && typeof direct === "string") {
    const t = direct.trim();
    if (t) return t;
  }
  const fields = Array.isArray(body.fields) ? body.fields : [];
  const summonerFieldNames = ["summoner", "player", "username", "riot", "account"];
  for (const f of fields) {
    const name = (f.name || "").toLowerCase().trim();
    const value = (f.value || "").trim();
    if (name.includes("champion")) continue;
    if (value && summonerFieldNames.some((n) => name.includes(n))) return value;
  }
  // DeepLol URL: .../summoner/euw/FM%20Stew-MEEPS → FM Stew#MEEPS
  const url = (body.url || "").trim();
  const urlMatch = url.match(/\/summoner\/[^/]+\/([^?#]+)/i);
  if (urlMatch) {
    try {
      let id = decodeURIComponent(urlMatch[1].trim());
      const lastHyphen = id.lastIndexOf("-");
      if (lastHyphen > 0) {
        const after = id.slice(lastHyphen + 1);
        if (/^[A-Za-z0-9]{2,6}$/.test(after)) id = id.slice(0, lastHyphen) + "#" + after;
      }
      if (id) return id;
    } catch (_) {}
  }
  // Description: "FM Stew has completed a match!"
  const desc = (body.description || "").trim();
  const descMatch = desc.match(/^(.+?)\s+has completed a match!$/i);
  if (descMatch) {
    const name = descMatch[1].trim();
    if (name && name.length >= 2) return name;
  }
  return null;
}

/** Build embed payload from Diana MessagePayload. Fallback markdown for legacy display. */
function buildEmbed(body, bannerUrl = null) {
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
  if (bannerUrl) embed.bannerUrl = bannerUrl;
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

  try {
    let bannerUrl = null;
    const leagueUsername = extractLeagueUsername(body);
    if (leagueUsername) {
      const leagueNorm = leagueUsername.trim().toLowerCase();
      const gameNameOnly = leagueNorm.split("#")[0];
      const bannerResult = await db.query(
        `SELECT banner_url FROM users
         WHERE user_type = 'user'
           AND TRIM(COALESCE(league_username, '')) != ''
           AND (LOWER(TRIM(league_username)) = $1 OR LOWER(TRIM(SPLIT_PART(COALESCE(league_username, ''), '#', 1))) = $2)
         LIMIT 1`,
        [leagueNorm, gameNameOnly]
      );
      if (bannerResult.rows[0]?.banner_url) {
        bannerUrl = bannerResult.rows[0].banner_url;
      }
    }

    const embed = buildEmbed(body, bannerUrl);
    const dianaResult = await db.query(
      "SELECT id FROM users WHERE user_type = $1 AND display_name = $2 LIMIT 1",
      ["bot", SENDER_NAME]
    );
    const dianaBotId = dianaResult.rows[0]?.id ?? null;

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
