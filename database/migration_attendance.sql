-- Attendance Records table for check-in/check-out system
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  check_in TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out TIMESTAMPTZ,
  check_in_location TEXT,
  check_out_location TEXT,
  check_in_lat DECIMAL(10,7),
  check_in_lng DECIMAL(10,7),
  check_out_lat DECIMAL(10,7),
  check_out_lng DECIMAL(10,7),
  check_in_method TEXT DEFAULT 'manual',
  check_out_method TEXT,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent', 'half_day', 'overtime')),
  total_hours DECIMAL(8,2),
  overtime_hours DECIMAL(8,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_check_in ON attendance_records(check_in);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance_records(employee_id, check_in);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records(status);

-- Enable RLS
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view attendance for their projects"
  ON attendance_records FOR SELECT
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.project_id = attendance_records.project_id
    ) OR
    attendance_records.project_id IS NULL
  );

CREATE POLICY "Users can insert attendance"
  ON attendance_records FOR INSERT
  WITH CHECK (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.project_id = attendance_records.project_id
    ) OR
    attendance_records.project_id IS NULL
  );

CREATE POLICY "Users can update attendance"
  ON attendance_records FOR UPDATE
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.project_id = attendance_records.project_id
    )
  );

-- Add location fields to projects table (for maps)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lat DECIMAL(10,7);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lng DECIMAL(10,7);

-- Add location fields to units table (for maps)
ALTER TABLE units ADD COLUMN IF NOT EXISTS lat DECIMAL(10,7);
ALTER TABLE units ADD COLUMN IF NOT EXISTS lng DECIMAL(10,7);
