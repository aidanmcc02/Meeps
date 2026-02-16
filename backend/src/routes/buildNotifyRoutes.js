const express = require("express");
const buildNotifyController = require("../controllers/buildNotifyController");

const router = express.Router();

router.post("/build-notify", buildNotifyController.notify);

module.exports = router;
