const router = require("express").Router();
const pushController = require("../controllers/pushController");
const { authenticate } = require("../middleware/authMiddleware");

router.get("/push-vapid-public", pushController.getVapidPublic);
router.post("/push-subscribe", authenticate, pushController.subscribe);

module.exports = router;
