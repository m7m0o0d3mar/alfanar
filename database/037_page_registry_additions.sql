-- ============================================================================
-- 037: Page Registry Additions - Analytics, Support, Admin Dashboard
-- ============================================================================

INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_admin) VALUES
  ('analytics', '/analytics', 'BarChart3', 'Analytics', 'تحليلات', 'sales', 'Sales & CRM', 'المبيعات', 42, false),
  ('support', '/support', 'TicketCheck', 'Support', 'الدعم الفني', 'sales', 'Sales & CRM', 'المبيعات', 43, false),
  ('admin_dashboard', '/admin', 'LayoutDashboard', 'Admin Dashboard', 'لوحة الإدارة', 'admin', 'Administration', 'الإدارة', 99, true)
ON CONFLICT (code) DO UPDATE SET
  path = EXCLUDED.path, icon = EXCLUDED.icon,
  name_en = EXCLUDED.name_en, name_ar = EXCLUDED.name_ar,
  sort_order = EXCLUDED.sort_order;
