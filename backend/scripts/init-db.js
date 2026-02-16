const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { initDatabase } = require("../src/config/initDb");

initDatabase()
  .then(() => {
    console.log("Database initialized for tests.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
