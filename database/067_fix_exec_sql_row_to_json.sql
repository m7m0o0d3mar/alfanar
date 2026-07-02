DROP FUNCTION IF EXISTS public.exec_sql(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.exec_sql(query TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  EXECUTE 'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM (' || query || ') t' INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO authenticated;
