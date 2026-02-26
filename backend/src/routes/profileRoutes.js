const express = require("express");
const profileController = require("../controllers/profileController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

// Authenticated current-user profile (unused by frontend skeleton but available)
router.get("/profile", authenticate, profileController.getProfile);

// List users (user_type = 'user') for assignee dropdown etc.
router.get("/users", profileController.listUsers);

// Public endpoints by user id – used by the frontend skeleton
router.get("/profile/:id", profileController.getProfileById);
router.put("/profile/:id", profileController.updateProfileById);

// Manually trigger Diana banner backfill for current user (e.g. after adding league username)
router.post("/profile/backfill-diana-banners", authenticate, profileController.backfillDianaBanners);

module.exports = router;

