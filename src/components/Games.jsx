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
    minute: "2-digit"
  });
}

function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return "—";
  const total = Math.max(0, Math.floor(Number(seconds)));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}m ${secs}s`;
}

const RESULT_STYLES = {
  Win: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  Lose: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  Remake: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
};
const RESULT_ROW_STYLES = {
  Win: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-900/20",
  Lose: "border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-900/20",
  Remake: "border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-900/20"
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
  CHALLENGER: "#1e90ff"
};

function DianaMatchCard({ match, showDetails }) {
  const timestamp = formatTimestamp(match?.gameCreation || match?.gameEndTime);
  const durationLabel = formatDuration(match?.gameDuration);
  const summoner = match?.summonerName || "Unknown";
  const tagLine = match?.tagLine ? `#${match.tagLine}` : "";
  const resultClass = RESULT_STYLES[match?.result] || RESULT_STYLES.Remake;
  const rowClass = RESULT_ROW_STYLES[match?.result] || RESULT_ROW_STYLES.Remake;
  const rankTier = (match?.rankTier || "").toUpperCase();
  const showRankTier = Boolean(rankTier && rankTier !== "UNRANKED");
  const rankColor = RANK_COLORS[rankTier] || "#94a3b8";
  const lpChange =
    typeof match?.lpChange === "number" ? match.lpChange : null;
  const lpChangeLabel =
    lpChange == null ? "—" : `${lpChange > 0 ? "+" : ""}${lpChange} LP`;
  const showRankUpdate = lpChange != null && lpChange !== 0;

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${rowClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {match?.championImageUrl ? (
            <img
              src={match.championImageUrl}
              alt={match?.champion || "Champion"}
              className="h-10 w-10 rounded-full object-cover ring-2 ring-white/70 dark:ring-gray-900/60"
            />
          ) : null}
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
              {summoner}
              {tagLine && <span className="text-sm text-gray-500 dark:text-gray-400"> {tagLine}</span>}
            </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {match?.queueName || "Unknown queue"}
            {durationLabel !== "—" ? ` · ${durationLabel}` : ""}
            {timestamp ? ` · ${timestamp}` : ""}
          </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${resultClass}`}>
            {match?.result || "Match"}
          </span>
          {showRankUpdate ? (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
              Rank Update
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white/80 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900/60">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Champion
          </div>
          <div className="mt-0.5 text-sm text-gray-800 dark:text-gray-200">
            {match?.champion || "Unknown"}
            {match?.role ? ` · ${match.role}` : ""}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white/80 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900/60">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            KDA
          </div>
          <div className="mt-0.5 text-sm text-gray-800 dark:text-gray-200">
            {match?.kda || "0/0/0"}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white/80 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900/60">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Damage
          </div>
          <div className="mt-0.5 text-sm text-gray-800 dark:text-gray-200">
            {match?.damage ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white/80 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900/60">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <span>Rank</span>
            {showRankTier ? (
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${rankColor}22`, color: rankColor }}>
                {rankTier}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex items-center justify-between text-sm text-gray-800 dark:text-gray-200">
            <span>{match?.rank || "Unranked"}</span>
            <span className={lpChange != null && lpChange < 0 ? "text-rose-600 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-300"}></span>
          </div>
        </div>
        {showDetails ? (
          <>
            <div className="rounded-lg border border-gray-200 bg-white/80 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900/60">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Duration
              </div>
              <div className="mt-0.5 text-sm text-gray-800 dark:text-gray-200">
                {formatDuration(match?.gameDuration)}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white/80 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900/60">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Mode
              </div>
              <div className="mt-0.5 text-sm text-gray-800 dark:text-gray-200">
                {match?.gameMode || "—"} · {match?.gameType || "—"}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function NotificationCard({ payload, compact }) {
  if (!payload) return null;
  const fields = Array.isArray(payload.fields) ? payload.fields : [];
  const accent = typeof payload.colorHex === "number"
    ? `#${payload.colorHex.toString(16).padStart(6, "0")}`
    : null;
  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/80 ${compact ? "p-3" : ""}`}
      style={accent ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}22` } : undefined}
    >
      <div className="flex items-start gap-3">
        {payload.thumbnailUrl ? (
          <img
            src={payload.thumbnailUrl}
            alt={payload.title || "Diana update"}
            className="h-10 w-10 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-gray-700"
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          {payload.title && (
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {payload.title.replace(/\*\*/g, "")}
            </h3>
          )}
          {payload.description && (
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {payload.description.replace(/\*\*/g, "")}
            </p>
          )}
        </div>
      </div>
      {fields.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {fields.map((field, index) => (
            <div
              key={`${field.name || "field"}-${index}`}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/70"
            >
              <div className="font-semibold text-gray-500 dark:text-gray-400">
                {String(field.name).replace(/\*\*/g, "")}
              </div>
              <div className="mt-0.5 text-sm text-gray-800 dark:text-gray-200">
                {String(field.value).replace(/\*\*/g, "")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Games({ dianaApiBase, apiBase, token, currentUser }) {
  const LIMIT = 20;
  const LIVE_LIMIT = 5;
  const [activeView, setActiveView] = useState("diana");
  const [dianaTab, setDianaTab] = useState("history");
  const [page, setPage] = useState(0);
  const [matches, setMatches] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [newMatches, setNewMatches] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    players: [],
    matchTypes: [],
    results: ["Win", "Lose", "Remake"]
  });
  const [filters, setFilters] = useState({
    player: "all",
    matchType: "all",
    result: "all"
  });
  const filtersRef = useRef(null);

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      const aTime = new Date(a.gameCreation || 0).getTime();
      const bTime = new Date(b.gameCreation || 0).getTime();
      return bTime - aTime;
    });
  }, [matches]);

  const sortedLiveMatches = useMemo(() => {
    return [...liveMatches].sort((a, b) => {
      const aTime = new Date(a.gameCreation || 0).getTime();
      const bTime = new Date(b.gameCreation || 0).getTime();
      return bTime - aTime;
    });
  }, [liveMatches]);

  const playerOptions = useMemo(() => {
    return ["all", ...filterOptions.players];
  }, [filterOptions.players]);

  const matchTypeOptions = useMemo(() => {
    return ["all", ...filterOptions.matchTypes];
  }, [filterOptions.matchTypes]);

  const resultOptions = useMemo(() => {
    return ["all", ...(filterOptions.results || [])];
  }, [filterOptions.results]);

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

  const loadPage = (nextPage, nextFilters = filters) => {
    if (!dianaApiBase) return;
    setLoading(true);
    setError(null);
    const offset = nextPage * LIMIT;
    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String(offset)
    });
    if (nextFilters.player !== "all") params.set("player", nextFilters.player);
    if (nextFilters.matchType !== "all") params.set("queueId", nextFilters.matchType);
    if (nextFilters.result !== "all") params.set("result", nextFilters.result);
    fetch(`${dianaApiBase.replace(/\/$/, "")}/match/recent?${params.toString()}`, {
      headers: { "Cache-Control": "no-cache" }
    })
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText || "Failed to load matches");
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
      headers: { "Cache-Control": "no-cache" }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setFilterOptions({
          players: Array.isArray(data.players) ? data.players : [],
          matchTypes: Array.isArray(data.matchTypes) ? data.matchTypes : [],
          results: Array.isArray(data.results) ? data.results : ["Win", "Lose", "Remake"]
        });
      })
      .catch(() => {});
  }, [dianaApiBase]);

  useEffect(() => {
    if (activeView !== "diana" || dianaTab !== "history") return;
    loadPage(0, filters);
  }, [dianaApiBase, filters, activeView, dianaTab]);

  useEffect(() => {
    if (!dianaApiBase) return;
    const poll = () => {
      if (activeView !== "diana" || dianaTab !== "history") return;
      if (page !== 0) return;
      if (filters.player !== "all" || filters.matchType !== "all" || filters.result !== "all") return;
      fetch(`${dianaApiBase.replace(/\/$/, "")}/match/recent?limit=${LIMIT}&offset=0`, {
        headers: { "Cache-Control": "no-cache" }
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
  }, [dianaApiBase, page, sortedMatches, filters, activeView, dianaTab]);

  useEffect(() => {
    if (!dianaApiBase) return;
    if (activeView !== "diana" || dianaTab !== "live") return;
    let cancelled = false;
    const fetchLatest = () => {
      fetch(`${dianaApiBase.replace(/\/$/, "")}/match/recent?limit=${LIVE_LIMIT}&offset=0`, {
        headers: { "Cache-Control": "no-cache" }
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled) return;
          if (!data?.matches || !Array.isArray(data.matches)) return;
          setLiveMatches((prev) => {
            const existingIds = new Set(prev.map((m) => m.matchId));
            const fresh = data.matches.filter((m) => !existingIds.has(m.matchId));
            if (fresh.length === 0) return prev;
            return [...fresh, ...prev].slice(0, LIVE_LIMIT);
          });
        })
        .catch(() => {});
    };
    fetchLatest();
    const interval = setInterval(fetchLatest, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [dianaApiBase, activeView, dianaTab, LIVE_LIMIT]);

  const showNewMatches = () => {
    if (!newMatches.length) return;
    setMatches((prev) => {
      const existingIds = new Set(prev.map((m) => m.matchId));
      const merged = [...newMatches, ...prev.filter((m) => !existingIds.has(m.matchId))];
      return merged.slice(0, LIMIT);
    });
    setNewMatches([]);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50/60 dark:bg-gray-950/70">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <div>
          <label className="sr-only" htmlFor="games-view-select">Game view</label>
          <select
            id="games-view-select"
            value={activeView}
            onChange={(e) => setActiveView(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="diana">Diana</option>
            <option value="neon">Neon</option>
          </select>
        </div>
        {activeView === "diana" ? (
          <div className="flex items-center gap-2" ref={filtersRef}>
            <button
              type="button"
              onClick={() => loadPage(page)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              aria-label="Refresh"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 8a8 8 0 00-14.64-3.36L4 10M4 16a8 8 0 0014.64 3.36L20 14" />
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
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18M6 12h12M10 19h4" />
                </svg>
              </button>
              {filtersOpen && dianaTab === "history" && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Player</label>
                      <select
                        value={filters.player}
                        onChange={(e) => setFilters((prev) => ({ ...prev, player: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      >
                      {playerOptions.map((opt) => (
                        opt === "all" ? (
                          <option key="all" value="all">All players</option>
                        ) : (
                          <option key={opt.puuid} value={opt.puuid}>
                            {opt.gameName}{opt.tagLine ? `#${opt.tagLine}` : ""}
                          </option>
                        )
                      ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Match type</label>
                      <select
                        value={filters.matchType}
                        onChange={(e) => setFilters((prev) => ({ ...prev, matchType: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      >
                      {matchTypeOptions.map((opt) => (
                        opt === "all" ? (
                          <option key="all" value="all">All types</option>
                        ) : (
                          <option key={opt.queueId} value={String(opt.queueId)}>
                            {opt.name}
                          </option>
                        )
                      ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Result</label>
                      <select
                        value={filters.result}
                        onChange={(e) => setFilters((prev) => ({ ...prev, result: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      >
                      {resultOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt === "all" ? "All results" : opt === "Lose" ? "Loss" : opt}
                        </option>
                      ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <span />
        )}
      </div>

      {activeView === "diana" && dianaTab === "history" && newMatches.length > 0 && page === 0 && filters.player === "all" && filters.matchType === "all" && filters.result === "all" && (
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
          <span>{newMatches.length} new match{newMatches.length === 1 ? "" : "es"} completed.</span>
          <button
            type="button"
            onClick={showNewMatches}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Show
          </button>
        </div>
      )}

      {activeView === "diana" && dianaTab === "history" && error && (
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
          <div className="flex flex-shrink-0 items-center gap-2 border-b border-gray-200 bg-white/70 px-4 py-2 text-sm font-medium text-gray-600 dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-300">
            {["history", "live"].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setDianaTab(tab)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  dianaTab === tab
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                {tab === "history" ? "Match History" : "Live Feed"}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {dianaTab === "history" && loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              </div>
            ) : (dianaTab === "history" ? sortedMatches : sortedLiveMatches).length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
                {dianaTab === "live" ? "No live updates yet." : "No matches found yet."}
              </div>
            ) : (
              <div className="space-y-4">
                {dianaTab === "history" ? (
                  sortedMatches.map((match) => (
                    <DianaMatchCard
                      key={match.id || match.matchId}
                      match={match}
                      showDetails={false}
                    />
                  ))
                ) : (
                  sortedLiveMatches.map((match) => (
                    <div key={match.id || match.matchId} className="space-y-3">
                      <NotificationCard payload={match.notificationPayload} />
                      {match.rankNotificationPayload ? (
                        <NotificationCard payload={match.rankNotificationPayload} compact />
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {dianaTab === "history" && (
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
          )}
        </>
      )}
    </div>
  );
}
