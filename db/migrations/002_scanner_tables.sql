-- Add missing scanner tables (credentials, targets, vcenter_instances)

CREATE TABLE IF NOT EXISTS credentials (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    cred_type       VARCHAR(20) NOT NULL DEFAULT 'winrm',
    username        VARCHAR(255),
    password        TEXT,
    domain          VARCHAR(255),
    transport       VARCHAR(20) DEFAULT 'ntlm',
    port            INT,
    use_https       BOOLEAN DEFAULT FALSE,
    verify_ssl      BOOLEAN DEFAULT FALSE,
    community       TEXT,
    snmp_version    VARCHAR(10),
    notes           TEXT,
    enabled         BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS targets (
    id              SERIAL PRIMARY KEY,
    hostname        VARCHAR(255) NOT NULL,
    scan_type       VARCHAR(20) NOT NULL,
    enabled         BOOLEAN DEFAULT TRUE,
    notes           TEXT,
    is_subnet       BOOLEAN DEFAULT FALSE,
    credential_id   INT REFERENCES credentials(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (hostname, scan_type)
);

CREATE INDEX IF NOT EXISTS idx_targets_scan_type ON targets(scan_type);

CREATE TABLE IF NOT EXISTS vcenter_instances (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    hostname        VARCHAR(255) NOT NULL,
    credential_id   INT REFERENCES credentials(id) ON DELETE SET NULL,
    enabled         BOOLEAN DEFAULT TRUE,
    notes           TEXT,
    last_scan       TIMESTAMP WITH TIME ZONE,
    hosts_found     INT DEFAULT 0,
    vms_found       INT DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
