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
2. **Variables** (required so the PWA can reach your backend): in the PWA service add
   - `VITE_BACKEND_HTTP_URL` = your backend URL (e.g. `https://meeps-production.up.railway.app`)
   - `VITE_BACKEND_WS_URL` = your backend WebSocket URL (e.g. `wss://meeps-production.up.railway.app/ws`)
   - `VITE_DIANA_API_URL` = Diana bot API URL (e.g. `https://diana-bot-production.up.railway.app`)
   The build writes these into `public/config.json`; the app loads that at runtime so the correct backend URL is used.
3. Build and start are set in `railway.json`:
   - Build: `npm run build:web`
   - Start: `npm start` (serves `dist/` with `serve`)
4. Deploy. After deployment, open the generated URL on your phone and use **Add to Home Screen** (Safari on iOS) to install the PWA.

### App icon (Windows + iPhone PWA)

Place a square PNG as **`icon.png`** in the project root, then run:

```bash
npm run update-icons
```

This generates the Windows icon (`.ico` and store assets) from `icon.png` and copies it to `public/` for the PWA (iPhone home screen, etc.). Use a square image, ideally **512×512 or larger**. Then rebuild:

- Windows: `npm run tauri:build`
- PWA: `npm run build:web`

**Windows taskbar still shows the old icon?** The icon is embedded in the .exe at build time. Do this:
1. **Rebuild** so the new icon is in the executable: `npm run tauri:build`, then run the new `.exe` from `src-tauri/target/release/bundle/` (or reinstall from the new `.msi`).
2. **Unpin** the app from the taskbar (right‑click → Unpin), then run the new build and pin it again.
3. If it still shows the old icon, clear Windows’ icon cache: close Explorer in Task Manager, delete `%LOCALAPPDATA%\IconCache.db`, then restart Explorer (File → Run new task → `explorer`).

### iOS PWA Notifications

The app supports notifications on iOS when the PWA is installed, including **when the app is closed** (mention notifications via Web Push).

#### Enabling notifications on your iPhone

1. **Install the PWA**: Open the app URL in Safari on your iPhone and tap "Add to Home Screen"
2. **Open the PWA**: Launch the app from your home screen (not Safari)
3. **Enable notifications**: Go to iPhone Settings → [Your PWA Name] → Notifications → Enable "Allow Notifications"
4. **Grant permission**: When the app prompts you, tap "Allow"

Notifications work when the app is open, backgrounded, or **closed** — if the backend is configured for push (see below).

#### Backend setup: push notifications when the app is closed

To send mention notifications when the app is closed (e.g. someone @mentions you and you get a push on your lock screen), the backend must be configured with **VAPID keys** and the **push_subscriptions** table.

1. **Run the migration** (creates `push_subscriptions`):

   ```bash
   cd backend
   npm run migrate
   ```

2. **Generate VAPID keys** (one-time):

   ```bash
   cd backend
   node scripts/generate-vapid-keys.js
   ```

   This prints a public and private key. Add them to your backend environment (e.g. Railway variables or `.env`):

   - `VAPID_PUBLIC_KEY` = the public key (long base64url string)
   - `VAPID_PRIVATE_KEY` = the private key (long base64url string)

   **Important:** Keep the private key secret and do not commit it to the repo.

3. **Restart the backend** after setting the variables. The frontend will automatically subscribe to push when the user grants notification permission; the backend will then send a push to mentioned users who are not currently connected (e.g. app closed on iPhone).

## Tech stack

- React + Vite
- TailwindCSS
- Tauri (Rust)
- PWA (vite-plugin-pwa) for iOS/web

