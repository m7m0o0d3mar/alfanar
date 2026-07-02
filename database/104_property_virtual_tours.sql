-- 104: Property Media Gallery, Virtual Tours & Interactive Floor Plans
-- Inspired by Matterport, Archilogic, Planogate, Planomatic

-- Property media gallery (photos/videos per unit or project)
CREATE TABLE IF NOT EXISTS property_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  media_type VARCHAR(20) DEFAULT 'image' CHECK (media_type IN ('image','video','floorplan','document')),
  caption TEXT,
  sort_order INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Virtual tours (Matterport, Zillow 3D, custom 3D walks)
CREATE TABLE IF NOT EXISTS virtual_tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  floor_id UUID REFERENCES floors(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  tour_url TEXT NOT NULL,
  tour_type VARCHAR(30) NOT NULL DEFAULT 'matterport' CHECK (tour_type IN ('matterport','zillow3d','custom3d','kuula','other')),
  thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add room data to floors for interactive hot spots
ALTER TABLE floors ADD COLUMN IF NOT EXISTS room_data JSONB DEFAULT '[]'::jsonb;

-- Add virtual tour URL directly on units for quick access
ALTER TABLE units ADD COLUMN IF NOT EXISTS virtual_tour_url TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS virtual_tour_type VARCHAR(30) DEFAULT 'matterport';

-- Add virtual tour URL on projects for master tour
ALTER TABLE projects ADD COLUMN IF NOT EXISTS virtual_tour_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS virtual_tour_type VARCHAR(30) DEFAULT 'matterport';

-- Published flag for public property portal
ALTER TABLE units ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE units ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Enable RLS
ALTER TABLE property_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_tours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON property_media FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for authenticated users" ON virtual_tours FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_property_media_unit ON property_media(unit_id);
CREATE INDEX IF NOT EXISTS idx_property_media_project ON property_media(project_id);
CREATE INDEX IF NOT EXISTS idx_virtual_tours_unit ON virtual_tours(unit_id);
CREATE INDEX IF NOT EXISTS idx_virtual_tours_project ON virtual_tours(project_id);

-- Create storage bucket for property media
insert into storage.buckets (id, name, public) values ('property_media', 'property_media', true)
on conflict (id) do nothing;

-- Note: page_registry entries removed — these features are embedded inside
-- ProjectDetailPage/UnitDetailPage/MapsPage, not standalone pages.
