-- Seed default settings so they appear in the UI
INSERT INTO settings (key, value, category, description, sensitive) VALUES
  ('scan_interval_minutes', '60', 'scanner', 'Minutes between automatic scan cycles', false),
  ('winrm_enabled', 'false', 'winrm', 'Enable WinRM scanner', false),
  ('winrm_username', '', 'winrm', 'Default WinRM username (DOMAIN\\user)', false),
  ('winrm_password', '', 'winrm', 'Default WinRM password', true),
  ('winrm_transport', 'ntlm', 'winrm', 'WinRM transport (ntlm, kerberos, ssl)', false),
  ('winrm_port', '5985', 'winrm', 'WinRM port', false),
  ('sccm_enabled', 'false', 'sccm', 'Enable SCCM scanner', false),
  ('sccm_server_url', '', 'sccm', 'SCCM Admin Service URL (https://sccm-server.domain.com)', false),
  ('sccm_username', '', 'sccm', 'SCCM username (DOMAIN\\user)', false),
  ('sccm_password', '', 'sccm', 'SCCM password', true),
  ('sccm_verify_ssl', 'false', 'sccm', 'Verify SCCM SSL certificate', false),
  ('snmp_enabled', 'false', 'snmp', 'Enable SNMP discovery', false),
  ('snmp_community', 'public', 'snmp', 'SNMP community string', true),
  ('agent_api_key', '', 'agent', 'API key for push-mode agents (legacy)', true),
  ('stale_days', '30', 'scanner', 'Days without scan before marking host inactive', false)
ON CONFLICT (key) DO NOTHING;
