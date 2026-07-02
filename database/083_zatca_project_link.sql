-- Link zatca_invoices to projects
ALTER TABLE zatca_invoices ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
