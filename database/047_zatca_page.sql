-- Register ZATCA E-Invoicing page in sidebar
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
VALUES ('zatca', '/zatca', 'Receipt', 'E-Invoicing', 'الفوترة الإلكترونية', 'finance', 'Finance', 'المالية', 55, true, false, NULL)
ON CONFLICT (code) DO NOTHING;
