const { pool } = require("./db");
const { runMigrations } = require("../../scripts/run-migrations");

async function initDatabase() {
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    throw new Error(`Database connection failed: ${err.message}`);
  }

  try {
    await runMigrations({ silent: true });
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}

module.exports = { initDatabase };
