-- Dedicated introspection functions for Table Browser

CREATE OR REPLACE FUNCTION public.list_tables()
RETURNS TABLE(table_name TEXT, table_schema TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT t.table_name::text, t.table_schema::text
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
  ORDER BY t.table_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_tables() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_columns(tbl TEXT)
RETURNS TABLE(column_name TEXT, data_type TEXT, is_nullable TEXT, column_default TEXT, character_maximum_length INT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.column_name::text, c.data_type::text, c.is_nullable::text, c.column_default::text, c.character_maximum_length::int
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = tbl
  ORDER BY c.ordinal_position;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_columns(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_table_constraints(tbl TEXT)
RETURNS TABLE(column_name TEXT, constraint_type TEXT, foreign_table_name TEXT, foreign_column_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT kcu.column_name::text, tc.constraint_type::text, ccu.table_name::text AS foreign_table_name, ccu.column_name::text AS foreign_column_name
  FROM information_schema.key_column_usage kcu
  JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
  LEFT JOIN information_schema.constraint_column_usage ccu ON kcu.constraint_name = ccu.constraint_name
  WHERE kcu.table_schema = 'public' AND kcu.table_name = tbl;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_table_constraints(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_unique_constraints(tbl TEXT)
RETURNS TABLE(constraint_name TEXT, column_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT tc.constraint_name::text, kcu.column_name::text
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_schema = 'public' AND tc.table_name = tbl AND tc.constraint_type = 'UNIQUE';
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_unique_constraints(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_check_constraints(tbl TEXT)
RETURNS TABLE(constraint_name TEXT, check_clause TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT cc.constraint_name::text, cc.check_clause::text
  FROM information_schema.check_constraints cc
  WHERE cc.constraint_name IN (
    SELECT tc.constraint_name FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public' AND tc.table_name = tbl AND tc.constraint_type = 'CHECK'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_check_constraints(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_incoming_fks(tbl TEXT)
RETURNS TABLE(table_name TEXT, column_name TEXT, referenced_column TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT kcu.table_name::text, kcu.column_name::text, ccu.column_name::text AS referenced_column
  FROM information_schema.key_column_usage kcu
  JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
  JOIN information_schema.constraint_column_usage ccu ON kcu.constraint_name = ccu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = tbl AND ccu.table_schema = 'public';
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_incoming_fks(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_tables_with_fk()
RETURNS TABLE(table_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT kcu.table_name::text
  FROM information_schema.key_column_usage kcu
  JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
  JOIN information_schema.constraint_column_usage ccu ON kcu.constraint_name = ccu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY' AND kcu.table_schema = 'public';
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_tables_with_fk() TO authenticated;
