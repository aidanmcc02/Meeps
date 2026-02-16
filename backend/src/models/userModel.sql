-- Minimal users table for Meeps backend skeleton.
-- You can run this manually against your PostgreSQL database.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  bio TEXT,
  achievements TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  theme TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

