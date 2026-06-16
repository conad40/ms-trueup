-- SCCM instances table (like vcenter_instances, with per-instance credentials)
CREATE TABLE IF NOT EXISTS sccm_instances (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    server_url      VARCHAR(500) NOT NULL,
    credential_id   INT REFERENCES credentials(id) ON DELETE SET NULL,
    verify_ssl      BOOLEAN DEFAULT FALSE,
    enabled         BOOLEAN DEFAULT TRUE,
    notes           TEXT,
    last_scan       TIMESTAMP WITH TIME ZONE,
    hosts_found     INT DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
