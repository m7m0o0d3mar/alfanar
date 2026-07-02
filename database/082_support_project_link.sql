-- Link support_tickets to projects
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
