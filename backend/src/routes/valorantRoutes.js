const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const {
  linkAccount,
  listPlayers,
  getPlayerStats,
  unlinkAccount,
} = require("../controllers/valorantController");

const router = express.Router();

router.post("/valorant/link", authenticate, linkAccount);
router.get("/valorant/players", authenticate, listPlayers);
router.get("/valorant/players/:userId/stats", authenticate, getPlayerStats);
router.delete("/valorant/link", authenticate, unlinkAccount);

module.exports = router;
