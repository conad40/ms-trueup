-- Store VM power state (PoweredOn / PoweredOff / Suspended) from the vCenter scan.
ALTER TABLE hosts ADD COLUMN IF NOT EXISTS power_state VARCHAR(20);
