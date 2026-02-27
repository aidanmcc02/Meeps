const db = require("../config/db");
const { broadcastProfileUpdate } = require("../websocket/websocketServer");
const { backfillBannersForUser } = require("../services/dianaEmbedService");

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

  const detailLevel = row.activity_detail_level;
  const activityDetailLevel =
    detailLevel === "just_application" || detailLevel === "none" ? detailLevel : "in_depth";

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    bio: row.bio || "",
    achievements,
    avatarUrl: row.avatar_url || null,
    bannerUrl: row.banner_url || null,
    leagueUsername: row.league_username || "",
    winGifUrl: row.win_gif_url || null,
    loseGifUrl: row.lose_gif_url || null,
    theme: row.theme || null,
    userType: row.user_type || "user",
    activityLoggingEnabled: row.activity_logging_enabled !== false,
    activityDetailLevel,
    doNotDisturb: row.do_not_disturb === true,
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
      "SELECT id, email, display_name, user_type, bio, achievements, avatar_url, banner_url, league_username, win_gif_url, lose_gif_url, theme, activity_logging_enabled, activity_detail_level, do_not_disturb, created_at FROM users WHERE id = $1",
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
      "SELECT id, email, display_name, user_type, bio, achievements, avatar_url, banner_url, league_username, win_gif_url, lose_gif_url, theme, activity_logging_enabled, activity_detail_level, do_not_disturb, created_at FROM users WHERE id = $1",
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

    const { displayName, bio, achievements, avatarUrl, bannerUrl, winGifUrl, loseGifUrl, leagueUsername, theme, activityLoggingEnabled, activityDetailLevel, doNotDisturb } = req.body;

  try {
    const existingResult = await db.query(
      "SELECT display_name, user_type, bio, achievements, avatar_url, banner_url, league_username, win_gif_url, lose_gif_url, theme, activity_logging_enabled, activity_detail_level, do_not_disturb FROM users WHERE id = $1",
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
    const newWinGifUrl =
      winGifUrl !== undefined ? winGifUrl || null : existing.win_gif_url;
    const newLoseGifUrl =
      loseGifUrl !== undefined ? loseGifUrl || null : existing.lose_gif_url;
    const newLeagueUsername =
      leagueUsername !== undefined ? (leagueUsername || "").trim() : (existing.league_username || "");
    const newTheme = theme !== undefined ? theme || null : existing.theme;
    const newActivityLoggingEnabled =
      activityLoggingEnabled !== undefined ? !!activityLoggingEnabled : (existing.activity_logging_enabled !== false);
    const allowedDetailLevels = ["in_depth", "just_application", "none"];
    const newActivityDetailLevel =
      activityDetailLevel !== undefined && allowedDetailLevels.includes(activityDetailLevel)
        ? activityDetailLevel
        : (existing.activity_detail_level === "just_application" || existing.activity_detail_level === "none"
          ? existing.activity_detail_level
          : "in_depth");
    const newDoNotDisturb =
      doNotDisturb !== undefined ? !!doNotDisturb : (existing.do_not_disturb === true);

    // Detect avatar uploads served from our own /api/files/:publicId route so we can pin them.
    const extractPublicId = (url) => {
      if (!url || typeof url !== "string") return null;
      try {
        // Absolute URL with /api/files/:id
        const absMatch = url.match(/\/api\/files\/([^/?#]+)/);
        if (absMatch && absMatch[1]) return absMatch[1];
      } catch (_err) {
        // ignore
      }
      return null;
    };

    const previousAvatarPublicId = extractPublicId(existing.avatar_url);
    const nextAvatarPublicId = extractPublicId(newAvatarUrl);

    const result = await db.query(
      "UPDATE users SET display_name = $2, bio = $3, achievements = $4, avatar_url = $5, banner_url = $6, league_username = $7, win_gif_url = $8, lose_gif_url = $9, theme = $10, activity_logging_enabled = $11, activity_detail_level = $12, do_not_disturb = $13 WHERE id = $1 RETURNING id, email, display_name, user_type, bio, achievements, avatar_url, banner_url, league_username, win_gif_url, lose_gif_url, theme, activity_logging_enabled, activity_detail_level, do_not_disturb, created_at",
      [userId, newDisplayName, newBio, achievementsJson, newAvatarUrl, newBannerUrl, newLeagueUsername, newWinGifUrl, newLoseGifUrl, newTheme, newActivityLoggingEnabled, newActivityDetailLevel, newDoNotDisturb]
    );

    // Pin the new avatar upload (if any) and unpin the previous one, so that
    // files actively used as profile pictures are not removed by cleanup.
    try {
      if (previousAvatarPublicId && previousAvatarPublicId !== nextAvatarPublicId) {
        await db.query("UPDATE uploads SET is_pinned = FALSE WHERE public_id = $1", [previousAvatarPublicId]);
      }
      if (nextAvatarPublicId) {
        await db.query("UPDATE uploads SET is_pinned = TRUE WHERE public_id = $1", [nextAvatarPublicId]);
      }
    } catch (pinErr) {
      // Best-effort only; do not fail profile updates because of pinning issues.
      // eslint-disable-next-line no-console
      console.warn("[profile] Failed to update avatar pinning:", pinErr?.message);
    }

    const profile = mapUserRowToProfile(result.rows[0]);

    // Notify all connected clients about the profile change
    broadcastProfileUpdate(profile);

    // Backfill Diana match embeds: add banner for matching summoners, revert to solid when summoner doesn't match any user
    try {
      await backfillBannersForUser(newLeagueUsername || "", {
        bannerUrl: newBannerUrl,
        winGifUrl: newWinGifUrl,
        loseGifUrl: newLoseGifUrl
      });
    } catch (err) {
      console.warn("[profile] Banner backfill failed:", err?.message);
    }

    return res.json(profile);
  } catch (err) {
    return next(err);
  }
};

exports.backfillDianaBanners = async (req, res, next) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const result = await db.query(
      "SELECT league_username, banner_url, win_gif_url, lose_gif_url FROM users WHERE id = $1",
      [userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
    const { league_username, banner_url, win_gif_url, lose_gif_url } = result.rows[0];
    if (!league_username || !league_username.trim()) {
      return res.status(400).json({ message: "League username not set. Add it in Gamer Tags (Edit profile)." });
    }
    const backfillResult = await backfillBannersForUser(league_username.trim(), {
      bannerUrl: banner_url,
      winGifUrl: win_gif_url,
      loseGifUrl: lose_gif_url
    });
    return res.json({
      ok: true,
      message: "Banner backfill completed",
      ...backfillResult
    });
  } catch (err) {
    return next(err);
  }
};

