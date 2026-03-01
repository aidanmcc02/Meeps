/**
 * Conqueror API: receives TFT match notifications from Conqueror service
 * and exposes linked TFT users (via league_username, shared with Diana).
 */

const db = require("../config/db");
const { postMessageToChannel } = require("../websocket/websocketServer");

const MATCHES_CHANNEL = "matches";
const SENDER_NAME = "Conqueror";

function getSecret(req) {
  const header = req.headers["x-conqueror-secret"];
  if (header) return header;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

function verifySecret(req, res) {
  const secret = process.env.CONQUEROR_WEBHOOK_SECRET;
  const receivedSecret = getSecret(req);
  if (!secret) {
    res.status(503).json({ error: "Conqueror API not configured" });
    return false;
  }
  if (receivedSecret !== secret) {
    res.status(401).json({ error: "Invalid Conqueror webhook secret" });
    return false;
  }
  return true;
}

/** Build TFT match embed from Conqueror payload */
function buildMatchEmbed(body, bannerUrl = null) {
  const placement = body.placement ?? body.place ?? body.rank;
  const comp = body.comp ?? body.composition ?? body.traits ?? "";
  const gameMode = body.gameMode ?? body.game_mode ?? body.queue ?? "normal";
  const gameName = body.gameName ?? body.game_name ?? "";
  const tagLine = body.tagLine ?? body.tag_line ?? "";
  const riotId =
    gameName && tagLine
      ? `${gameName}#${tagLine}`
      : (body.league_username ?? body.riotId ?? "");

  const modeLabel =
    gameMode === "ranked"
      ? "Ranked"
      : gameMode === "double_up"
        ? "Double Up"
        : "Normal";

  const placementStr =
    typeof placement === "number" ? `#${placement}` : String(placement ?? "?");

  const fields = [
    { name: "Placement", value: placementStr, inline: true },
    { name: "Mode", value: modeLabel, inline: true },
  ];
  if (comp) {
    fields.push({
      name: "Comp",
      value:
        typeof comp === "string"
          ? comp
          : (Array.isArray(comp) ? comp : []).join(", "),
      inline: false,
    });
  }

  const resultColor =
    placement === 1 ? 0x28a745 : placement <= 4 ? 0x17a2b8 : 0xe74c3c;

  const embed = {
    title: riotId ? `${riotId} — TFT ${modeLabel}` : `TFT ${modeLabel} Match`,
    description: riotId
      ? `${riotId} placed ${placementStr} in a ${modeLabel} game.`
      : `Placed ${placementStr} in a ${modeLabel} game.`,
    url: body.url ?? null,
    colorHex: body.colorHex ?? resultColor,
    thumbnailUrl: body.thumbnailUrl ?? null,
    fields,
    footer: body.footer ?? `Match ID: ${body.matchId ?? ""}`.trim(),
    timestamp: body.timestamp ?? new Date().toISOString(),
  };
  if (bannerUrl) embed.bannerUrl = bannerUrl;
  return embed;
}

/** Fallback markdown for TFT match */
function payloadToMarkdown(body) {
  const placement = body.placement ?? body.place ?? body.rank ?? "?";
  const comp = body.comp ?? body.composition ?? "";
  const gameMode =
    body.gameMode === "ranked"
      ? "Ranked"
      : body.gameMode === "double_up"
        ? "Double Up"
        : "Normal";
  const riotId =
    body.gameName && body.tagLine
      ? `${body.gameName}#${body.tagLine}`
      : (body.league_username ?? "");

  const parts = [
    `**TFT ${gameMode}** — ${riotId || "Player"} placed #${placement}`,
  ];
  if (comp) parts.push(`**Comp:** ${comp}`);
  if (body.url) parts.push(`[Match](${body.url})`);
  return parts.join("\n\n");
}

/**
 * POST /api/conqueror-notify
 * Conqueror sends TFT match completion. We post to #matches.
 */
exports.notify = async (req, res, next) => {
  if (!verifySecret(req, res)) return;

  const body = req.body || {};
  const content = payloadToMarkdown(body) || "(TFT match completed)";

  try {
    let bannerUrl = null;
    const gameName = body.gameName ?? body.game_name ?? "";
    const tagLine = body.tagLine ?? body.tag_line ?? "";
    const leagueUsername =
      gameName && tagLine
        ? `${gameName}#${tagLine}`
        : (body.league_username ?? "");

    if (leagueUsername) {
      const leagueNorm = leagueUsername.trim().toLowerCase();
      const gameNameOnly = leagueNorm.split("#")[0];
      const userResult = await db.query(
        `SELECT banner_url, win_gif_url, lose_gif_url FROM users
         WHERE user_type = 'user'
           AND TRIM(COALESCE(league_username, '')) != ''
           AND (LOWER(TRIM(league_username)) = $1 OR LOWER(TRIM(SPLIT_PART(COALESCE(league_username, ''), '#', 1))) = $2)
         LIMIT 1`,
        [leagueNorm, gameNameOnly],
      );
      const row = userResult.rows[0];
      if (row) {
        const placement = body.placement ?? body.place ?? body.rank;
        const isWin = placement === 1;
        if (isWin && row.win_gif_url) {
          bannerUrl = row.win_gif_url;
        } else if (!isWin && placement != null && row.lose_gif_url) {
          bannerUrl = row.lose_gif_url;
        }
        if (!bannerUrl && row.banner_url) {
          bannerUrl = row.banner_url;
        }
      }
    }

    const embed = buildMatchEmbed(body, bannerUrl);
    const conquerorResult = await db.query(
      "SELECT id FROM users WHERE user_type = $1 AND display_name = $2 LIMIT 1",
      ["bot", SENDER_NAME],
    );
    const conquerorBotId = conquerorResult.rows[0]?.id ?? null;

    const payload = await postMessageToChannel(
      MATCHES_CHANNEL,
      conquerorBotId,
      SENDER_NAME,
      content,
      embed,
    );
    if (!payload) {
      return res.status(500).json({ error: "Failed to post message" });
    }
    return res
      .status(201)
      .json({ ok: true, channel: MATCHES_CHANNEL, id: payload.id });
  } catch (err) {
    console.error("[conqueror-notify] Error:", err.message);
    return next(err);
  }
};

/**
 * GET /api/conqueror-linked-users
 * Returns users who have linked their Riot account (league_username).
 * Same data Diana uses — League and TFT share the same Riot account.
 */
exports.getLinkedUsers = async (req, res, next) => {
  if (!verifySecret(req, res)) return;

  try {
    const result = await db.query(
      `SELECT id AS user_id, display_name, league_username
       FROM users
       WHERE user_type = 'user'
         AND TRIM(COALESCE(league_username, '')) != ''
       ORDER BY id`,
    );
    const users = result.rows.map((r) => ({
      user_id: r.user_id,
      display_name: r.display_name || `User ${r.user_id}`,
      league_username: (r.league_username || "").trim(),
      game_name: (() => {
        const u = (r.league_username || "").trim();
        const hashIdx = u.indexOf("#");
        return hashIdx >= 0 ? u.slice(0, hashIdx).trim() : u;
      })(),
      tag_line: (() => {
        const u = (r.league_username || "").trim();
        const hashIdx = u.indexOf("#");
        return hashIdx >= 0 ? u.slice(hashIdx + 1).trim() : "";
      })(),
    }));
    return res.json({ users });
  } catch (err) {
    console.error("[conqueror-linked-users] Error:", err.message);
    return next(err);
  }
};
