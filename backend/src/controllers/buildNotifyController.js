const db = require("../config/db");
const { broadcastMessagePayload } = require("../websocket/websocketServer");

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
  const receivedSecret = getSecret(req);
  console.log("[build-notify] Request received. BUILD_WEBHOOK_SECRET configured:", !!secret, "| Received secret present:", !!receivedSecret, "| Match:", secret ? receivedSecret === secret : "n/a");
  if (!secret) {
    console.log("[build-notify] Not running: BUILD_WEBHOOK_SECRET is not set on the server (add it in Railway/backend env vars).");
    return res.status(503).json({ error: "Build notifications not configured" });
  }
  if (receivedSecret !== secret) {
    console.log("[build-notify] Not running: secret mismatch. Ensure BUILD_WEBHOOK_SECRET in GitHub Secrets matches the value set on the backend.");
    return res.status(401).json({ error: "Invalid build secret" });
  }
  console.log("[build-notify] Checks passed. Body:", JSON.stringify(req.body || {}));

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
    const result = await db.query(
      "INSERT INTO messages (channel, sender_name, content, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING id, created_at",
      [BUILDS_CHANNEL, SENDER_NAME, content]
    );
    const row = result.rows[0];
    const payload = {
      id: row.id,
      channel: BUILDS_CHANNEL,
      sender: SENDER_NAME,
      senderId: undefined,
      content,
      createdAt: row.created_at
    };
    broadcastMessagePayload(payload);
    console.log("[build-notify] Message inserted and broadcast. id:", row.id);
    return res.status(201).json({ ok: true, channel: BUILDS_CHANNEL });
  } catch (err) {
    console.error("[build-notify] DB/insert error:", err.message);
    return next(err);
  }
};
