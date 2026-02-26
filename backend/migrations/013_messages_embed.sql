-- Embed payload for Diana (Discord-style rich messages)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS embed JSONB;
