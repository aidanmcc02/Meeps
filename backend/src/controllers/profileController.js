const db = require("../config/db");
const { broadcastProfileUpdate } = require("../websocket/websocketServer");

function mapUserRowToProfile(row) {
  let achievements = [];
  if (row.achievements) {
    try {
      const parsed = JSON.parse(row.achievements);
      if (Array.isArray(parsed)) {
        achievements = parsed;
      }
    } catch (_err) {
      // ignore malformed JSON and fall back to empty array
    }
  }

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    bio: row.bio || "",
    achievements,
    avatarUrl: row.avatar_url || null,
    bannerUrl: row.banner_url || null,
    theme: row.theme || null,
    userType: row.user_type || "user",
    activityLoggingEnabled: row.activity_logging_enabled !== false,
    createdAt: row.created_at
  };
}

exports.listUsers = async (req, res, next) => {
  try {
    const result = await db.query(
      "SELECT id, display_name FROM users WHERE user_type = $1 ORDER BY display_name ASC",
      ["user"]
    );
    const users = result.rows.map((row) => ({
      id: row.id,
      displayName: row.display_name || "Unknown",
    }));
    return res.json({ users });
  } catch (err) {
    return next(err);
  }
};

exports.getProfile = async (req, res, next) => {
  const userId = req.userId;

  try {
    const result = await db.query(
      "SELECT id, email, display_name, user_type, bio, achievements, avatar_url, banner_url, theme, activity_logging_enabled, created_at FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "user not found" });
    }

    const profile = mapUserRowToProfile(result.rows[0]);
    return res.json(profile);
  } catch (err) {
    return next(err);
  }
};

exports.getProfileById = async (req, res, next) => {
  const userId = Number(req.params.id);
  if (!userId) {
    return res.status(400).json({ message: "invalid user id" });
  }

  try {
    const result = await db.query(
      "SELECT id, email, display_name, user_type, bio, achievements, avatar_url, banner_url, theme, activity_logging_enabled, created_at FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "user not found" });
    }

    const profile = mapUserRowToProfile(result.rows[0]);
    return res.json(profile);
  } catch (err) {
    return next(err);
  }
};

exports.updateProfileById = async (req, res, next) => {
  const userId = Number(req.params.id);
  if (!userId) {
    return res.status(400).json({ message: "invalid user id" });
  }

  const { displayName, bio, achievements, avatarUrl, bannerUrl, theme, activityLoggingEnabled } = req.body;

  try {
    const existingResult = await db.query(
      "SELECT display_name, user_type, bio, achievements, avatar_url, banner_url, theme, activity_logging_enabled FROM users WHERE id = $1",
      [userId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ message: "user not found" });
    }

    const existing = existingResult.rows[0];

    let achievementsJson = existing.achievements;
    if (Array.isArray(achievements)) {
      achievementsJson = JSON.stringify(achievements);
    } else if (achievements === null) {
      achievementsJson = null;
    }

    const newDisplayName =
      displayName !== undefined ? displayName || null : existing.display_name;
    const newBio = bio !== undefined ? bio || null : existing.bio;
    const newAvatarUrl =
      avatarUrl !== undefined ? avatarUrl || null : existing.avatar_url;
    const newBannerUrl =
      bannerUrl !== undefined ? bannerUrl || null : existing.banner_url;
    const newTheme = theme !== undefined ? theme || null : existing.theme;
    const newActivityLoggingEnabled =
      activityLoggingEnabled !== undefined ? !!activityLoggingEnabled : (existing.activity_logging_enabled !== false);

    const result = await db.query(
      "UPDATE users SET display_name = $2, bio = $3, achievements = $4, avatar_url = $5, banner_url = $6, theme = $7, activity_logging_enabled = $8 WHERE id = $1 RETURNING id, email, display_name, user_type, bio, achievements, avatar_url, banner_url, theme, activity_logging_enabled, created_at",
      [userId, newDisplayName, newBio, achievementsJson, newAvatarUrl, newBannerUrl, newTheme, newActivityLoggingEnabled]
    );

    const profile = mapUserRowToProfile(result.rows[0]);

    // Notify all connected clients about the profile change
    broadcastProfileUpdate(profile);

    return res.json(profile);
  } catch (err) {
    return next(err);
  }
};

