-- Add user_type: 'user' (default) or 'bot'
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type VARCHAR(50) NOT NULL DEFAULT 'user';

-- Insert Diana bot user (used when posting match updates to Matches channel).
-- password_hash is a bcrypt hash of a placeholder; bots do not log in.
INSERT INTO users (email, password_hash, display_name, user_type, created_at, updated_at)
VALUES (
  'diana@bot.meeps.local',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Diana',
  'bot',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  user_type = EXCLUDED.user_type,
  updated_at = CURRENT_TIMESTAMP;
