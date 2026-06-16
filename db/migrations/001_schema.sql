-- MS License True-Up — Complete Schema
-- All constraints included from day one

-- Discovered hosts
CREATE TABLE IF NOT EXISTS hosts (
    id              SERIAL PRIMARY KEY,
    hostname        VARCHAR(255) NOT NULL UNIQUE,
    ip_address      VARCHAR(45),
    domain          VARCHAR(255),
    os_name         VARCHAR(255),
    os_version      VARCHAR(100),
    os_edition      VARCHAR(100),
    is_virtual      BOOLEAN DEFAULT FALSE,
    hypervisor_host VARCHAR(255),
    cpu_sockets     INT,
    cpu_cores       INT,
    cpu_logical     INT,
    cpu_model       VARCHAR(255),
    ram_gb          NUMERIC(10,2),
    scan_source     VARCHAR(20),
    last_scan       TIMESTAMP WITH TIME ZONE,
    status          VARCHAR(20) DEFAULT 'active',
    license_override    VARCHAR(50),
    sql_license_override VARCHAR(50),
    notes           TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hosts_status ON hosts(status);
CREATE INDEX IF NOT EXISTS idx_hosts_scan_source ON hosts(scan_source);
CREATE INDEX IF NOT EXISTS idx_hosts_domain ON hosts(domain);
CREATE INDEX IF NOT EXISTS idx_hosts_os_edition ON hosts(os_edition);

-- SQL Server instances
CREATE TABLE IF NOT EXISTS sql_instances (
    id              SERIAL PRIMARY KEY,
    host_id         INT REFERENCES hosts(id) ON DELETE CASCADE,
    instance_name   VARCHAR(255) NOT NULL,
    edition         VARCHAR(100),
    version         VARCHAR(50),
    version_name    VARCHAR(50),
    license_model   VARCHAR(20),
    is_clustered    BOOLEAN DEFAULT FALSE,
    cluster_name    VARCHAR(255),
    last_scan       TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (host_id, instance_name)
);

CREATE INDEX IF NOT EXISTS idx_sql_instances_host_id ON sql_instances(host_id);
CREATE INDEX IF NOT EXISTS idx_sql_edition ON sql_instances(edition);

-- Installed Microsoft products
CREATE TABLE IF NOT EXISTS installed_products (
    id              SERIAL PRIMARY KEY,
    host_id         INT REFERENCES hosts(id) ON DELETE CASCADE,
    product_name    VARCHAR(255) NOT NULL,
    product_family  VARCHAR(100),
    version         VARCHAR(100),
    edition         VARCHAR(100),
    last_scan       TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (host_id, product_name)
);

CREATE INDEX IF NOT EXISTS idx_installed_products_host_id ON installed_products(host_id);
CREATE INDEX IF NOT EXISTS idx_products_family ON installed_products(product_family);

-- CAL tracking
CREATE TABLE IF NOT EXISTS cal_counts (
    id              SERIAL PRIMARY KEY,
    cal_type        VARCHAR(50) NOT NULL,
    license_mode    VARCHAR(20) NOT NULL,
    count           INT NOT NULL,
    source          VARCHAR(100),
    scan_date       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cal_type ON cal_counts(cal_type, license_mode);

-- License entitlements (what you own)
CREATE TABLE IF NOT EXISTS entitlements (
    id              SERIAL PRIMARY KEY,
    product_name    VARCHAR(255) NOT NULL,
    product_family  VARCHAR(100),
    edition         VARCHAR(100),
    license_type    VARCHAR(50),
    quantity        INT NOT NULL,
    agreement_number VARCHAR(100),
    agreement_type  VARCHAR(50),
    effective_date  DATE,
    expiry_date     DATE,
    sa_included     BOOLEAN DEFAULT FALSE,
    notes           TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entitlements_family ON entitlements(product_family);

-- Scan history
CREATE TABLE IF NOT EXISTS scan_log (
    id              SERIAL PRIMARY KEY,
    scan_type       VARCHAR(50) NOT NULL,
    started_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at    TIMESTAMP WITH TIME ZONE,
    hosts_scanned   INT DEFAULT 0,
    hosts_failed    INT DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'running',
    error_message   TEXT
);

CREATE TABLE IF NOT EXISTS scan_errors (
    id              SERIAL PRIMARY KEY,
    scan_id         INT REFERENCES scan_log(id) ON DELETE CASCADE,
    hostname        VARCHAR(255),
    error_type      VARCHAR(50),
    error_message   TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    key             VARCHAR(100) PRIMARY KEY,
    value           TEXT DEFAULT '',
    category        VARCHAR(50) DEFAULT 'general',
    description     TEXT DEFAULT '',
    sensitive       BOOLEAN DEFAULT FALSE,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scan ta