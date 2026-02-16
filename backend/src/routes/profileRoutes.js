const express = require("express");
const profileController = require("../controllers/profileController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

// Authenticated current-user profile (unused by frontend skeleton but available)
router.get("/profile", authenticate, profileController.getProfile);

// Public endpoints by user id – used by the frontend skeleton
router.get("/profile/:id", profileController.getProfileById);
router.put("/profile/:id", profileController.updateProfileById);

module.exports = router;

