-- Migration tracker: replace "Schedule with Jeremy" checkbox with a free-text
-- App Support field, and add a scheduled date+time for the move.
ALTER TABLE migration_tracking ADD COLUMN IF NOT EXISTS app_support TEXT;
ALTER TABLE migration_tracking ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;  -- local wall-clock (no tz)
