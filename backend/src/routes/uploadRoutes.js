const express = require("express");
const uploadController = require("../controllers/uploadController");

const router = express.Router();
const upload = uploadController.getMulterUpload();

router.post("/upload", upload, uploadController.uploadFiles);
router.get("/files/:id", uploadController.serveFile);

module.exports = router;
