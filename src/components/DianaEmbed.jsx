import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Result colors: win=green, lose=red, remake=orange. Infer from content when possible. */
const RESULT_COLORS = { win: 0x28a745, lose: 0xe74c3c, remake: 0xe67e22 };

/** Data Dragon version for champion/rank icons (update periodically) */
const DDRAGON_VERSION = "14.24.1";

/** Display name -> Riot Data Dragon champion id (edge cases where they differ) */
const CHAMPION_NAME_TO_ID = {
  "monkey king": "MonkeyKing",
  "nunu & willump": "Nunu",
  "dr. mundo": "DrMundo",
  "cho'gath": "Chogath",
  "rek'sai": "RekSai",
  "jarvan iv": "JarvanIV",
  "master yi": "MasterYi",
  "miss fortune": "MissFortune",
  "tahm kench": "TahmKench",
  "xin zhao": "XinZhao",
  "twisted fate": "TwistedFate",
  "lee sin": "LeeSin",
  "aurelion sol": "AurelionSol",
  "bel'veth": "Belveth",
  "kog'maw": "KogMaw",
  "vel'koz": "Velkoz",
  "renata glasc": "Renata"
};

/** Convert champion display name to Data Dragon id for icon URL */
function championNameToId(displayName) {
  if (!displayName || typeof displayName !== "string") return null;
  const normalized = displayName.trim().toLowerCase();
  const override = CHAMPION_NAME_TO_ID[normalized];
  if (override) return override;
  return displayName
    .trim()
    .replace(/[''.]/g, "")
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

/** Small thumbnail in top-right (champion or rank icon), hides on load error */
function EmbedThumbnail({ src, className = "" }) {
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt=""
      className={`w-16 h-16 rounded-lg object-cover ring-1 ring-black/10 dark:ring-white/10 shadow-md flex-shrink-0 ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

/** Community Dragon base for rank emblems */
const CDRAGON_RANKED = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/ranked-emblem";

/** Valid rank tiers for emblem filenames */
const RANK_TIERS = ["iron", "bronze", "silver", "gold", "platinum", "emerald", "diamond", "master", "grandmaster", "challenger"];

/** Build rank emblem URL from tier (e.g. "Gold", "Platinum 1" -> gold, platinum) */
export function getRankEmblemUrl(tierOrRankStr) {
  if (!tierOrRankStr || typeof tierOrRankStr !== "string") return null;
  const tier = tierOrRankStr.trim().split(/\s+/)[0].toLowerCase();
  if (RANK_TIERS.includes(tier)) {
    return `${CDRAGON_RANKED}/emblem-${tier}.png`;
  }
  return null;
}

/** Build Data Dragon champion icon URL from display name */
export function getChampionIconUrl(championDisplayName) {
  const id = championNameToId(championDisplayName);
  if (!id) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${id}.png`;
}

/**
 * Parse legacy Diana markdown (pre-embed) into an embed structure for nice display.
 * Format: **Title** \n\n Description \n\n **Field** value \n\n [Link](url)
 * @param {string} content - Legacy markdown content
 * @param {string} [createdAt] - Message timestamp for footer
 * @returns {object|null} Embed object or null if not parseable as Diana format
 */
export function parseLegacyDianaMarkdown(content, createdAt) {
  if (!content || typeof content !== "string") return null;
  const trimmed = content.trim();
  if (!trimmed) return null;

  const blocks = trimmed.split(/\n\n+/);
  const embed = { title: null, description: null, url: null, fields: [], timestamp: createdAt };

  let i = 0;

  // First block: **Title** (bold only)
  if (i < blocks.length) {
    const titleMatch = blocks[i].match(/^\*\*(.+)\*\*$/s);
    if (titleMatch) {
      embed.title = titleMatch[1].trim();
      i++;
    }
  }

  // Second block: description (no **, not a link)
  if (i < blocks.length && !blocks[i].match(/^\*\*/) && !blocks[i].match(/^\[.+\]\(.+\)$/)) {
    embed.description = blocks[i].trim();
    i++;
  }

  // Remaining: fields **Name** value or [Link](url)
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
        // Infer color from Result field
        if (name.toLowerCase().includes("result") && !embed.colorHex) {
          const v = value.toLowerCase();
          if (v.includes("win")) embed.colorHex = RESULT_COLORS.win;
          else if (v.includes("lose") || v.includes("loss")) embed.colorHex = RESULT_COLORS.lose;
          else if (v.includes("remake")) embed.colorHex = RESULT_COLORS.remake;
        }
        embed.fields.push({ name, value, inline: true });
        if ((name.toLowerCase().includes("champion") || name.toLowerCase().includes("champ")) && value) {
          embed._championUrl = embed._championUrl ?? getChampionIconUrl(value);
        }
        if ((name.toLowerCase().includes("rank change") || name.toLowerCase().includes("rank update")) && value) {
          embed._rankUrl = embed._rankUrl ?? getRankEmblemUrl(value);
        }
        if (name.toLowerCase().includes("rank") && value && !embed._rankUrl) {
          embed._rankUrl = getRankEmblemUrl(value);
        }
      }
    }
  }

  const isRankChange = embed.title && /promotion|demotion/.test(embed.title.toLowerCase());
  if (embed.title) {
    const t = embed.title.toLowerCase();
    if (t.includes("promotion")) embed.colorHex = embed.colorHex ?? 0x28a745;
    else if (t.includes("demotion")) embed.colorHex = embed.colorHex ?? 0xe74c3c;
  }
  embed.thumbnailUrl = embed.thumbnailUrl ?? (isRankChange && embed._rankUrl
    ? embed._rankUrl
    : (embed._championUrl ?? embed._rankUrl));
  delete embed._championUrl;
  delete embed._rankUrl;

  if (!embed.title && embed.fields.length === 0 && !embed.description) return null;
  return embed;
}

/**
 * Discord-style embed for Diana messages (match summaries, rank changes, etc.).
 * Renders title, description, thumbnail (champion/rank icon), fields, footer with color accent.
 */
function DianaEmbed({ embed }) {
  if (!embed || typeof embed !== "object") return null;

  const {
    title,
    description,
    url,
    colorHex,
    thumbnailUrl,
    fields = [],
    footer,
    text,
    timestamp,
    bannerUrl
  } = embed;

  const borderColor = (() => {
    if (colorHex == null) return "#6366f1";
    if (typeof colorHex === "string" && colorHex.startsWith("#")) return colorHex;
    if (typeof colorHex === "string") return `#${colorHex.replace(/^#/, "")}`;
    const hex = Number(colorHex).toString(16).padStart(6, "0");
    return `#${hex}`;
  })();

  const formatTimestamp = (ts) => {
    if (!ts) return null;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const inlineFields = fields.filter((f) => f.inline);
  const blockFields = fields.filter((f) => !f.inline);

  const bgStyle = bannerUrl
    ? {
        backgroundImage: `url(${bannerUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center"
      }
    : {};

  return (
    <div
      className={`diana-embed mt-1.5 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-xl shadow-gray-200/60 dark:shadow-black/30 hover:shadow-2xl transition-shadow duration-200 ${!bannerUrl ? "bg-white/90 dark:bg-gray-800/95" : ""}`}
      style={{
        borderLeftWidth: "5px",
        borderLeftColor: borderColor,
        ...bgStyle
      }}
    >
      <div
        className={`relative p-4 ${bannerUrl ? "bg-black/50 text-white [&_.text-gray-500]:!text-gray-300 [&_.text-gray-400]:!text-gray-300 [&_.text-gray-600]:!text-gray-200 [&_.text-gray-900]:!text-white [&_.dark\\:text-white]:!text-white [&_.text-gray-800]:!text-gray-100 [&_.text-gray-700]:!text-gray-200 [&_a]:!text-indigo-200 [&_a:hover]:!text-indigo-100" : ""}`}
      >
        {thumbnailUrl && (
          <div className="absolute top-3 right-3">
            <EmbedThumbnail src={thumbnailUrl} />
          </div>
        )}
        <div className={`flex-1 min-w-0 ${thumbnailUrl ? "pr-20" : ""}`}>
          {title && (
            <div className="mb-1">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-base font-bold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-2 py-0.5 -mx-2 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                  style={{ color: "inherit" }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]} className="inline [&_p]:inline [&_*]:inline">
                    {title}
                  </ReactMarkdown>
                  <span className="text-indigo-500 dark:text-indigo-400 text-sm opacity-90">↗</span>
                </a>
              ) : (
                <span className="text-base font-bold text-gray-900 dark:text-white">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} className="inline [&_p]:inline [&_*]:inline">
                    {title}
                  </ReactMarkdown>
                </span>
              )}
            </div>
          )}
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              {description}
            </p>
          )}
          {text && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              {text}
            </p>
          )}

          {inlineFields.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 mb-2">
              {inlineFields.map((f, i) => (
                <div key={i} className="min-w-0">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block truncate">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} className="inline [&_p]:inline [&_*]:inline text-inherit">
                      {f.name || ""}
                    </ReactMarkdown>
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} className="inline [&_p]:inline [&_*]:inline text-inherit">
                      {f.value || ""}
                    </ReactMarkdown>
                  </span>
                </div>
              ))}
            </div>
          )}

          {blockFields.length > 0 && (
            <div className="space-y-1.5">
              {blockFields.map((f, i) => (
                <div key={i} className="py-1 border-t border-gray-100 dark:border-gray-700/80 first:border-t-0 first:pt-0">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-0.5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} className="inline [&_p]:inline [&_*]:inline text-inherit">
                      {f.name || ""}
                    </ReactMarkdown>
                  </span>
                  <span className="text-sm text-gray-800 dark:text-gray-200">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} className="inline [&_p]:inline [&_*]:inline text-inherit">
                      {f.value || ""}
                    </ReactMarkdown>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {(footer || timestamp) && (
        <div className="px-4 py-2 bg-gray-50/80 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700/80 flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{footer || ""}</span>
          {timestamp && (
            <span className="shrink-0">{formatTimestamp(timestamp)}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default DianaEmbed;
