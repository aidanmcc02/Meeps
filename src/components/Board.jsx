import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";

async function loadCommitCountFromTauri() {
  if (typeof window === "undefined" || !window.__TAURI__) return null;
  const { invoke } = await import("@tauri-apps/api/tauri");
  try {
    const count = await invoke("get_git_commit_count", { repoPath: null });
    return typeof count === "number" ? count : null;
  } catch (_) {
    return null;
  }
}

const COLUMNS = [
  { id: "todo", label: "To Do", color: "bg-slate-100 dark:bg-slate-800/60" },
  {
    id: "in_progress",
    label: "In Progress",
    color: "bg-amber-50 dark:bg-amber-900/20",
  },
  { id: "done", label: "Done", color: "bg-emerald-50 dark:bg-emerald-900/20" },
];

function normalizeIssue(issue) {
  return {
    id: String(issue.id),
    title: issue.title,
    description: issue.description ?? null,
    status: issue.status || "todo",
    priority: issue.priority || "medium",
    assigneeId: issue.assigneeId ?? null,
    assigneeName: issue.assigneeName ?? null,
    createdAt: issue.createdAt ?? null,
    updatedAt: issue.updatedAt ?? null,
  };
}

const DRAG_THRESHOLD_PX = 6;

function IssueCard({
  issue,
  currentUser,
  onEdit,
  onDelete,
  onDragStart,
  onDragMove,
  onDragEnd,
  isDragging,
}) {
  const assigneeName =
    issue.assigneeName ||
    (issue.assigneeId === currentUser?.id
      ? currentUser?.displayName || "You"
      : "Unassigned");

  const priorityColors = {
    low: "bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200",
    medium:
      "bg-amber-200 text-amber-800 dark:bg-amber-700/50 dark:text-amber-200",
    high: "bg-rose-200 text-rose-800 dark:bg-rose-700/50 dark:text-rose-200",
  };
  const priorityLabel =
    { low: "Low", medium: "Medium", high: "High" }[issue.priority] || "Medium";

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    onDragStart?.(issue.id, e.clientX, e.clientY);
  };

  const handlePointerMove = (e) => {
    if (e.buttons !== 1) return;
    onDragMove?.(e.clientX, e.clientY);
  };

  const handlePointerUp = (e) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    onDragEnd?.();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`
        group rounded-xl border bg-white p-3 shadow-sm transition-all dark:bg-gray-800/90 dark:border-gray-700
        hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500/50 select-none
        ${isDragging ? "opacity-50 scale-95 cursor-grabbing" : "cursor-grab active:cursor-grabbing"}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-xs font-medium text-indigo-600 dark:text-indigo-400"
          title={issue.id}
        >
          #{String(issue.id).slice(-7)}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${priorityColors[issue.priority] || priorityColors.medium}`}
        >
          {priorityLabel}
        </span>
      </div>
      <h3
        className="mt-1 font-medium text-gray-900 dark:text-gray-100 line-clamp-2"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(issue);
        }}
      >
        {issue.title}
      </h3>
      {issue.description ? (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
          {issue.description}
        </p>
      ) : null}
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(issue);
          }}
          className="text-[10px] font-medium text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
        >
          {assigneeName}
        </button>
        <div
          className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(issue);
            }}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            title="Edit"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(issue.id);
            }}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            title="Delete"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function IssueModal({
  issue,
  isOpen,
  onClose,
  onCreate,
  onSave,
  currentUser,
  users = [],
}) {
  const isEdit = issue != null;
  const [title, setTitle] = useState(issue?.title ?? "");
  const [description, setDescription] = useState(issue?.description ?? "");
  const [priority, setPriority] = useState(issue?.priority ?? "medium");
  const [assignToMe, setAssignToMe] = useState(
    isEdit ? issue.assigneeId === currentUser?.id : true,
  );
  const [selectedUserId, setSelectedUserId] = useState(
    issue?.assigneeId ?? null,
  );

  const reset = useCallback(() => {
    if (issue) {
      setTitle(issue.title);
      setDescription(issue.description ?? "");
      setPriority(issue.priority ?? "medium");
      setAssignToMe(issue.assigneeId === currentUser?.id);
      setSelectedUserId(issue.assigneeId ?? null);
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setAssignToMe(true);
      setSelectedUserId(null);
    }
  }, [issue, currentUser?.id]);

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, reset]);

  const assigneeId = assignToMe
    ? (currentUser?.id ?? null)
    : selectedUserId
      ? Number(selectedUserId)
      : null;
  const assigneeName = assignToMe
    ? currentUser?.displayName || "Me"
    : selectedUserId
      ? (users.find((u) => u.id === Number(selectedUserId))?.displayName ??
        issue?.assigneeName ??
        null)
      : null;

  const usersForDropdown = useMemo(() => {
    const list = [...users];
    if (
      issue &&
      issue.assigneeId &&
      issue.assigneeId !== currentUser?.id &&
      !list.some((u) => u.id === issue.assigneeId)
    ) {
      list.unshift({
        id: issue.assigneeId,
        displayName: issue.assigneeName || `User #${issue.assigneeId}`,
      });
    }
    return list;
  }, [users, issue, currentUser?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const hasExistingId = issue != null && issue.id != null;
    if (hasExistingId) {
      onSave({
        ...issue,
        id: issue.id,
        title: t,
        description: description.trim() || null,
        priority: priority || "medium",
        assigneeId,
        assigneeName,
      });
    } else {
      onCreate({
        title: t,
        description: description.trim() || null,
        status: "todo",
        priority: priority || "medium",
        assigneeId,
        assigneeName,
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEdit ? "Edit issue" : "New issue"}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {isEdit
              ? `#${String(issue.id).slice(-7)}`
              : "Add title, description, and assign yourself or leave unassigned."}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fix login button"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              autoFocus={!isEdit}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details…"
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Assignee
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={assignToMe}
                onChange={(e) => setAssignToMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Assign to me
              </span>
            </label>
            {!assignToMe && (
              <select
                value={selectedUserId ?? ""}
                onChange={(e) =>
                  setSelectedUserId(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">Unassigned</option>
                {usersForDropdown.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEdit ? "Save" : "Create issue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StatsChart({
  issues,
  commitsOnMain,
  commitsLoading,
  commitsError,
  ticketsByAssignee,
  contributors,
  onRefreshCommits,
}) {
  const [viewMode, setViewMode] = useState("bar"); // "bar" | "pie"
  const ticketsLeaderboard = Array.isArray(ticketsByAssignee)
    ? ticketsByAssignee
    : [];
  const commitsLeaderboard = Array.isArray(contributors) ? contributors : [];

  const stats = useMemo(() => {
    const byStatus = {
      todo: 0,
      in_progress: 0,
      done: 0,
    };
    for (const issue of issues) {
      const status = issue.status || "todo";
      if (status === "in_progress") byStatus.in_progress += 1;
      else if (status === "done") byStatus.done += 1;
      else byStatus.todo += 1;
    }
    const ticketsTaken = byStatus.in_progress + byStatus.done;
    const totalTickets = byStatus.todo + byStatus.in_progress + byStatus.done;
    return { byStatus, ticketsTaken, totalTickets };
  }, [issues]);

  const barData = useMemo(() => {
    const values = [
      { key: "tickets", label: "Tickets taken", value: stats.ticketsTaken },
      { key: "commits", label: "Commits (GitHub)", value: commitsOnMain ?? 0 },
    ];
    const maxValue = Math.max(1, ...values.map((v) => v.value || 0));
    return { values, maxValue };
  }, [stats.ticketsTaken, commitsOnMain]);

  const pieData = useMemo(() => {
    const ticketValue = stats.ticketsTaken;
    const commitValue = commitsOnMain ?? 0;
    const total = ticketValue + commitValue || 1;
    return {
      ticketPortion: ticketValue / total,
      commitPortion: commitValue / total,
      total,
    };
  }, [stats.ticketsTaken, commitsOnMain]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Board statistics
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Compare tickets taken (in progress + done) with commits on the
            repo&apos;s default branch (from GitHub).
          </p>
        </div>
        <div className="inline-flex items-center rounded-full bg-gray-100 p-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <button
            type="button"
            onClick={() => setViewMode("bar")}
            className={`px-3 py-1.5 rounded-full transition-colors ${
              viewMode === "bar"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-50"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            }`}
          >
            Bar
          </button>
          <button
            type="button"
            onClick={() => setViewMode("pie")}
            className={`px-3 py-1.5 rounded-full transition-colors ${
              viewMode === "pie"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-50"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            }`}
          >
            Pie
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Tickets taken
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-50">
            {stats.ticketsTaken}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Out of {stats.totalTickets} total tickets on the board.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Commits (GitHub)
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-50">
            {commitsLoading ? "…" : (commitsOnMain ?? "—")}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {commitsError
              ? "Could not load from GitHub."
              : "Total commits on the default branch (from GitHub)."}
          </p>
          {commitsError && typeof onRefreshCommits === "function" && (
            <button
              type="button"
              onClick={onRefreshCommits}
              className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Retry
            </button>
          )}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Tickets by status
          </p>
          <dl className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
            <div className="flex items-center justify-between">
              <dt>To Do</dt>
              <dd className="font-medium">{stats.byStatus.todo}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>In Progress</dt>
              <dd className="font-medium">{stats.byStatus.in_progress}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Done</dt>
              <dd className="font-medium">{stats.byStatus.done}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
            Tickets taken leaderboard
          </h3>
          {ticketsLeaderboard.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No tickets taken yet.
            </p>
          ) : (
            <ol className="space-y-2">
              {ticketsLeaderboard.map((entry, index) => {
                const rank = index + 1;
                const rankStyle =
                  rank === 1
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                    : rank === 2
                      ? "bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200"
                      : rank === 3
                        ? "bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
                return (
                  <li
                    key={entry.assigneeId ?? "unassigned" + index}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700/80"
                  >
                    <span
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${rankStyle}`}
                    >
                      {rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {entry.assigneeName}
                    </span>
                    <span className="flex-shrink-0 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                      {entry.ticketsTaken}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
            GitHub contributors (commits)
          </h3>
          {commitsLeaderboard.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {commitsLoading ? "Loading…" : "No contributor data."}
            </p>
          ) : (
            <ol className="space-y-2">
              {commitsLeaderboard.map((entry, index) => {
                const rank = index + 1;
                const rankStyle =
                  rank === 1
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                    : rank === 2
                      ? "bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200"
                      : rank === 3
                        ? "bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
                return (
                  <li
                    key={entry.login ?? index}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700/80"
                  >
                    <span
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${rankStyle}`}
                    >
                      {rank}
                    </span>
                    <a
                      href={`https://github.com/${entry.login}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {entry.login}
                    </a>
                    <span className="flex-shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {entry.contributions}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      <div className="mt-2 flex-1 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        {viewMode === "bar" ? (
          <div className="flex h-full flex-col">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
              Bar chart: tickets taken vs commits (GitHub default branch).
            </p>
            <div className="flex-1 flex items-end justify-around gap-6 pb-2">
              {barData.values.map((item) => {
                const height = barData.maxValue
                  ? (item.value / barData.maxValue) * 100
                  : 0;
                const isTickets = item.key === "tickets";
                return (
                  <div
                    key={item.key}
                    className="flex flex-col items-center gap-1"
                  >
                    <div className="relative flex h-40 w-10 items-end rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className={`w-full transition-all duration-500 ${
                          isTickets ? "bg-indigo-500" : "bg-emerald-500"
                        }`}
                        style={{ height: `${height}%` }}
                        aria-label={`${item.label}: ${item.value}`}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                      {item.value}
                    </span>
                    <span className="text-[11px] text-center text-gray-500 dark:text-gray-400">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 sm:flex-row sm:items-stretch sm:justify-between">
            <div className="flex items-center justify-center">
              <svg
                width="180"
                height="180"
                viewBox="0 0 180 180"
                role="img"
                aria-label="Pie chart of tickets vs commits"
              >
                <circle
                  cx="90"
                  cy="90"
                  r="60"
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.3)"
                  strokeWidth="20"
                />
                <circle
                  cx="90"
                  cy="90"
                  r="60"
                  fill="none"
                  stroke="#6366F1"
                  strokeWidth="20"
                  strokeDasharray={`${pieData.ticketPortion * 377} 377`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  transform="rotate(-90 90 90)"
                />
                <circle
                  cx="90"
                  cy="90"
                  r="60"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="20"
                  strokeDasharray={`${pieData.commitPortion * 377} 377`}
                  strokeDashoffset={-pieData.ticketPortion * 377}
                  strokeLinecap="round"
                  transform="rotate(-90 90 90)"
                />
              </svg>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Pie chart breakdown
              </p>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  Tickets taken:{" "}
                  <span className="font-medium">{stats.ticketsTaken}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  Commits (GitHub):{" "}
                  <span className="font-medium">
                    {commitsLoading ? "…" : (commitsOnMain ?? "—")}
                  </span>
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Total combined:{" "}
                <span className="font-medium">{pieData.total}</span>
              </p>
              {commitsError ? (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  {commitsError}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Board({ currentUser, apiBase }) {
  const [issues, setIssues] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
  const [draggingIssueId, setDraggingIssueId] = useState(null);
  const [dropTargetColumnId, setDropTargetColumnId] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterPriority, setFilterPriority] = useState("");
  const [filterAssigneeId, setFilterAssigneeId] = useState(null);
  const [sortOrder, setSortOrder] = useState("desc");
  const [activeTab, setActiveTab] = useState("board"); // "board" | "stats"
  const [mobileColumn, setMobileColumn] = useState("todo");
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" &&
      !window.matchMedia("(min-width: 768px)").matches,
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const handle = () => setIsMobile(!mq.matches);
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);
  const [commitsOnMain, setCommitsOnMain] = useState(null);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitsError, setCommitsError] = useState(null);
  const [hasLoadedCommits, setHasLoadedCommits] = useState(false);
  const [ticketsByAssignee, setTicketsByAssignee] = useState([]);
  const [contributors, setContributors] = useState([]);
  const [syncFromGitHubLoading, setSyncFromGitHubLoading] = useState(false);
  const filterDropdownRef = useRef(null);
  const potentialDragRef = useRef(null);
  const justDraggedRef = useRef(false);
  const dropTargetColumnIdRef = useRef(null);
  dropTargetColumnIdRef.current = dropTargetColumnId;

  const base = apiBase || "";

  useEffect(() => {
    fetch(`${base}/api/users`)
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => setUsers(Array.isArray(data.users) ? data.users : []))
      .catch(() => setUsers([]));
  }, [base]);

  useEffect(() => {
    if (activeTab !== "stats" || hasLoadedCommits) return;
    let cancelled = false;
    setCommitsLoading(true);
    setCommitsError(null);

    (async () => {
      const [tauriCount, backendData] = await Promise.all([
        loadCommitCountFromTauri(),
        fetch(`${base}/api/board/stats`)
          .then((res) =>
            res.ok ? res.json() : Promise.reject(new Error(res.statusText)),
          )
          .catch((err) => ({ error: err.message })),
      ]);
      if (cancelled) return;
      if (backendData && !backendData.error) {
        setTicketsByAssignee(
          Array.isArray(backendData.ticketsByAssignee)
            ? backendData.ticketsByAssignee
            : [],
        );
        setContributors(
          Array.isArray(backendData.contributors)
            ? backendData.contributors
            : [],
        );
        if (tauriCount == null) {
          setCommitsOnMain(
            typeof backendData.commitsOnMain === "number"
              ? backendData.commitsOnMain
              : null,
          );
          setCommitsError(backendData.commitsError || null);
        }
      }
      if (tauriCount != null) {
        setCommitsOnMain(tauriCount);
        setCommitsError(null);
      } else if (backendData?.error) {
        setCommitsError(backendData.error);
      }
      setHasLoadedCommits(true);
      setCommitsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, base, hasLoadedCommits]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${base}/api/board/issues`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText || "Failed to load issues");
        return res.json();
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data.issues)) {
          setIssues(data.issues.map(normalizeIssue));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  const addIssue = useCallback(
    async (payload) => {
      try {
        const res = await fetch(`${base}/api/board/issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: payload.title,
            description: payload.description ?? null,
            status: payload.status || "todo",
            priority: payload.priority || "medium",
            assigneeId: payload.assigneeId ?? null,
            assigneeName: payload.assigneeName ?? null,
          }),
        });
        if (!res.ok) throw new Error((await res.text()) || "Create failed");
        const created = await res.json();
        setIssues((prev) => [normalizeIssue(created), ...prev]);
      } catch (err) {
        setError(err.message || "Failed to create issue");
      }
    },
    [base],
  );

  const updateIssue = useCallback(
    async (updated) => {
      try {
        const res = await fetch(`${base}/api/board/issues/${updated.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: updated.title,
            description: updated.description ?? null,
            priority: updated.priority || "medium",
            assigneeId: updated.assigneeId ?? null,
            assigneeName: updated.assigneeName ?? null,
            movedBy: currentUser?.displayName ?? "Someone",
            movedById: currentUser?.id ?? null,
          }),
        });
        if (!res.ok) throw new Error((await res.text()) || "Update failed");
        const data = await res.json();
        setIssues((prev) =>
          prev.map((i) =>
            i.id === String(data.id) ? normalizeIssue(data) : i,
          ),
        );
        setEditingIssue(null);
      } catch (err) {
        setError(err.message || "Failed to update");
      }
    },
    [base, currentUser],
  );

  const refetch = useCallback(() => {
    fetch(`${base}/api/board/issues`)
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(res.statusText)),
      )
      .then(
        (data) =>
          Array.isArray(data.issues) &&
          setIssues(data.issues.map(normalizeIssue)),
      )
      .catch((err) => setError(err.message || "Failed to load"));
  }, [base]);

  const syncFromGitHub = useCallback(async () => {
    setSyncFromGitHubLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/api/board/sync-from-github`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || res.statusText || "Sync failed");
        return;
      }
      if (data.created > 0) {
        refetch();
      }
    } catch (err) {
      setError(err.message || "Sync failed");
    } finally {
      setSyncFromGitHubLoading(false);
    }
  }, [base, refetch]);

  const moveIssue = useCallback(
    async (issueId, newStatus) => {
      const id = String(issueId);
      setIssues((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i)),
      );
      try {
        const res = await fetch(`${base}/api/board/issues/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: newStatus,
            movedBy: currentUser?.displayName ?? "Someone",
            movedById: currentUser?.id ?? null,
          }),
        });
        if (!res.ok) throw new Error((await res.text()) || "Move failed");
        const data = await res.json();
        setIssues((prev) =>
          prev.map((i) =>
            i.id === String(data.id) ? normalizeIssue(data) : i,
          ),
        );
      } catch (err) {
        setError(err.message || "Failed to move");
        refetch();
      }
    },
    [base, refetch, currentUser],
  );

  const deleteIssue = useCallback(
    async (issueId) => {
      const id = String(issueId);
      setEditingIssue(null);
      setIssues((prev) => prev.filter((i) => i.id !== id));
      try {
        const res = await fetch(`${base}/api/board/issues/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error((await res.text()) || "Delete failed");
      } catch (err) {
        setError(err.message || "Failed to delete");
        refetch();
      }
    },
    [base, refetch],
  );

  const handleDragStart = useCallback((issueId, clientX, clientY) => {
    potentialDragRef.current = {
      issueId: String(issueId),
      startX: clientX,
      startY: clientY,
    };
  }, []);

  const draggingIssueIdRef = useRef(null);
  draggingIssueIdRef.current = draggingIssueId;

  const handleDragMove = useCallback((clientX, clientY) => {
    const pot = potentialDragRef.current;
    if (pot) {
      const dx = clientX - pot.startX;
      const dy = clientY - pot.startY;
      if (
        Math.abs(dx) <= DRAG_THRESHOLD_PX &&
        Math.abs(dy) <= DRAG_THRESHOLD_PX
      )
        return;
      setDraggingIssueId(pot.issueId);
      potentialDragRef.current = null;
    }
    const el = document.elementFromPoint(clientX, clientY);
    let node = el;
    while (node) {
      const colId = node.getAttribute?.("data-column-id");
      if (colId) {
        setDropTargetColumnId(colId);
        return;
      }
      node = node.parentElement;
    }
    setDropTargetColumnId(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    const wasDragging = draggingIssueIdRef.current;
    const targetCol = dropTargetColumnIdRef.current;
    setDraggingIssueId(null);
    setDropTargetColumnId(null);
    potentialDragRef.current = null;
    if (wasDragging && targetCol) {
      justDraggedRef.current = true;
      moveIssue(wasDragging, targetCol);
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 150);
    }
  }, [moveIssue]);

  useEffect(() => {
    if (!draggingIssueId) return;
    const onUp = () => handleDragEnd();
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [draggingIssueId, handleDragEnd]);

  const handleEditClick = useCallback((issue) => {
    if (justDraggedRef.current) return;
    setCreateModalOpen(false);
    setEditingIssue(issue);
  }, []);

  const filteredAndSortedIssues = useMemo(() => {
    let list = [...issues];
    if (filterPriority) {
      list = list.filter((i) => (i.priority || "medium") === filterPriority);
    }
    if (filterAssigneeId != null) {
      if (filterAssigneeId === "unassigned") {
        list = list.filter((i) => i.assigneeId == null);
      } else {
        list = list.filter(
          (i) => Number(i.assigneeId) === Number(filterAssigneeId),
        );
      }
    }
    const order = sortOrder === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const ta = a.createdAt ?? 0;
      const tb = b.createdAt ?? 0;
      return order * (ta - tb);
    });
    return list;
  }, [issues, filterPriority, filterAssigneeId, sortOrder]);

  const assigneesFromIssues = useMemo(() => {
    const byId = new Map();
    for (const u of users) {
      byId.set(Number(u.id), {
        id: Number(u.id),
        displayName: u.displayName || `User #${u.id}`,
      });
    }
    for (const i of issues) {
      const id = i.assigneeId;
      if (id != null && !byId.has(Number(id))) {
        const name =
          i.assigneeName ||
          (id === currentUser?.id
            ? currentUser?.displayName || "You"
            : `User #${id}`);
        byId.set(Number(id), { id: Number(id), displayName: name });
      }
    }
    const list = Array.from(byId.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
    if (issues.some((i) => i.assigneeId == null)) {
      list.unshift({ id: "unassigned", displayName: "Unassigned" });
    }
    return list;
  }, [issues, users, currentUser]);

  useEffect(() => {
    if (!filterOpen) return;
    const handleClick = (e) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(e.target)
      ) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [filterOpen]);

  const hasActiveFilters =
    filterPriority || filterAssigneeId != null || sortOrder !== "desc";

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-gray-50/60 dark:bg-gray-950/70">
      {error ? (
        <div className="flex-shrink-0 flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="rounded px-2 py-1 hover:bg-amber-200/50 dark:hover:bg-amber-800/50"
          >
            Dismiss
          </button>
        </div>
      ) : null}
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 sm:px-5 sm:py-4 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            Board
          </h1>
          <div className="inline-flex items-center rounded-full bg-gray-100 p-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            <button
              type="button"
              onClick={() => setActiveTab("board")}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full transition-colors ${
                activeTab === "board"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-50"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("stats")}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full transition-colors ${
                activeTab === "stats"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-50"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              Stats
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={syncFromGitHub}
            disabled={syncFromGitHubLoading}
            className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 sm:px-3 sm:py-2.5 text-xs sm:text-sm font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            title="Sync from GitHub"
          >
            {syncFromGitHubLoading ? (
              <span className="animate-pulse">Syncing…</span>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="hidden sm:inline">Sync from GitHub</span>
              </>
            )}
          </button>
          <div className="relative" ref={filterDropdownRef}>
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 sm:px-3 sm:py-2.5 text-xs sm:text-sm font-medium transition-colors ${
                hasActiveFilters
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              }`}
              title="Filter issues"
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
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              {hasActiveFilters && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-indigo-500" />
              )}
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-gray-200 bg-white py-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="px-3 py-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Severity
                  </p>
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="">All severities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="px-3 py-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Assignee
                  </p>
                  <select
                    value={filterAssigneeId ?? ""}
                    onChange={(e) =>
                      setFilterAssigneeId(
                        e.target.value === "" ? null : e.target.value,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="">All users</option>
                    {assigneesFromIssues.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="border-t border-gray-200 px-3 py-1.5 dark:border-gray-700">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Order
                  </p>
                  <div className="mt-1.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSortOrder("desc")}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                        sortOrder === "desc"
                          ? "bg-indigo-500 text-white dark:bg-indigo-600"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      Newest first
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortOrder("asc")}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                        sortOrder === "asc"
                          ? "bg-indigo-500 text-white dark:bg-indigo-600"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      Oldest first
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setCreateModalOpen(true);
              setEditingIssue(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500 px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium text-white shadow-sm hover:bg-indigo-600 transition-colors"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-auto p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
            Loading issues…
          </div>
        ) : activeTab === "stats" ? (
          <StatsChart
            issues={issues}
            commitsOnMain={commitsOnMain}
            commitsLoading={commitsLoading}
            commitsError={commitsError}
            ticketsByAssignee={ticketsByAssignee}
            contributors={contributors}
            onRefreshCommits={() => setHasLoadedCommits(false)}
          />
        ) : isMobile ? (
          <div className="flex h-full flex-col min-h-0">
            <div className="flex flex-shrink-0 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800 mb-3">
              {COLUMNS.map((col) => {
                const count = filteredAndSortedIssues.filter(
                  (i) => i.status === col.id,
                ).length;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setMobileColumn(col.id)}
                    className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                      mobileColumn === col.id
                        ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-50"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {col.label}{" "}
                    <span className="ml-0.5 opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pb-4">
              {filteredAndSortedIssues
                .filter((i) => i.status === mobileColumn)
                .map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    currentUser={currentUser}
                    onEdit={handleEditClick}
                    onDelete={deleteIssue}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    isDragging={draggingIssueId === issue.id}
                  />
                ))}
              {filteredAndSortedIssues.filter((i) => i.status === mobileColumn)
                .length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  No issues here yet.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex gap-3 sm:gap-4 h-full w-full min-w-0 pb-4">
            {COLUMNS.map((col) => {
              const columnIssues = filteredAndSortedIssues.filter(
                (i) => i.status === col.id,
              );
              const isDropTarget = dropTargetColumnId === col.id;
              return (
                <div
                  key={col.id}
                  data-column-id={col.id}
                  className={`
                  flex-1 min-w-[11rem] max-w-[28rem] flex min-h-0 flex-col rounded-2xl border-2 border-dashed p-3 transition-colors
                  ${col.color}
                  ${isDropTarget ? "border-indigo-400 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20" : "border-gray-200 dark:border-gray-700"}
                `}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {col.label}
                    </h2>
                    <span className="rounded-full bg-gray-200/80 dark:bg-gray-700/80 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                      {columnIssues.length}
                    </span>
                  </div>
                  <div className="flex-1 min-h-0 space-y-2 overflow-y-auto overflow-x-hidden">
                    {columnIssues.map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        currentUser={currentUser}
                        onEdit={handleEditClick}
                        onDelete={deleteIssue}
                        onDragStart={handleDragStart}
                        onDragMove={handleDragMove}
                        onDragEnd={handleDragEnd}
                        isDragging={draggingIssueId === issue.id}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <IssueModal
        issue={editingIssue}
        isOpen={createModalOpen || editingIssue != null}
        onClose={() => {
          setCreateModalOpen(false);
          setEditingIssue(null);
        }}
        onCreate={addIssue}
        onSave={updateIssue}
        currentUser={currentUser}
        users={users}
      />
    </div>
  );
}
