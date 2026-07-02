-- Register Field Service page in page_registry
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
VALUES ('field-service', '/field-service', 'Wrench', 'Field Service', 'خدمة ميدانية', 'operations', 'Operations', 'العمليات', 65, true, false, NULL)
ON CONFLICT (code) DO NOTHING;
