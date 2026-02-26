const express = require("express");
const boardController = require("../controllers/boardController");

const router = express.Router();

router.get("/board/issues", boardController.listIssues);
router.post("/board/issues", boardController.createIssue);
router.patch("/board/issues/:id", boardController.updateIssue);
router.delete("/board/issues/:id", boardController.deleteIssue);
router.get("/board/stats", boardController.getStats);

module.exports = router;
