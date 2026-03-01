/**
 * Web Push service for message notifications when the app is closed (e.g. iOS PWA).
 * Requires VAPID keys in env (see README).
 * Notifies on all messages (not just @mentions).
 */
const webpush = require("web-push");
const db = require("../config/db");

let vapidPublicKey = null;
let vapidPrivateKey = null;
let initialized = false;

function init() {
  if (initialized) return;
  vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(
      "mailto:meeps@example.com",
      vapidPublicKey,
      vapidPrivateKey,
    );
    initialized = true;
  }
}

/**
 * @returns {string|null} VAPID public key or null if not configured
 */
function getPublicKey() {
  init();
  return vapidPublicKey || null;
}

/**
 * @returns {boolean} true if push is configured and can send
 */
function isConfigured() {
  init();
  return initialized;
}

/** Strip basic markdown for plain text notification preview */
function stripMarkdown(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
}

/**
 * Send a message notification to users who are not currently connected via WebSocket.
 * Format: "Meeps" (title), "SenderName: message preview" (body) – no channel name.
 * @param {number[]} userIds - User IDs to notify (will skip if no subscription)
 * @param {object} payload - { channel, sender, body }
 */
async function sendMessagePushToUsers(userIds, payload) {
  if (!isConfigured() || !userIds || userIds.length === 0) return;

  const { channel, sender, body } = payload;
  const title = "Meeps";
  const rawBody = typeof body === "string" ? body : "";
  const plainPreview = stripMarkdown(rawBody).slice(0, 80);
  const bodyText =
    plainPreview + (plainPreview.length >= 80 ? "…" : "") || "New message";
  const notificationBody = `${sender || "Someone"}: ${bodyText}`;

  const pushPayload = JSON.stringify({
    title,
    body: notificationBody,
    icon: "/apple-touch-icon.png",
    tag: `message-${channel || "general"}`,
    data: { url: "/" },
  });

  for (const userId of userIds) {
    try {
      // Send to only one subscription per user to avoid duplicate notifications on the same
      // device (e.g. iPhone with both Safari and PWA subscriptions).
      const result = await db.query(
        "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1",
        [userId],
      );
      for (const row of result.rows) {
        const subscription = {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth,
          },
        };
        try {
          await webpush.sendNotification(subscription, pushPayload);
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await db.query(
              "DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2",
              [userId, row.endpoint],
            );
          }
        }
      }
    } catch (err) {
      console.error("[push] Error sending to user", userId, err.message);
    }
  }
}

module.exports = {
  getPublicKey,
  isConfigured,
  sendMessagePushToUsers,
};
