-- Register WhatsApp Messages page in sidebar
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_enabled, is_admin, require_module)
VALUES ('whatsapp', '/whatsapp', 'MessageCircle', 'WhatsApp', 'واتساب', 'crm', 'CRM', 'سي آر إم', 43, true, false, NULL)
ON CONFLICT (code) DO NOTHING;
