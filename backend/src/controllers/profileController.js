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
    createdAt: row.created_at
  };
}

exports.getProfile = async (req, res, next) => {
  const userId = req.userId;

  try {
    const result = await db.query(
      "SELECT id, email, display_name, bio, achievements, avatar_url, banner_url, theme, created_at FROM users WHERE id = $1",
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
      "SELECT id, email, display_name, bio, achievements, avatar_url, banner_url, theme, created_at FROM users WHERE id = $1",
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

  const { displayName, bio, achievements, avatarUrl, bannerUrl, theme } = req.body;

  try {
    const existingResult = await db.query(
      "SELECT display_name, bio, achievements, avatar_url, banner_url, theme FROM users WHERE id = $1",
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

    const result = await db.query(
      "UPDATE users SET display_name = $2, bio = $3, achievements = $4, avatar_url = $5, banner_url = $6, theme = $7 WHERE id = $1 RETURNING id, email, display_name, bio, achievements, avatar_url, banner_url, theme, created_at",
      [userId, newDisplayName, newBio, achievementsJson, newAvatarUrl, newBannerUrl, newTheme]
    );

    const profile = mapUserRowToProfile(result.rows[0]);

    // Notify all connected clients about the profile change
    broadcastProfileUpdate(profile);

    return res.json(profile);
  } catch (err) {
    return next(err);
  }
};

