-- Add system health page to page_registry
-- Add system health page to page_registry
INSERT INTO page_registry (code, path, name_en, name_ar, icon, section_key, section_label_en, section_label_ar, is_admin, require_module, sort_order, is_enabled)
SELECT 'system_health', '/admin/health', 'System Health', 'صحة النظام', 'Activity', 'admin_section', 'Administration', 'الإدارة', true, NULL, 95, true
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'system_health');
