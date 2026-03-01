const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

console.log("Auth routes loaded");

router.post("/register", authController.register);
router.post("/login", authController.login);

module.exports = router;
