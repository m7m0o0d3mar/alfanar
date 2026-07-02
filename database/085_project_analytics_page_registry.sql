-- 085: Register ProjectAnalyticsPage in sidebar

INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
VALUES ('project_analytics', '/project-analytics', 'BarChart3', 'Project Analytics', 'تحليلات المشاريع', 'projects', 'Projects', 'المشاريع', 14, true, false, 'projects')
ON CONFLICT (code) DO NOTHING;
