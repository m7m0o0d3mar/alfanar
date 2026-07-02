-- 106: Map Hierarchy Enhancement
-- Adds hierarchical image layers, improved syncing, and geometry input support

-- Project-level plan image and bounds
ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan_image TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan_image_bounds JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS center_lat DOUBLE PRECISION;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS center_lng DOUBLE PRECISION;

-- Building plan image, bounds, and geometry center
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS plan_image TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS plan_image_bounds JSONB;

-- Storage for reference images per any hierarchy level
CREATE TABLE IF NOT EXISTS map_layer_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  block_id UUID REFERENCES blocks(id) ON DELETE CASCADE,
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  floor_id UUID REFERENCES floors(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_ar TEXT,
  image_url TEXT NOT NULL,
  image_bounds JSONB NOT NULL,  -- { north, south, east, west }
  opacity REAL DEFAULT 0.8,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Saved map view states (full hierarchy breadcrumb)
ALTER TABLE map_views ADD COLUMN IF NOT EXISTS hierarchy_state JSONB;  -- { projectId, blockId, buildingId, floorId, unitId }
ALTER TABLE map_views ADD COLUMN IF NOT EXISTS filters JSONB;
ALTER TABLE map_views ADD COLUMN IF NOT EXISTS viewport JSONB;  -- { center, zoom, bounds }

-- Geometry import sessions (for multi-step input)
CREATE TABLE IF NOT EXISTS geometry_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  import_type TEXT NOT NULL CHECK (import_type IN ('geojson', 'csv', 'draw', 'form', 'template')),
  source_name TEXT,
  raw_data JSONB,
  processed_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_map_layer_images_project ON map_layer_images(project_id);
CREATE INDEX IF NOT EXISTS idx_map_layer_images_block ON map_layer_images(block_id);
CREATE INDEX IF NOT EXISTS idx_map_layer_images_building ON map_layer_images(building_id);
CREATE INDEX IF NOT EXISTS idx_map_layer_images_floor ON map_layer_images(floor_id);
CREATE INDEX IF NOT EXISTS idx_geometry_imports_project ON geometry_imports(project_id);

-- Enable RLS
ALTER TABLE map_layer_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE geometry_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON map_layer_images FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for authenticated users" ON geometry_imports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public read for published projects
CREATE POLICY "Public read map_layer_images" ON map_layer_images FOR SELECT TO anon USING (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.is_published = true)
);

-- Grant public access to projects lat/lng for global map
GRANT SELECT (id, project_code, name_en, name_ar, status, progress_percent, location, latitude, longitude, center_lat, center_lng, plan_image, is_published) ON projects TO anon;
