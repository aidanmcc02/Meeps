#!/usr/bin/env node
/**
 * Migration runner - iterates over backend/migrations/*.sql in order,
 * running each migration that hasn't been applied yet.
 *
 * Usage: node scripts/run-migrations.js
 * Or: npm run migrate
 */

const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { pool } = require("../src/config/db");

const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations() {
  const result = await pool.query(
    "SELECT name FROM schema_migrations ORDER BY id",
  );
  return new Set(result.rows.map((r) => r.name));
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function runMigration(name, sql) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
      name,
    ]);
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function runMigrations(options = {}) {
  const { silent = false } = options;
  const log = silent ? () => {} : (msg) => console.log(msg);

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = getMigrationFiles();

  let runCount = 0;
  for (const file of files) {
    const name = path.basename(file, ".sql");
    if (applied.has(name)) {
      log(`  skip ${name}`);
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, "utf8").trim();
    if (!sql) {
      log(`  skip ${name} (empty)`);
      continue;
    }

    log(`  run  ${name}`);
    await runMigration(name, sql);
    runCount++;
  }

  return runCount;
}

module.exports = { runMigrations };

async function main() {
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  }

  console.log("Running migrations...");
  const runCount = await runMigrations();
  console.log(`Done. Ran ${runCount} migration(s).`);
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
