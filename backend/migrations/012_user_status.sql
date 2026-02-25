-- User preference: do_not_disturb = online but no notifications (sound, push)
-- Presence (online/idle/offline) stays automatic via websocket
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS do_not_disturb BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
