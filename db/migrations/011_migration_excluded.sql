-- Mark VMs that will NOT be migrated (excluded from progress + SCVMM auto-detection).
ALTER TABLE migration_tracking ADD COLUMN IF NOT EXISTS excluded BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_migration_tracking_excluded ON migration_tracking(excluded);
