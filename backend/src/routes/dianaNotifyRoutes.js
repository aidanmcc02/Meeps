const express = require("express");
const dianaNotifyController = require("../controllers/dianaNotifyController");

const router = express.Router();

router.post("/diana-notify", dianaNotifyController.notify);

module.exports = router;
