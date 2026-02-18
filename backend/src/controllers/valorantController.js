const { pool } = require("../config/db");
const {
  getAccountByRiotId,
  getMatchList,
  getMatch,
  getMatchPlayerSummary,
} = require("../services/valorantService");
const { authenticate } = require("../middleware/authMiddleware");

const MATCHES_CHANNEL_ID = "matches";
const QUEUE = "competitive";

/**
 * POST /api/valorant/link (auth required)
 * Body: { gameName, tagLine, region? }
 * Links the current Meeps user to a Riot account.
 */
async function linkAccount(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { gameName, tagLine, region = "eu" } = req.body;
    if (!gameName || !tagLine) {
      return res.status(400).json({
        message: "gameName and tagLine are required",
      });
    }
    const account = await getAccountByRiotId(gameName, tagLine, region);
    await pool.query(
      `INSERT INTO valorant_links (user_id, riot_puuid, game_name, tag_line, region)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         riot_puuid = EXCLUDED.riot_puuid,
         game_name = EXCLUDED.game_name,
         tag_line = EXCLUDED.tag_line,
         region = EXCLUDED.region`,
      [userId, account.puuid, account.gameName, account.tagLine, region]
    );
    return res.status(200).json({
      message: "Linked",
      gameName: account.gameName,
      tagLine: account.tagLine,
    });
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ message: "Riot account not found" });
    }
    if (err.response?.status === 403) {
      return res.status(502).json({ message: "Riot API key invalid or rate limited" });
    }
    console.error("[Valorant link]", err);
    return res.status(500).json({ message: "Failed to link account" });
  }
}

/**
 * GET /api/valorant/players (auth required)
 * Returns all Meeps users who have linked Valorant (for Neon tab selector).
 */
async function listPlayers(req, res) {
  try {
    const result = await pool.query(
      `SELECT v.user_id AS id, v.game_name, v.tag_line, v.region,
              COALESCE(u.display_name, 'User ' || v.user_id) AS display_name
       FROM valorant_links v
       JOIN users u ON u.id = v.user_id
       ORDER BY u.display_name, v.game_name`
    );
    return res.json(result.rows);
  } catch (err) {
    if (err.code === "42P01") {
      return res.json([]);
    }
    console.error("[Valorant listPlayers]", err);
    return res.status(500).json({ message: "Failed to list players" });
  }
}

/**
 * GET /api/valorant/players/:userId/stats (auth required)
 * Returns current rank and recent match history for that user.
 */
async function getPlayerStats(req, res) {
  try {
    const userId = Number(req.params.userId);
    if (!userId) {
      return res.status(400).json({ message: "Invalid userId" });
    }
    const linkResult = await pool.query(
      "SELECT user_id, riot_puuid, game_name, tag_line, region FROM valorant_links WHERE user_id = $1",
      [userId]
    );
    if (linkResult.rows.length === 0) {
      return res.status(404).json({ message: "Player has not linked Valorant" });
    }
    const link = linkResult.rows[0];
    const history = await getMatchList(link.riot_puuid, link.region, QUEUE, 0, 15);
    const matches = [];
    for (const entry of history) {
      try {
        const match = await getMatch(entry.matchId, link.region);
        const summary = await getMatchPlayerSummary(match, link.riot_puuid);
        if (summary) {
          matches.push({
            ...summary,
            startTime: summary.startTime ? new Date(parseInt(summary.startTime, 10)).toISOString() : null,
          });
        }
      } catch (e) {
        // skip failed match fetch
      }
    }
    const currentRank = matches.length > 0 ? matches[0].rankName : null;
    const currentTier = matches.length > 0 ? matches[0].competitiveTier : 0;
    return res.json({
      userId: link.user_id,
      gameName: link.game_name,
      tagLine: link.tag_line,
      region: link.region,
      currentRank: currentRank || "Unranked",
      currentTier,
      matches,
    });
  } catch (err) {
    console.error("[Valorant getPlayerStats]", err);
    return res.status(500).json({ message: "Failed to load stats" });
  }
}

/**
 * DELETE /api/valorant/link (auth required)
 * Unlinks the current user's Riot account.
 */
async function unlinkAccount(req, res) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const result = await pool.query(
      "DELETE FROM valorant_links WHERE user_id = $1 RETURNING id",
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No link found" });
    }
    return res.status(200).json({ message: "Unlinked" });
  } catch (err) {
    console.error("[Valorant unlink]", err);
    return res.status(500).json({ message: "Failed to unlink" });
  }
}

module.exports = {
  linkAccount,
  listPlayers,
  getPlayerStats,
  unlinkAccount,
  MATCHES_CHANNEL_ID,
};
