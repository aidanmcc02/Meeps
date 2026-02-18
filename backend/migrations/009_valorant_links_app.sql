-- Valorant links for Meeps users (in-app Neon tab + match posts to #matches channel).
-- One link per user; links to Riot account by puuid.

CREATE TABLE IF NOT EXISTS valorant_links (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  riot_puuid VARCHAR(255) NOT NULL,
  game_name VARCHAR(255) NOT NULL,
  tag_line VARCHAR(32) NOT NULL,
  region VARCHAR(8) NOT NULL DEFAULT 'eu',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id),
  UNIQUE(riot_puuid)
);

CREATE INDEX IF NOT EXISTS idx_valorant_links_user_id ON valorant_links(user_id);
