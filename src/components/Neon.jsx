import React, { useEffect, useState } from "react";

function Neon({ apiBase, token, currentUser }) {
  const [players, setPlayers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState(null);
  const [linkForm, setLinkForm] = useState({ gameName: "", tagLine: "", region: "eu" });
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState(null);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [statsError, setStatsError] = useState(null);
  const [platformStatus, setPlatformStatus] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);

  useEffect(() => {
    if (!apiBase) return;
    fetch(`${apiBase}/api/valorant/status?region=eu`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setPlatformStatus)
      .catch(() => setPlatformStatus(null));
    fetch(`${apiBase}/api/valorant/leaderboard?region=eu`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setLeaderboard)
      .catch(() => setLeaderboard(null));
  }, [apiBase]);

  useEffect(() => {
    if (!apiBase) return;
    setLoading(true);
    setError(null);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${apiBase}/api/valorant/players`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load players");
        return res.json();
      })
      .then((data) => {
        setPlayers(Array.isArray(data) ? data : []);
        if (data.length > 0 && !selectedUserId) {
          setSelectedUserId(data[0].id);
        }
      })
      .catch((err) => {
        setError(err.message);
        setPlayers([]);
      })
      .finally(() => setLoading(false));
  }, [apiBase, token]);

  useEffect(() => {
    if (!apiBase || selectedUserId == null) {
      setStats(null);
      setStatsError(null);
      return;
    }
    setLoadingStats(true);
    setStats(null);
    setStatsError(null);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${apiBase}/api/valorant/players/${selectedUserId}/stats`, { headers })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Failed to load stats");
        return data;
      })
      .then((data) => {
        setStats(data);
        setStatsError(null);
      })
      .catch((err) => {
        setStats(null);
        setStatsError(err.message || "Failed to load stats");
      })
      .finally(() => setLoadingStats(false));
  }, [apiBase, token, selectedUserId]);

  const selectedPlayer = players.find((p) => p.id === selectedUserId);
  const isLinked = currentUser && players.some((p) => p.id === currentUser.id);

  const handleLinkSubmit = (e) => {
    e.preventDefault();
    if (!apiBase || !token || !linkForm.gameName.trim() || !linkForm.tagLine.trim()) return;
    setLinkLoading(true);
    setLinkError(null);
    setLinkSuccess(false);
    fetch(`${apiBase}/api/valorant/link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        gameName: linkForm.gameName.trim(),
        tagLine: linkForm.tagLine.trim(),
        region: linkForm.region,
      }),
    })
      .then((res) => {
        const data = res.json().catch(() => ({}));
        if (!res.ok) return data.then((d) => { throw new Error(d.message || "Link failed"); });
        return data;
      })
      .then(() => {
        setLinkSuccess(true);
        setLinkForm({ gameName: "", tagLine: "", region: "eu" });
        return fetch(`${apiBase}/api/valorant/players`, { headers: { Authorization: `Bearer ${token}` } });
      })
      .then((r) => r.json())
      .then((data) => {
        setPlayers(Array.isArray(data) ? data : []);
        if (data.length > 0 && currentUser && data.find((p) => p.id === currentUser.id)) {
          setSelectedUserId(currentUser.id);
        }
      })
      .catch((err) => setLinkError(err.message))
      .finally(() => setLinkLoading(false));
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50/60 dark:bg-gray-950/70">
      <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Neon</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Valorant rank & match history
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {(platformStatus || leaderboard) && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {platformStatus && (
              <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Valorant status (EU)
                </h3>
                {((platformStatus.maintenances || platformStatus.Maintenances || []).length > 0 ||
                  (platformStatus.incidents || platformStatus.Incidents || []).length > 0) ? (
                  <ul className="text-sm text-amber-600 dark:text-amber-400">
                    {(platformStatus.maintenances || platformStatus.Maintenances || []).map((m, i) => (
                      <li key={`m-${i}`}>{m.maintenance_status || m.MaintenanceStatus || m.name || m.Name || "Maintenance"}</li>
                    ))}
                    {(platformStatus.incidents || platformStatus.Incidents || []).map((inc, i) => (
                      <li key={`i-${i}`}>{inc.incident_severity || inc.IncidentSeverity || inc.name || inc.Name || "Incident"}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">All systems operational</p>
                )}
              </div>
            )}
            {leaderboard && (
              <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {leaderboard.actName ? `Leaderboard — ${leaderboard.actName}` : "Top ranked (EU)"}
                </h3>
                {(leaderboard.players?.length > 0 || leaderboard.Players?.length > 0) ? (
                  <ul className="max-h-32 space-y-0.5 overflow-y-auto text-sm">
                    {(leaderboard.players || leaderboard.Players || []).slice(0, 10).map((p, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="truncate text-gray-700 dark:text-gray-300">
                          #{p.leaderboardRank ?? p.LeaderboardRank ?? i + 1} {p.gameName ?? p.GameName}#{p.tagLine ?? p.TagLine}
                        </span>
                        <span className="shrink-0 text-gray-500 dark:text-gray-400">
                          {p.rankedRating ?? p.RankedRating ?? "—"} RR
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {leaderboard.error || "No leaderboard data for current act."}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {currentUser && token && !isLinked && (
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
                <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                  Link your Riot account
                </h3>
                <form onSubmit={handleLinkSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                    <input
                      type="text"
                      placeholder="Game name"
                      value={linkForm.gameName}
                      onChange={(e) => setLinkForm((f) => ({ ...f, gameName: e.target.value }))}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="Tag line (e.g. NA1)"
                      value={linkForm.tagLine}
                      onChange={(e) => setLinkForm((f) => ({ ...f, tagLine: e.target.value }))}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    <select
                      value={linkForm.region}
                      onChange={(e) => setLinkForm((f) => ({ ...f, region: e.target.value }))}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="eu">EU</option>
                      <option value="na">NA</option>
                      <option value="ap">AP</option>
                      <option value="kr">KR</option>
                      <option value="br">BR</option>
                      <option value="latam">LATAM</option>
                    </select>
                    <button
                      type="submit"
                      disabled={linkLoading || !linkForm.gameName.trim() || !linkForm.tagLine.trim()}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {linkLoading ? "Linking…" : "Link"}
                    </button>
                  </div>
                  {linkError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{linkError}</p>
                  )}
                  {linkSuccess && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">Account linked.</p>
                  )}
                </form>
              </div>
            )}
            {players.length === 0 && !linkSuccess ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-800/80">
                <p className="text-gray-600 dark:text-gray-400">
                  No players have linked Valorant yet. Link your Riot account above to appear here.
                </p>
              </div>
            ) : (
          <>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Player
              </label>
              <div className="flex flex-wrap gap-2">
                {players.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedUserId(p.id)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      selectedUserId === p.id
                        ? "bg-indigo-600 text-white shadow dark:bg-indigo-500"
                        : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-700"
                    }`}
                  >
                    {p.display_name || p.gameName || `User ${p.id}`}
                  </button>
                ))}
              </div>
            </div>

            {loadingStats ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              </div>
            ) : stats ? (
              <div className="space-y-6">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-lg font-bold text-white shadow">
                      {stats.currentRank?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Current rank
                      </p>
                      <p className="text-xl font-semibold text-gray-900 dark:text-white">
                        {stats.currentRank || "Unranked"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {stats.gameName}#{stats.tagLine}
                        {stats._demo && (
                          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Demo
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Recent matches
                    {stats._demo && (
                      <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        Sample data
                      </span>
                    )}
                  </h2>
                  <div className="space-y-3">
                    {stats.matches && stats.matches.length === 0 ? (
                      <p className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
                        No competitive matches in history.
                      </p>
                    ) : (
                      (stats.matches || []).map((m, i) => (
                        <div
                          key={m.matchId || i}
                          className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-gray-800/80 ${
                            m.won
                              ? "border-emerald-200 dark:border-emerald-800/50"
                              : "border-red-200 dark:border-red-800/50"
                          }`}
                        >
                          <div className="flex gap-4">
                            {m.agentIcon && (
                              <img
                                src={m.agentIcon}
                                alt={m.agentName}
                                className="h-14 w-14 flex-shrink-0 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-gray-600"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    m.won
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                      : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                                  }`}
                                >
                                  {m.won ? "Victory" : "Defeat"}
                                </span>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {m.agentName}
                                </span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  · {m.rankName}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                Score: <strong>{m.scoreline}</strong>  ·  K/D/A:{" "}
                                <strong>
                                  {m.kills}/{m.deaths}/{m.assists}
                                </strong>{" "}
                                ·  Combat: <strong>{m.score}</strong>
                              </p>
                              {m.startTime && (
                                <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                                  {new Date(m.startTime).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-800/80">
                <p className="text-gray-500 dark:text-gray-400">
                  Could not load stats for {selectedPlayer?.display_name || selectedPlayer?.gameName || "this player"}.
                </p>
                {statsError && (
                  <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{statsError}</p>
                )}
              </div>
            )}
          </>
          )}
          </>
        )}
      </div>
    </div>
  );
}

export default Neon;
