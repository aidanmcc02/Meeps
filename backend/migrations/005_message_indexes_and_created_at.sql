CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

ALTER TABLE messages ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
