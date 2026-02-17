# Meeps Desktop Chat (Skeleton)

This repository contains the initial React + TailwindCSS + Tauri skeleton for the Meeps desktop chat application.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the web dev server (for browser-only preview):

   ```bash
   npm run dev
   ```

3. Run the Tauri desktop app in development:

   ```bash
   npm run tauri:dev
   ```

## Packaging for Windows

The app is built for Windows using Tauri. You can get a Windows build in two ways:

### Option 1: Build on a Windows machine

On Windows, install [Node.js](https://nodejs.org/), [Rust](https://rustup.rs/), and [Microsoft Edge WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually pre-installed on Windows 11). Then:

```bash
npm ci
npm run tauri:build
```

The installer (`.msi`) and portable executable will be in `src-tauri/target/release/bundle/`.

### Option 2: Build via GitHub Actions (from Linux/macOS)

Push your code to GitHub and run the **Build for Windows** workflow (Actions → Build for Windows → Run workflow). When it finishes, download the Windows artifacts from the run. No Windows machine needed.

## PWA (iOS / web) and Railway

The app can run as a Progressive Web App in the browser (including **Add to Home Screen** on iOS) and be hosted on [Railway](https://railway.app).

### Build for web (PWA)

Use the web build when deploying to a host (e.g. Railway). It uses root-relative URLs (`BASE_URL=/`) so the app and service worker work correctly:

```bash
npm run build:web
```

Then serve the `dist/` folder (e.g. `npm start` which runs `serve -s dist`).

### Deploy to Railway

1. Create a new project on [Railway](https://railway.app) and add a service from this repo.
2. Build and start are set in `railway.json`:
   - Build: `npm run build:web`
   - Start: `npm start` (serves `dist/` with `serve`)
3. Deploy. After deployment, open the generated URL on your phone and use **Add to Home Screen** (Safari on iOS) to install the PWA.

### PWA icons

Icons are copied from the Tauri icon by default. For best quality on iOS and Android, replace the files in `public/` with higher-resolution PNGs:

- `public/apple-touch-icon.png` — 180×180 (iOS home screen)
- `public/icon-192.png` — 192×192
- `public/icon-512.png` — 512×512

Regenerate from the Tauri icon after running `generate-icon`:  
`npm run generate-pwa-icons`

## Tech stack

- React + Vite
- TailwindCSS
- Tauri (Rust)
- PWA (vite-plugin-pwa) for iOS/web

