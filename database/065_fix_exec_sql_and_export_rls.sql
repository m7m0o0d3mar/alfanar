-- Fix exec_sql to return query results (not just success flag)
DROP FUNCTION IF EXISTS public.exec_sql(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.exec_sql(query TEXT)
RETURNS SETOF JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY EXECUTE query;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO authenticated;

-- Fix export_configs RLS: use auth.role() instead of is_admin() (doesn't work with service key)
DROP POLICY IF EXISTS "export_configs_select_admin" ON export_configs;
DROP POLICY IF EXISTS "export_configs_insert_admin" ON export_configs;
DROP POLICY IF EXISTS "export_configs_update_admin" ON export_configs;
DROP POLICY IF EXISTS "export_configs_delete_admin" ON export_configs;

CREATE POLICY "export_configs_select" ON export_configs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "export_configs_insert" ON export_configs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "export_configs_update" ON export_configs FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "export_configs_delete" ON export_configs FOR DELETE USING (auth.role() = 'authenticated');

-- Fix export_logs RLS
DROP POLICY IF EXISTS "export_logs_select_admin" ON export_logs;
DROP POLICY IF EXISTS "export_logs_insert_admin" ON export_logs;

CREATE POLICY "export_logs_select" ON export_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "export_logs_insert" ON export_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
