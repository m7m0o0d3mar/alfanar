-- 109_geometry_input_fix.sql
-- Fix RLS on project_geometries to allow all authenticated users to manage

-- Drop the old admin-only policy (created in 072)
DROP POLICY IF EXISTS "Admins manage project geometries" ON project_geometries;

-- Allow all authenticated users full CRUD on project_geometries
DROP POLICY IF EXISTS "auth_all" ON project_geometries;
CREATE POLICY "auth_all" ON project_geometries
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also create an authenticated SELECT policy (in case the old one was the only SELECT)
DROP POLICY IF EXISTS "auth_select" ON project_geometries;
CREATE POLICY "auth_select" ON project_geometries
  FOR SELECT
  TO authenticated
  USING (true);
