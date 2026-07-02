-- 096_page_registry_reports.sql
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
SELECT 'reports', '/reports', 'FileText', 'Reports', 'التقارير', 'analytics', 'Analytics & Reports', 'التقارير والتحليلات', 45, true, false, NULL
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'reports');
