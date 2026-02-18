const { pool } = require("../config/db");
const {
  getAccountByRiotId,
  getMatchList,
  getMatch,
  getMatchPlayerSummary,
  getContent,
  getLeaderboard,
  getPlatformStatus,
  getCurrentActId,
} = require("../services/valorantService");
const { authenticate } = require("../middleware/authMiddleware");

const MATCHES_CHANNEL_ID = "matches";
const QUEUE = "competitive";

const DEMO_MODE = process.env.VALORANT_DEMO_MODE === "1" || process.env.VALORANT_DEMO_MODE === "true";

/** Mock match entries for demo mode (when using a dev/temp Riot key that can't access match history). */
function getMockMatches(gameName, tagLine) {
  const agents = [
    { name: "Jett", icon: "https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png" },
    { name: "Phoenix", icon: "https://media.valorant-api.com/agents/eb93336a-449b-9c1b-0a54-a891f7921d69/displayicon.png" },
    { name: "Sage", icon: "https://media.valorant-api.com/agents/569fdd95-4d10-43ab-ca70-79becc718b46/displayicon.png" },
    { name: "Reyna", icon: "https://media.valorant-api.com/agents/a3bfb853-43b2-7238-a4f1-ad90e9e46bcc/displayicon.png" },
    { name: "Omen", icon: "https://media.valorant-api.com/agents/8e253930-4c05-31dd-1b6c-968525494517/displayicon.png" },
  ];
  const now = Date.now();
  return [
    { gameName, tagLine, agentName: agents[0].name, agentIcon: agents[0].icon, rankName: "Gold 2", competitiveTier: 13, won: true, scoreline: "13-9", kills: 18, deaths: 12, assists: 4, score: 234, roundsPlayed: 22, startTime: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
    { gameName, tagLine, agentName: agents[1].name, agentIcon: agents[1].icon, rankName: "Gold 2", competitiveTier: 13, won: false, scoreline: "11-13", kills: 14, deaths: 16, assists: 6, score: 198, roundsPlayed: 24, startTime: new Date(now - 5 * 60 * 60 * 1000).toISOString() },
    { gameName, tagLine, agentName: agents[2].name, agentIcon: agents[2].icon, rankName: "Gold 1", competitiveTier: 12, won: true, scoreline: "13-7", kills: 16, deaths: 10, assists: 8, score: 221, roundsPlayed: 20, startTime: new Date(now - 24 * 60 * 60 * 1000).toISOString() },
    { gameName, tagLine, agentName: agents[3].name, agentIcon: agents[3].icon, rankName: "Gold 1", competitiveTier: 12, won: true, scoreline: "13-10", kills: 20, deaths: 14, assists: 3, score: 256, roundsPlayed: 23, startTime: new Date(now - 28 * 60 * 60 * 1000).toISOString() },
    { gameName, tagLine, agentName: agents[4].name, agentIcon: agents[4].icon, rankName: "Silver 3", competitiveTier: 11, won: false, scoreline: "9-13", kills: 11, deaths: 15, assists: 5, score: 167, roundsPlayed: 22, startTime: new Date(now - 48 * 60 * 60 * 1000).toISOString() },
  ];
}

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

    if (DEMO_MODE) {
      const matches = getMockMatches(link.game_name, link.tag_line);
      return res.json({
        userId: link.user_id,
        gameName: link.game_name,
        tagLine: link.tag_line,
        region: link.region,
        currentRank: matches[0].rankName,
        currentTier: matches[0].competitiveTier,
        matches,
        _demo: true,
      });
    }

    let history;
    try {
      history = await getMatchList(link.riot_puuid, link.region, QUEUE, 0, 15);
    } catch (e) {
      if (e.response?.status === 404) {
        history = [];
      } else if (e.response?.status === 403) {
        const matches = getMockMatches(link.game_name, link.tag_line);
        return res.json({
          userId: link.user_id,
          gameName: link.game_name,
          tagLine: link.tag_line,
          region: link.region,
          currentRank: matches[0].rankName,
          currentTier: matches[0].competitiveTier,
          matches,
          _demo: true,
        });
      } else {
        throw e;
      }
    }
    history = history || [];
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
    console.error("[Valorant getPlayerStats]", err?.message || err);
    const status = err.response?.status ?? err.response?.statusCode;
    const riotMsg = err.response?.data?.message || err.response?.data?.status?.message;
    let message = "Failed to load stats";
    if (err.message === "RIOT_API_KEY is not set") {
      message = "Server: Riot API key not configured.";
    } else if (status === 403) {
      message = "Riot API returned 403 Forbidden. Use a Production API key (dev keys like RGAPI-... expire in 24h and often cannot access Valorant match data). Enable Valorant for your app at developer.riotgames.com.";
    } else if (status === 429) {
      message = "Riot API rate limited; try again in a minute.";
    } else if (status === 404 || riotMsg) {
      message = riotMsg || "Riot account or region may be wrong.";
    } else if (err.message && err.message !== "Failed to load stats") {
      message = err.message;
    }
    return res.status(status && status >= 400 && status < 600 ? status : 500).json({ message });
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

/**
 * GET /api/valorant/status?region=eu
 * val-status-v1: platform status (no auth).
 */
async function getStatus(req, res) {
  try {
    const region = req.query.region || "eu";
    const data = await getPlatformStatus(region);
    return res.json(data);
  } catch (err) {
    console.error("[Valorant getStatus]", err?.message || err);
    const status = err.response?.status ?? err.response?.statusCode;
    return res
      .status(status && status >= 400 && status < 600 ? status : 500)
      .json({ message: err.message || "Failed to load status" });
  }
}

/**
 * GET /api/valorant/leaderboard?region=eu
 * val-content-v1 + val-ranked-v1: current act leaderboard (no auth).
 */
async function getLeaderboardData(req, res) {
  try {
    const region = req.query.region || "eu";
    const actIdParam = req.query.actId || null;
    let actId = actIdParam;
    let content = null;
    if (!actId) {
      content = await getContent(region);
      actId = getCurrentActId(content);
      if (!actId) {
        const keys = content ? Object.keys(content) : [];
        console.log("[Valorant leaderboard] No act ID from content. Keys:", keys.join(", "));
        return res.json({ actId: null, players: [], actName: null, error: "No current act in content. Try ?actId=<act-uuid> if you have one." });
      }
    }
    const leaderboard = await getLeaderboard(region, actId);
    const players = leaderboard?.players || leaderboard?.Players || [];
    let actName = null;
    if (content) {
      const acts = content.acts || content.Acts || content.Seasons?.filter((s) => (s.Type || s.type) === "act") || [];
      const actEntry = acts.find((a) => (a.id || a.ID) === actId);
      actName = actEntry?.name || actEntry?.Name || null;
    }
    return res.json({ actId, actName, players });
  } catch (err) {
    console.error("[Valorant getLeaderboard]", err?.message || err);
    const status = err.response?.status ?? err.response?.statusCode;
    return res
      .status(status && status >= 400 && status < 600 ? status : 500)
      .json({ message: err.message || "Failed to load leaderboard" });
  }
}

module.exports = {
  linkAccount,
  listPlayers,
  getPlayerStats,
  unlinkAccount,
  getStatus,
  getLeaderboardData,
  MATCHES_CHANNEL_ID,
};
