CREATE TABLE IF NOT EXISTS export_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('csv', 'json')),
  filters JSONB DEFAULT '{}'::jsonb,
  schedule TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE export_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "export_configs_select_admin" ON export_configs FOR SELECT USING (is_admin());
CREATE POLICY "export_configs_insert_admin" ON export_configs FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "export_configs_update_admin" ON export_configs FOR UPDATE USING (is_admin());
CREATE POLICY "export_configs_delete_admin" ON export_configs FOR DELETE USING (is_admin());

CREATE TABLE IF NOT EXISTS export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_config_id UUID REFERENCES export_configs(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  format TEXT NOT NULL,
  row_count INT DEFAULT 0,
  file_size BIGINT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "export_logs_select_admin" ON export_logs FOR SELECT USING (is_admin());
CREATE POLICY "export_logs_insert_admin" ON export_logs FOR INSERT WITH CHECK (is_admin());
