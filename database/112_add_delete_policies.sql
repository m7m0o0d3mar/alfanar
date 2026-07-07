-- ============================================================================
-- ADD MISSING DELETE POLICIES FOR units AND projects
-- ============================================================================
-- Run via: Get-Content database\112_add_delete_policies.sql | supabase db query --linked
-- Problem: units and projects have SELECT/INSERT/UPDATE but NO DELETE policy
-- ============================================================================

-- Projects delete policy (admin OR owner OR project_manager)
DROP POLICY IF EXISTS "projects_delete" ON projects;
CREATE POLICY "projects_delete" ON projects
  FOR DELETE USING (
    is_admin()
    OR has_project_role(id, 'owner')
    OR has_project_role(id, 'project_manager')
  );

-- Units delete policy (admin OR project_manager of the project)
DROP POLICY IF EXISTS "units_delete" ON units;
CREATE POLICY "units_delete" ON units
  FOR DELETE USING (
    is_admin()
    OR has_project_role(project_id, 'project_manager')
  );
