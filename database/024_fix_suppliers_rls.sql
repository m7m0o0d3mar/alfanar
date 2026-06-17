-- ============================================================================
-- FIX: suppliers SELECT policy too restrictive
-- The original policy (is_admin() OR has user_projects) blocked finance/
-- project_manager roles that could INSERT/UPDATE but not SELECT.
-- Now matches the INSERT/UPDATE policy by also allowing these roles.
-- ============================================================================

DROP POLICY IF EXISTS "suppliers_select" ON suppliers;

CREATE POLICY "suppliers_select" ON suppliers FOR SELECT USING (
    is_admin()
    OR current_user_role() IN ('finance', 'project_manager')
    OR EXISTS (SELECT 1 FROM user_projects up WHERE up.user_id = auth.uid())
);
