-- Page Registry entry for Status Templates page
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
SELECT 'status_templates', '/status-templates', 'Palette', 'Status Templates', 'قوالب الحالة', 'admin', 'Administration', 'الإدارة', 18, true, false, NULL
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'status_templates');
