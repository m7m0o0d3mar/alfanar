-- ============================================================
-- RESTORE SYSTEM CONFIG TABLES (page_registry, roles, etc.)
-- Run via: Get-Content ... | supabase db query --linked
-- ============================================================

-- 1. ROLES (from 050_rbac_rebuild.sql)
INSERT INTO roles (code, name_en, name_ar, is_system, hierarchy_level) VALUES
  ('admin', 'Administrator', 'مدير النظام', true, 100),
  ('developer', 'Developer', 'مطور', true, 90),
  ('project_manager', 'Project Manager', 'مدير مشروع', true, 80),
  ('main_contractor', 'Main Contractor', 'مقاول رئيسي', true, 70),
  ('subcontractor', 'Subcontractor', 'مقاول فرعي', true, 60),
  ('engineer', 'Site Engineer', 'مهندس موقع', true, 50),
  ('quality', 'QC Inspector', 'مفتش جودة', true, 40),
  ('hse', 'HSE Officer', 'مسؤول سلامة', true, 40),
  ('hr', 'HR Manager', 'مدير موارد بشرية', true, 50),
  ('finance', 'Finance Officer', 'مسؤول مالي', true, 50),
  ('sales', 'Sales', 'مبيعات', true, 30),
  ('consultant', 'Consultant', 'استشاري', true, 60),
  ('client', 'Client', 'عميل', true, 20)
ON CONFLICT (code) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_ar = EXCLUDED.name_ar,
  is_system = true;

-- 2. ROLE PERMISSIONS (from 010_admin_features.sql, adapted for current schema)
INSERT INTO role_permissions (role, permissions) VALUES
('admin', '{"all_modules": true, "manage_users": true, "manage_roles": true, "manage_settings": true, "sql_editor": true}'::jsonb),
('developer', '{"all_modules": true, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('project_manager', '{"all_modules": ["dashboard","projects","units","execution","quality","hr","procurement","documents","approvals"], "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('main_contractor', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('subcontractor', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('engineer', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('quality', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('hse', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('hr', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('finance', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('sales', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('consultant', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('client', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb)
ON CONFLICT DO NOTHING;

-- 3. CORE PAGE REGISTRY (from 050_rbac_rebuild.sql)
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_admin) VALUES
  ('dashboard', '/', 'LayoutDashboard', 'Dashboard', 'لوحة التحكم', 'main', '', '', 1, false),
  ('projects', '/projects', 'Building2', 'Projects', 'المشاريع', 'projects', 'Projects', 'المشاريع', 10, false),
  ('units', '/units', 'Grid3X3', 'Units', 'الوحدات', 'projects', 'Projects', 'المشاريع', 11, false),
  ('timelines', '/timelines', 'CalendarRange', 'Timelines', 'الجداول الزمنية', 'projects', 'Projects', 'المشاريع', 12, false),
  ('maps', '/maps', 'Map', 'Maps', 'الخرائط', 'projects', 'Projects', 'المشاريع', 13, false),
  ('execution', '/execution', 'HardHat', 'Execution', 'التنفيذ', 'operations', 'Operations', 'العمليات', 20, false),
  ('quality', '/quality', 'ShieldCheck', 'Quality', 'الجودة', 'operations', 'Operations', 'العمليات', 21, false),
  ('hse', '/hse', 'ShieldCheck', 'HSE', 'السلامة', 'operations', 'Operations', 'العمليات', 22, false),
  ('warehouse', '/warehouse', 'Warehouse', 'Warehouse', 'المخازن', 'operations', 'Operations', 'العمليات', 23, false),
  ('hr', '/hr', 'Users', 'HR & Payroll', 'الموارد البشرية', 'resources', 'Resources', 'الموارد', 30, false),
  ('attendance', '/attendance', 'Clock', 'Attendance', 'الحضور', 'resources', 'Resources', 'الموارد', 31, false),
  ('procurement', '/procurement', 'ShoppingCart', 'Procurement', 'المشتريات', 'resources', 'Resources', 'الموارد', 32, false),
  ('finance', '/finance', 'DollarSign', 'Finance', 'المالية', 'resources', 'Resources', 'الموارد', 33, false),
  ('resources', '/resources', 'Briefcase', 'Resources', 'الموارد', 'resources', 'Resources', 'الموارد', 34, false),
  ('sales', '/sales', 'TrendingUp', 'Sales', 'المبيعات', 'sales', 'Sales & CRM', 'المبيعات', 40, false),
  ('crm', '/crm', 'Contact', 'CRM', 'CRM', 'sales', 'Sales & CRM', 'المبيعات', 41, false),
  ('technical', '/technical', 'Wrench', 'Technical Office', 'المكتب الفني', 'docs', 'Documents', 'الوثائق', 50, false),
  ('documents', '/documents', 'FolderOpen', 'Documents', 'الوثائق', 'docs', 'Documents', 'الوثائق', 51, false),
  ('approvals', '/approvals', 'CheckSquare', 'Approvals', 'الموافقات', 'docs', 'Documents', 'الوثائق', 52, false),
  ('settings', '/settings', 'Cog', 'Settings', 'الإعدادات', 'system', 'System', 'النظام', 60, false),
  ('admin_users', '/admin/users', 'UserCog', 'Users', 'المستخدمين', 'admin', 'Administration', 'الإدارة', 100, true),
  ('admin_roles', '/admin/roles', 'Shield', 'Roles & Permissions', 'الأدوار والصلاحيات', 'admin', 'Administration', 'الإدارة', 101, true),
  ('admin_branding', '/admin/branding', 'Palette', 'Branding', 'العلامة التجارية', 'admin', 'Administration', 'الإدارة', 102, true),
  ('admin_settings', '/admin/settings', 'Cog', 'System Settings', 'إعدادات النظام', 'admin', 'Administration', 'الإدارة', 103, true),
  ('admin_sql', '/admin/sql', 'Terminal', 'SQL Editor', 'محرر SQL', 'admin', 'Administration', 'الإدارة', 104, true)
ON CONFLICT (code) DO UPDATE SET
  path = EXCLUDED.path, icon = EXCLUDED.icon,
  name_en = EXCLUDED.name_en, name_ar = EXCLUDED.name_ar,
  sort_order = EXCLUDED.sort_order;

-- 4. ADDITIONAL PAGE REGISTRY (from 037_page_registry_additions.sql)
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_admin) VALUES
  ('analytics', '/analytics', 'BarChart3', 'Analytics', 'تحليلات', 'sales', 'Sales & CRM', 'المبيعات', 42, false),
  ('support', '/support', 'TicketCheck', 'Support', 'الدعم الفني', 'sales', 'Sales & CRM', 'المبيعات', 43, false),
  ('admin_dashboard', '/admin', 'LayoutDashboard', 'Admin Dashboard', 'لوحة الإدارة', 'admin', 'Administration', 'الإدارة', 99, true)
ON CONFLICT (code) DO UPDATE SET
  path = EXCLUDED.path, icon = EXCLUDED.icon,
  name_en = EXCLUDED.name_en, name_ar = EXCLUDED.name_ar,
  sort_order = EXCLUDED.sort_order;

-- 5. PORTAL PAGE (from 038_page_registry_portal_additions.sql)
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order)
VALUES
  ('portal', '/portal', 'Globe', 'Customer Portal', 'بوابة العميل', 'crm', 'CRM', 'سي آر إم', 44)
ON CONFLICT (code) DO UPDATE SET
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  name_en = EXCLUDED.name_en,
  name_ar = EXCLUDED.name_ar,
  sort_order = EXCLUDED.sort_order;

-- 6. FIELD SERVICE (from 042_field_service_page.sql)
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
VALUES ('field-service', '/field-service', 'Wrench', 'Field Service', 'خدمة ميدانية', 'operations', 'Operations', 'العمليات', 65, true, false, NULL)
ON CONFLICT (code) DO NOTHING;

-- 7. WHATSAPP (from 045_whatsapp_page.sql)
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
VALUES ('whatsapp', '/whatsapp', 'MessageCircle', 'WhatsApp', 'واتساب', 'crm', 'CRM', 'سي آر إم', 43, true, false, NULL)
ON CONFLICT (code) DO NOTHING;

-- 8. E-INVOICING (from 047_zatca_page.sql)
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
VALUES ('zatca', '/zatca', 'Receipt', 'E-Invoicing', 'الفوترة الإلكترونية', 'finance', 'Finance', 'المالية', 55, true, false, NULL)
ON CONFLICT (code) DO NOTHING;

-- 9. AUDIT LOG (from 058_dynamic_page_config.sql)
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_admin, require_module, config)
VALUES
('audit_log', '/admin/audit-log', 'History', 'Audit Log', 'سجل النشاطات', 'system', 'System', 'النظام', 140, true, NULL, '{"view": "table", "entity_type": "audit_logs"}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  name_en = EXCLUDED.name_en,
  name_ar = EXCLUDED.name_ar,
  config = EXCLUDED.config;

-- 10. SYSTEM HEALTH (from 059_system_health_page.sql)
INSERT INTO page_registry (code, path, name_en, name_ar, icon, section_key, section_label_en, section_label_ar, is_admin, require_module, sort_order, is_enabled)
SELECT 'system_health', '/admin/health', 'System Health', 'صحة النظام', 'Activity', 'admin_section', 'Administration', 'الإدارة', true, NULL, 95, true
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'system_health');

-- 11. CONTRACTS & SUPPLY CHAIN (from 059_page_registry_supply_chain.sql)
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
SELECT 'contracts', '/contracts', 'FileText', 'Contracts Management', 'إدارة العقود', 'business', 'Business', 'الأعمال', 32.5, true, false, NULL
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'contracts');

INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
SELECT 'supply_chain', '/supply-chain', 'Activity', 'Supply Chain', 'سلسلة التوريد', 'analytics', 'Analytics & Reports', 'التقارير والتحليلات', 42, true, false, NULL
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'supply_chain');

-- 12. BACKUP & EXPORT (from 064_backup_export_page_registry.sql)
INSERT INTO page_registry (code, path, name_en, name_ar, icon, section_key, section_label_en, section_label_ar, is_admin, require_module, sort_order, is_enabled)
SELECT 'backup_export', '/admin/backup-export', 'Backup & Export', 'النسخ الاحتياطي والتصدير', 'HardDrive', 'admin_section', 'Administration', 'الإدارة', true, NULL, 96, true
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'backup_export');

-- 13. TABLE BROWSER (from 066_table_browser_page.sql)
INSERT INTO page_registry (code, path, name_en, name_ar, icon, section_key, section_label_en, section_label_ar, is_admin, require_module, sort_order, is_enabled)
SELECT 'table_browser', '/admin/table-browser', 'Table Browser', 'متصفح الجداول', 'Database', 'admin_section', 'Administration', 'الإدارة', true, NULL, 95, true
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'table_browser');

-- 14. PROJECT ANALYTICS (from 085_project_analytics_page_registry.sql)
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
VALUES ('project_analytics', '/project-analytics', 'BarChart3', 'Project Analytics', 'تحليلات المشاريع', 'projects', 'Projects', 'المشاريع', 14, true, false, 'projects')
ON CONFLICT (code) DO NOTHING;

-- 15. NOTIFICATIONS (from 087_notifications_page.sql)
INSERT INTO page_registry (code, path, name_en, name_ar, icon, sort_order, is_enabled, require_module, is_admin)
VALUES ('notifications', '/notifications', 'Notifications', 'الإشعارات', 'Bell', 25, true, NULL, false)
ON CONFLICT (code) DO NOTHING;

-- 16. DAILY REPORTS (from 089_reorganize_navigation.sql)
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
SELECT 'daily_reports', '/daily-reports', 'FileText', 'Daily Reports', 'التقارير اليومية', 'analytics', 'Analytics & Reports', 'التقارير والتحليلات', 43, true, false, NULL
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'daily_reports');

-- 17. COMMUNICATION & COST MANAGEMENT (from 093_page_registry_additions.sql)
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
SELECT 'communication', '/communication', 'MessageSquare', 'Communication Hub', 'مركز الاتصالات', 'communication', 'Communication', 'التواصل', 54, true, false, NULL
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'communication');

INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
SELECT 'cost_management', '/cost', 'DollarSign', 'Cost Management', 'إدارة التكاليف', 'analytics', 'Analytics & Reports', 'التقارير والتحليلات', 44, true, false, NULL
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'cost_management');

-- 18. REPORTS (from 096_page_registry_reports.sql)
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
SELECT 'reports', '/reports', 'FileText', 'Reports', 'التقارير', 'analytics', 'Analytics & Reports', 'التقارير والتحليلات', 45, true, false, NULL
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'reports');

-- 19. STATUS TEMPLATES (from 102_page_registry_status_templates.sql)
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
SELECT 'status_templates', '/status-templates', 'Palette', 'Status Templates', 'قوالب الحالة', 'admin', 'Administration', 'الإدارة', 18, true, false, NULL
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'status_templates');

-- 20. SYSTEM SETTINGS (from 057_seed_new_tables.sql)
INSERT INTO system_settings (key, value) VALUES
  ('app_name', '"ERP"'),
  ('company_name', '"شركة الإنشاءات الحديثة"'),
  ('primary_color', '"#a855f7"'),
  ('secondary_color', '"#06b6d4"'),
  ('default_language', '"ar"'),
  ('theme', '"dark"'),
  ('font_family', '"Inter"'),
  ('logo_url', '""'),
  ('login_logo_url', '""'),
  ('login_message', '"نظام تخطيط موارد المؤسسات"'),
  ('favicon_url', '""'),
  ('custom_css', '""'),
  ('dashboard_widgets', '["recent_activity","budget_status","procurement_spend","quick_actions","ai_insights"]')
ON CONFLICT (key) DO NOTHING;
