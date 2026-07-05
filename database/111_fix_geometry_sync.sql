-- 111: Fix geometry sync triggers — properly extract lat/lng from GeoJSON,
-- and only create project_geometries from units that have actual polygon geometry

-- ── 0. Fix centroid helpers (were extracting entire arrays as text) ──
CREATE OR REPLACE FUNCTION geo_centroid_lat(g JSONB) RETURNS DOUBLE PRECISION AS $$
DECLARE
  t TEXT;
  c JSONB;
BEGIN
  IF g IS NULL THEN RETURN NULL; END IF;
  t := g->>'type';
  c := g->'coordinates';
  IF t = 'Point' THEN
    RETURN (c->>1)::DOUBLE PRECISION;
  ELSIF t = 'Polygon' THEN
    -- First ring, first coordinate pair: coordinates[0][0][1]
    RETURN (c->0->0->>1)::DOUBLE PRECISION;
  ELSIF t = 'MultiPolygon' THEN
    RETURN (c->0->0->0->>1)::DOUBLE PRECISION;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION geo_centroid_lng(g JSONB) RETURNS DOUBLE PRECISION AS $$
DECLARE
  t TEXT;
  c JSONB;
BEGIN
  IF g IS NULL THEN RETURN NULL; END IF;
  t := g->>'type';
  c := g->'coordinates';
  IF t = 'Point' THEN
    RETURN (c->>0)::DOUBLE PRECISION;
  ELSIF t = 'Polygon' THEN
    -- First ring, first coordinate pair: coordinates[0][0][0]
    RETURN (c->0->0->>0)::DOUBLE PRECISION;
  ELSIF t = 'MultiPolygon' THEN
    RETURN (c->0->0->0->>0)::DOUBLE PRECISION;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── 1. Fix sync_geometry_to_unit: extract lat/lng from polygon centroid ──
CREATE OR REPLACE FUNCTION sync_geometry_to_unit()
RETURNS TRIGGER AS $$
DECLARE
  existing_id UUID;
  unit_type_val TEXT;
  unit_code_val TEXT;
  centroid_lat DOUBLE PRECISION;
  centroid_lng DOUBLE PRECISION;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.geometry_type <> 'unit' THEN RETURN NEW; END IF;

  SELECT id INTO existing_id FROM units WHERE geometry_id = NEW.id LIMIT 1;

  unit_code_val := COALESCE(NEW.label_en, 'GEO-' || substring(NEW.id::text, 1, 8));
  unit_type_val := normalize_unit_type(NEW.properties->>'unit_type');

  -- Extract centroid for map marker display
  centroid_lat := geo_centroid_lat(NEW.geometry);
  centroid_lng := geo_centroid_lng(NEW.geometry);

  IF existing_id IS NOT NULL THEN
    UPDATE units SET
      project_id = NEW.project_id,
      unit_code = unit_code_val,
      unit_type = unit_type_val,
      geometry = NEW.geometry,
      lat = COALESCE(units.lat, centroid_lat),
      lng = COALESCE(units.lng, centroid_lng),
      updated_at = now()
    WHERE id = existing_id;
  ELSE
    INSERT INTO units (project_id, unit_code, unit_type, geometry, geometry_id, status, is_active, lat, lng)
    VALUES (NEW.project_id, unit_code_val, unit_type_val, NEW.geometry, NEW.id, 'available', true, centroid_lat, centroid_lng)
    ON CONFLICT (project_id, unit_code) DO UPDATE SET
      geometry = EXCLUDED.geometry,
      geometry_id = EXCLUDED.geometry_id,
      lat = COALESCE(units.lat, EXCLUDED.lat),
      lng = COALESCE(units.lng, EXCLUDED.lng);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. Fix sync_unit_to_geometry: only create geometry for actual polygon geometry,
--    skip Point-only units (they show as markers already)
CREATE OR REPLACE FUNCTION sync_unit_to_geometry()
RETURNS TRIGGER AS $$
DECLARE
  existing_id UUID;
  geom_json JSONB;
  parent_geom_id UUID;
  geom_type TEXT;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  geom_json := NEW.geometry;

  -- Only create project_geometry if unit has real polygon geometry (not just lat/lng)
  -- Units with only lat/lng appear as markers on the map already
  IF geom_json IS NULL THEN RETURN NEW; END IF;

  geom_type := geom_json->>'type';
  -- Skip Point geometries — they'd be invisible as polygons and markers already cover them
  IF geom_type = 'Point' THEN RETURN NEW; END IF;

  -- If unit already has a geometry_id, update existing geometry
  IF NEW.geometry_id IS NOT NULL THEN
    UPDATE project_geometries SET
      project_id = NEW.project_id,
      label_en = NEW.unit_code,
      label_ar = NEW.unit_code,
      geometry = geom_json,
      properties = jsonb_build_object('unit_type', NEW.unit_type, 'sales_status', NEW.status, 'price', NEW.price),
      updated_at = now()
    WHERE id = NEW.geometry_id;
    RETURN NEW;
  END IF;

  -- Check if geometry already exists by matching unit_code & project_id
  SELECT id INTO existing_id FROM project_geometries
    WHERE project_id = NEW.project_id AND geometry_type = 'unit'
      AND label_en = NEW.unit_code LIMIT 1;

  -- Find parent geometry (floor) if unit has floor_id
  parent_geom_id := NULL;
  IF NEW.floor_id IS NOT NULL THEN
    SELECT geometry_id INTO parent_geom_id FROM floors WHERE id = NEW.floor_id;
  END IF;

  IF existing_id IS NOT NULL THEN
    UPDATE project_geometries SET
      parent_id = COALESCE(parent_geom_id, parent_id),
      geometry = geom_json,
      label_ar = NEW.unit_code,
      properties = jsonb_build_object('unit_type', NEW.unit_type, 'sales_status', NEW.status, 'price', NEW.price),
      updated_at = now()
    WHERE id = existing_id;
    UPDATE units SET geometry_id = existing_id WHERE id = NEW.id AND geometry_id IS NULL;
  ELSE
    INSERT INTO project_geometries (project_id, parent_id, geometry_type, label_en, label_ar, geometry, properties, level, sort_order, status)
    VALUES (NEW.project_id, parent_geom_id, 'unit', NEW.unit_code, NEW.unit_code, geom_json,
            jsonb_build_object('unit_type', NEW.unit_type, 'sales_status', NEW.status, 'price', NEW.price),
            3, 0, 'active')
    RETURNING id INTO existing_id;
    UPDATE units SET geometry_id = existing_id WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Fix sync_geometry_to_building: extract lat/lng from centroid ──
CREATE OR REPLACE FUNCTION sync_geometry_to_building()
RETURNS TRIGGER AS $$
DECLARE
  existing_id UUID;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.geometry_type <> 'building' THEN RETURN NEW; END IF;

  SELECT id INTO existing_id FROM buildings WHERE geometry_id = NEW.id LIMIT 1;

  IF existing_id IS NOT NULL THEN
    UPDATE buildings SET
      project_id = NEW.project_id,
      name_en = COALESCE(NEW.label_en, name_en),
      name_ar = NEW.label_ar,
      geometry = NEW.geometry,
      center_lat = geo_centroid_lat(NEW.geometry),
      center_lng = geo_centroid_lng(NEW.geometry),
      updated_at = now()
    WHERE id = existing_id;
  ELSE
    INSERT INTO buildings (project_id, building_code, name_en, name_ar, geometry, center_lat, center_lng, geometry_id)
    VALUES (NEW.project_id, COALESCE(NEW.label_en, 'BLDG-' || substring(NEW.id::text, 1, 8)),
            COALESCE(NEW.label_en, 'Building'), NEW.label_ar,
            NEW.geometry, geo_centroid_lat(NEW.geometry), geo_centroid_lng(NEW.geometry), NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Backfill: set lat/lng for existing units created from geometries ──
UPDATE units u SET
  lat = geo_centroid_lat(u.geometry),
  lng = geo_centroid_lng(u.geometry)
WHERE u.geometry IS NOT NULL AND u.geometry_id IS NOT NULL
  AND (u.lat IS NULL OR u.lng IS NULL);
