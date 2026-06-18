-- Allow manual override of SCVMM auto-detection in the migration tracker.
-- NULL/FALSE override => "migrated" follows SCVMM auto-detection.
-- TRUE override        => user set "migrated" manually; auto-detection won't change it.
ALTER TABLE migration_tracking ADD COLUMN IF NOT EXISTS migrated_override BOOLEAN DEFAULT FALSE;
