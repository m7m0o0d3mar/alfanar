ALTER TABLE page_registry ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

DROP POLICY IF EXISTS "audit_admin_select_all" ON audit_logs;
CREATE POLICY "audit_admin_select_all" ON audit_logs FOR SELECT USING (is_admin());

INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_admin, require_module, config)
VALUES
('audit_log', '/admin/audit-log', 'History', 'Audit Log', 'سجل النشاطات', 'system', 'System', 'النظام', 140, true, NULL, '{"view": "table", "entity_type": "audit_logs"}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  name_en = EXCLUDED.name_en,
  name_ar = EXCLUDED.name_ar,
  config = EXCLUDED.config;
