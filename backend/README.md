# Meeps Backend (Node.js + Express + PostgreSQL)

This is the backend skeleton for the Meeps desktop chat application. It provides:

- REST API endpoints for authentication and basic profile data.
- PostgreSQL connection setup (local and Railway-compatible).
- WebSocket server ready for real-time messaging and user status updates.

## Folder structure

- `backend/package.json` — Backend dependencies and scripts.
- `backend/.env.example` — Example environment variables.
- `backend/src/app.js` — Express app configuration.
- `backend/src/server.js` — HTTP + WebSocket server entrypoint.
- `backend/src/config/db.js` — PostgreSQL pool configuration.
- `backend/src/routes/authRoutes.js` — `/register` and `/login` routes.
- `backend/src/routes/profileRoutes.js` — `/profile` route.
- `backend/src/controllers/*` — Handlers for auth and profile APIs.
- `backend/src/middleware/*` — Auth and error-handling middleware.
- `backend/src/websocket/websocketServer.js` — WebSocket server setup.
- `backend/src/models/userModel.sql` — Example SQL to create a `users` table.

## REST endpoints

All endpoints are currently prefixed with `/api`:

- `POST /api/register` — Register a new user.
- `POST /api/login` — Login with email and password; returns JWT.
- `GET /api/profile` — Get the current user profile (requires `Authorization: Bearer <token>`).

## WebSocket server

A WebSocket server is attached to the same HTTP server on path `/ws`. It currently:

- Accepts connections at `ws://<host>:<PORT>/ws`.
- Broadcasts any received messages to all connected clients (simple echo/broadcast).

You can later extend this to handle rooms, presence, and typing indicators.

## Running locally

### Option A: PostgreSQL + Backend with Docker Compose (recommended)

1. **Start PostgreSQL and backend** (from project root):

   ```bash
   docker compose up -d
   ```

   This runs Postgres 16 and the backend. Migrations run automatically on backend startup. The backend listens on `http://localhost:4000`.

2. **Environment**: Use the root `.env` (the backend loads it automatically), or copy `backend/.env.example` to `backend/.env`. The backend container uses `PGHOST=postgres` to connect to the Postgres service in Docker.

3. **Run without Docker**: To run the backend on the host (against Docker Postgres), use `PGHOST=localhost` and `PGPORT=5433` in `.env`, then:

   ```bash
   cd backend
   npm install
   npm run dev
   ```

   By default it listens on `http://localhost:4000`.

### Option B: Existing PostgreSQL (no Docker)

1. **Create a PostgreSQL database** (example uses `meeps`):

   ```bash
   createdb meeps
   ```

2. **Create your `.env` file** (root or backend):

   ```bash
   cp .env.example .env
   # or in backend: cp .env.example .env
   # Edit with your local DB credentials and a strong JWT_SECRET
   ```

3. **Install and run**:

   ```bash
   cd backend
   npm install
   npm run dev
   ```

   Tables are created automatically on first run (see `config/initDb.js`).

## Valorant (Neon tab and #Matchs channel)

The app has a **Neon** tab to view Valorant rank and match history for linked players. When a linked user finishes a competitive game, a message is posted to the **#Matchs** text channel (win/loss, agent image, rank, K/D/A).

**Setup:** Set `RIOT_API_KEY` in `.env` (from developer.riotgames.com, Valorant product). Tracker polls every 2 min and posts to #Matchs. **Linking:** From Neon tab or API (POST/GET/DELETE /api/valorant/*, auth required).

1. **Riot API key** — [developer.riotgames.com](https://developer.riotgames.com/) → create an app and get an API key (Valorant product).
2. **Environment** (root `.env` or backend `.env`):
   - `RIOT_API_KEY` — your Riot API key

**Note:** Riot’s match API does not expose RR gained/lost per match; the message shows “—” for RR unless you add a separate source.

## Deploying / connecting to Railway

1. **Create a new Railway project** and add a **PostgreSQL** plugin.

2. **Get your Railway Postgres connection string**:
   - In the Railway dashboard, open your Postgres service.
   - Copy the `Postgres Connection URL` (e.g. `postgresql://user:password@host:5432/database`).

3. **Set environment variables in Railway** for your backend service:

   - `DATABASE_URL` — paste the Postgres connection URL from the previous step.
   - `NODE_ENV` — `production`
   - `PORT` — `4000` (or whatever port you configure).
   - `JWT_SECRET` — a strong, random secret string.

   When `DATABASE_URL` is set, the backend will use it instead of the individual `PG*` variables and will enable SSL in production mode.

4. **Deploy the backend** (via GitHub integration or `railway up`):

   - Ensure your Railway service runs the command:

     ```bash
     npm install && npm start
     ```

5. **Migrations on Railway**: The backend runs migrations automatically on each deploy via `preDeployCommand` in `backend/railway.json`. 

   **Important**: Ensure the backend service has its **root directory set to `backend`** in Railway dashboard (Settings → Service → Root Directory). Otherwise, Railway won't find `railway.json` and migrations won't run automatically.

   **Check if migrations ran**:
   ```sql
   SELECT * FROM schema_migrations ORDER BY applied_at;
   ```

   **Manual migration** (if automatic migrations didn't run):
   - Open Railway shell for your **backend service** (not Postgres)
   - Run: `npm run migrate`
   - Or connect to Postgres and run migration SQL files manually

Once deployed, update your frontend or Tauri app to point its API base URL at your Railway backend (e.g. `https://your-project.up.railway.app/api`).

### File uploads (Railway)

Uploaded files are stored on disk and **auto-deleted after 3 days**. On Railway the filesystem is ephemeral unless you use a **Volume**:

1. In your Railway project, add a **Volume** to your backend service and set the mount path (e.g. `/data`).
2. Set the backend variable **`UPLOADS_PATH`** to that path (e.g. `/data`). Uploads will be stored under `UPLOADS_PATH/files`.
3. Alternatively use the provided env **`RAILWAY_VOLUME_MOUNT_PATH`** and set `UPLOADS_PATH=$RAILWAY_VOLUME_MOUNT_PATH` so uploads persist across deploys.

Without a volume, uploads work but are lost on redeploy. A cleanup job runs every hour to remove files older than 3 days.

