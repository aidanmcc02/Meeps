/**
 * Valorant data via Riot API and community assets.
 * Requires RIOT_API_KEY (from developer.riotgames.com).
 */

const axios = require("axios");

const RIOT_API_KEY = process.env.RIOT_API_KEY || "";
const VALORANT_API_BASE = "https://valorant-api.com/v1";

// Riot: account is on regional cluster (americas, europe, asia); match is on platform (na, eu, ap, kr, br, latam)
const REGION_TO_CLUSTER = {
  na: "americas",
  br: "americas",
  latam: "americas",
  eu: "europe",
  ap: "asia",
  kr: "asia",
};

const RANK_TIER_NAMES = {
  0: "Unranked",
  1: "Unused 1",
  2: "Unused 2",
  3: "Iron 1",
  4: "Iron 2",
  5: "Iron 3",
  6: "Bronze 1",
  7: "Bronze 2",
  8: "Bronze 3",
  9: "Silver 1",
  10: "Silver 2",
  11: "Silver 3",
  12: "Gold 1",
  13: "Gold 2",
  14: "Gold 3",
  15: "Platinum 1",
  16: "Platinum 2",
  17: "Platinum 3",
  18: "Diamond 1",
  19: "Diamond 2",
  20: "Diamond 3",
  21: "Ascendant 1",
  22: "Ascendant 2",
  23: "Ascendant 3",
  24: "Immortal 1",
  25: "Immortal 2",
  26: "Immortal 3",
  27: "Radiant",
};

let agentCache = null;
let rankIconCache = null;

async function riotRequest(method, url, options = {}) {
  if (!RIOT_API_KEY) {
    throw new Error("RIOT_API_KEY is not set");
  }
  const { data } = await axios({
    method,
    url,
    headers: {
      "X-Riot-Token": RIOT_API_KEY,
      "Accept": "application/json",
      ...options.headers,
    },
    timeout: 15000,
    ...options,
  });
  return data;
}

function getAccountBase(region) {
  const cluster = REGION_TO_CLUSTER[region] || "americas";
  return `https://${cluster}.api.riotgames.com`;
}

function getValorantBase(region) {
  const r = region || "eu";
  return `https://${r}.api.riotgames.com`;
}

/**
 * Resolve Riot account by game name and tag. Returns puuid and region (from default or inferred).
 */
async function getAccountByRiotId(gameName, tagLine, defaultRegion = "eu") {
  const base = getAccountBase(defaultRegion);
  const encodedName = encodeURIComponent(gameName);
  const encodedTag = encodeURIComponent(tagLine);
  const data = await riotRequest(
    "GET",
    `${base}/riot/account/v1/accounts/by-riot-id/${encodedName}/${encodedTag}`
  );
  return {
    puuid: data.puuid,
    gameName: data.gameName,
    tagLine: data.tagLine,
    region: defaultRegion,
  };
}

/**
 * Get match list for a player (recent matches).
 */
async function getMatchList(puuid, region, queue = "competitive", start = 0, end = 15) {
  const base = getValorantBase(region);
  const data = await riotRequest(
    "GET",
    `${base}/val/match/v1/matchlists/by-puuid/${puuid}?startIndex=${start}&endIndex=${end}&queue=${queue}`
  );
  return data?.history || [];
}

/**
 * Get full match details.
 */
async function getMatch(matchId, region) {
  const base = getValorantBase(region);
  return riotRequest("GET", `${base}/val/match/v1/matches/${matchId}`);
}

/**
 * Fetch agent list from valorant-api.com (display names and icons).
 */
async function getAgentMap() {
  if (agentCache) return agentCache;
  const { data } = await axios.get(`${VALORANT_API_BASE}/agents`, {
    params: { isPlayableCharacter: true },
    timeout: 10000,
  });
  const map = {};
  for (const a of data.data || []) {
    map[a.uuid] = {
      name: a.displayName,
      icon: a.displayIcon,
    };
  }
  agentCache = map;
  return map;
}

/**
 * Get rank display name from tier number.
 */
function getRankName(tier) {
  return RANK_TIER_NAMES[Number(tier)] ?? `Tier ${tier}`;
}

/**
 * Rank tier icons from valorant-api (competitivetiers). Optional; we can use emoji or text.
 */
async function getRankIconUrl(tier) {
  if (rankIconCache && rankIconCache[tier]) return rankIconCache[tier];
  try {
    const { data } = await axios.get(`${VALORANT_API_BASE}/competitivetiers`, { timeout: 5000 });
    const tiers = data.data?.[data.data.length - 1]?.tiers || [];
    if (!rankIconCache) rankIconCache = {};
    for (const t of tiers) {
      rankIconCache[t.tier] = t.largeIcon;
    }
    return rankIconCache[tier] || null;
  } catch {
    return null;
  }
}

/**
 * Build a summary for one player in a match (for display or channel post).
 */
async function getMatchPlayerSummary(match, puuid) {
  const agents = await getAgentMap();
  const red = match.teams?.red ?? {};
  const blue = match.teams?.blue ?? {};
  const allPlayers = [
    ...(match.players?.filter((p) => p.teamId === "Red") || []),
    ...(match.players?.filter((p) => p.teamId === "Blue") || []),
  ];
  const player = allPlayers.find((p) => p.puuid === puuid);
  if (!player) return null;

  const characterId = player.characterId || "";
  const agentInfo = agents[characterId] || { name: "Unknown", icon: null };
  const stats = player.stats || {};
  const kills = stats.kills ?? 0;
  const deaths = stats.deaths ?? 0;
  const assists = stats.assists ?? 0;
  const score = stats.score ?? 0;
  const roundsPlayed = stats.roundsPlayed ?? 0;

  const redWins = red.roundsWon ?? 0;
  const blueWins = blue.roundsWon ?? 0;
  const playerWon = (player.teamId === "Red" && redWins > blueWins) ||
    (player.teamId === "Blue" && blueWins > redWins);
  const scoreline = `${redWins}-${blueWins}`;

  const competitiveTier = player.competitiveTier ?? 0;
  const rankName = getRankName(competitiveTier);
  const rankIcon = await getRankIconUrl(competitiveTier);

  return {
    gameName: player.gameName,
    tagLine: player.tagLine,
    agentName: agentInfo.name,
    agentIcon: agentInfo.icon,
    rankName,
    rankIcon,
    competitiveTier,
    won: playerWon,
    scoreline,
    kills,
    deaths,
    assists,
    score,
    roundsPlayed,
    matchId: match.matchInfo?.matchId,
    queueId: match.matchInfo?.queueId,
    isRanked: match.matchInfo?.isRanked ?? false,
    startTime: match.matchInfo?.gameStartMillis,
  };
}

/**
 * val-content-v1: Get game content (acts, agents, etc.). Use for current act ID.
 */
async function getContent(region, locale = "en-US") {
  const base = getValorantBase(region);
  return riotRequest(
    "GET",
    `${base}/val/content/v1/contents?locale=${encodeURIComponent(locale)}`
  );
}

/**
 * val-ranked-v1: Get leaderboard for an act.
 */
async function getLeaderboard(region, actId) {
  const base = getValorantBase(region);
  return riotRequest(
    "GET",
    `${base}/val/ranked/v1/leaderboards/by-act/${actId}`
  );
}

/**
 * val-status-v1: Get platform status.
 */
async function getPlatformStatus(region) {
  const base = getValorantBase(region);
  return riotRequest("GET", `${base}/val/status/v1/platform-data`);
}

/**
 * Get current act ID from content (first active act, or latest act).
 */
function getCurrentActId(content) {
  const acts = content?.acts || content?.Acts || [];
  const active = acts.find((a) => a.isActive || a.IsActive);
  if (active?.id || active?.ID) return active.id || active.ID;
  if (acts.length > 0) return acts[acts.length - 1].id || acts[acts.length - 1].ID;
  return null;
}

module.exports = {
  getAccountByRiotId,
  getMatchList,
  getMatch,
  getAgentMap,
  getRankName,
  getRankIconUrl,
  getMatchPlayerSummary,
  getContent,
  getLeaderboard,
  getPlatformStatus,
  getCurrentActId,
  REGION_TO_CLUSTER,
  RANK_TIER_NAMES,
};
