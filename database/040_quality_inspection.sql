-- Quality Control & Inspection Module
-- Inspired by GoAudits (checklist inspections), Axonator (QC workflows), Acumatica (project quality)

-- 1. Inspection Checklist Templates (reusable forms)
CREATE TABLE IF NOT EXISTS qc_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  category VARCHAR(100) NOT NULL DEFAULT 'general',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Template Items (questions/checks within a template)
CREATE TABLE IF NOT EXISTS qc_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES qc_checklist_templates(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  description_en TEXT NOT NULL,
  description_ar TEXT,
  expected_value TEXT,
  is_critical BOOLEAN DEFAULT false,
  weight DECIMAL(5,2) DEFAULT 1.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Inspections (scheduled/completed inspections)
CREATE TABLE IF NOT EXISTS qc_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES qc_checklist_templates(id),
  inspection_no VARCHAR(50) NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
  material_id UUID REFERENCES materials_catalog(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  inspection_date DATE NOT NULL,
  inspector_id UUID REFERENCES user_profiles(id),
  status VARCHAR(50) DEFAULT 'draft',
  score_percent DECIMAL(5,2),
  notes TEXT,
  signed_by VARCHAR(255),
  signed_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Inspection Results (per-item results)
CREATE TABLE IF NOT EXISTS qc_inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES qc_inspections(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES qc_template_items(id),
  result VARCHAR(20) CHECK (result IN ('pass','fail','na')),
  actual_value TEXT,
  notes TEXT,
  photo_urls TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Non-Conformance Reports (dedicated NCR table)
CREATE TABLE IF NOT EXISTS qc_ncr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ncr_no VARCHAR(50) NOT NULL,
  source_type VARCHAR(50) DEFAULT 'inspection',
  source_id UUID,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'minor',
  status VARCHAR(50) DEFAULT 'open',
  root_cause TEXT,
  detected_date DATE DEFAULT CURRENT_DATE,
  closed_date DATE,
  assigned_to UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CAPA (Corrective & Preventive Actions)
CREATE TABLE IF NOT EXISTS qc_capa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_no VARCHAR(50) NOT NULL,
  ncr_id UUID REFERENCES qc_ncr(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  action_type VARCHAR(20) NOT NULL DEFAULT 'corrective',
  root_cause TEXT,
  proposed_action TEXT,
  assigned_to UUID REFERENCES user_profiles(id),
  deadline DATE,
  status VARCHAR(50) DEFAULT 'open',
  effectiveness_review TEXT,
  closed_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE qc_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_ncr ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_capa ENABLE ROW LEVEL SECURITY;

-- RLS policies: authenticated users can read/write
CREATE POLICY "Authenticated can read qc_checklist_templates" ON qc_checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert qc_checklist_templates" ON qc_checklist_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update qc_checklist_templates" ON qc_checklist_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete qc_checklist_templates" ON qc_checklist_templates FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can read qc_template_items" ON qc_template_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert qc_template_items" ON qc_template_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update qc_template_items" ON qc_template_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete qc_template_items" ON qc_template_items FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can read qc_inspections" ON qc_inspections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert qc_inspections" ON qc_inspections FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update qc_inspections" ON qc_inspections FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete qc_inspections" ON qc_inspections FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can read qc_inspection_items" ON qc_inspection_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert qc_inspection_items" ON qc_inspection_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update qc_inspection_items" ON qc_inspection_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete qc_inspection_items" ON qc_inspection_items FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can read qc_ncr" ON qc_ncr FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert qc_ncr" ON qc_ncr FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update qc_ncr" ON qc_ncr FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete qc_ncr" ON qc_ncr FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can read qc_capa" ON qc_capa FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert qc_capa" ON qc_capa FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update qc_capa" ON qc_capa FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete qc_capa" ON qc_capa FOR DELETE TO authenticated USING (true);
