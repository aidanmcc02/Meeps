const db = require("../config/db");
const pushService = require("../services/pushService");

/**
 * GET /api/push-vapid-public
 * Returns the VAPID public key for the client to subscribe to push.
 */
exports.getVapidPublic = (req, res) => {
  const publicKey = pushService.getPublicKey();
  if (!publicKey) {
    return res.status(503).json({
      message: "Push notifications are not configured (missing VAPID keys)",
    });
  }
  res.json({ publicKey });
};

/**
 * POST /api/push-subscribe
 * Body: { subscription: PushSubscription JSON }
 * Saves the subscription for the authenticated user.
 */
exports.subscribe = async (req, res, next) => {
  const userId = req.userId;
  const { subscription } = req.body;

  if (!subscription || typeof subscription.endpoint !== "string") {
    return res
      .status(400)
      .json({ message: "Invalid subscription: endpoint required" });
  }

  const keys = subscription.keys;
  if (
    !keys ||
    typeof keys.p256dh !== "string" ||
    typeof keys.auth !== "string"
  ) {
    return res
      .status(400)
      .json({
        message: "Invalid subscription: keys.p256dh and keys.auth required",
      });
  }

  try {
    await db.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = $3, auth = $4, updated_at = CURRENT_TIMESTAMP`,
      [userId, subscription.endpoint, keys.p256dh, keys.auth],
    );
    return res.status(201).json({ ok: true });
  } catch (err) {
    return next(err);
  }
};
