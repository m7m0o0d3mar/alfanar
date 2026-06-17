-- Scheduling Engine: Dependencies, CPM, Resources, Baselines
-- Transforms work_tasks into a Primavera/MS Project-like scheduling system

-- ============================================================
-- 1. Enhance work_tasks with CPM and scheduling fields
-- ============================================================
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS early_start DATE;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS early_finish DATE;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS late_start DATE;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS late_finish DATE;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS total_float DECIMAL(8,2) DEFAULT 0;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS is_critical BOOLEAN DEFAULT false;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS duration_days DECIMAL(8,2);
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS duration_type TEXT DEFAULT 'work' CHECK (duration_type IN ('calendar', 'work'));
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS baseline_start DATE;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS baseline_end DATE;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS percent_complete_type TEXT DEFAULT 'physical' CHECK (percent_complete_type IN ('physical', 'duration', 'units'));
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS calendar_id UUID;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS suspend_date DATE;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS resume_date DATE;

-- ============================================================
-- 2. Task Dependencies (Predecessor / Successor)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  predecessor_id UUID NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
  successor_id UUID NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
  lag_days DECIMAL(8,2) DEFAULT 0,
  dependency_type TEXT DEFAULT 'FS' CHECK (dependency_type IN ('FS', 'SS', 'FF', 'SF')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(predecessor_id, successor_id)
);

CREATE INDEX IF NOT EXISTS idx_task_dep_predecessor ON task_dependencies(predecessor_id);
CREATE INDEX IF NOT EXISTS idx_task_dep_successor ON task_dependencies(successor_id);
CREATE INDEX IF NOT EXISTS idx_task_dep_project ON task_dependencies(project_id);

-- ============================================================
-- 3. Resources (labor, material, equipment, subcontractor)
-- ============================================================
CREATE TABLE IF NOT EXISTS resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  resource_code TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('labor', 'material', 'equipment', 'subcontractor')),
  unit_of_measure TEXT DEFAULT 'each',
  cost_per_unit DECIMAL(14,2) DEFAULT 0,
  currency TEXT DEFAULT 'SAR',
  calendar_id UUID,
  max_units DECIMAL(12,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, resource_code)
);

-- ============================================================
-- 4. Task Resource Assignments
-- ============================================================
CREATE TABLE IF NOT EXISTS task_resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  allocated_units DECIMAL(12,2) DEFAULT 1,
  unit_price DECIMAL(14,2) DEFAULT 0,
  total_cost DECIMAL(20,2) GENERATED ALWAYS AS (allocated_units * unit_price) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_task_res_task ON task_resources(task_id);
CREATE INDEX IF NOT EXISTS idx_task_res_resource ON task_resources(resource_id);

-- ============================================================
-- 5. Baselines (snapshot of schedule for comparison)
-- ============================================================
CREATE TABLE IF NOT EXISTS baselines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  baseline_no INTEGER NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES user_profiles(id),
  UNIQUE(project_id, baseline_no)
);

CREATE TABLE IF NOT EXISTS baseline_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  baseline_id UUID NOT NULL REFERENCES baselines(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
  baseline_start DATE NOT NULL,
  baseline_end DATE NOT NULL,
  baseline_duration DECIMAL(8,2),
  baseline_progress DECIMAL(5,2) DEFAULT 0,
  UNIQUE(baseline_id, task_id)
);

-- ============================================================
-- 6. Calendars (work days, holidays)
-- ============================================================
CREATE TABLE IF NOT EXISTS calendars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_base BOOLEAN DEFAULT false,
  work_week JSONB DEFAULT '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":false,"saturday":false,"sunday":true}',
  work_hours_start TIME DEFAULT '08:00',
  work_hours_end TIME DEFAULT '17:00',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calendar_exceptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  is_working BOOLEAN DEFAULT false,
  reason TEXT,
  UNIQUE(calendar_id, exception_date)
);

-- ============================================================
-- 7. CPM Calculation Function (Forward/Backward Pass)
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_cpm(p_project_id UUID)
RETURNS TABLE(task_id UUID, early_start DATE, early_finish DATE, late_start DATE, late_finish DATE, total_float DECIMAL, is_critical BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
  v_task RECORD;
  v_dep RECORD;
  v_max_ef DATE;
  v_min_ls DATE;
  v_project_end DATE;
  v_duration DECIMAL;
BEGIN
  -- Get project end date
  SELECT COALESCE(end_date, CURRENT_DATE + 365) INTO v_project_end
  FROM projects WHERE id = p_project_id;

  -- Initialize: set all ES/EF to NULL first
  UPDATE work_tasks SET early_start = NULL, early_finish = NULL, late_start = NULL, late_finish = NULL,
    total_float = 0, is_critical = false
  WHERE project_id = p_project_id;

  -- ---- FORWARD PASS ----
  -- Loop until all tasks have ES/EF computed (handle dependency chains)
  LOOP
    -- Find tasks with no unmet predecessors
    FOR v_task IN
      SELECT t.id, t.start_date, t.end_date,
        COALESCE(t.duration_days, GREATEST(1, (COALESCE(t.end_date, v_project_end) - COALESCE(t.start_date, CURRENT_DATE)))) AS dur
      FROM work_tasks t
      WHERE t.project_id = p_project_id
        AND t.early_start IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM task_dependencies d
          JOIN work_tasks p ON p.id = d.predecessor_id
          WHERE d.successor_id = t.id AND p.early_finish IS NULL
        )
      ORDER BY t.start_date NULLS LAST, t.created_at
      LIMIT 50
    LOOP
      v_duration := GREATEST(1, v_task.dur);

      -- Find the latest predecessor finish
      SELECT GREATEST(COALESCE(MAX(p.early_finish), v_task.start_date::DATE),
             COALESCE(MAX(p.early_finish + d.lag_days::INT), v_task.start_date::DATE))
      INTO v_max_ef
      FROM task_dependencies d
      JOIN work_tasks p ON p.id = d.predecessor_id
      WHERE d.successor_id = v_task.id;

      IF v_max_ef IS NULL THEN
        v_max_ef := COALESCE(v_task.start_date, CURRENT_DATE);
      END IF;

      UPDATE work_tasks SET
        early_start = v_max_ef,
        early_finish = v_max_ef + v_duration::INT
      WHERE id = v_task.id;
    END LOOP;

    EXIT WHEN NOT FOUND;
  END LOOP;

  -- Any remaining tasks get default dates
  UPDATE work_tasks SET
    early_start = COALESCE(start_date, CURRENT_DATE),
    early_finish = COALESCE(end_date, COALESCE(start_date, CURRENT_DATE) + 30)
  WHERE project_id = p_project_id AND early_start IS NULL;

  -- ---- BACKWARD PASS ----
  LOOP
    FOR v_task IN
      SELECT t.id, t.early_start, t.early_finish,
        COALESCE(t.duration_days, GREATEST(1, t.early_finish - t.early_start)) AS dur
      FROM work_tasks t
      WHERE t.project_id = p_project_id
        AND t.late_start IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM task_dependencies d
          JOIN work_tasks s ON s.id = d.successor_id
          WHERE d.predecessor_id = t.id AND s.late_start IS NULL
        )
      ORDER BY t.early_finish DESC, t.created_at DESC
      LIMIT 50
    LOOP
      v_duration := GREATEST(1, v_task.dur);

      SELECT MIN(COALESCE(s.late_start, v_project_end) - d.lag_days::INT)
      INTO v_min_ls
      FROM task_dependencies d
      JOIN work_tasks s ON s.id = d.successor_id
      WHERE d.predecessor_id = v_task.id;

      IF v_min_ls IS NULL THEN
        v_min_ls := v_project_end;
      END IF;

      UPDATE work_tasks SET
        late_finish = v_min_ls,
        late_start = v_min_ls - v_duration::INT
      WHERE id = v_task.id;
    END LOOP;

    EXIT WHEN NOT FOUND;
  END LOOP;

  -- ---- FLOAT & CRITICAL ----
  UPDATE work_tasks SET
    total_float = late_finish - early_finish,
    is_critical = (late_finish - early_finish) <= 0
  WHERE project_id = p_project_id AND late_finish IS NOT NULL AND early_finish IS NOT NULL;

  -- Return results
  RETURN QUERY
  SELECT t.id, t.early_start, t.early_finish, t.late_start, t.late_finish,
    t.total_float, t.is_critical
  FROM work_tasks t
  WHERE t.project_id = p_project_id
  ORDER BY t.early_start NULLS LAST, t.created_at;
END;
$$;

-- ============================================================
-- 8. Save Baseline Snapshot
-- ============================================================
CREATE OR REPLACE FUNCTION save_baseline(p_project_id UUID, p_name TEXT, p_user_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE
  v_baseline_no INTEGER;
  v_baseline_id UUID;
  v_task RECORD;
BEGIN
  SELECT COALESCE(MAX(baseline_no), 0) + 1 INTO v_baseline_no
  FROM baselines WHERE project_id = p_project_id;

  -- Deactivate other baselines for this project
  UPDATE baselines SET is_active = false WHERE project_id = p_project_id;

  INSERT INTO baselines (project_id, baseline_no, name, is_active, created_by)
  VALUES (p_project_id, v_baseline_no, p_name, true, p_user_id)
  RETURNING id INTO v_baseline_id;

  FOR v_task IN
    SELECT id, start_date, end_date, duration_days, progress
    FROM work_tasks
    WHERE project_id = p_project_id
  LOOP
    INSERT INTO baseline_tasks (baseline_id, task_id, baseline_start, baseline_end, baseline_duration, baseline_progress)
    VALUES (v_baseline_id, v_task.id, v_task.start_date, v_task.end_date, v_task.duration_days, v_task.progress);
  END LOOP;

  RETURN v_baseline_id;
END;
$$;

-- ============================================================
-- 9. View: project_schedule (unified schedule with all levels)
-- ============================================================
CREATE OR REPLACE VIEW project_schedule AS
SELECT
  p.id AS project_id,
  p.project_code,
  p.name_en AS project_name,
  p.start_date AS project_start,
  p.end_date AS project_end,
  p.progress_percent AS project_progress,
  p.status AS project_status,
  pp.id AS phase_id,
  pp.phase_code,
  pp.name_en AS phase_name,
  pp.start_date AS phase_start,
  pp.end_date AS phase_end,
  pp.progress_percent AS phase_progress,
  pp.status AS phase_status,
  wbs.id AS wbs_id,
  wbs.wbs_code,
  wbs.name_en AS wbs_name,
  wbs.level AS wbs_level,
  wbs.parent_id AS wbs_parent_id,
  wbs.weight_percent AS wbs_weight,
  t.id AS task_id,
  t.task_code,
  t.title_en AS task_name,
  t.start_date AS task_start,
  t.end_date AS task_end,
  t.duration_days AS task_duration,
  t.progress AS task_progress,
  t.status AS task_status,
  t.priority AS task_priority,
  t.assigned_to,
  up.full_name_en AS assignee_name,
  t.early_start,
  t.early_finish,
  t.late_start,
  t.late_finish,
  t.total_float,
  t.is_critical,
  t.baseline_start,
  t.baseline_end,
  t.suspend_date,
  t.resume_date,
  u.unit_code,
  u.unit_type
FROM projects p
LEFT JOIN project_phases pp ON pp.project_id = p.id
LEFT JOIN work_breakdown_structure wbs ON wbs.project_id = p.id
LEFT JOIN work_tasks t ON t.project_id = p.id AND (t.wbs_id = wbs.id OR t.wbs_id IS NULL)
LEFT JOIN user_profiles up ON up.id = t.assigned_to
LEFT JOIN units u ON u.id = t.unit_id
ORDER BY p.project_code, pp."order", wbs.level, wbs.wbs_code, t.start_date;

-- ============================================================
-- 10. RLS Policies for Scheduling Tables
-- ============================================================
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE baseline_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_exceptions ENABLE ROW LEVEL SECURITY;

-- Users can read scheduling data for projects they have access to
CREATE POLICY "Users can view task_dependencies for their projects"
  ON task_dependencies FOR SELECT
  USING (project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can view resources for their projects"
  ON resources FOR SELECT
  USING (project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can view task_resources for their projects"
  ON task_resources FOR SELECT
  USING (task_id IN (SELECT id FROM work_tasks WHERE project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid())));

CREATE POLICY "Users can view baselines for their projects"
  ON baselines FOR SELECT
  USING (project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can view baseline_tasks for their projects"
  ON baseline_tasks FOR SELECT
  USING (baseline_id IN (SELECT id FROM baselines WHERE project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid())));

CREATE POLICY "Users can view calendars for their projects"
  ON calendars FOR SELECT
  USING (project_id IS NULL OR project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can view calendar_exceptions for their projects"
  ON calendar_exceptions FOR SELECT
  USING (calendar_id IN (SELECT id FROM calendars WHERE project_id IS NULL OR project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid())));

-- Project managers and admins can insert/update/delete scheduling data
CREATE POLICY "Project managers can manage task_dependencies"
  ON task_dependencies FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner')));

CREATE POLICY "Project managers can update task_dependencies"
  ON task_dependencies FOR UPDATE
  USING (project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner')));

CREATE POLICY "Project managers can delete task_dependencies"
  ON task_dependencies FOR DELETE
  USING (project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner')));

CREATE POLICY "Project managers can manage resources"
  ON resources FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner')));

CREATE POLICY "Project managers can update resources"
  ON resources FOR UPDATE
  USING (project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner')));

CREATE POLICY "Project managers can delete resources"
  ON resources FOR DELETE
  USING (project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner')));

CREATE POLICY "Project managers can manage task_resources"
  ON task_resources FOR INSERT
  WITH CHECK (task_id IN (SELECT id FROM work_tasks WHERE project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner'))));

CREATE POLICY "Project managers can update task_resources"
  ON task_resources FOR UPDATE
  USING (task_id IN (SELECT id FROM work_tasks WHERE project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner'))));

CREATE POLICY "Project managers can delete task_resources"
  ON task_resources FOR DELETE
  USING (task_id IN (SELECT id FROM work_tasks WHERE project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner'))));

CREATE POLICY "Project managers can manage baselines"
  ON baselines FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner')));

CREATE POLICY "Project managers can update baselines"
  ON baselines FOR UPDATE
  USING (project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner')));

CREATE POLICY "Project managers can delete baselines"
  ON baselines FOR DELETE
  USING (project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner')));

CREATE POLICY "Project managers can manage baseline_tasks"
  ON baseline_tasks FOR INSERT
  WITH CHECK (baseline_id IN (SELECT id FROM baselines WHERE project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner'))));

CREATE POLICY "Project managers can update baseline_tasks"
  ON baseline_tasks FOR UPDATE
  USING (baseline_id IN (SELECT id FROM baselines WHERE project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner'))));

CREATE POLICY "Project managers can delete baseline_tasks"
  ON baseline_tasks FOR DELETE
  USING (baseline_id IN (SELECT id FROM baselines WHERE project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner'))));

CREATE POLICY "Project managers can manage calendars"
  ON calendars FOR INSERT
  WITH CHECK (project_id IS NULL OR project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner')));

CREATE POLICY "Project managers can update calendars"
  ON calendars FOR UPDATE
  USING (project_id IS NULL OR project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner')));

CREATE POLICY "Project managers can delete calendars"
  ON calendars FOR DELETE
  USING (project_id IS NULL OR project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner')));

CREATE POLICY "Project managers can manage calendar_exceptions"
  ON calendar_exceptions FOR INSERT
  WITH CHECK (calendar_id IN (SELECT id FROM calendars WHERE project_id IS NULL OR project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner'))));

CREATE POLICY "Project managers can update calendar_exceptions"
  ON calendar_exceptions FOR UPDATE
  USING (calendar_id IN (SELECT id FROM calendars WHERE project_id IS NULL OR project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner'))));

CREATE POLICY "Project managers can delete calendar_exceptions"
  ON calendar_exceptions FOR DELETE
  USING (calendar_id IN (SELECT id FROM calendars WHERE project_id IS NULL OR project_id IN (SELECT project_id FROM user_projects WHERE user_id = auth.uid() AND project_role IN ('project_manager', 'owner'))));

-- ============================================================
-- 11. Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_work_tasks_cpm ON work_tasks(project_id, early_start, early_finish, is_critical);
CREATE INDEX IF NOT EXISTS idx_work_tasks_dates ON work_tasks(project_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_work_tasks_priority ON work_tasks(project_id, priority);
CREATE INDEX IF NOT EXISTS idx_work_tasks_assigned ON work_tasks(project_id, assigned_to);
