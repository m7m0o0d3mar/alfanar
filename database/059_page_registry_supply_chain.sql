-- ============================================================
-- Page Registry for Supply Chain and Contracts pages
-- ============================================================

-- Contracts page in business section (sort 32.5, between procurement and finance)
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
SELECT 'contracts', '/contracts', 'FileText', 'Contracts Management', 'إدارة العقود', 'business', 'Business', 'الأعمال', 32.5, true, false, NULL
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'contracts');

-- Supply Chain Dashboard in analytics section (sort 42, between resources and daily_reports)
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
SELECT 'supply_chain', '/supply-chain', 'Activity', 'Supply Chain', 'سلسلة التوريد', 'analytics', 'Analytics & Reports', 'التقارير والتحليلات', 42, true, false, NULL
WHERE NOT EXISTS (SELECT 1 FROM page_registry WHERE code = 'supply_chain');

-- Update sort orders to accommodate new pages
UPDATE page_registry SET sort_order = 32 WHERE code = 'procurement' AND section_key = 'business';
UPDATE page_registry SET sort_order = 33 WHERE code = 'contracts' AND section_key = 'business';
UPDATE page_registry SET sort_order = 34 WHERE code = 'finance' AND section_key = 'business';
UPDATE page_registry SET sort_order = 35 WHERE code = 'sales' AND section_key = 'business';
UPDATE page_registry SET sort_order = 36 WHERE code = 'crm' AND section_key = 'business';
UPDATE page_registry SET sort_order = 37 WHERE code = 'resources' AND section_key = 'business';
UPDATE page_registry SET sort_order = 38 WHERE code = 'technical' AND section_key = 'business';
UPDATE page_registry SET sort_order = 39 WHERE code = 'portal' AND section_key = 'business';
UPDATE page_registry SET sort_order = 40 WHERE code = 'whatsapp' AND section_key = 'business';

UPDATE page_registry SET sort_order = 32 WHERE code = 'procurement' AND section_key = 'business';
