-- 094_reports_system.sql
-- Comprehensive Reports System: Templates, Reports, Approvals, Tracking

CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  category TEXT DEFAULT 'custom' CHECK (category IN ('daily','weekly','monthly','progress','quality','safety','custom')),
  icon TEXT DEFAULT 'FileText',
  layout_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_template_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  section_key TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_ar TEXT,
  section_type TEXT NOT NULL CHECK (section_type IN ('text','table','chart','image','signature','dynamic','checkbox','select')),
  content_template TEXT,
  config JSONB DEFAULT '{}',
  is_required BOOLEAN DEFAULT true,
  UNIQUE(template_id, section_key)
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES report_templates(id),
  project_id UUID REFERENCES projects(id),
  department_id UUID REFERENCES departments(id),
  unit_id UUID REFERENCES units(id),
  block_id UUID REFERENCES blocks(id),
  activity_id UUID,
  created_by UUID REFERENCES user_profiles(id),
  assigned_to UUID REFERENCES user_profiles(id),
  title_en TEXT NOT NULL,
  title_ar TEXT,
  report_date DATE NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','submitted','under_review','approved','rejected','archived')),
  progress_pct DECIMAL(5,2) DEFAULT 0,
  report_data JSONB DEFAULT '{}',
  is_locked BOOLEAN DEFAULT false,
  previous_version_id UUID REFERENCES reports(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_approval_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  stage_order INTEGER NOT NULL,
  stage_name_en TEXT NOT NULL,
  stage_name_ar TEXT,
  approver_role TEXT,
  approver_user_id UUID REFERENCES user_profiles(id),
  required_signatures INTEGER DEFAULT 1,
  timeout_hours INTEGER,
  UNIQUE(template_id, stage_order)
);

CREATE TABLE IF NOT EXISTS report_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES report_approval_stages(id),
  approver_id UUID REFERENCES user_profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','escalated')),
  comments TEXT,
  signed_at TIMESTAMPTZ,
  UNIQUE(report_id, stage_id)
);

CREATE TABLE IF NOT EXISTS report_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created','submitted','approved','rejected','revised','archived','reminder_sent','escalated','stage_approved','stage_rejected')),
  event_data JSONB DEFAULT '{}',
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_project ON reports(project_id, report_date);
CREATE INDEX IF NOT EXISTS idx_reports_template ON reports(template_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_assigned ON reports(assigned_to);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_by);
CREATE INDEX IF NOT EXISTS idx_report_approvals_report ON report_approvals(report_id);
CREATE INDEX IF NOT EXISTS idx_report_approvals_approver ON report_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_report_tracking_report ON report_tracking(report_id);
CREATE INDEX IF NOT EXISTS idx_report_template_sections ON report_template_sections(template_id, sort_order);

-- Prevent duplicate reports with same template+project+date+activity when at 100%
CREATE OR REPLACE FUNCTION prevent_duplicate_report()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM reports
    WHERE template_id = NEW.template_id
      AND project_id IS NOT DISTINCT FROM NEW.project_id
      AND report_date = NEW.report_date
      AND department_id IS NOT DISTINCT FROM NEW.department_id
      AND unit_id IS NOT DISTINCT FROM NEW.unit_id
      AND block_id IS NOT DISTINCT FROM NEW.block_id
      AND activity_id IS NOT DISTINCT FROM NEW.activity_id
      AND id != NEW.id
      AND (progress_pct >= 100 OR status = 'approved')
      AND status != 'archived'
  ) THEN
    RAISE EXCEPTION 'A completed report already exists for this combination (template+project+date). Archive it first or create a revision.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_report ON reports;
CREATE TRIGGER trg_prevent_duplicate_report
  BEFORE INSERT OR UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_report();
