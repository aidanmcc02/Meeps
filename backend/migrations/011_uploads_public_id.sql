-- Add a non-guessable public identifier for uploads so that files are not exposed
-- via sequential integer IDs.
--
-- This migration is safe to run multiple times thanks to IF NOT EXISTS guards.

ALTER TABLE uploads
  ADD COLUMN IF NOT EXISTS public_id VARCHAR(64);

-- Backfill any existing rows that do not have a public_id yet.
-- Use md5() which is available in core Postgres (no extensions required) to
-- generate a reasonably unguessable 32-character hex string.
UPDATE uploads
SET public_id = md5(
  coalesce(id::text, '') || '-' ||
  coalesce(extract(epoch FROM now())::text, '') || '-' ||
  coalesce(random()::text, '')
)
WHERE public_id IS NULL;

-- Ensure uniqueness and fast lookup by public_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_uploads_public_id ON uploads(public_id);

-- Enforce that every upload row has a public_id going forward.
ALTER TABLE uploads
  ALTER COLUMN public_id SET NOT NULL;

