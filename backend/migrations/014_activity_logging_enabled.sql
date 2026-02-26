-- User preference: when false, hide their activity (game/app) from others
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS activity_logging_enabled BOOLEAN DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
