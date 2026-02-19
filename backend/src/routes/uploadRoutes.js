const express = require("express");
const uploadController = require("../controllers/uploadController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();
const upload = uploadController.getMulterUpload();

router.post("/upload", authenticate, upload, uploadController.uploadFiles);
router.get("/files/:id", authenticate, uploadController.serveFile);

module.exports = router;
