const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const {
  linkAccount,
  listPlayers,
  getPlayerStats,
  unlinkAccount,
  getStatus,
  getLeaderboardData,
} = require("../controllers/valorantController");

const router = express.Router();

router.post("/valorant/link", authenticate, linkAccount);
router.get("/valorant/players", listPlayers);
router.get("/valorant/players/:userId/stats", getPlayerStats);
router.delete("/valorant/link", authenticate, unlinkAccount);
router.get("/valorant/status", getStatus);
router.get("/valorant/leaderboard", getLeaderboardData);

module.exports = router;
