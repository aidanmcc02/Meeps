-- Fix created_at column type to TIMESTAMPTZ (timestamp with timezone) and ensure DEFAULT is set
-- This handles existing production databases where created_at was DATE or TIMESTAMP

DO $$
DECLARE
  current_type TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'created_at'
  ) THEN
    SELECT data_type INTO current_type
    FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'created_at';

    IF current_type = 'date' THEN
      ALTER TABLE messages
        ALTER COLUMN created_at TYPE TIMESTAMPTZ
        USING created_at::TIMESTAMPTZ;
    ELSIF current_type = 'timestamp without time zone' THEN
      ALTER TABLE messages
        ALTER COLUMN created_at TYPE TIMESTAMPTZ
        USING created_at AT TIME ZONE 'UTC';
    END IF;
  END IF;
END $$;

-- Ensure DEFAULT is set to CURRENT_TIMESTAMP (which returns TIMESTAMPTZ in PostgreSQL)
ALTER TABLE messages ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
