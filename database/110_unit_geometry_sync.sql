-- 110: Bidirectional sync between business tables and project_geometries
-- Ensures units ↔ project_geometries (unit), buildings ↔ project_geometries (building),
-- and floors ↔ project_geometries (floor) stay synchronized.

-- ── 1. Add geometry_id FK to business tables ──
ALTER TABLE units ADD COLUMN IF NOT EXISTS geometry_id UUID REFERENCES project_geometries(id) ON DELETE SET NULL;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS geometry_id UUID REFERENCES project_geometries(id) ON DELETE SET NULL;
ALTER TABLE floors ADD COLUMN IF NOT EXISTS geometry_id UUID REFERENCES project_geometries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_units_geometry_id ON units(geometry_id);
CREATE INDEX IF NOT EXISTS idx_buildings_geometry_id ON buildings(geometry_id);
CREATE INDEX IF NOT EXISTS idx_floors_geometry_id ON floors(geometry_id);

-- ── 2. Helper: normalize unit_type to valid CHECK constraint values ──
CREATE OR REPLACE FUNCTION normalize_unit_type(val TEXT) RETURNS TEXT AS $$
BEGIN
  IF val IS NULL THEN RETURN 'apartment'; END IF;
  val := lower(trim(val));
  -- Map common variations
  IF val IN ('1br', '2br', '3br', '4br', '5br', 'studio') THEN
    IF val = 'studio' THEN RETURN 'studio'; END IF;
    RETURN 'apartment';
  END IF;
  IF val IN ('shop', 'retail', 'store') THEN RETURN 'shop'; END IF;
  IF val IN ('warehouse', 'storage', 'godown') THEN RETURN 'warehouse'; END IF;
  IF val IN ('penthouse', 'ph') THEN RETURN 'penthouse'; END IF;
  IF val IN ('duplex', 'townhouse') THEN RETURN 'duplex'; END IF;
  IF val IN ('plot', 'land', 'vacant') THEN RETURN 'plot'; END IF;
  IF val IN ('floor', 'whole_floor') THEN RETURN 'floor'; END IF;
  IF val IN ('villa', 'house', 'chalet') THEN RETURN 'villa'; END IF;
  IF val IN ('office', 'commercial') THEN RETURN 'office'; END IF;
  -- Check if it's already valid
  IF val IN ('apartment', 'villa', 'office', 'shop', 'warehouse', 'penthouse', 'duplex', 'studio', 'plot', 'floor') THEN
    RETURN val;
  END IF;
  RETURN 'apartment';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── 3. Helper: extract centroid coordinates from a GeoJSON geometry ──
CREATE OR REPLACE FUNCTION geo_centroid_lat(g JSONB) RETURNS DOUBLE PRECISION AS $$
DECLARE
  t TEXT;
  coords JSONB;
BEGIN
  IF g IS NULL THEN RETURN NULL; END IF;
  t := g->>'type';
  coords := g->'coordinates';
  IF t = 'Point' THEN
    RETURN (coords->>1)::DOUBLE PRECISION;
  ELSIF t IN ('Polygon', 'MultiLineString') THEN
    RETURN (coords->0->>1)::DOUBLE PRECISION;
  ELSIF t = 'MultiPolygon' THEN
    RETURN (coords->0->0->>1)::DOUBLE PRECISION;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION geo_centroid_lng(g JSONB) RETURNS DOUBLE PRECISION AS $$
DECLARE
  t TEXT;
  coords JSONB;
BEGIN
  IF g IS NULL THEN RETURN NULL; END IF;
  t := g->>'type';
  coords := g->'coordinates';
  IF t = 'Point' THEN
    RETURN (coords->>0)::DOUBLE PRECISION;
  ELSIF t IN ('Polygon', 'MultiLineString') THEN
    RETURN (coords->0->>0)::DOUBLE PRECISION;
  ELSIF t = 'MultiPolygon' THEN
    RETURN (coords->0->0->>0)::DOUBLE PRECISION;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── 3. Trigger: project_geometries (unit) → units ──
CREATE OR REPLACE FUNCTION sync_geometry_to_unit()
RETURNS TRIGGER AS $$
DECLARE
  existing_id UUID;
  unit_type_val TEXT;
  unit_code_val TEXT;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  IF NEW.geometry_type <> 'unit' THEN RETURN NEW; END IF;

  -- Check for existing linked unit
  SELECT id INTO existing_id FROM units WHERE geometry_id = NEW.id LIMIT 1;

  unit_code_val := COALESCE(NEW.label_en, 'GEO-' || substring(NEW.id::text, 1, 8));
  unit_type_val := normalize_unit_type(NEW.properties->>'unit_type');

  IF existing_id IS NOT NULL THEN
    UPDATE units SET
      project_id = NEW.project_id,
      unit_code = unit_code_val,
      unit_type = unit_type_val,
      geometry = NEW.geometry,
      updated_at = now()
    WHERE id = existing_id;
  ELSE
    INSERT INTO units (project_id, unit_code, unit_type, geometry, geometry_id, status, is_active)
    VALUES (NEW.project_id, unit_code_val, unit_type_val, NEW.geometry, NEW.id, 'available', true)
    ON CONFLICT (project_id, unit_code) DO UPDATE SET
      geometry = EXCLUDED.geometry,
      geometry_id = EXCLUDED.geometry_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_geometry_to_unit ON project_geometries;
CREATE TRIGGER trg_sync_geometry_to_unit
  AFTER INSERT OR UPDATE ON project_geometries
  FOR EACH ROW EXECUTE FUNCTION sync_geometry_to_unit();

-- ── 4. Trigger: units → project_geometries (unit) ──
CREATE OR REPLACE FUNCTION sync_unit_to_geometry()
RETURNS TRIGGER AS $$
DECLARE
  existing_id UUID;
  geom_json JSONB;
  parent_geom_id UUID;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  -- Build geometry: use existing geometry col, or create Point from lat/lng
  geom_json := NEW.geometry;
  IF geom_json IS NULL AND NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    geom_json := jsonb_build_object(
      'type', 'Point',
      'coordinates', jsonb_build_array(NEW.lng, NEW.lat)
    );
  END IF;
  IF geom_json IS NULL THEN RETURN NEW; END IF;

  -- If unit already has a geometry_id, update it
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

DROP TRIGGER IF EXISTS trg_sync_unit_to_geometry ON units;
CREATE TRIGGER trg_sync_unit_to_geometry
  AFTER INSERT OR UPDATE OF project_id, unit_code, geometry, lat, lng, status, price, unit_type, floor_id ON units
  FOR EACH ROW EXECUTE FUNCTION sync_unit_to_geometry();

-- ── 5. Trigger: project_geometries (building) → buildings ──
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

DROP TRIGGER IF EXISTS trg_sync_geometry_to_building ON project_geometries;
CREATE TRIGGER trg_sync_geometry_to_building
  AFTER INSERT OR UPDATE ON project_geometries
  FOR EACH ROW EXECUTE FUNCTION sync_geometry_to_building();

-- ── 6. Trigger: project_geometries (floor) → floors ──
CREATE OR REPLACE FUNCTION sync_geometry_to_floor()
RETURNS TRIGGER AS $$
DECLARE
  existing_id UUID;
  parent_bldg_id UUID;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.geometry_type <> 'floor' THEN RETURN NEW; END IF;

  SELECT id INTO existing_id FROM floors WHERE geometry_id = NEW.id LIMIT 1;

  -- Try to resolve parent (building) to set building_id
  IF NEW.parent_id IS NOT NULL THEN
    SELECT id INTO parent_bldg_id FROM buildings WHERE geometry_id = NEW.parent_id LIMIT 1;
  END IF;

  IF existing_id IS NOT NULL THEN
    UPDATE floors SET
      geometry = NEW.geometry,
      name_en = NEW.label_en,
      name_ar = NEW.label_ar,
      building_id = COALESCE(parent_bldg_id, building_id),
      updated_at = now()
    WHERE id = existing_id;
  ELSE
    INSERT INTO floors (building_id, floor_number, name_en, name_ar, geometry, geometry_id)
    VALUES (parent_bldg_id, COALESCE((NEW.properties->>'floor_number')::int, 0),
            COALESCE(NEW.label_en, 'Floor'), NEW.label_ar, NEW.geometry, NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_geometry_to_floor ON project_geometries;
CREATE TRIGGER trg_sync_geometry_to_floor
  AFTER INSERT OR UPDATE ON project_geometries
  FOR EACH ROW EXECUTE FUNCTION sync_geometry_to_floor();

-- ── 7. Initial backfill: sync existing project_geometries (unit) → units ──
-- Step A: Link already-existing units to geometries by matching project_id + unit_code == label_en
UPDATE units u SET geometry_id = pg.id
FROM project_geometries pg
WHERE pg.project_id = u.project_id
  AND pg.geometry_type = 'unit'
  AND pg.label_en = u.unit_code
  AND u.geometry_id IS NULL;

-- Step B: For geometries without a linked unit, create minimal unit records
INSERT INTO units (project_id, unit_code, unit_type, geometry, geometry_id, status, is_active)
SELECT DISTINCT ON (pg.project_id, COALESCE(pg.label_en, 'GEO-' || substring(pg.id::text, 1, 8)))
  pg.project_id,
  COALESCE(pg.label_en, 'GEO-' || substring(pg.id::text, 1, 8)),
  normalize_unit_type(pg.properties->>'unit_type'),
  pg.geometry,
  pg.id,
  'available',
  true
FROM project_geometries pg
WHERE pg.geometry_type = 'unit'
  AND pg.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM units u WHERE u.geometry_id = pg.id)
ON CONFLICT (project_id, unit_code) DO UPDATE SET
  geometry = EXCLUDED.geometry,
  geometry_id = EXCLUDED.geometry_id;

-- ── 8. Initial backfill: sync existing units → project_geometries ──
-- For units with geometry or lat/lng that don't have geometry_id,
-- create matching project_geometries (skip if one already exists by unit_code)
INSERT INTO project_geometries (project_id, parent_id, geometry_type, label_en, label_ar, geometry, properties, level, sort_order, status)
SELECT
  u.project_id,
  f.geometry_id,
  'unit',
  u.unit_code,
  u.unit_code,
  COALESCE(u.geometry, jsonb_build_object('type', 'Point', 'coordinates', jsonb_build_array(u.lng, u.lat))),
  jsonb_build_object('unit_type', u.unit_type, 'sales_status', u.status, 'price', u.price),
  3, 0, 'active'
FROM units u
LEFT JOIN floors f ON f.id = u.floor_id
WHERE u.geometry_id IS NULL
  AND (u.geometry IS NOT NULL OR (u.lat IS NOT NULL AND u.lng IS NOT NULL))
  AND NOT EXISTS (
    SELECT 1 FROM project_geometries pg2
    WHERE pg2.project_id = u.project_id AND pg2.geometry_type = 'unit' AND pg2.label_en = u.unit_code
  );

-- Link back: set geometry_id on units that now have matching geometries
UPDATE units u SET geometry_id = pg.id
FROM project_geometries pg
WHERE pg.project_id = u.project_id
  AND pg.geometry_type = 'unit'
  AND pg.label_en = u.unit_code
  AND u.geometry_id IS NULL;
