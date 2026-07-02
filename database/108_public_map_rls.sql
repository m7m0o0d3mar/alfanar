-- 108_public_map_rls.sql
-- Enable anonymous access to buildings and project_geometries for public map

-- Buildings: allow SELECT for anon role (all active buildings)
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON buildings;
CREATE POLICY "anon_select" ON buildings
  FOR SELECT USING (true);

-- Project geometries: allow SELECT for anon role
ALTER TABLE project_geometries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON project_geometries;
CREATE POLICY "anon_select" ON project_geometries
  FOR SELECT USING (true);

-- Map layer images: allow SELECT for anon role (published content)
ALTER TABLE map_layer_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON map_layer_images;
CREATE POLICY "anon_select" ON map_layer_images
  FOR SELECT USING (true);
