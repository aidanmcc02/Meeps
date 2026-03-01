const express = require("express");
const gifController = require("../controllers/gifController");

const router = express.Router();

router.get("/search-gifs", gifController.searchGifs);

module.exports = router;
