-- Valorant: tracked matches (dedup so we only post each match once to #Matchs).
-- App account links use valorant_links (migration 009).

CREATE TABLE IF NOT EXISTS valorant_tracked_matches (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR(255) NOT NULL,
  puuid VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(match_id, puuid)
);

CREATE INDEX IF NOT EXISTS idx_valorant_tracked_matches_puuid ON valorant_tracked_matches(puuid);
CREATE INDEX IF NOT EXISTS idx_valorant_tracked_matches_match_id ON valorant_tracked_matches(match_id);
