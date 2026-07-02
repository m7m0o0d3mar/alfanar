-- PlanRadar-style Punch List / Defects Tracking
CREATE TABLE IF NOT EXISTS qc_defects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_no TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  severity TEXT NOT NULL DEFAULT 'minor',
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  location_description TEXT,
  due_date DATE,
  photos JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE qc_defects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Defects select" ON qc_defects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Defects insert" ON qc_defects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Defects update" ON qc_defects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Defects delete" ON qc_defects FOR DELETE TO authenticated USING (true);
