CREATE TABLE IF NOT EXISTS form_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  entity_type TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE form_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "form_definitions_select_all" ON form_definitions FOR SELECT USING (true);
CREATE POLICY "form_definitions_insert_admin" ON form_definitions FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "form_definitions_update_admin" ON form_definitions FOR UPDATE USING (is_admin());
CREATE POLICY "form_definitions_delete_admin" ON form_definitions FOR DELETE USING (is_admin());
