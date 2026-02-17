import React, { useState, useEffect, useCallback } from "react";

const COLUMNS = [
  { id: "todo", label: "To Do", color: "bg-slate-100 dark:bg-slate-800/60" },
  { id: "in_progress", label: "In Progress", color: "bg-amber-50 dark:bg-amber-900/20" },
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

function IssueCard({ issue, currentUser, onEdit, onDelete, onDropInColumn }) {
  const [isDragging, setIsDragging] = useState(false);
  const assigneeName = issue.assigneeName || (issue.assigneeId === currentUser?.id ? (currentUser?.displayName || "You") : "Unassigned");

  const priorityColors = {
    low: "bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200",
    medium: "bg-amber-200 text-amber-800 dark:bg-amber-700/50 dark:text-amber-200",
    high: "bg-rose-200 text-rose-800 dark:bg-rose-700/50 dark:text-rose-200",
  };
  const priorityLabel = { low: "Low", medium: "Medium", high: "High" }[issue.priority] || "Medium";

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/meeps-issue", issue.id);
        e.dataTransfer.setData("text/plain", issue.id);
        e.dataTransfer.effectAllowed = "move";
        setIsDragging(true);
      }}
      onDragEnd={() => setIsDragging(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = e.dataTransfer.getData("application/meeps-issue") || e.dataTransfer.getData("text/plain");
        if (id && id !== issue.id && onDropInColumn) onDropInColumn(id);
      }}
      className={`
        group rounded-xl border bg-white p-3 shadow-sm transition-all dark:bg-gray-800/90 dark:border-gray-700
        hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500/50
        ${isDragging ? "opacity-50 scale-95" : "cursor-grab active:cursor-grabbing"}
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
        onClick={() => onEdit(issue)}
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
          onClick={() => onEdit(issue)}
          className="text-[10px] font-medium text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
        >
          {assigneeName}
        </button>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onEdit(issue)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            title="Edit"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onDelete(issue.id)}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            title="Delete"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateIssueModal({ isOpen, onClose, onCreate, currentUser }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignToMe, setAssignToMe] = useState(true);

  const reset = useCallback(() => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setAssignToMe(true);
  }, []);

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, reset]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onCreate({
      title: t,
      description: description.trim() || null,
      status: "todo",
      priority: priority || "medium",
      assigneeId: assignToMe ? (currentUser?.id ?? null) : null,
      assigneeName: assignToMe ? (currentUser?.displayName || "Me") : null,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New issue</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Add title, description, and assign yourself or leave unassigned.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fix login button"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details…"
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 resize-none"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignToMe}
                  onChange={(e) => setAssignToMe(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Assign to me</span>
              </label>
            </div>
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
              Create issue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditIssueModal({ issue, isOpen, onClose, onSave, currentUser }) {
  const [title, setTitle] = useState(issue?.title ?? "");
  const [description, setDescription] = useState(issue?.description ?? "");
  const [priority, setPriority] = useState(issue?.priority ?? "medium");
  const [assigneeId, setAssigneeId] = useState(issue?.assigneeId ?? null);
  const [assigneeName, setAssigneeName] = useState(issue?.assigneeName ?? null);

  useEffect(() => {
    if (issue) {
      setTitle(issue.title);
      setDescription(issue.description ?? "");
      setPriority(issue.priority ?? "medium");
      setAssigneeId(issue.assigneeId ?? null);
      setAssigneeName(issue.assigneeName ?? null);
    }
  }, [issue]);

  if (!isOpen || !issue) return null;

  const assignToMe = () => {
    setAssigneeId(currentUser?.id ?? null);
    setAssigneeName(currentUser?.displayName || "Me");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      ...issue,
      title: title.trim(),
      description: description.trim() || null,
      priority: priority || "medium",
      assigneeId,
      assigneeName: assigneeId === currentUser?.id ? (currentUser?.displayName || "Me") : assigneeName,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit issue</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">#{String(issue.id).slice(-7)}</p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Priority</label>
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
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Assignee</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={assignToMe}
                className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-200 dark:hover:bg-indigo-900/60"
              >
                Assign to me
              </button>
              <button
                type="button"
                onClick={() => {
                  setAssigneeId(null);
                  setAssigneeName("Unassigned");
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Unassign
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {assigneeId === currentUser?.id ? (currentUser?.displayName || "You") : (assigneeName || "Unassigned")}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button type="submit" disabled={!title.trim()} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Board({ currentUser, apiBase }) {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const base = apiBase || "";

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
    return () => { cancelled = true; };
  }, [base]);

  const addIssue = useCallback(async (payload) => {
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
      if (!res.ok) throw new Error(await res.text() || "Create failed");
      const created = await res.json();
      setIssues((prev) => [...prev, normalizeIssue(created)]);
    } catch (err) {
      setError(err.message || "Failed to create issue");
    }
  }, [base]);

  const updateIssue = useCallback(async (updated) => {
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
        }),
      });
      if (!res.ok) throw new Error(await res.text() || "Update failed");
      const data = await res.json();
      setIssues((prev) => prev.map((i) => (i.id === String(data.id) ? normalizeIssue(data) : i)));
      setEditingIssue(null);
    } catch (err) {
      setError(err.message || "Failed to update");
    }
  }, [base]);

  const refetch = useCallback(() => {
    fetch(`${base}/api/board/issues`)
      .then((res) => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
      .then((data) => Array.isArray(data.issues) && setIssues(data.issues.map(normalizeIssue)))
      .catch((err) => setError(err.message || "Failed to load"));
  }, [base]);

  const moveIssue = useCallback(async (issueId, newStatus) => {
    const id = String(issueId);
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i)));
    try {
      const res = await fetch(`${base}/api/board/issues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(await res.text() || "Move failed");
      const data = await res.json();
      setIssues((prev) => prev.map((i) => (i.id === String(data.id) ? normalizeIssue(data) : i)));
    } catch (err) {
      setError(err.message || "Failed to move");
      refetch();
    }
  }, [base, refetch]);

  const deleteIssue = useCallback(async (issueId) => {
    const id = String(issueId);
    setEditingIssue(null);
    setIssues((prev) => prev.filter((i) => i.id !== id));
    try {
      const res = await fetch(`${base}/api/board/issues/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text() || "Delete failed");
    } catch (err) {
      setError(err.message || "Failed to delete");
      refetch();
    }
  }, [base, refetch]);

  const handleDrop = (e, columnId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);
    const issueId =
      e.dataTransfer.getData("application/meeps-issue") ||
      e.dataTransfer.getData("text/plain");
    if (issueId) moveIssue(issueId, columnId);
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverColumn(null);
  };


  return (
    <div className="flex h-full flex-col bg-gray-50/60 dark:bg-gray-950/70">
      {error ? (
        <div className="flex-shrink-0 flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="rounded px-2 py-1 hover:bg-amber-200/50 dark:hover:bg-amber-800/50">Dismiss</button>
        </div>
      ) : null}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Board</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Drag cards between columns. Create issues and assign yourself or others.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New issue
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">Loading issues…</div>
        ) : (
        <div className="flex gap-4 h-full min-w-max pb-4">
          {COLUMNS.map((col) => {
            const columnIssues = issues.filter((i) => i.status === col.id);
            const isDropTarget = dragOverColumn === col.id;
            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`
                  flex-shrink-0 w-72 flex flex-col rounded-2xl border-2 border-dashed p-3 transition-colors
                  ${col.color}
                  ${isDropTarget ? "border-indigo-400 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20" : "border-gray-200 dark:border-gray-700"}
                `}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{col.label}</h2>
                  <span className="rounded-full bg-gray-200/80 dark:bg-gray-700/80 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                    {columnIssues.length}
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto min-h-[120px]">
                  {columnIssues.map((issue) => (
                    <IssueCard
                        key={issue.id}
                        issue={issue}
                        currentUser={currentUser}
                        onEdit={setEditingIssue}
                        onDelete={deleteIssue}
                        onDropInColumn={(id) => moveIssue(id, col.id)}
                      />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      <CreateIssueModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={addIssue}
        currentUser={currentUser}
      />
      <EditIssueModal
        issue={editingIssue}
        isOpen={editingIssue != null}
        onClose={() => setEditingIssue(null)}
        onSave={updateIssue}
        currentUser={currentUser}
      />
    </div>
  );
}
