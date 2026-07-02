INSERT INTO page_registry (code, path, name_en, name_ar, icon, section_key, section_label_en, section_label_ar, is_admin, require_module, sort_order, is_enabled)
SELECT 'table_browser', '/admin/table-browser', 'Table Browser', 'متصفح الجداول', 'Database', 'admin_section', 'Administration', 'الإدارة', true, NULL, 95, true
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'table_browser');
