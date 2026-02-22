/**
 * Writes public/config.json from env vars so the PWA can read backend URL at runtime.
 * Run before build:web (e.g. on Railway). Ensures backend URL is set even if
 * Vite env isn't available during build.
 */
const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "..", "public");
const httpUrl = process.env.VITE_BACKEND_HTTP_URL || "";
const wsUrl = process.env.VITE_BACKEND_WS_URL || "";
const dianaUrl = process.env.VITE_DIANA_API_URL || "";

fs.mkdirSync(publicDir, { recursive: true });

const config = {};
if (httpUrl) config.VITE_BACKEND_HTTP_URL = httpUrl.replace(/\/$/, "");
if (wsUrl) config.VITE_BACKEND_WS_URL = wsUrl;
if (dianaUrl) config.VITE_DIANA_API_URL = dianaUrl.replace(/\/$/, "");

fs.writeFileSync(
  path.join(publicDir, "config.json"),
  JSON.stringify(config, null, 0)
);
console.log("Wrote public/config.json with backend URL from env");
