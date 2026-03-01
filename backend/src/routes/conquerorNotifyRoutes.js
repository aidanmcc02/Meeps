const express = require("express");
const conquerorNotifyController = require("../controllers/conquerorNotifyController");

const router = express.Router();

router.post("/conqueror-notify", conquerorNotifyController.notify);
router.get("/conqueror-linked-users", conquerorNotifyController.getLinkedUsers);

module.exports = router;
