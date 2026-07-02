-- Flow Diagrams for data-flow visualization between tables and pages

CREATE TABLE IF NOT EXISTS flow_diagrams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT NOT NULL,
  name_ar TEXT,
  description_en TEXT,
  description_ar TEXT,
  config JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE flow_diagrams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flow_diagrams_select" ON flow_diagrams;
DROP POLICY IF EXISTS "flow_diagrams_insert" ON flow_diagrams;
DROP POLICY IF EXISTS "flow_diagrams_update" ON flow_diagrams;
DROP POLICY IF EXISTS "flow_diagrams_delete" ON flow_diagrams;

CREATE POLICY "flow_diagrams_select" ON flow_diagrams
  FOR SELECT USING (true);

CREATE POLICY "flow_diagrams_insert" ON flow_diagrams
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "flow_diagrams_update" ON flow_diagrams
  FOR UPDATE USING (auth.role() = 'authenticated' AND (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "flow_diagrams_delete" ON flow_diagrams
  FOR DELETE USING (auth.role() = 'authenticated' AND (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin');

GRANT SELECT ON flow_diagrams TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON flow_diagrams TO authenticated, service_role;
