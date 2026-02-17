const { pool } = require("./db");

async function initDatabase() {
  try {
    // Create users table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create messages table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(255) NOT NULL,
        sender_name VARCHAR(255) NOT NULL,
        sender_id INTEGER REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE messages ADD COLUMN sender_id INTEGER REFERENCES users(id);
      EXCEPTION WHEN duplicate_column THEN NULL; END $$
    `);

    // Add profile columns if they don't exist (for existing DBs created before profile feature)
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$
    `);
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS achievements TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$
    `);
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$
    `);
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$
    `);
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url TEXT;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$
    `);

    // Create board_issues table for the built-in board
    await pool.query(`
      CREATE TABLE IF NOT EXISTS board_issues (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'todo',
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        assignee_id INTEGER REFERENCES users(id),
        assignee_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_board_issues_status ON board_issues(status)");

    // Create indexes for better performance
    await pool.query("CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)");

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}

module.exports = { initDatabase };
