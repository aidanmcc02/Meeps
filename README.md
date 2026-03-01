# Meeps

**Meeps** is a cross-platform desktop and web chat application built with React, Tauri, and a Node.js backend. It runs as a native Windows app, as a Progressive Web App (including iOS), and can be deployed to Railway or any static host.

---

## Table of contents

- [Getting started](#getting-started)
- [Packaging for Windows](#packaging-for-windows)
- [PWA & deployment](#pwa--deployment)
- [Notifications (iOS PWA)](#notifications-ios-pwa)
- [Tech stack](#tech-stack)

---

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Run the web dev server** (browser preview)

   ```bash
   npm run dev
   ```

3. **Run the Tauri desktop app** (development)

   ```bash
   npm run tauri:dev
   ```

---

## Packaging for Windows

The app is built for Windows using Tauri.

### Build on Windows

Install [Node.js](https://nodejs.org/), [Rust](https://rustup.rs/), and [Microsoft Edge WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (typically pre-installed on Windows 11). Then:

```bash
npm ci
npm run tauri:build
```

Installers (`.msi`) and the portable executable are in `src-tauri/target/release/bundle/`.

### Build via GitHub Actions (from Linux/macOS)

Push to GitHub and run **Actions → Build for Windows → Run workflow**. Download the Windows artifacts from the completed run. No Windows machine required.

---

## PWA & deployment

The app runs as a Progressive Web App in the browser (including **Add to Home Screen** on iOS) and can be hosted on [Railway](https://railway.app) or any static host.

### Build for web (PWA)

Use the web build for deployment. It uses root-relative URLs (`BASE_URL=/`) so the app and service worker work correctly:

```bash
npm run build:web
```

Serve the `dist/` folder (e.g. `npm start`, which runs `serve -s dist`).

### Deploy to Railway

1. Create a new project on [Railway](https://railway.app) and add a service from this repo.
2. **Environment variables** (required for the PWA to reach your backend): in the PWA service, set:
   - `VITE_BACKEND_HTTP_URL` — backend URL (e.g. `https://meeps-production.up.railway.app`)
   - `VITE_BACKEND_WS_URL` — backend WebSocket URL (e.g. `wss://meeps-production.up.railway.app/ws`)
   - `VITE_DIANA_API_URL` — Diana bot API URL (e.g. `https://diana-bot-production.up.railway.app`)
     The build writes these into `public/config.json`; the app loads that at runtime.
3. Build and start are configured in `railway.json`:
   - **Build:** `npm run build:web`
   - **Start:** `npm start` (serves `dist/` with `serve`)
4. Deploy. Open the generated URL on your device and use **Add to Home Screen** (Safari on iOS) to install the PWA.

### App icon (Windows + PWA)

Place a square PNG as **`icon.png`** in the project root, then run:

```bash
npm run update-icons
```

This generates the Windows icon (`.ico` and store assets) and copies it to `public/` for the PWA. Use a square image, ideally **512×512 or larger**. Then rebuild:

- **Windows:** `npm run tauri:build`
- **PWA:** `npm run build:web`

**Windows taskbar still shows the old icon?** The icon is embedded in the executable at build time:

1. Rebuild: `npm run tauri:build`, then run the new `.exe` from `src-tauri/target/release/bundle/` (or reinstall from the new `.msi`).
2. Unpin the app from the taskbar (right-click → Unpin), run the new build, then pin it again.
3. If it still shows the old icon, clear the icon cache: close Explorer in Task Manager, delete `%LOCALAPPDATA%\IconCache.db`, then restart Explorer (File → Run new task → `explorer`).

---

## Notifications (iOS PWA)

The app supports push notifications on iOS when the PWA is installed, including when the app is closed (e.g. mention notifications via Web Push).

### Enabling notifications on iPhone

1. **Install the PWA:** Open the app URL in Safari and tap **Add to Home Screen**.
2. **Open the PWA:** Launch the app from the home screen (not from Safari).
3. **Enable notifications:** iPhone **Settings → [PWA name] → Notifications** → turn on **Allow Notifications**.
4. **Grant permission:** When the app prompts, tap **Allow**.

Notifications work when the app is open, in the background, or closed—provided the backend is configured for push (see below).

### Backend: push when the app is closed

To send mention notifications when the app is closed, the backend must use **VAPID keys** and the **push_subscriptions** table.

1. **Run migrations** (creates `push_subscriptions`):

   ```bash
   cd backend
   npm run migrate
   ```

2. **Generate VAPID keys** (one-time):

   ```bash
   cd backend
   node scripts/generate-vapid-keys.js
   ```

   Add the printed keys to your backend environment (e.g. Railway variables or `.env`):
   - `VAPID_PUBLIC_KEY` — public key (base64url string)
   - `VAPID_PRIVATE_KEY` — private key (base64url string)

   **Keep the private key secret; do not commit it.**

3. **Restart the backend.** The frontend will subscribe to push when the user grants permission; the backend will then send push notifications to mentioned users who are not connected (e.g. app closed on iPhone).

---

## Tech stack

| Layer    | Technology                |
| -------- | ------------------------- |
| Frontend | React, Vite, Tailwind CSS |
| Desktop  | Tauri (Rust)              |
| Web/PWA  | vite-plugin-pwa           |
