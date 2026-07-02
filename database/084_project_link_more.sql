-- 084: Add project_id to fs_equipment and qc_capa

ALTER TABLE fs_equipment ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_fs_equipment_project ON fs_equipment(project_id);

ALTER TABLE qc_capa ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_qc_capa_project ON qc_capa(project_id);
