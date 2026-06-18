-- ESXi -> Hyper-V migration tracking
CREATE TABLE IF NOT EXISTS migration_tracking (
    id               SERIAL PRIMARY KEY,
    vm_name          VARCHAR(255) NOT NULL UNIQUE,
    power_state      VARCHAR(50),
    datastore        VARCHAR(255),
    schedule_jeremy  BOOLEAN DEFAULT FALSE,   -- "Schedule with Jeremy"
    move_daytime     BOOLEAN DEFAULT FALSE,   -- "Move during daytime"
    move_afterhours  BOOLEAN DEFAULT FALSE,   -- "Move Afterhours"
    migrated         BOOLEAN DEFAULT FALSE,   -- "Migrated"
    date_migrated    DATE,                    -- "Date Migrated"
    verified_working BOOLEAN DEFAULT FALSE,   -- "Verified Working"
    zprl_to_nrep     BOOLEAN DEFAULT FALSE,   -- "Zprl -> Nrep"
    vpg_deleted      BOOLEAN DEFAULT FALSE,   -- "VPG Deleted"
    should_be_zprl   BOOLEAN DEFAULT FALSE,   -- "Should be zprl"
    notes            TEXT,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migration_tracking_migrated ON migration_tracking(migrated);
