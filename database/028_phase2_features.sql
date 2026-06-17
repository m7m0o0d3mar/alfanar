-- ============================================================================
-- 028: Phase 2 Features - Work Requests auto-number, WR/WT columns,
--       contingency formula fix, progress view, unit_progress, RLS
-- ============================================================================
-- Run after: 027_comprehensive_features.sql
-- ============================================================================

-- ============================================================================
-- 1. WORK REQUESTS — Auto number sequence, new columns
-- ============================================================================

-- Sequence for WR auto-number
CREATE SEQUENCE IF NOT EXISTS wr_number_seq START 1;

-- Add auto-number trigger
CREATE OR REPLACE FUNCTION trg_auto_wr_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  seq_num TEXT;
  today TEXT;
BEGIN
  seq_num := LPAD(nextval('wr_number_seq')::TEXT, 4, '0');
  today := TO_CHAR(NOW(), 'YYYYMMDD');
  NEW.wir_no := 'WR-' || today || '-' || seq_num;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_wr_number ON work_requests;
CREATE TRIGGER trg_auto_wr_number
  BEFORE INSERT ON work_requests
  FOR EACH ROW
  WHEN (NEW.wir_no IS NULL OR NEW.wir_no = '')
  EXECUTE FUNCTION trg_auto_wr_number();

-- New columns for auto-linking
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS division TEXT;
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS sub_division TEXT;
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS activity TEXT;
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS activity_weight DECIMAL(5,2);
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS zone TEXT;
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS block TEXT;

-- QC Engineer and Consultant assignment
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS qc_engineer_id UUID REFERENCES user_profiles(id);
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS consultant_engineer_id UUID REFERENCES user_profiles(id);

-- ============================================================================
-- 2. WORK TASKS — New columns
-- ============================================================================

ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS division TEXT;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS sub_division TEXT;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS activity TEXT;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS zone TEXT;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS block TEXT;

-- Priority (column may already exist; add CHECK constraint if missing)
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE work_tasks DROP CONSTRAINT IF EXISTS work_tasks_priority_check;
ALTER TABLE work_tasks ADD CONSTRAINT work_tasks_priority_check CHECK (priority IN ('high', 'medium', 'low'));

-- Target and actual dates
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS actual_completion_date DATE;

-- Project team reference (who assigned the task)
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES user_profiles(id);

-- ============================================================================
-- 3. FIX Item Definitions contingency formula
-- ============================================================================
-- Drop and recreate the column since we cannot ALTER a generated column

ALTER TABLE item_definitions DROP COLUMN IF EXISTS contingency;
ALTER TABLE item_definitions ADD COLUMN contingency DECIMAL(14,2) GENERATED ALWAYS AS (COALESCE(booked_budget, 0) - COALESCE(open_budget, 0)) STORED;

-- ============================================================================
-- 4. PROGRESS TRACKING VIEW
-- ============================================================================

CREATE OR REPLACE VIEW project_progress AS
SELECT
  p.id AS project_id,
  p.name_en AS project_name,
  COUNT(DISTINCT wr.id) FILTER (WHERE wr.status = 'approved') AS approved_requests,
  COUNT(DISTINCT wr.id) FILTER (WHERE wr.status NOT IN ('approved', 'rejected', 'draft')) AS pending_requests,
  COUNT(DISTINCT wr.id) FILTER (WHERE wr.status = 'rejected') AS rejected_requests,
  COALESCE(AVG(idf.activity_weight) FILTER (WHERE wr.status = 'approved'), 0) AS progress_percent,
  COUNT(DISTINCT u.id) AS total_units,
  COUNT(DISTINCT u.id) FILTER (WHERE wr.status = 'approved' AND wr.unit_id IS NOT NULL) AS completed_units
FROM projects p
LEFT JOIN work_requests wr ON wr.project_id = p.id
LEFT JOIN item_definitions idf ON idf.id = wr.item_definition_id
LEFT JOIN units u ON u.project_id = p.id
GROUP BY p.id, p.name_en;

-- ============================================================================
-- 5. UNIT_PROGRESS TABLE (update or create)
-- ============================================================================
-- Note: if table already exists from 002_business_projects_units.sql,
-- CREATE TABLE IF NOT EXISTS is a no-op; the ALTER statements below add
-- the new columns to the existing schema.

CREATE TABLE IF NOT EXISTS unit_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  work_request_id UUID REFERENCES work_requests(id) ON DELETE SET NULL,
  milestone TEXT NOT NULL,
  progress_pct DECIMAL(5,2) DEFAULT 0,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(unit_id, work_request_id, milestone)
);

-- Add new columns if table already exists with legacy schema
ALTER TABLE unit_progress ADD COLUMN IF NOT EXISTS work_request_id UUID REFERENCES work_requests(id) ON DELETE SET NULL;
ALTER TABLE unit_progress ADD COLUMN IF NOT EXISTS milestone TEXT;
ALTER TABLE unit_progress ADD COLUMN IF NOT EXISTS progress_pct DECIMAL(5,2) DEFAULT 0;
ALTER TABLE unit_progress ADD COLUMN IF NOT EXISTS achieved_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE unit_progress ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ============================================================================
-- 6. RLS POLICIES FOR NEW COLUMNS AND UNIT_PROGRESS
-- ============================================================================

ALTER TABLE unit_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unit_progress_select" ON unit_progress;
CREATE POLICY "unit_progress_select" ON unit_progress FOR SELECT USING (
  is_admin() OR EXISTS (
    SELECT 1 FROM units WHERE id = unit_progress.unit_id AND has_project_access(units.project_id)
  )
);

DROP POLICY IF EXISTS "unit_progress_insert" ON unit_progress;
CREATE POLICY "unit_progress_insert" ON unit_progress FOR INSERT WITH CHECK (
  is_admin() OR current_user_role() IN ('admin', 'project_manager', 'engineer')
);

DROP POLICY IF EXISTS "unit_progress_update" ON unit_progress;
CREATE POLICY "unit_progress_update" ON unit_progress FOR UPDATE USING (is_admin());

-- ============================================================================
-- 7. AUDIT TRIGGER FOR UNIT_PROGRESS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_audit_unit_progress ON unit_progress;
CREATE TRIGGER trg_audit_unit_progress
  AFTER INSERT OR UPDATE OR DELETE ON unit_progress
  FOR EACH ROW EXECUTE FUNCTION trg_audit_log();
