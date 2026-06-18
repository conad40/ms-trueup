-- Store the datastore(s) a VM lives on (comma-separated when it spans several).
ALTER TABLE hosts ADD COLUMN IF NOT EXISTS datastore TEXT;
