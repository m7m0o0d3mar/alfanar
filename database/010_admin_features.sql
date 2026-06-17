-- ============================================================================
-- ADMIN FEATURES: Role Permissions + SQL Execution
-- ============================================================================

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    role TEXT PRIMARY KEY,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage role_permissions; all authenticated can read
CREATE POLICY "rp_select_all" ON role_permissions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "rp_insert_admin" ON role_permissions FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "rp_update_admin" ON role_permissions FOR UPDATE USING (is_admin());
CREATE POLICY "rp_delete_admin" ON role_permissions FOR DELETE USING (is_admin());

-- Seed default permissions for each role
INSERT INTO role_permissions (role, permissions) VALUES
('admin', '{"all_modules": true, "manage_users": true, "manage_roles": true, "manage_settings": true, "sql_editor": true}'::jsonb),
('developer', '{"all_modules": true, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('project_manager', '{"all_modules": ["dashboard","projects","units","execution","quality","hr","procurement","documents","approvals"], "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('main_contractor', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('subcontractor', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('engineer', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('quality', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('hse', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('hr', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('finance', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('sales', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('consultant', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb),
('client', '{"all_modules": false, "manage_users": false, "manage_roles": false, "manage_settings": false, "sql_editor": false}'::jsonb)
ON CONFLICT (role) DO NOTHING;

-- ============================================================================
-- SQL Execution RPC (admin only)
-- ============================================================================
-- This function allows admins to execute arbitrary SQL via the Supabase API.
-- It uses SECURITY DEFINER to bypass RLS.
CREATE OR REPLACE FUNCTION public.exec_sql(query TEXT)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify caller is admin
    IF NOT (SELECT is_admin()) THEN
        RAISE EXCEPTION 'Only admins can execute SQL';
    END IF;

    -- Execute the query
    RETURN QUERY
    EXECUTE query;
END;
$$;

-- Grant execute to authenticated users (RLS in function body enforces admin check)
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO authenticated;
