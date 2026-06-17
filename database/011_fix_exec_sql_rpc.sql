-- ============================================================================
-- FIX: Re-deploy exec_sql RPC with proper search_path and error handling
-- ============================================================================
-- This migration ensures the exec_sql function exists for the SQL Editor.
-- Run this in your Supabase SQL Editor or via CLI.
-- ============================================================================

-- Drop if exists with old signature to avoid conflicts
DROP FUNCTION IF EXISTS public.exec_sql(TEXT);

-- Recreate with SECURITY DEFINER and proper search_path
CREATE OR REPLACE FUNCTION public.exec_sql(query TEXT)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    admin_check BOOLEAN;
BEGIN
    -- Verify caller is admin
    SELECT is_admin() INTO admin_check;
    IF NOT admin_check THEN
        RAISE EXCEPTION 'Only admins can execute SQL';
    END IF;

    -- Execute the query and return results as JSONB rows
    RETURN QUERY EXECUTE query;
END;
$$;

-- Grant execute to authenticated users (RLS in function body enforces admin check)
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO authenticated;

-- Verify the function was created
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'exec_sql';
