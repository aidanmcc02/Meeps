const { pool } = require("./db");
const { runMigrations } = require("../../scripts/run-migrations");

const DIANA_EMAIL = "diana@bot.meeps.local";
const DIANA_DISPLAY_NAME = "Diana";
const CONQUEROR_EMAIL = "conqueror@bot.meeps.local";
const CONQUEROR_DISPLAY_NAME = "Conqueror";

async function ensureDianaBotUser() {
  const hash = process.env.DIANA_PASSWORD_HASH;
  if (!hash || typeof hash !== "string" || hash.trim() === "") {
    return;
  }
  await pool.query(
    `INSERT INTO users (email, password_hash, display_name, user_type, created_at, updated_at)
     VALUES ($1, $2, $3, 'bot', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       display_name = EXCLUDED.display_name,
       user_type = EXCLUDED.user_type,
       updated_at = CURRENT_TIMESTAMP`,
    [DIANA_EMAIL, hash.trim(), DIANA_DISPLAY_NAME],
  );
}

async function ensureConquerorBotUser() {
  const hash = process.env.CONQUEROR_PASSWORD_HASH;
  if (!hash || typeof hash !== "string" || hash.trim() === "") {
    return;
  }
  await pool.query(
    `INSERT INTO users (email, password_hash, display_name, user_type, created_at, updated_at)
     VALUES ($1, $2, $3, 'bot', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       display_name = EXCLUDED.display_name,
       user_type = EXCLUDED.user_type,
       updated_at = CURRENT_TIMESTAMP`,
    [CONQUEROR_EMAIL, hash.trim(), CONQUEROR_DISPLAY_NAME],
  );
}

async function initDatabase() {
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    throw new Error(`Database connection failed: ${err.message}`);
  }

  try {
    await runMigrations({ silent: true });
    await ensureDianaBotUser();
    await ensureConquerorBotUser();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}

module.exports = { initDatabase };
