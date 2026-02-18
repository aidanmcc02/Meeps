/**
 * Copies icon to public/ for PWA (iOS + Android).
 * Uses project root icon.png if present, otherwise src-tauri/icons/icon.png.
 * Run from repo root: node scripts/generate-pwa-icons.js
 */
const fs = require("fs");
const path = require("path");

const rootIcon = path.join(__dirname, "..", "icon.png");
const tauriIcon = path.join(__dirname, "..", "src-tauri", "icons", "icon.png");
const src = fs.existsSync(rootIcon) ? rootIcon : tauriIcon;
const publicDir = path.join(__dirname, "..", "public");

if (!fs.existsSync(src)) {
  console.error("Put an icon.png in the project root, or run: npm run generate-icon");
  process.exit(1);
}

fs.mkdirSync(publicDir, { recursive: true });
const icon = fs.readFileSync(src);

fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), icon);
fs.writeFileSync(path.join(publicDir, "icon-192.png"), icon);
fs.writeFileSync(path.join(publicDir, "icon-512.png"), icon);

console.log("Created public/apple-touch-icon.png, icon-192.png, icon-512.png");
if (src === rootIcon) {
  console.log("(from project root icon.png – use a square PNG, ideally 512×512 or larger for best quality)");
} else {
  console.log("(from src-tauri/icons/icon.png)");
}
