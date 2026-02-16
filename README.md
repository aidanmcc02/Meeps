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

## Tech stack

- React + Vite
- TailwindCSS
- Tauri (Rust)

