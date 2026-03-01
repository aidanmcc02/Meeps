const express = require("express");
const messageController = require("../controllers/messageController");

const router = express.Router();

router.get("/messages", messageController.listMessages);

module.exports = router;
