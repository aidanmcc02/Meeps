-- Mark uploads that should not be auto-deleted (e.g. profile avatars).
-- This migration is safe to run multiple times.

ALTER TABLE uploads
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for quick lookups in cleanup and file serving.
CREATE INDEX IF NOT EXISTS idx_uploads_is_pinned ON uploads(is_pinned);

