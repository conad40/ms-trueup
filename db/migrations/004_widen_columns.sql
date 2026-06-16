-- Widen scan_type and scan_source columns that were too narrow
ALTER TABLE scan_log ALTER COLUMN scan_type TYPE VARCHAR(100);
ALTER TABLE scan_errors ALTER COLUMN error_type TYPE VARCHAR(100);
