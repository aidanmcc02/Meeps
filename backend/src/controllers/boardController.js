const db = require("../config/db");
const axios = require("axios");
const { exec } = require("child_process");
const path = require("path");
const util = require("util");

const execAsync = util.promisify(exec);

const GIT_TIMEOUT_MS = 8000;
const BRANCHES_TO_TRY = ["main", "master", "HEAD"];
const DEFAULT_GITHUB_REPO = "aidanmcc02/Meeps";
const GITHUB_CACHE_MS = 5 * 60 * 1000; // 5 minutes
const githubCommitCache = new Map(); // slug -> { count, at }
const githubContributorsCache = new Map(); // slug -> { list, at }

/**
 * Normalize GitHub URL or "owner/repo" to "owner/repo".
 */
function parseGitHubRepoSlug(input) {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/github\.com[/:](\w[-.\w]*)\/(\w[-.\w]*)/i);
  if (urlMatch) return `${urlMatch[1]}/${urlMatch[2].replace(/\.git$/, "")}`;
  if (/^[\w.-]+\/[\w.-]+$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Get commit count for default branch from GitHub API (no token needed for public repos).
 */
async function getGitHubCommitCount(repoSlug) {
  const slug = parseGitHubRepoSlug(repoSlug);
  if (!slug) return null;
  const cached = githubCommitCache.get(slug);
  if (cached && Date.now() - cached.at < GITHUB_CACHE_MS) return cached.count;
  const [owner, repo] = slug.split("/");
  try {
    const { data, headers, status } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits`,
      {
        params: { per_page: 1 },
        headers: { "User-Agent": "Meeps-Board-Stats", Accept: "application/vnd.github.v3+json" },
        timeout: 10000,
        validateStatus: () => true,
      }
    );
    if (status !== 200) return null;
    let count = null;
    const link = headers?.link;
    if (link) {
      const lastMatch = link.match(/<[^>]+[?&]page=(\d+)>;\s*rel="last"/);
      if (lastMatch) count = parseInt(lastMatch[1], 10) || null;
    }
    if (count == null) count = Array.isArray(data) && data.length > 0 ? 1 : 0;
    if (count != null) githubCommitCache.set(slug, { count, at: Date.now() });
    return count;
  } catch (_) {
    return null;
  }
}

/**
 * Get repo contributors (login + contributions) from GitHub API.
 */
async function getGitHubContributors(repoSlug) {
  const slug = parseGitHubRepoSlug(repoSlug);
  if (!slug) return null;
  const cached = githubContributorsCache.get(slug);
  if (cached && Date.now() - cached.at < GITHUB_CACHE_MS) return cached.list;
  const [owner, repo] = slug.split("/");
  try {
    const { data, status } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contributors`,
      {
        params: { per_page: 100 },
        headers: { "User-Agent": "Meeps-Board-Stats", Accept: "application/vnd.github.v3+json" },
        timeout: 10000,
        validateStatus: () => true,
      }
    );
    if (status !== 200 || !Array.isArray(data)) return null;
    const list = data.map((c) => ({
      login: c.login || String(c.id),
      contributions: typeof c.contributions === "number" ? c.contributions : 0,
    })).sort((a, b) => b.contributions - a.contributions);
    githubContributorsCache.set(slug, { list, at: Date.now() });
    return list;
  } catch (_) {
    return null;
  }
}

async function getGitCommitCount(cwd) {
  for (const branch of BRANCHES_TO_TRY) {
    try {
      const { stdout } = await execAsync(`git rev-list --count ${branch}`, {
        cwd,
        timeout: GIT_TIMEOUT_MS,
        maxBuffer: 1024,
      });
      const parsed = parseInt(String(stdout).trim(), 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return { count: parsed, branch };
      }
    } catch (_) {
      continue;
    }
  }
  return null;
}

function rowToIssue(row) {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    priority: row.priority || "medium",
    assigneeId: row.assignee_id ?? null,
    assigneeName: row.assignee_name ?? null,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
  };
}

exports.listIssues = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, title, description, status, priority, assignee_id, assignee_name, created_at, updated_at
       FROM board_issues
       ORDER BY created_at DESC`
    );
    const issues = result.rows.map(rowToIssue);
    return res.json({ issues });
  } catch (err) {
    return next(err);
  }
};

exports.createIssue = async (req, res, next) => {
  try {
    const { title, description, status, priority, assigneeId, assigneeName } = req.body;
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "title is required" });
    }
    const result = await db.query(
      `INSERT INTO board_issues (title, description, status, priority, assignee_id, assignee_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, description, status, priority, assignee_id, assignee_name, created_at, updated_at`,
      [
        title.trim(),
        description && typeof description === "string" ? description.trim() : null,
        status === "todo" || status === "in_progress" || status === "done" ? status : "todo",
        priority === "low" || priority === "medium" || priority === "high" ? priority : "medium",
        assigneeId != null ? Number(assigneeId) : null,
        assigneeName && typeof assigneeName === "string" ? assigneeName.trim() : null,
      ]
    );
    const row = result.rows[0];
    return res.status(201).json(rowToIssue(row));
  } catch (err) {
    return next(err);
  }
};

exports.updateIssue = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: "invalid issue id" });
    }
    const { title, description, status, priority, assigneeId, assigneeName } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;
    if (typeof title === "string") {
      updates.push(`title = $${paramIndex++}`);
      values.push(title.trim());
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description && typeof description === "string" ? description.trim() : null);
    }
    if (status === "todo" || status === "in_progress" || status === "done") {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (priority === "low" || priority === "medium" || priority === "high") {
      updates.push(`priority = $${paramIndex++}`);
      values.push(priority);
    }
    if (assigneeId !== undefined) {
      updates.push(`assignee_id = $${paramIndex++}`);
      values.push(assigneeId != null ? Number(assigneeId) : null);
    }
    if (assigneeName !== undefined) {
      updates.push(`assignee_name = $${paramIndex++}`);
      values.push(assigneeName && typeof assigneeName === "string" ? assigneeName.trim() : null);
    }
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    if (updates.length <= 1) {
      return res.status(400).json({ message: "no fields to update" });
    }

    const result = await db.query(
      `UPDATE board_issues SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING id, title, description, status, priority, assignee_id, assignee_name, created_at, updated_at`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "issue not found" });
    }
    return res.json(rowToIssue(result.rows[0]));
  } catch (err) {
    return next(err);
  }
};

exports.deleteIssue = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: "invalid issue id" });
    }
    const result = await db.query("DELETE FROM board_issues WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "issue not found" });
    }
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const issuesResult = await db.query(
      "SELECT status FROM board_issues"
    );

    const issuesByStatus = {
      todo: 0,
      in_progress: 0,
      done: 0,
    };

    for (const row of issuesResult.rows) {
      const status = row.status || "todo";
      if (status === "in_progress") {
        issuesByStatus.in_progress += 1;
      } else if (status === "done") {
        issuesByStatus.done += 1;
      } else {
        issuesByStatus.todo += 1;
      }
    }

    const ticketsTaken = issuesByStatus.in_progress + issuesByStatus.done;

    const ticketsByAssigneeResult = await db.query(
      `SELECT assignee_id, assignee_name, COUNT(*) AS tickets_taken
       FROM board_issues
       WHERE status IN ('in_progress', 'done')
       GROUP BY assignee_id, assignee_name
       ORDER BY tickets_taken DESC`
    );
    const ticketsByAssignee = ticketsByAssigneeResult.rows.map((row) => ({
      assigneeId: row.assignee_id ?? null,
      assigneeName: row.assignee_name && String(row.assignee_name).trim() ? row.assignee_name : "Unassigned",
      ticketsTaken: parseInt(row.tickets_taken, 10) || 0,
    }));

    let commitsOnMain = null;
    let commitsError = null;
    let contributors = [];

    const githubRepo =
      (req.query.githubRepo && typeof req.query.githubRepo === "string"
        ? req.query.githubRepo.trim()
        : null) || process.env.MEEPS_GITHUB_REPO || DEFAULT_GITHUB_REPO;

    const fromGitHub = await getGitHubCommitCount(githubRepo);
    if (fromGitHub != null) {
      commitsOnMain = fromGitHub;
      commitsError = null;
    } else {
      const repoPath =
        req.query.repoPath && typeof req.query.repoPath === "string"
          ? req.query.repoPath.trim()
          : process.env.MEEPS_GIT_REPO_PATH || null;
      const dirsToTry = repoPath
        ? [path.resolve(repoPath)]
        : [
            process.cwd(),
            path.resolve(process.cwd(), ".."),
            path.resolve(process.cwd(), "..", ".."),
          ];
      for (const dir of dirsToTry) {
        const result = await getGitCommitCount(dir);
        if (result) {
          commitsOnMain = result.count;
          commitsError = null;
          break;
        }
      }
      if (commitsOnMain == null) {
        commitsError =
          "Could not get commits from GitHub. Check MEEPS_GITHUB_REPO or rate limits.";
      }
    }

    const contributorsList = await getGitHubContributors(githubRepo);
    if (Array.isArray(contributorsList)) contributors = contributorsList;

    return res.json({
      issuesByStatus,
      ticketsTaken,
      ticketsByAssignee,
      commitsOnMain,
      commitsError,
      contributors,
    });
  } catch (err) {
    return next(err);
  }
};
