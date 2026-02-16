const db = require("../config/db");

const BUILDS_CHANNEL = "Builds";
const SENDER_NAME = "GitHub Actions";

function getSecret(req) {
  const header = req.headers["x-build-secret"];
  if (header) return header;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

exports.notify = async (req, res, next) => {
  const secret = process.env.BUILD_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(503).json({ error: "Build notifications not configured" });
  }
  if (getSecret(req) !== secret) {
    return res.status(401).json({ error: "Invalid build secret" });
  }

  const { status, workflow, runUrl, branch, message } = req.body || {};
  const normalizedStatus = status === "failure" ? "failure" : "success";
  const emoji = normalizedStatus === "success" ? "✅" : "❌";
  const parts = [
    `${emoji} **Build ${normalizedStatus}**`,
    workflow ? `Workflow: ${workflow}` : null,
    branch ? `Branch: ${branch}` : null,
    runUrl ? `[View run](${runUrl})` : null,
    message ? message : null
  ].filter(Boolean);
  const content = parts.join("\n");

  try {
    await db.query(
      "INSERT INTO messages (channel, sender_name, content) VALUES ($1, $2, $3) RETURNING id, created_at",
      [BUILDS_CHANNEL, SENDER_NAME, content]
    );
    return res.status(201).json({ ok: true, channel: BUILDS_CHANNEL });
  } catch (err) {
    return next(err);
  }
};
