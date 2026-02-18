const path = require("path");
// Load root .env first so one file works for full-stack local dev
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config(); // backend/.env overrides if present

const http = require("http");
const app = require("./app");
const { startWebSocketServer } = require("./websocket/websocketServer");
const { pool } = require("./config/db");
const { initDatabase } = require("./config/initDb");
const { cleanupExpiredUploads } = require("./controllers/uploadController");
const { startTracker, stopTracker } = require("./services/valorantMatchTracker");

const PORT = process.env.PORT || 4000;
const UPLOAD_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let server;
let cleanupInterval;

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

  server = http.createServer(app);
  startWebSocketServer(server);

  // Clean up expired file uploads (older than 3 days) every hour
  setTimeout(() => cleanupExpiredUploads(), 60 * 1000);
  cleanupInterval = setInterval(cleanupExpiredUploads, UPLOAD_CLEANUP_INTERVAL_MS);

  server.listen(PORT, "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`Meeps backend listening on port ${PORT}`);
    startTracker();
  });
}

function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`${signal} received, shutting down gracefully`);
  stopTracker();
  if (cleanupInterval) clearInterval(cleanupInterval);
  if (server) {
    server.close(() => {
      pool.end().then(() => process.exit(0)).catch(() => process.exit(0));
    });
    // Force exit after 10s if close hangs
    setTimeout(() => process.exit(0), 10000);
  } else {
    pool.end().then(() => process.exit(0)).catch(() => process.exit(0));
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();

