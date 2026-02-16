const path = require("path");
// Load root .env first so one file works for full-stack local dev
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config(); // backend/.env overrides if present

const http = require("http");
const app = require("./app");
const { startWebSocketServer } = require("./websocket/websocketServer");
const { pool } = require("./config/db");
const { initDatabase } = require("./config/initDb");

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await pool.query("SELECT 1");
    // eslint-disable-next-line no-console
    console.log("Connected to PostgreSQL");
    
    // Initialize database tables
    await initDatabase();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to connect to PostgreSQL:", err.message);
  }

  const server = http.createServer(app);
  startWebSocketServer(server);

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Meeps backend listening on http://localhost:${PORT}`);
  });
}

start();

