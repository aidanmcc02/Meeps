/**
 * Backfills bannerUrl on Diana match embeds when a user sets their league_username.
 * Supports both messages with stored embed and legacy markdown content.
 */

const db = require("../config/db");
const { broadcastMessageUpdate } = require("../websocket/websocketServer");

const MATCHES_CHANNEL = "matches";
const DDRAGON_VERSION = "14.24.1";
const CDRAGON_RANKED = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/ranked-emblem";
const RANK_TIERS = ["iron", "bronze", "silver", "gold", "platinum", "emerald", "diamond", "master", "grandmaster", "challenger"];
const RESULT_COLORS = { win: 0x28a745, lose: 0xe74c3c, remake: 0xe67e22 };

/** Extract League username from a stored embed (same logic as Diana payload extraction). */
function extractLeagueUsernameFromEmbed(embed) {
  if (!embed || typeof embed !== "object") return null;
  const direct = embed.summonerName || embed.gameName || embed.summoner_name || embed.game_name;
  if (direct && typeof direct === "string") {
    const t = String(direct).trim();
    if (t) return t;
  }
  const fields = Array.isArray(embed.fields) ? embed.fields : [];
  const summonerFieldNames = ["summoner", "player", "username", "riot", "account"];
  for (const f of fields) {
    const name = (f.name || "").toLowerCase().trim();
    const value = (f.value || "").trim();
    if (name.includes("champion")) continue;
    if (value && summonerFieldNames.some((n) => name.includes(n))) return value;
  }
  // DeepLol URL: .../summoner/euw/FM%20Stew-MEEPS → FM Stew#MEEPS
  const url = (embed.url || "").trim();
  const urlMatch = url.match(/\/summoner\/[^/]+\/([^?#]+)/i);
  if (urlMatch) {
    try {
      let id = decodeURIComponent(urlMatch[1].trim());
      // DeepLol uses GameName-Tag; Riot uses GameName#Tag. Convert last hyphen to #
      const lastHyphen = id.lastIndexOf("-");
      if (lastHyphen > 0) {
        const after = id.slice(lastHyphen + 1);
        if (/^[A-Za-z0-9]{2,6}$/.test(after)) id = id.slice(0, lastHyphen) + "#" + after;
      }
      if (id) return id;
    } catch (_) {}
  }
  // Description: "FM Stew has completed a match!"
  const desc = (embed.description || "").trim();
  const descMatch = desc.match(/^(.+?)\s+has completed a match!$/i);
  if (descMatch) {
    const name = descMatch[1].trim();
    if (name && name.length >= 2) return name;
  }
  return null;
}

/** Parse legacy Diana markdown content into embed + summoner. Returns null if not parseable. */
function parseLegacyDianaContent(content, createdAt) {
  if (!content || typeof content !== "string") return null;
  const trimmed = content.trim();
  if (!trimmed) return null;

  const blocks = trimmed.split(/\n\n+/);
  const embed = { title: null, description: null, url: null, fields: [], timestamp: createdAt };
  let summonerName = null;

  let i = 0;
  if (i < blocks.length) {
    const titleMatch = blocks[i].match(/^\*\*(.+)\*\*$/s);
    if (titleMatch) {
      embed.title = titleMatch[1].trim();
      i++;
    }
  }
  if (i < blocks.length && !blocks[i].match(/^\*\*/) && !blocks[i].match(/^\[.+\]\(.+\)$/)) {
    embed.description = blocks[i].trim();
    i++;
  }

  let foundLink = false;
  for (; i < blocks.length; i++) {
    const block = blocks[i].trim();
    const linkMatch = block.match(/^\[([^\]]*)\]\((https?:\/\/[^)]+)\)$/);
    if (linkMatch && !foundLink) {
      embed.url = linkMatch[2];
      foundLink = true;
      continue;
    }
    const fieldMatch = block.match(/^\*\*(.+?)\*\*\s+(.+)$/s);
    if (fieldMatch) {
      const name = fieldMatch[1].trim();
      const value = fieldMatch[2].trim();
      if (name && value) {
        const nameLower = name.toLowerCase();
        if ((nameLower.includes("summoner") || nameLower.includes("player") || nameLower.includes("username") || nameLower.includes("riot") || nameLower.includes("account")) && !nameLower.includes("champion")) {
          summonerName = value;
        }
        if (nameLower.includes("result") && !embed.colorHex) {
          const v = value.toLowerCase();
          if (v.includes("win")) embed.colorHex = RESULT_COLORS.win;
          else if (v.includes("lose") || v.includes("loss")) embed.colorHex = RESULT_COLORS.lose;
          else if (v.includes("remake")) embed.colorHex = RESULT_COLORS.remake;
        }
        embed.fields.push({ name, value, inline: true });
      }
    }
  }

  const isRankChange = embed.title && /promotion|demotion/.test(embed.title.toLowerCase());
  if (embed.title) {
    const t = embed.title.toLowerCase();
    if (t.includes("promotion")) embed.colorHex = embed.colorHex ?? 0x28a745;
    else if (t.includes("demotion")) embed.colorHex = embed.colorHex ?? 0xe74c3c;
  }

  let champUrl = null;
  let rankUrl = null;
  for (const f of embed.fields) {
    const n = (f.name || "").toLowerCase();
    const v = f.value || "";
    if ((n.includes("champion") || n.includes("champ")) && v) {
      const id = v.trim().replace(/[''.]/g, "").split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
      if (id) champUrl = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${id}.png`;
    }
    if ((n.includes("rank change") || n.includes("rank update") || n.includes("rank")) && v) {
      const tier = v.trim().split(/\s+/)[0].toLowerCase();
      if (RANK_TIERS.includes(tier)) rankUrl = `${CDRAGON_RANKED}/emblem-${tier}.png`;
    }
  }
  embed.thumbnailUrl = isRankChange && rankUrl ? rankUrl : (champUrl || rankUrl);

  if (!embed.title && embed.fields.length === 0 && !embed.description) return null;
  if (!summonerName) summonerName = extractLeagueUsernameFromEmbed(embed);
  return { embed, summonerName };
}

/** Normalize for matching: lowercase, trim, remove spaces (FM Stew vs FMStew both -> fmstew). */
function normalizeForMatch(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, "");
}

/** Check if embed's league username matches the user's league_username (case-insensitive, tag-optional, space-flexible). */
function embedMatchesUser(embed, userLeagueUsername) {
  const embedUsername = extractLeagueUsernameFromEmbed(embed);
  if (!embedUsername || !userLeagueUsername) return false;
  const embedNorm = embedUsername.trim().toLowerCase();
  const userNorm = userLeagueUsername.trim().toLowerCase();
  const embedGameName = embedNorm.split("#")[0];
  const userGameName = userNorm.split("#")[0];
  const embedNormNoSp = normalizeForMatch(embedGameName);
  const userNormNoSp = normalizeForMatch(userGameName);
  return (
    embedNorm === userNorm ||
    embedGameName === userGameName ||
    embedNormNoSp === userNormNoSp
  );
}

function leagueUsernameMatches(embedOrParsed, userLeagueUsername) {
  const toMatch = embedOrParsed && typeof embedOrParsed === "object"
    ? extractLeagueUsernameFromEmbed(embedOrParsed)
    : embedOrParsed;
  if (!toMatch || !userLeagueUsername) return false;
  const embedNorm = String(toMatch).trim().toLowerCase();
  const userNorm = String(userLeagueUsername).trim().toLowerCase();
  const embedGameName = embedNorm.split("#")[0];
  const userGameName = userNorm.split("#")[0];
  const embedNormNoSp = normalizeForMatch(embedGameName);
  const userNormNoSp = normalizeForMatch(userGameName);
  return (
    embedNorm === userNorm ||
    embedGameName === userGameName ||
    embedNormNoSp === userNormNoSp
  );
}

/** Check if summoner matches any of the given league usernames. */
function summonerMatchesAny(summoner, leagueUsernames) {
  if (!summoner || !String(summoner).trim()) return false;
  for (const u of leagueUsernames) {
    if (u && leagueUsernameMatches(summoner, u)) return true;
  }
  return false;
}

/** Infer Win/Lose/Remake from embed fields (Result) or title. Returns "win" | "lose" | null. */
function inferMatchResult(embed) {
  if (!embed || typeof embed !== "object") return null;
  const fields = Array.isArray(embed.fields) ? embed.fields : [];
  for (const f of fields) {
    const name = (f.name || "").toLowerCase();
    const value = String(f.value || "").toLowerCase();
    if (name.includes("result") && value) {
      if (value.includes("win")) return "win";
      if (value.includes("lose") || value.includes("loss")) return "lose";
      if (value.includes("remake")) return "lose";
    }
  }
  const title = (embed.title || "").toLowerCase();
  if (title.includes("promotion") || title.includes("win")) return "win";
  if (title.includes("demotion") || title.includes("lose") || title.includes("loss")) return "lose";
  return null;
}

/**
 * Update all Diana match embeds in #matches that match the user's league_username.
 * Uses winGifUrl for wins, loseGifUrl for losses/remakes; falls back to bannerUrl if specific URL not set.
 * Also removes bannerUrl from embeds whose summoner doesn't match any user (revert to solid).
 * Returns { updated, checked, summonerNamesFound } for diagnostics.
 * @param {string} leagueUsername
 * @param {{ bannerUrl?: string | null, winGifUrl?: string | null, loseGifUrl?: string | null }} opts
 */
async function backfillBannersForUser(leagueUsername, opts = {}) {
  const bannerUrl = opts?.bannerUrl ?? null;
  const winGifUrl = opts?.winGifUrl ?? null;
  const loseGifUrl = opts?.loseGifUrl ?? null;
  const result = { updated: 0, checked: 0, summonerNamesFound: [] };
  const trimmed = leagueUsername ? leagueUsername.trim() : "";

  const seenSummoners = new Set();
  const usersResult = await db.query(
    `SELECT league_username FROM users WHERE user_type = 'user' AND TRIM(COALESCE(league_username, '')) != ''`
  );
  const allLeagueUsernames = usersResult.rows.map((r) => (r.league_username || "").trim()).filter(Boolean);

  try {
    const dbResult = await db.query(
      `SELECT id, channel, sender_name, sender_id, content, embed, created_at
       FROM messages
       WHERE channel = $1 AND sender_name = 'Diana'`,
      [MATCHES_CHANNEL]
    );

    for (const row of dbResult.rows) {
      result.checked++;
      let embed = null;
      let matchesCurrentUser = false;

      if (row.embed) {
        try {
          embed = typeof row.embed === "string" ? JSON.parse(row.embed) : row.embed;
        } catch {
          embed = null;
        }
        if (embed && typeof embed === "object") {
          const found = extractLeagueUsernameFromEmbed(embed);
          if (found && !seenSummoners.has(found)) {
            seenSummoners.add(found);
            result.summonerNamesFound.push(found);
          }
          if (trimmed) matchesCurrentUser = embedMatchesUser(embed, trimmed);
        }
      }

      if (!matchesCurrentUser && row.content) {
        const parsed = parseLegacyDianaContent(row.content, row.created_at);
        if (parsed?.summonerName) {
          if (!seenSummoners.has(parsed.summonerName)) {
            seenSummoners.add(parsed.summonerName);
            result.summonerNamesFound.push(parsed.summonerName);
          }
          if (trimmed && leagueUsernameMatches(parsed.summonerName, trimmed)) {
            embed = parsed.embed;
            matchesCurrentUser = true;
          }
        }
      }

      if (!embed) continue;

      const summoner = extractLeagueUsernameFromEmbed(embed) || parseLegacyDianaContent(row.content, row.created_at)?.summonerName;
      const matchesAnyUser = summoner ? summonerMatchesAny(summoner, allLeagueUsernames) : false;

      let updatedEmbed = { ...embed };
      let changed = false;

      if (matchesCurrentUser && trimmed) {
        const matchResult = inferMatchResult(embed);
        const urlToUse =
          matchResult === "win"
            ? (winGifUrl || bannerUrl)
            : matchResult === "lose"
              ? (loseGifUrl || bannerUrl)
              : bannerUrl;
        if (urlToUse) {
          updatedEmbed.bannerUrl = urlToUse;
          changed = true;
        } else {
          if (updatedEmbed.bannerUrl) {
            delete updatedEmbed.bannerUrl;
            changed = true;
          }
        }
      } else if (updatedEmbed.bannerUrl && !matchesAnyUser) {
        delete updatedEmbed.bannerUrl;
        changed = true;
      }

      if (!changed) continue;

      const embedJson = JSON.stringify(updatedEmbed);
      await db.query(
        "UPDATE messages SET embed = $2::jsonb WHERE id = $1",
        [row.id, embedJson]
      );
      result.updated++;

      broadcastMessageUpdate({
        id: row.id,
        channel: row.channel,
        sender: row.sender_name,
        senderId: row.sender_id ?? undefined,
        content: row.content,
        embed: updatedEmbed,
        createdAt: row.created_at
      });
    }
  } catch (err) {
    console.error("[diana-embed] Backfill banners failed:", err.message);
  }
  return result;
}

module.exports = { backfillBannersForUser, extractLeagueUsernameFromEmbed, embedMatchesUser };
