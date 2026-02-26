-- Activity detail level: in_depth (full window title), just_application (app name only), none (show "Hiding activity")
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS activity_detail_level TEXT DEFAULT 'in_depth';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

UPDATE users SET activity_detail_level = 'in_depth' WHERE activity_detail_level IS NULL;
