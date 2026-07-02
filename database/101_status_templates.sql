-- Status Templates — customizable status definitions, labels, colors, icons
-- Allows projects/blocks to use custom status schemas instead of hardcoded ones

CREATE TABLE IF NOT EXISTS status_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name_en VARCHAR(200) NOT NULL,
  name_ar VARCHAR(200),
  description TEXT,
  target_type VARCHAR(30) NOT NULL DEFAULT 'project' CHECK (target_type IN ('project','block','unit','task','all')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS status_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES status_templates(id) ON DELETE CASCADE,
  status_key VARCHAR(50) NOT NULL,
  label_en VARCHAR(100) NOT NULL,
  label_ar VARCHAR(100),
  color VARCHAR(20) NOT NULL DEFAULT '#6b7280',
  icon VARCHAR(50),
  sort_order INT NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  allow_transitions JSONB DEFAULT '[]',
  UNIQUE(template_id, status_key)
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS status_template_id UUID REFERENCES status_templates(id) ON DELETE SET NULL;
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS status_template_id UUID REFERENCES status_templates(id) ON DELETE SET NULL;

ALTER TABLE status_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "status_templates_select" ON status_templates;
DROP POLICY IF EXISTS "status_templates_insert" ON status_templates;
DROP POLICY IF EXISTS "status_templates_update" ON status_templates;
DROP POLICY IF EXISTS "status_templates_delete" ON status_templates;
DROP POLICY IF EXISTS "status_template_items_select" ON status_template_items;
DROP POLICY IF EXISTS "status_template_items_insert" ON status_template_items;
DROP POLICY IF EXISTS "status_template_items_update" ON status_template_items;
DROP POLICY IF EXISTS "status_template_items_delete" ON status_template_items;

CREATE POLICY "status_templates_select" ON status_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "status_templates_insert" ON status_templates FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "status_templates_update" ON status_templates FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "status_templates_delete" ON status_templates FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "status_template_items_select" ON status_template_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "status_template_items_insert" ON status_template_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "status_template_items_update" ON status_template_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "status_template_items_delete" ON status_template_items FOR DELETE USING (auth.role() = 'authenticated');

-- Seed a default construction project status template
INSERT INTO status_templates (code, name_en, name_ar, description, target_type)
VALUES ('CONSTRUCTION-DEFAULT', 'Construction Default', 'الافتراضي للإنشاءات', 'Standard statuses for construction projects', 'all')
ON CONFLICT (code) DO NOTHING;

INSERT INTO status_template_items (template_id, status_key, label_en, label_ar, color, sort_order, is_default)
SELECT id, t.* FROM status_templates st, (VALUES
  ('planning', 'Planning', 'تخطيط', '#3b82f6', 1, false),
  ('in_progress', 'In Progress', 'قيد التنفيذ', '#f59e0b', 2, true),
  ('completed', 'Completed', 'مكتمل', '#22c55e', 3, false),
  ('on_hold', 'On Hold', 'معلق', '#ef4444', 4, false),
  ('cancelled', 'Cancelled', 'ملغي', '#9ca3af', 5, false),
  ('approved', 'Approved', 'معتمد', '#10b981', 6, false),
  ('draft', 'Draft', 'مسودة', '#6b7280', 7, false)
) AS t(status_key, label_en, label_ar, color, sort_order, is_default)
WHERE st.code = 'CONSTRUCTION-DEFAULT'
ON CONFLICT (template_id, status_key) DO NOTHING;

-- Seed a residential sales status template
INSERT INTO status_templates (code, name_en, name_ar, description, target_type)
VALUES ('UNIT-SALES', 'Unit Sales Status', 'حالة بيع الوحدات', 'Sales-oriented statuses for residential units', 'unit')
ON CONFLICT (code) DO NOTHING;

INSERT INTO status_template_items (template_id, status_key, label_en, label_ar, color, sort_order, is_default)
SELECT id, t.* FROM status_templates st, (VALUES
  ('available', 'Available', 'متاح', '#10b981', 1, true),
  ('reserved', 'Reserved', 'محجوز', '#f59e0b', 2, false),
  ('sold', 'Sold', 'مباع', '#ef4444', 3, false),
  ('handed_over', 'Handed Over', 'تم التسليم', '#22c55e', 4, false)
) AS t(status_key, label_en, label_ar, color, sort_order, is_default)
WHERE st.code = 'UNIT-SALES'
ON CONFLICT (template_id, status_key) DO NOTHING;
