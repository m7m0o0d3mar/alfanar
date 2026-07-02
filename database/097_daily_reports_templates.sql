ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}';
