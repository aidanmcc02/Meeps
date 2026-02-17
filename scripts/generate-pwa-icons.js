/**
 * Copies Tauri icon to public/ for PWA (iOS + Android).
 * Run from repo root: node scripts/generate-pwa-icons.js
 * For best quality on iOS, replace public/apple-touch-icon.png with a 180x180 PNG.
 */
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "src-tauri", "icons", "icon.png");
const publicDir = path.join(__dirname, "..", "public");

if (!fs.existsSync(src)) {
  console.error("Run generate-icon.js first to create src-tauri/icons/icon.png");
  process.exit(1);
}

fs.mkdirSync(publicDir, { recursive: true });
const icon = fs.readFileSync(src);

fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), icon);
fs.writeFileSync(path.join(publicDir, "icon-192.png"), icon);
fs.writeFileSync(path.join(publicDir, "icon-512.png"), icon);

console.log("Created public/apple-touch-icon.png, icon-192.png, icon-512.png (from Tauri icon)");
console.log("Tip: Replace with 180x180, 192x192, 512x512 PNGs for best PWA quality.");
