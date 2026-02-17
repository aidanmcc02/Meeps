const fs = require("fs");
const path = require("path");

/**
 * Auto-generate a Tauri updater latest.json for the current Windows build.
 *
 * Usage (after `npm run tauri:build`):
 *   node scripts/generate-latest-json.js
 *
 * Optional env overrides:
 *   LATEST_JSON_REPO   - "user/repo" (defaults to "aidanmcc02/Meeps")
 *   LATEST_JSON_TAG    - release tag, e.g. "v0.1.0" (defaults to "v" + version from tauri.conf.json)
 *   LATEST_JSON_NOTES  - release notes text
 */

function main() {
  const projectRoot = path.join(__dirname, "..");
  const tauriConfPath = path.join(projectRoot, "src-tauri", "tauri.conf.json");

  if (!fs.existsSync(tauriConfPath)) {
    console.error("Could not find src-tauri/tauri.conf.json");
    process.exit(1);
  }

  const tauriConfig = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
  const version =
    tauriConfig?.package?.version ||
    tauriConfig?.tauri?.package?.version ||
    null;

  if (!version) {
    console.error("Could not read package.version from tauri.conf.json");
    process.exit(1);
  }

  const repo = process.env.LATEST_JSON_REPO || "aidanmcc02/Meeps";
  const tag =
    process.env.LATEST_JSON_TAG ||
    (version.startsWith("v") ? version : `v${version}`);
  const notes = process.env.LATEST_JSON_NOTES || "";

  const bundleRoot = path.join(
    projectRoot,
    "src-tauri",
    "target",
    "release",
    "bundle"
  );

  if (!fs.existsSync(bundleRoot)) {
    console.error(
      "Bundle directory not found. Run `npm run tauri:build` before generating latest.json."
    );
    process.exit(1);
  }

  // Prefer NSIS on Windows; fall back to MSI if needed.
  const nsisDir = path.join(bundleRoot, "nsis");
  const msiDir = path.join(bundleRoot, "msi");

  let sigDir = null;
  let sigFile = null;
  let platformKey = "windows-x86_64";

  if (fs.existsSync(nsisDir)) {
    const files = fs
      .readdirSync(nsisDir)
      .filter((f) => f.endsWith(".nsis.zip.sig"))
      .sort();
    if (files.length > 0) {
      sigDir = nsisDir;
      sigFile = files[0];
    }
  }

  if (!sigFile && fs.existsSync(msiDir)) {
    const files = fs
      .readdirSync(msiDir)
      .filter((f) => f.endsWith(".msi.zip.sig"))
      .sort();
    if (files.length > 0) {
      sigDir = msiDir;
      sigFile = files[0];
    }
  }

  if (!sigFile) {
    console.error(
      "No *.zip.sig updater bundle found. Make sure `npm run tauri:build` completed successfully."
    );
    process.exit(1);
  }

  const sigPath = path.join(sigDir, sigFile);
  const signature = fs.readFileSync(sigPath, "utf8").trim();

  // Corresponding .zip file name (same name without .sig)
  const zipName = sigFile.replace(/\.sig$/, "");

  const downloadUrl = `https://github.com/${repo}/releases/download/${tag}/${zipName}`;

  const latest = {
    version: version.startsWith("v") ? version : `v${version}`,
    notes,
    pub_date: new Date().toISOString(),
    platforms: {
      [platformKey]: {
        signature,
        url: downloadUrl,
      },
    },
  };

  const outPath = path.join(bundleRoot, "latest.json");
  fs.writeFileSync(outPath, JSON.stringify(latest, null, 2), "utf8");

  console.log(`latest.json written to: ${outPath}`);
  console.log(`- repo: ${repo}`);
  console.log(`- tag:  ${tag}`);
  console.log(`- url:  ${downloadUrl}`);
}

main();

