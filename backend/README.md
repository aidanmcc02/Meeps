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

5. **Migrations on Railway**: The backend runs migrations automatically on each deploy via `preDeployCommand` in `backend/railway.json`. Ensure the backend service has its root directory set to `backend` so Railway uses that config.

   For manual migration (e.g. first-time setup or troubleshooting), open a Railway shell for your Postgres service and run:

     ```sql
     \i src/models/userModel.sql
     ```

     or copy the contents of `userModel.sql` into a Railway SQL console.

Once deployed, update your frontend or Tauri app to point its API base URL at your Railway backend (e.g. `https://your-project.up.railway.app/api`).

