-- 060: Interactive Map 3D Enhancement
-- Adds geometry support, buildings, floors, and 3D visualization data

-- Add geometry columns to blocks
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS geometry JSONB;
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS center_lat DOUBLE PRECISION;
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS center_lng DOUBLE PRECISION;
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS area_sqm NUMERIC(15,2);
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS color VARCHAR(20);

-- Create buildings table
CREATE TABLE IF NOT EXISTS buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  block_id UUID REFERENCES blocks(id) ON DELETE SET NULL,
  building_code VARCHAR(50) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  floors INT DEFAULT 1,
  geometry JSONB,
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  area_sqm NUMERIC(15,2),
  height_m NUMERIC(8,2),
  status VARCHAR(30) DEFAULT 'planning',
  color VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create floors table
CREATE TABLE IF NOT EXISTS floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  block_id UUID REFERENCES blocks(id) ON DELETE SET NULL,
  floor_number INT NOT NULL,
  name_en VARCHAR(255),
  name_ar VARCHAR(255),
  geometry JSONB,
  plan_image TEXT,
  area_sqm NUMERIC(15,2),
  height_m NUMERIC(8,2) DEFAULT 3.0,
  status VARCHAR(30) DEFAULT 'planning',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(building_id, floor_number)
);

-- Add floor_id and geometry to units
ALTER TABLE units ADD COLUMN IF NOT EXISTS floor_id UUID REFERENCES floors(id) ON DELETE SET NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS geometry JSONB;
ALTER TABLE units ADD COLUMN IF NOT EXISTS rotation DOUBLE PRECISION DEFAULT 0;

-- Enable RLS
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON buildings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for authenticated users" ON floors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_buildings_project ON buildings(project_id);
CREATE INDEX IF NOT EXISTS idx_buildings_block ON buildings(block_id);
CREATE INDEX IF NOT EXISTS idx_floors_building ON floors(building_id);
CREATE INDEX IF NOT EXISTS idx_floors_block ON floors(block_id);
CREATE INDEX IF NOT EXISTS idx_units_floor ON units(floor_id);
CREATE INDEX IF NOT EXISTS idx_blocks_geometry ON blocks USING gin(geometry);
CREATE INDEX IF NOT EXISTS idx_buildings_geometry ON buildings USING gin(geometry);
CREATE INDEX IF NOT EXISTS idx_floors_geometry ON floors USING gin(geometry);
