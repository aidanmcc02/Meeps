/**
 * Web Push service for mention notifications when the app is closed (e.g. iOS PWA).
 * Requires VAPID keys in env (see README).
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
      vapidPrivateKey
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

/**
 * Send a mention notification to users who are not currently connected via WebSocket.
 * @param {number[]} userIds - User IDs to notify (will skip if no subscription)
 * @param {object} payload - { channel, sender, body }
 */
async function sendMentionPushToUsers(userIds, payload) {
  if (!isConfigured() || !userIds || userIds.length === 0) return;

  const { channel, sender, body } = payload;
  const title = "Meeps – mentioned you";
  const bodyText =
    typeof body === "string" && body.trim()
      ? body.trim().slice(0, 80) + (body.length > 80 ? "…" : "")
      : "New message";
  const notificationBody = `#${channel || "general"}: ${sender || "Someone"} – ${bodyText}`;

  const pushPayload = JSON.stringify({
    title,
    body: notificationBody,
    icon: "/apple-touch-icon.png",
    tag: `mention-${channel || "general"}`,
    data: { url: "/" }
  });

  for (const userId of userIds) {
    try {
      const result = await db.query(
        "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
        [userId]
      );
      for (const row of result.rows) {
        const subscription = {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth
          }
        };
        try {
          await webpush.sendNotification(subscription, pushPayload);
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await db.query(
              "DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2",
              [userId, row.endpoint]
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
  sendMentionPushToUsers
};
