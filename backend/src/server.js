require("dotenv").config();

const http = require("http");
const app = require("./app");
const { startWebSocketServer } = require("./websocket/websocketServer");
const { pool } = require("./config/db");

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await pool.query("SELECT 1");
    // eslint-disable-next-line no-console
    console.log("Connected to PostgreSQL");
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

