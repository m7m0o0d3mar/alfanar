-- 093_page_registry_additions.sql
-- Add new pages to page_registry: Communication hub, Cost Management

INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
SELECT 'communication', '/communication', 'MessageSquare', 'Communication Hub', 'مركز الاتصالات', 'communication', 'Communication', 'التواصل', 54, true, false, NULL
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'communication');

INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
SELECT 'cost_management', '/cost', 'DollarSign', 'Cost Management', 'إدارة التكاليف', 'analytics', 'Analytics & Reports', 'التقارير والتحليلات', 44, true, false, NULL
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'cost_management');

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE evm_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE call_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_bots;
ALTER PUBLICATION supabase_realtime ADD TABLE cost_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE budget_forecasts;
