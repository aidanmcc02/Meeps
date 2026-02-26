const db = require("../config/db");

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
