-- Enterprise agreements table
CREATE TABLE IF NOT EXISTS agreements (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    agreement_number VARCHAR(100),
    agreement_type  VARCHAR(50) DEFAULT 'EA',
    start_date      DATE,
    expiry_date     DATE,
    notes           TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link entitlements to agreements
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS agreement_id INT REFERENCES agreements(id) ON DELETE SET NULL;
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS part_number VARCHAR(50);
