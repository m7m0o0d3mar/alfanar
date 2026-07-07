-- 114: Server-side function for reliable unit generation (bypasses RLS)
-- Called from frontend via supabase.rpc('generate_project_units', {...})
-- p_mode: 'replace' → delete all existing units first, 'append' → only add new ones

CREATE OR REPLACE FUNCTION generate_project_units(
  p_project_id UUID,
  p_unit_data JSONB,
  p_mode TEXT DEFAULT 'append'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_mode = 'replace' THEN
    DELETE FROM units WHERE project_id = p_project_id;
  END IF;

  INSERT INTO units (project_id, unit_code, unit_type, geometry, status, is_active, lat, lng)
  SELECT
    p_project_id,
    unit_code,
    unit_type,
    geometry::jsonb,
    status,
    is_active::boolean,
    lat::double precision,
    lng::double precision
  FROM jsonb_to_recordset(p_unit_data) AS x(
    unit_code text,
    unit_type text,
    geometry text,
    status text,
    is_active text,
    lat text,
    lng text
  )
  ON CONFLICT (project_id, unit_code) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Grant execute to roles that can call via REST API
GRANT EXECUTE ON FUNCTION generate_project_units(UUID, JSONB, TEXT) TO anon, authenticated, service_role;
