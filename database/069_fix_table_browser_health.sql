-- Optimized table list function with row counts and FK flags, granted to all roles

DROP FUNCTION IF EXISTS public.list_tables();
CREATE OR REPLACE FUNCTION public.list_tables()
RETURNS TABLE(table_name TEXT, table_schema TEXT, row_count BIGINT, has_fks BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.table_name::text,
    t.table_schema::text,
    GREATEST(0, COALESCE(
      (SELECT reltuples::bigint FROM pg_class WHERE oid = (quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass),
      0
    )),
    EXISTS(
      SELECT 1 FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND kcu.table_schema = t.table_schema
        AND kcu.table_name = t.table_name
    ) AS has_fks
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
  ORDER BY t.table_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_tables() TO anon;
GRANT EXECUTE ON FUNCTION public.list_tables() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_tables() TO service_role;

GRANT EXECUTE ON FUNCTION public.list_columns(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.list_table_constraints(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.list_unique_constraints(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.list_check_constraints(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.list_incoming_fks(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.list_tables_with_fk() TO anon;
