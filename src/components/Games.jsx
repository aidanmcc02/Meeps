import React, { useEffect, useMemo, useRef, useState } from "react";
import Neon from "./Neon";

function formatTimestamp(ts) {
  if (!ts) return null;
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return "—";
  const total = Math.max(0, Math.floor(Number(seconds)));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}m ${secs}s`;
}

const DEFAULT_DDRAGON_VERSION = "16.4.1";
const DDRAGON_BASE = "https://ddragon.leagueoflegends.com/cdn";
const CDRAGON_BASE =
  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1";
const PLAYER_FILTER_STORAGE_KEY = "meeps_diana_player_filter";

function getDdragonVersionFromUrl(url) {
  if (!url) return null;
  const match = String(url).match(/cdn\/([^/]+)\//);
  return match?.[1] || null;
}

function getChampionIconUrl(championName, version) {
  if (!championName) return null;
  return `${DDRAGON_BASE}/${version}/img/champion/${championName}.png`;
}

function getItemIconUrl(itemId, version) {
  if (!itemId || Number(itemId) === 0) return null;
  return `${DDRAGON_BASE}/${version}/img/item/${itemId}.png`;
}

function getCdragonItemUrl(itemId) {
  if (!itemId || Number(itemId) === 0) return null;
  return `${CDRAGON_BASE}/items/${itemId}.png`;
}

function formatKdaRatio(kills, deaths, assists) {
  if ([kills, deaths, assists].some((v) => v == null)) return null;
  const ratio = (Number(kills) + Number(assists)) / Math.max(1, Number(deaths));
  return ratio.toFixed(1);
}

function simplifyQueueName(queueName = "") {
  const name = String(queueName).toLowerCase();
  if (name.includes("ranked solo")) return "Ranked Solo/Duo";
  if (name.includes("ranked flex")) return "Ranked Flex";
  if (name.includes("aram")) return "ARAM";
  if (name.includes("swiftplay")) return "Swiftplay";
  if (name.includes("clash")) return "Clash";
  if (name.includes("normal")) return "Normal";
  return queueName || "Match";
}

const RESULT_STYLES = {
  Win: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  Lose: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  Remake:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
};
const RESULT_ROW_STYLES = {
  Win: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-900/20",
  Lose: "border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-900/20",
  Remake:
    "border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-900/20",
};
const RANK_COLORS = {
  UNRANKED: "#95a5a6",
  IRON: "#7f8c8d",
  BRONZE: "#cd7f32",
  SILVER: "#c0c0c0",
  GOLD: "#ffd700",
  PLATINUM: "#40e0d0",
  EMERALD: "#50c878",
  DIAMOND: "#b9f2ff",
  MASTER: "#800080",
  GRANDMASTER: "#8b0000",
  CHALLENGER: "#1e90ff",
};

const TFT_PLACEMENT_STYLES = {
  1: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  2: "bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-200",
  3: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-300",
  4: "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200",
};
const TFT_PLACEMENT_ROW_STYLES = {
  1: "border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-900/20",
  2: "border-gray-200 bg-gray-50/60 dark:border-gray-800/60 dark:bg-gray-900/20",
  3: "border-amber-200 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-900/15",
  4: "border-slate-200 bg-slate-50/60 dark:border-slate-800/60 dark:bg-slate-900/20",
};
const TFT_BOTTOM_ROW =
  "border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-900/20";

function ConquerorMatchCard({ match }) {
  const timestamp = formatTimestamp(match?.gameEndTime || match?.gameCreation);
  const placement = match?.placement ?? match?.place ?? 0;
  const placementStyle =
    TFT_PLACEMENT_STYLES[placement] ??
    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200";
  const rowStyle = TFT_PLACEMENT_ROW_STYLES[placement] ?? TFT_BOTTOM_ROW;
  const gameName = match?.gameName ?? match?.summonerName ?? "Unknown";
  const tagLine = match?.tagLine ? `#${match.tagLine}` : "";
  const gameMode =
    match?.gameMode === "ranked"
      ? "Ranked"
      : match?.gameMode === "double_up"
        ? "Double Up"
        : "Normal";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${rowStyle}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
            {gameName}
            {tagLine && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {" "}
                {tagLine}
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {gameMode}
            {timestamp ? ` · ${timestamp}` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold ${placementStyle}`}
        >
          #{placement}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white/80 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900/60">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Mode
          </div>
          <div className="mt-0.5 text-sm text-gray-800 dark:text-gray-200">
            {gameMode}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white/80 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900/60 sm:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Comp
          </div>
          <div className="mt-0.5 text-sm text-gray-800 dark:text-gray-200">
            {match?.comp ?? match?.composition ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

function DianaMatchCard({
  match,
  detail,
  expanded,
  onToggle,
  ddragonVersion,
  spellMap,
  runeMap,
}) {
  const timestamp = formatTimestamp(match?.gameCreation || match?.gameEndTime);
  const durationSeconds = detail?.gameDuration ?? match?.gameDuration;
  const durationLabel = formatDuration(durationSeconds);
  const summoner = match?.summonerName || "Unknown";
  const resultClass = RESULT_STYLES[match?.result] || RESULT_STYLES.Remake;
  const rowClass = RESULT_ROW_STYLES[match?.result] || RESULT_ROW_STYLES.Remake;
  const rankTier = (match?.rankTier || "").toUpperCase();
  const showRankTier = Boolean(rankTier && rankTier !== "UNRANKED");
  const rankColor = RANK_COLORS[rankTier] || "#94a3b8";
  const isRankedQueue =
    match?.queueName && /ranked\s*(solo|flex)/i.test(String(match.queueName));
  const lpChange =
    isRankedQueue && typeof match?.lpChange === "number"
      ? match.lpChange
      : null;
  const lpChangeLabel =
    lpChange == null ? "—" : `${lpChange > 0 ? "+" : ""}${lpChange} LP`;
  const participant = detail?.participants?.find(
    (p) =>
      (match?.entryPlayerPuuid && p.puuid === match.entryPlayerPuuid) ||
      (!match?.entryPlayerPuuid &&
        (p.riotIdGameName || p.summonerName) === match?.summonerName),
  );
  const kills = participant?.kills ?? null;
  const deaths = participant?.deaths ?? null;
  const assists = participant?.assists ?? null;
  const kdaRatio = formatKdaRatio(kills, deaths, assists);
  const kdaList =
    kills != null && deaths != null && assists != null
      ? `${kills}/${deaths}/${assists}`
      : match?.kda || "0/0/0";
  const totalMinions = Number(participant?.totalMinionsKilled || 0);
  const neutralMinions = Number(participant?.neutralMinionsKilled || 0);
  const totalCs = totalMinions + neutralMinions;
  const csPerMin = durationSeconds
    ? totalCs / (Number(durationSeconds) / 60)
    : null;
  const totalCsLabel = totalCs || totalCs === 0 ? `${totalCs} CS` : "—";
  const spell1Icon =
    participant?.summoner1Id && spellMap?.[participant.summoner1Id];
  const spell2Icon =
    participant?.summoner2Id && spellMap?.[participant.summoner2Id];
  const runeStyles = participant?.perks?.styles || [];
  const primaryStyle = runeStyles[0];
  const secondaryStyle = runeStyles[1];
  const primaryRuneId = primaryStyle?.selections?.[0]?.perk;
  const secondaryStyleId = secondaryStyle?.style;
  const primaryRuneIcon = primaryRuneId && runeMap?.[primaryRuneId];
  const secondaryRuneIcon = secondaryStyleId && runeMap?.[secondaryStyleId];
  const itemIds = participant
    ? Array.from({ length: 7 }, (_, idx) => participant[`item${idx}`])
    : [];
  const itemIdsFull = itemIds.length ? itemIds : [];
  const damageDealt =
    participant?.totalDamageDealtToChampions ??
    participant?.totalDamageDealt ??
    null;
  const visionScore =
    participant?.visionScore != null ? Number(participant.visionScore) : null;
  const visionPerMin =
    visionScore != null && durationSeconds
      ? visionScore / (Number(durationSeconds) / 60)
      : null;
  const queueLabel = simplifyQueueName(match?.queueName);

  return (
    <div className={`rounded-2xl border px-3 py-2 shadow-sm ${rowClass}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-3 text-left"
        aria-expanded={expanded}
      >
        {match?.championImageUrl ? (
          <img
            src={match.championImageUrl}
            alt={match?.champion || "Champion"}
            className="h-9 w-9 rounded-full object-cover ring-2 ring-white/70 dark:ring-gray-900/60"
          />
        ) : null}
        <div className="min-w-[96px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {summoner}
            </span>
            {match?.role ? (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                {match.role}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{queueLabel}</span>
            {durationLabel !== "—" ? <span>• {durationLabel}</span> : null}
            {timestamp ? <span>• {timestamp}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${resultClass}`}
          >
            {match?.result || "Match"}
          </span>
          {lpChange != null ? (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                lpChange < 0
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
              }`}
            >
              {lpChangeLabel}
            </span>
          ) : null}
        </div>
        <div className="ml-4 flex flex-[2] items-center gap-5 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {kdaRatio ? `${kdaRatio} KDA` : "—"}
            </span>
            <span className="text-[11px]">{kdaList}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {csPerMin != null ? `${csPerMin.toFixed(1)} CS/min` : "—"}
            </span>
            <span className="text-[11px]">{totalCsLabel}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {visionPerMin != null ? `${visionPerMin.toFixed(1)} V/min` : "—"}
            </span>
            <span className="text-[11px]">
              {visionScore != null ? `${visionScore} VS` : "—"}
            </span>
          </div>
        </div>
        <div className="mt-2 flex flex-none items-center gap-2">
          <div className="flex flex-col gap-1">
            {[spell1Icon, spell2Icon].map((icon, idx) =>
              icon ? (
                <img
                  key={`spell-${idx}`}
                  src={`${DDRAGON_BASE}/${ddragonVersion}/img/spell/${icon}`}
                  alt="Summoner spell"
                  className="h-7 w-7 rounded-md border border-gray-200 dark:border-gray-700"
                />
              ) : (
                <div
                  key={`spell-${idx}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-gray-200 text-[10px] text-gray-400 dark:border-gray-700"
                >
                  —
                </div>
              ),
            )}
          </div>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {itemIds.length > 0
              ? itemIds.slice(0, 6).map((itemId, idx) => {
                  const icon = getItemIconUrl(itemId, ddragonVersion);
                  return icon ? (
                    <img
                      key={`item-${idx}`}
                      src={icon}
                      alt="Item"
                      className="h-7 w-7 rounded-md border border-gray-200 dark:border-gray-700"
                      onError={(event) => {
                        const target = event.currentTarget;
                        if (target.dataset.fallback === "1") return;
                        target.dataset.fallback = "1";
                        target.src =
                          getCdragonItemUrl(itemId) ||
                          getItemIconUrl(itemId, DEFAULT_DDRAGON_VERSION);
                      }}
                    />
                  ) : (
                    <div
                      key={`item-${idx}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-gray-200 text-[10px] text-gray-400 dark:border-gray-700"
                    >
                      —
                    </div>
                  );
                })
              : Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={`item-empty-${idx}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-gray-200 text-[10px] text-gray-400 dark:border-gray-700"
                  >
                    —
                  </div>
                ))}
          </div>
        </div>
        <div className="mt-2 flex flex-none items-center text-xs text-gray-500 dark:text-gray-400">
          <span
            className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
            style={{
              borderColor: `${rankColor}55`,
              backgroundColor: `${rankColor}22`,
              color: rankColor,
            }}
          >
            {match?.rank || "Unranked"}
          </span>
        </div>
      </button>

      {expanded ? (
        <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-800">
          <div className="grid gap-4 lg:grid-cols-2">
            {[100, 200].map((teamId) => {
              const teamPlayers =
                detail?.participants?.filter((p) => p.teamId === teamId) || [];
              const teamWon = teamPlayers.some((p) => p.win === true);
              const teamPanelClass = teamWon
                ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-900/20"
                : teamPlayers.length > 0
                  ? "border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-900/20"
                  : "border-gray-200 bg-white/80 dark:border-gray-700 dark:bg-gray-900/60";
              return (
                <div
                  key={`team-table-${teamId}`}
                  className={`rounded-xl border p-3 ${teamPanelClass}`}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                    Team {teamId === 100 ? "Blue" : "Red"}{" "}
                    {teamPlayers.length > 0
                      ? teamWon
                        ? "· Win"
                        : "· Loss"
                      : ""}
                  </div>
                  <div className="mt-2 space-y-2">
                    {teamPlayers.length > 0 ? (
                      teamPlayers.map((p) => {
                        const name =
                          p.riotIdGameName || p.summonerName || "Unknown";
                        const role =
                          p.teamPosition ||
                          p.individualPosition ||
                          p.role ||
                          "—";
                        const champIcon = getChampionIconUrl(
                          p.championName,
                          ddragonVersion,
                        );
                        const pkdaRatio = formatKdaRatio(
                          p.kills,
                          p.deaths,
                          p.assists,
                        );
                        const pkdaList =
                          p.kills != null &&
                          p.deaths != null &&
                          p.assists != null
                            ? `${p.kills}/${p.deaths}/${p.assists}`
                            : "—";
                        const pTotalMinions = Number(p.totalMinionsKilled || 0);
                        const pNeutralMinions = Number(
                          p.neutralMinionsKilled || 0,
                        );
                        const pTotalCs = pTotalMinions + pNeutralMinions;
                        const pCsPerMin =
                          durationSeconds != null
                            ? pTotalCs / (Number(durationSeconds) / 60)
                            : null;
                        const pVisionScore =
                          p.visionScore != null ? Number(p.visionScore) : null;
                        const pVisionPerMin =
                          pVisionScore != null && durationSeconds
                            ? pVisionScore / (Number(durationSeconds) / 60)
                            : null;
                        const pSpell1Icon =
                          p.summoner1Id && spellMap?.[p.summoner1Id];
                        const pSpell2Icon =
                          p.summoner2Id && spellMap?.[p.summoner2Id];
                        const pItems = Array.from(
                          { length: 6 },
                          (_, idx) => p[`item${idx}`],
                        );
                        const pDamage =
                          p.totalDamageDealtToChampions ??
                          p.totalDamageDealt ??
                          null;
                        return (
                          <div
                            key={`${p.puuid}-${p.championName}`}
                            className="grid items-center gap-3 rounded-lg border border-gray-200 bg-white/80 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-400"
                            style={{
                              gridTemplateColumns:
                                "28px minmax(120px,1fr) minmax(180px,1.1fr) 36px 1.2fr",
                            }}
                          >
                            {champIcon ? (
                              <img
                                src={champIcon}
                                alt={p.championName || "Champion"}
                                className="h-6 w-6 rounded-full border border-gray-200 dark:border-gray-700"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-full border border-dashed border-gray-200 dark:border-gray-700" />
                            )}
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                {name}
                              </div>
                              <div className="mt-0.5">
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                  {role}
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              <div
                                className="inline-flex items-center gap-1"
                                title={pkdaRatio ? `${pkdaRatio} KDA` : "—"}
                              >
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                  {pkdaList}
                                </span>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                  KDA
                                </span>
                              </div>
                              <div className="inline-flex items-center gap-1">
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                  {pDamage != null ? `${pDamage}` : "—"}
                                </span>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                  Damage
                                </span>
                              </div>
                              <div
                                className="inline-flex items-center gap-1"
                                title={
                                  pCsPerMin != null
                                    ? `${pCsPerMin.toFixed(1)} CS/min`
                                    : "—"
                                }
                              >
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                  {pTotalCs}
                                </span>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                  CS
                                </span>
                              </div>
                              <div
                                className="inline-flex items-center gap-1"
                                title={
                                  pVisionPerMin != null
                                    ? `${pVisionPerMin.toFixed(1)} V/min`
                                    : "—"
                                }
                              >
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                  {pVisionScore != null
                                    ? `${pVisionScore}`
                                    : "—"}
                                </span>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                  Vision
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              {[pSpell1Icon, pSpell2Icon].map((icon, idx) =>
                                icon ? (
                                  <img
                                    key={`p-spell-${idx}`}
                                    src={`${DDRAGON_BASE}/${ddragonVersion}/img/spell/${icon}`}
                                    alt="Summoner spell"
                                    className="h-6 w-6 rounded-md border border-gray-200 dark:border-gray-700"
                                  />
                                ) : (
                                  <div
                                    key={`p-spell-${idx}`}
                                    className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-gray-200 text-[10px] text-gray-400 dark:border-gray-700"
                                  >
                                    —
                                  </div>
                                ),
                              )}
                            </div>
                            <div className="grid w-max grid-cols-3 gap-1">
                              {pItems.map((itemId, idx) => {
                                const icon = getItemIconUrl(
                                  itemId,
                                  ddragonVersion,
                                );
                                return icon ? (
                                  <img
                                    key={`p-item-${idx}`}
                                    src={icon}
                                    alt="Item"
                                    className="h-6 w-6 rounded-md border border-gray-200 dark:border-gray-700"
                                    onError={(event) => {
                                      const target = event.currentTarget;
                                      if (target.dataset.fallback === "1")
                                        return;
                                      target.dataset.fallback = "1";
                                      target.src =
                                        getCdragonItemUrl(itemId) ||
                                        getItemIconUrl(
                                          itemId,
                                          DEFAULT_DDRAGON_VERSION,
                                        );
                                    }}
                                  />
                                ) : (
                                  <div
                                    key={`p-item-${idx}`}
                                    className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-gray-200 text-[10px] text-gray-400 dark:border-gray-700"
                                  >
                                    —
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Match roster unavailable.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Games({
  dianaApiBase,
  conquerorApiBase,
  apiBase,
  token,
  currentUser,
}) {
  const LIMIT = 20;
  const [activeView, setActiveView] = useState("diana");
  const [page, setPage] = useState(0);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [newMatches, setNewMatches] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    players: [],
    matchTypes: [],
    results: ["Win", "Lose", "Remake"],
    gameModes: [
      { id: "all", name: "All modes" },
      { id: "normal", name: "Normal" },
      { id: "ranked", name: "Ranked" },
      { id: "double_up", name: "Double Up" },
    ],
  });
  const [filters, setFilters] = useState(() => {
    let storedPlayer = "all";
    if (typeof window !== "undefined") {
      storedPlayer =
        window.localStorage.getItem(PLAYER_FILTER_STORAGE_KEY) || "all";
    }
    return {
      player: storedPlayer,
      matchType: "all",
      result: "all",
      gameMode: "all",
    };
  });
  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const [matchDetailsById, setMatchDetailsById] = useState({});
  const [ddragonVersion, setDdragonVersion] = useState(DEFAULT_DDRAGON_VERSION);
  const [spellMap, setSpellMap] = useState({});
  const [runeMap, setRuneMap] = useState({});
  const filtersRef = useRef(null);

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      const aTime = new Date(a.gameEndTime || a.gameCreation || 0).getTime();
      const bTime = new Date(b.gameEndTime || b.gameCreation || 0).getTime();
      return bTime - aTime;
    });
  }, [matches]);

  const playerOptions = useMemo(() => {
    return ["all", ...filterOptions.players];
  }, [filterOptions.players]);

  const matchTypeOptions = useMemo(() => {
    return ["all", ...filterOptions.matchTypes];
  }, [filterOptions.matchTypes]);

  const resultOptions = useMemo(() => {
    return ["all", ...(filterOptions.results || [])];
  }, [filterOptions.results]);

  const gameModeOptions = useMemo(() => {
    return filterOptions.gameModes || [];
  }, [filterOptions.gameModes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PLAYER_FILTER_STORAGE_KEY, filters.player);
  }, [filters.player]);

  useEffect(() => {
    const handler = (event) => {
      if (!filtersRef.current) return;
      if (!filtersRef.current.contains(event.target)) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (filters.player === "all") return;
    const exists = filterOptions.players.some(
      (opt) => opt?.puuid === filters.player,
    );
    if (!exists) {
      setFilters((prev) => ({ ...prev, player: "all" }));
    }
  }, [filterOptions.players, filters.player]);

  const loadPage = (nextPage, nextFilters = filters) => {
    const base =
      activeView === "diana"
        ? dianaApiBase
        : activeView === "conqueror"
          ? conquerorApiBase
          : null;
    if (!base) return;
    setLoading(true);
    setError(null);
    const offset = nextPage * LIMIT;

    if (activeView === "conqueror") {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(offset),
      });
      if (nextFilters.gameMode !== "all")
        params.set("gameMode", nextFilters.gameMode);
      fetch(`${base.replace(/\/$/, "")}/match/recent?${params.toString()}`, {
        headers: { "Cache-Control": "no-cache" },
      })
        .then((res) => {
          if (!res.ok)
            throw new Error(res.statusText || "Failed to load matches");
          return res.json();
        })
        .then((data) => {
          setMatches(Array.isArray(data.matches) ? data.matches : []);
          setHasMore(Boolean(data.hasMore));
          setPage(nextPage);
        })
        .catch((err) => setError(err.message || "Failed to load matches"))
        .finally(() => setLoading(false));
      return;
    }

    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String(offset),
    });
    if (nextFilters.player !== "all") params.set("player", nextFilters.player);
    if (nextFilters.matchType !== "all")
      params.set("queueId", nextFilters.matchType);
    if (nextFilters.result !== "all") params.set("result", nextFilters.result);
    fetch(`${base.replace(/\/$/, "")}/match/recent?${params.toString()}`, {
      headers: { "Cache-Control": "no-cache" },
    })
      .then((res) => {
        if (!res.ok)
          throw new Error(res.statusText || "Failed to load matches");
        return res.json();
      })
      .then((data) => {
        setMatches(Array.isArray(data.matches) ? data.matches : []);
        setHasMore(Boolean(data.hasMore));
        setPage(nextPage);
      })
      .catch((err) => setError(err.message || "Failed to load matches"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!dianaApiBase) return;
    fetch(`${dianaApiBase.replace(/\/$/, "")}/match/filters`, {
      headers: { "Cache-Control": "no-cache" },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setFilterOptions((prev) => ({
          ...prev,
          players: Array.isArray(data.players) ? data.players : [],
          matchTypes: Array.isArray(data.matchTypes) ? data.matchTypes : [],
          results: Array.isArray(data.results)
            ? data.results
            : ["Win", "Lose", "Remake"],
        }));
      })
      .catch(() => {});
  }, [dianaApiBase]);

  useEffect(() => {
    if (!conquerorApiBase) return;
    fetch(`${conquerorApiBase.replace(/\/$/, "")}/match/filters`, {
      headers: { "Cache-Control": "no-cache" },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setFilterOptions((prev) => ({
          ...prev,
          gameModes: Array.isArray(data.gameModes)
            ? data.gameModes
            : prev.gameModes,
        }));
      })
      .catch(() => {});
  }, [conquerorApiBase]);

  useEffect(() => {
    if (activeView !== "diana" && activeView !== "conqueror") return;
    const base = activeView === "diana" ? dianaApiBase : conquerorApiBase;
    if (!base) return;
    loadPage(0, filters);
  }, [dianaApiBase, conquerorApiBase, filters, activeView]);

  useEffect(() => {
    const versionFromMatches = matches
      .map((m) => getDdragonVersionFromUrl(m?.championImageUrl))
      .find(Boolean);
    if (versionFromMatches && versionFromMatches !== ddragonVersion) {
      setDdragonVersion(versionFromMatches);
    }
  }, [matches, ddragonVersion]);

  useEffect(() => {
    let cancelled = false;
    const base = `${DDRAGON_BASE}/${ddragonVersion}/data/en_US`;
    fetch(`${base}/summoner.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.data || cancelled) return;
        const next = {};
        Object.values(data.data).forEach((entry) => {
          if (entry?.key && entry?.image?.full) {
            next[Number(entry.key)] = entry.image.full;
          }
        });
        if (!cancelled) setSpellMap(next);
      })
      .catch(() => {});
    fetch(`${base}/runesReforged.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!Array.isArray(data) || cancelled) return;
        const next = {};
        data.forEach((style) => {
          if (style?.id && style?.icon) next[style.id] = style.icon;
          style?.slots?.forEach((slot) => {
            slot?.runes?.forEach((rune) => {
              if (rune?.id && rune?.icon) next[rune.id] = rune.icon;
            });
          });
        });
        if (!cancelled) setRuneMap(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ddragonVersion]);

  useEffect(() => {
    const base =
      activeView === "diana"
        ? dianaApiBase
        : activeView === "conqueror"
          ? conquerorApiBase
          : null;
    if (!base) return;
    const poll = () => {
      if (activeView !== "diana" && activeView !== "conqueror") return;
      if (page !== 0) return;
      const hasFilters =
        activeView === "diana"
          ? filters.player !== "all" ||
            filters.matchType !== "all" ||
            filters.result !== "all"
          : filters.gameMode !== "all";
      if (hasFilters) return;
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: "0",
      });
      if (activeView === "conqueror" && filters.gameMode !== "all")
        params.set("gameMode", filters.gameMode);
      fetch(`${base.replace(/\/$/, "")}/match/recent?${params.toString()}`, {
        headers: { "Cache-Control": "no-cache" },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data?.matches || !Array.isArray(data.matches)) return;
          const existingIds = new Set(sortedMatches.map((m) => m.matchId));
          const fresh = data.matches.filter((m) => !existingIds.has(m.matchId));
          if (fresh.length > 0) {
            setNewMatches(fresh);
          }
        })
        .catch(() => {});
    };
    const interval = setInterval(poll, 20000);
    return () => clearInterval(interval);
  }, [
    dianaApiBase,
    conquerorApiBase,
    page,
    sortedMatches,
    filters,
    activeView,
  ]);

  useEffect(() => {
    if (!dianaApiBase || matches.length === 0) return;
    const base = dianaApiBase.replace(/\/$/, "");
    const puuids = Array.from(
      new Set(matches.map((m) => m.entryPlayerPuuid).filter(Boolean)),
    );
    let cancelled = false;
    Promise.all(
      puuids.map((puuid) =>
        fetch(`${base}/match/${puuid}?numberOfMatches=${LIMIT}`, {
          headers: { "Cache-Control": "no-cache" },
        })
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const next = {};
        results
          .filter((list) => Array.isArray(list))
          .forEach((list) => {
            list.forEach((detail) => {
              if (detail?.matchId) next[detail.matchId] = detail;
            });
          });
        if (Object.keys(next).length > 0) {
          setMatchDetailsById((prev) => ({ ...prev, ...next }));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dianaApiBase, matches]);

  const showNewMatches = () => {
    if (!newMatches.length) return;
    setMatches((prev) => {
      const existingIds = new Set(prev.map((m) => m.matchId));
      const merged = [
        ...newMatches,
        ...prev.filter((m) => !existingIds.has(m.matchId)),
      ];
      return merged.slice(0, LIMIT);
    });
    setNewMatches([]);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50/60 dark:bg-gray-950/70">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <label className="sr-only" htmlFor="games-view-select">
            Game view
          </label>
          <select
            id="games-view-select"
            value={activeView}
            onChange={(e) => setActiveView(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="diana">Diana</option>
            <option value="conqueror">Conqueror</option>
            <option value="neon">Neon</option>
          </select>
          {activeView === "diana" ? (
            <div className="min-w-[200px]">
              <label className="sr-only" htmlFor="games-player-select">
                Player filter
              </label>
              <select
                id="games-player-select"
                value={filters.player}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    player: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                {playerOptions.map((opt) =>
                  opt === "all" ? (
                    <option key="all" value="all">
                      All players
                    </option>
                  ) : (
                    <option key={opt.puuid} value={opt.puuid}>
                      {opt.gameName}
                      {opt.tagLine ? `#${opt.tagLine}` : ""}
                    </option>
                  ),
                )}
              </select>
            </div>
          ) : null}
        </div>
        {activeView === "diana" || activeView === "conqueror" ? (
          <div className="flex items-center gap-2" ref={filtersRef}>
            <button
              type="button"
              onClick={() => loadPage(page)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              aria-label="Refresh"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v6h6M20 20v-6h-6"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 8a8 8 0 00-14.64-3.36L4 10M4 16a8 8 0 0014.64 3.36L20 14"
                />
              </svg>
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                aria-label="Filters"
                aria-expanded={filtersOpen}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5h18M6 12h12M10 19h4"
                  />
                </svg>
              </button>
              {filtersOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  <div className="space-y-3">
                    {activeView === "conqueror" ? (
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Game mode
                        </label>
                        <select
                          value={filters.gameMode}
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              gameMode: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        >
                          {gameModeOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Player
                          </label>
                          <select
                            value={filters.player}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                player: e.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                          >
                            {playerOptions.map((opt) =>
                              opt === "all" ? (
                                <option key="all" value="all">
                                  All players
                                </option>
                              ) : (
                                <option key={opt.puuid} value={opt.puuid}>
                                  {opt.gameName}
                                  {opt.tagLine ? `#${opt.tagLine}` : ""}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Match type
                          </label>
                          <select
                            value={filters.matchType}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                matchType: e.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                          >
                            {matchTypeOptions.map((opt) =>
                              opt === "all" ? (
                                <option key="all" value="all">
                                  All types
                                </option>
                              ) : (
                                <option
                                  key={opt.queueId}
                                  value={String(opt.queueId)}
                                >
                                  {opt.name}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Result
                          </label>
                          <select
                            value={filters.result}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                result: e.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                          >
                            {resultOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt === "all"
                                  ? "All results"
                                  : opt === "Lose"
                                    ? "Loss"
                                    : opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <span />
        )}
      </div>

      {(activeView === "diana" || activeView === "conqueror") &&
        newMatches.length > 0 &&
        page === 0 &&
        filters.player === "all" &&
        filters.matchType === "all" &&
        (activeView === "conqueror"
          ? filters.gameMode === "all"
          : filters.player === "all" &&
            filters.matchType === "all" &&
            filters.result === "all") && (
          <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
            <span>
              {newMatches.length} new match{newMatches.length === 1 ? "" : "es"}{" "}
              completed.
            </span>
            <button
              type="button"
              onClick={showNewMatches}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Show
            </button>
          </div>
        )}

      {(activeView === "diana" || activeView === "conqueror") && error && (
        <div className="flex-shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          {error}
        </div>
      )}

      {activeView === "neon" ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <Neon apiBase={apiBase} token={token} currentUser={currentUser} />
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              </div>
            ) : activeView === "conqueror" && !conquerorApiBase ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
                Conqueror API not configured. Set VITE_CONQUEROR_API_URL in
                config.
              </div>
            ) : sortedMatches.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
                No matches found yet.
              </div>
            ) : (
              <div className="space-y-4">
                {sortedMatches.map((match) => {
                  if (activeView === "conqueror") {
                    return (
                      <ConquerorMatchCard
                        key={match.id || match.matchId}
                        match={match}
                      />
                    );
                  }
                  const matchKey = match.id || match.matchId;
                  return (
                    <DianaMatchCard
                      key={matchKey}
                      match={match}
                      detail={matchDetailsById[match.matchId]}
                      expanded={expandedMatchId === matchKey}
                      onToggle={() =>
                        setExpandedMatchId((prev) =>
                          prev === matchKey ? null : matchKey,
                        )
                      }
                      ddragonVersion={ddragonVersion}
                      spellMap={spellMap}
                      runeMap={runeMap}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-shrink-0 items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
            {page > 0 ? (
              <button
                type="button"
                onClick={() => loadPage(Math.max(page - 1, 0))}
                disabled={loading}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                Previous
              </button>
            ) : (
              <span />
            )}
            <span>Page {page + 1}</span>
            {hasMore ? (
              <button
                type="button"
                onClick={() => loadPage(page + 1)}
                disabled={loading}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                Next
              </button>
            ) : (
              <span />
            )}
          </div>
        </>
      )}
    </div>
  );
}
