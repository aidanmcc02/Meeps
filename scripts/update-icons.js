/**
 * Use project root icon.png for Windows (Tauri) and iPhone/PWA.
 * Run from repo root: npm run update-icons
 * Requires icon.png in the project root (square PNG, 512×512 or larger recommended).
 */
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const rootIcon = path.join(rootDir, "icon.png");

if (!fs.existsSync(rootIcon)) {
  console.error(
    "icon.png not found in project root. Add your app icon as icon.png and run again.",
  );
  process.exit(1);
}

console.log("Generating Tauri icons (Windows, etc.) from icon.png…");
execSync("npx tauri icon icon.png", { cwd: rootDir, stdio: "inherit" });

console.log("Copying icon to public/ for PWA (iPhone)…");
require("./generate-pwa-icons.js");

console.log(
  "Done. Rebuild the app (npm run tauri:build or npm run build:web) to use the new icon.",
);
