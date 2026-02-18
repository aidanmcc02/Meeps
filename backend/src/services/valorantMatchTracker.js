/**
 * Polls Riot API for new Valorant matches for linked Meeps users
 * and posts updates to the #matches text channel in the app.
 */

const { pool } = require("../config/db");
const {
  getMatchList,
  getMatch,
  getMatchPlayerSummary,
} = require("./valorantService");
const { postMessageToChannel } = require("../websocket/websocketServer");

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const QUEUE = "competitive";
const MATCHES_CHANNEL_ID = "matches";

let pollInterval = null;

function isConfigured() {
  const demo = process.env.VALORANT_DEMO_MODE === "1" || process.env.VALORANT_DEMO_MODE === "true";
  return Boolean(process.env.RIOT_API_KEY) && !demo;
}

async function getLinkedUsers() {
  try {
    const result = await pool.query(
      `SELECT v.user_id, v.riot_puuid, v.game_name, v.tag_line, v.region,
              COALESCE(u.display_name, 'User ' || v.user_id) AS display_name
       FROM valorant_links v
       JOIN users u ON u.id = v.user_id`
    );
    return result.rows;
  } catch (err) {
    if (err.code === "42P01") return [];
    throw err;
  }
}

async function isMatchAlreadyPosted(matchId, puuid) {
  const result = await pool.query(
    "SELECT 1 FROM valorant_tracked_matches WHERE match_id = $1 AND puuid = $2",
    [matchId, puuid]
  );
  return result.rows.length > 0;
}

async function markMatchPosted(matchId, puuid) {
  await pool.query(
    "INSERT INTO valorant_tracked_matches (match_id, puuid) VALUES ($1, $2) ON CONFLICT (match_id, puuid) DO NOTHING",
    [matchId, puuid]
  );
}

function buildMatchMessageContent(summary) {
  const resultText = summary.won ? "Victory" : "Defeat";
  const resultEmoji = summary.won ? "✅" : "❌";
  const lines = [
    `## ${resultEmoji} ${resultText} — ${summary.gameName}#${summary.tagLine}`,
    "",
  ];
  if (summary.agentIcon) {
    lines.push(`![${summary.agentName}](${summary.agentIcon})`);
    lines.push("");
  }
  lines.push(`**Rank:** ${summary.rankName}  ·  **Score:** ${summary.scoreline}`);
  lines.push(`**K/D/A:** ${summary.kills}/${summary.deaths}/${summary.assists}  ·  **Combat score:** ${summary.score}`);
  if (summary.rrChange != null) {
    lines.push(`**RR:** ${summary.rrChange >= 0 ? "+" : ""}${summary.rrChange}`);
  }
  return lines.join("\n");
}

async function processLinkedUser(link) {
  const { user_id, riot_puuid, region, display_name } = link;
  let history;
  try {
    history = await getMatchList(riot_puuid, region, QUEUE, 0, 10);
  } catch (err) {
    console.warn("[Valorant Tracker] getMatchList failed for", link.game_name, err.message);
    return;
  }
  if (!history || history.length === 0) return;

  for (const entry of history) {
    const matchId = entry.matchId;
    if (!matchId) continue;
    const already = await isMatchAlreadyPosted(matchId, riot_puuid);
    if (already) continue;

    let match;
    try {
      match = await getMatch(matchId, region);
    } catch (err) {
      console.warn("[Valorant Tracker] getMatch failed", matchId, err.message);
      continue;
    }

    const summary = await getMatchPlayerSummary(match, riot_puuid);
    if (!summary) continue;

    try {
      const content = buildMatchMessageContent(summary);
      await postMessageToChannel(MATCHES_CHANNEL_ID, user_id, display_name, content);
      await markMatchPosted(matchId, riot_puuid);
    } catch (err) {
      console.warn("[Valorant Tracker] postMessageToChannel failed", err.message);
    }
  }
}

async function pollOnce() {
  if (!isConfigured()) return;
  try {
    const links = await getLinkedUsers();
    for (const link of links) {
      await processLinkedUser(link);
    }
  } catch (err) {
    console.warn("[Valorant Tracker] poll error", err.message);
  }
}

function startTracker() {
  if (pollInterval) return;
  if (!isConfigured()) {
    console.log("[Valorant Tracker] Not started: RIOT_API_KEY not set");
    return;
  }
  pollInterval = setInterval(pollOnce, POLL_INTERVAL_MS);
  console.log("[Valorant Tracker] Started polling every", POLL_INTERVAL_MS / 1000, "seconds");
  pollOnce();
}

function stopTracker() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

module.exports = {
  startTracker,
  stopTracker,
  pollOnce,
  getLinkedUsers,
};
