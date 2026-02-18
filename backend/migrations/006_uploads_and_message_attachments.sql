-- Uploads: temporary file storage (auto-deleted after 3 days)
CREATE TABLE IF NOT EXISTS uploads (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(512) NOT NULL,
  storage_path VARCHAR(1024) NOT NULL,
  mime_type VARCHAR(255),
  size_bytes BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON uploads(created_at);

-- Link uploads to messages so we know which message "owns" an attachment
CREATE TABLE IF NOT EXISTS message_attachments (
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  upload_id INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, upload_id)
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_upload_id ON message_attachments(upload_id);
