-- 089_reorganize_navigation.sql
-- Reorganize sidebar navigation into consolidated, professional sections
-- Reduces 11 sections → 9, fixes orphan pages, reassigns misplaced pages

-- 1. Add missing section_keys for pages that have none
UPDATE page_registry SET
  section_key = 'system',
  section_label_en = 'System',
  section_label_ar = 'النظام'
WHERE code = 'notifications' AND (section_key IS NULL OR section_key = '');

-- Add daily-reports to analytics section if it exists in registry
UPDATE page_registry SET
  section_key = 'analytics',
  section_label_en = 'Analytics & Reports',
  section_label_ar = 'التقارير والتحليلات',
  sort_order = 42
WHERE code = 'daily_reports' OR code = 'daily-reports';

-- 2. Move 'technical' from 'docs' section to 'business' section
UPDATE page_registry SET
  section_key = 'business',
  section_label_en = 'Business',
  section_label_ar = 'الأعمال',
  sort_order = 40
WHERE code = 'technical' AND section_key = 'docs';

-- 3. Reassign 'sales' section pages → 'business'
UPDATE page_registry SET
  section_key = 'business',
  section_label_en = 'Business',
  section_label_ar = 'الأعمال'
WHERE section_key = 'sales';

-- 4. Reassign 'resources' section pages → 'business'
UPDATE page_registry SET
  section_key = 'business',
  section_label_en = 'Business',
  section_label_ar = 'الأعمال'
WHERE section_key = 'resources';

-- 5. Reassign 'crm' section pages → 'business'
UPDATE page_registry SET
  section_key = 'business',
  section_label_en = 'Business',
  section_label_ar = 'الأعمال'
WHERE section_key = 'crm';

-- 6. Rename 'docs' section to 'documents' (keep documents + approvals)
UPDATE page_registry SET
  section_key = 'documents',
  section_label_en = 'Documents & Approvals',
  section_label_ar = 'الوثائق والموافقات'
WHERE section_key = 'docs';

-- 7. Reassign 'finance' section pages → 'business'
UPDATE page_registry SET
  section_key = 'business',
  section_label_en = 'Business',
  section_label_ar = 'الأعمال'
WHERE section_key = 'finance';

-- 8. Move 'analytics' page from business to analytics section
UPDATE page_registry SET
  section_key = 'analytics',
  section_label_en = 'Analytics & Reports',
  section_label_ar = 'التقارير والتحليلات',
  sort_order = 41
WHERE code = 'analytics';

-- 9. Move 'support' page from business to communication section
UPDATE page_registry SET
  section_key = 'communication',
  section_label_en = 'Communication',
  section_label_ar = 'التواصل',
  sort_order = 58
WHERE code = 'support';

-- 10. Add 'daily-reports' route to page_registry if missing, in analytics section
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
SELECT 'daily_reports', '/daily-reports', 'FileText', 'Daily Reports', 'التقارير اليومية', 'analytics', 'Analytics & Reports', 'التقارير والتحليلات', 43, true, false, NULL
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'daily_reports');

-- 9. Rename 'admin_section' → 'admin' for consistency
UPDATE page_registry SET
  section_key = 'admin',
  section_label_en = 'Administration',
  section_label_ar = 'الإدارة'
WHERE section_key = 'admin_section';

-- 10. Re-sort business section pages in logical order
UPDATE page_registry SET sort_order = 30 WHERE code = 'hr'     AND section_key = 'business';
UPDATE page_registry SET sort_order = 31 WHERE code = 'attendance' AND section_key = 'business';
UPDATE page_registry SET sort_order = 32 WHERE code = 'procurement' AND section_key = 'business';
UPDATE page_registry SET sort_order = 33 WHERE code = 'finance'  AND section_key = 'business';
UPDATE page_registry SET sort_order = 34 WHERE code = 'sales'    AND section_key = 'business';
UPDATE page_registry SET sort_order = 35 WHERE code = 'crm'      AND section_key = 'business';
UPDATE page_registry SET sort_order = 36 WHERE code = 'resources' AND section_key = 'business';
UPDATE page_registry SET sort_order = 37 WHERE code = 'technical' AND section_key = 'business';
UPDATE page_registry SET sort_order = 38 WHERE code = 'portal'    AND section_key = 'business';
UPDATE page_registry SET sort_order = 39 WHERE code = 'whatsapp'  AND section_key = 'business';

-- 11. Re-sort operations section
UPDATE page_registry SET sort_order = 20 WHERE code = 'execution' AND section_key = 'operations';
UPDATE page_registry SET sort_order = 21 WHERE code = 'quality'   AND section_key = 'operations';
UPDATE page_registry SET sort_order = 22 WHERE code = 'hse'       AND section_key = 'operations';
UPDATE page_registry SET sort_order = 23 WHERE code = 'warehouse' AND section_key = 'operations';
UPDATE page_registry SET sort_order = 24 WHERE code = 'field-service' AND section_key = 'operations';

-- 12. Re-sort documents section
UPDATE page_registry SET sort_order = 50 WHERE code = 'documents' AND section_key = 'documents';
UPDATE page_registry SET sort_order = 51 WHERE code = 'approvals' AND section_key = 'documents';

-- 13. Re-sort communication section
UPDATE page_registry SET sort_order = 55 WHERE code = 'chat'      AND section_key = 'communication';
UPDATE page_registry SET sort_order = 56 WHERE code = 'meetings'   AND section_key = 'communication';
UPDATE page_registry SET sort_order = 57 WHERE code = 'email'      AND section_key = 'communication';
UPDATE page_registry SET sort_order = 58 WHERE (code = 'support' OR code = 'email_compose' OR code = 'chat_channels' OR code = 'meetings_recordings') AND section_key = 'communication';

-- 14. Re-sort system section
UPDATE page_registry SET sort_order = 60 WHERE code = 'settings'      AND section_key = 'system';
UPDATE page_registry SET sort_order = 61 WHERE code = 'notifications'  AND section_key = 'system';

-- 15. Re-sort admin pages
UPDATE page_registry SET sort_order = 99  WHERE code = 'admin_dashboard' AND section_key = 'admin';
UPDATE page_registry SET sort_order = 100 WHERE code = 'admin_users'     AND section_key = 'admin';
UPDATE page_registry SET sort_order = 101 WHERE code = 'admin_roles'     AND section_key = 'admin';
UPDATE page_registry SET sort_order = 102 WHERE code = 'admin_branding'  AND section_key = 'admin';
UPDATE page_registry SET sort_order = 103 WHERE code = 'admin_settings'  AND section_key = 'admin';
UPDATE page_registry SET sort_order = 104 WHERE code = 'admin_sql'       AND section_key = 'admin';
UPDATE page_registry SET sort_order = 105 WHERE code = 'table_browser'   AND section_key = 'admin';
UPDATE page_registry SET sort_order = 106 WHERE code = 'system_health'   AND section_key = 'admin';
UPDATE page_registry SET sort_order = 107 WHERE code = 'backup_export'   AND section_key = 'admin';
UPDATE page_registry SET sort_order = 108 WHERE code = 'audit_log'       AND section_key = 'admin';
