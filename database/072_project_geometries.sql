-- Project Site Plans: interactive building/floor/unit geometries
-- Stores GeoJSON polygons for buildings, floors, units, and amenities

CREATE TABLE IF NOT EXISTS project_geometries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES project_geometries(id) ON DELETE CASCADE,
    geometry_type TEXT NOT NULL CHECK (geometry_type IN ('site', 'building', 'floor', 'unit', 'zone', 'amenity')),
    label_en TEXT,
    label_ar TEXT,
    geometry JSONB NOT NULL,
    properties JSONB DEFAULT '{}',
    level INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proj_geom_project ON project_geometries(project_id);
CREATE INDEX IF NOT EXISTS idx_proj_geom_parent ON project_geometries(parent_id);
CREATE INDEX IF NOT EXISTS idx_proj_geom_type ON project_geometries(geometry_type);

ALTER TABLE project_geometries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage project geometries"
    ON project_geometries FOR ALL
    USING (auth.uid() IN (SELECT id FROM user_profiles WHERE role = 'admin'))
    WITH CHECK (auth.uid() IN (SELECT id FROM user_profiles WHERE role = 'admin'));

CREATE POLICY "Users view project geometries"
    ON project_geometries FOR SELECT
    USING (auth.role() = 'authenticated');
