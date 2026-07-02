-- 038: Register Customer Portal in page_registry

INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order)
VALUES
  ('portal', '/portal', 'Globe', 'Customer Portal', 'بوابة العميل', 'crm', 'CRM', 'سي آر إم', 44)
ON CONFLICT (code) DO UPDATE SET
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  name_en = EXCLUDED.name_en,
  name_ar = EXCLUDED.name_ar,
  sort_order = EXCLUDED.sort_order;
