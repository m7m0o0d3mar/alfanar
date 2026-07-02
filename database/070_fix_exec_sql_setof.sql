-- Revert exec_sql to RETURNS SETOF JSONB for full backward compatibility with all pages
-- Migration 067 broke consumers by returning [{"exec_sql": [...]}] instead of [{...}, {...}]

DROP FUNCTION IF EXISTS public.exec_sql(TEXT);

CREATE OR REPLACE FUNCTION public.exec_sql(query TEXT)
RETURNS SETOF JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_select BOOLEAN;
BEGIN
  is_select := (regexp_match(trim(query), '^\s*(SELECT|WITH|EXPLAIN)\s', 'i') IS NOT NULL);

  IF is_select THEN
    RETURN QUERY EXECUTE format('SELECT row_to_json(t)::jsonb FROM (%s) t', query);
  ELSE
    EXECUTE query;
    RETURN;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO service_role;
