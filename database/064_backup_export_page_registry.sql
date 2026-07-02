INSERT INTO page_registry (code, path, name_en, name_ar, icon, section_key, section_label_en, section_label_ar, is_admin, require_module, sort_order, is_enabled)
SELECT 'backup_export', '/admin/backup-export', 'Backup & Export', 'النسخ الاحتياطي والتصدير', 'HardDrive', 'admin_section', 'Administration', 'الإدارة', true, NULL, 96, true
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'backup_export');
