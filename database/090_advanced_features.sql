-- 090_advanced_features.sql
-- New tables for Attendance approvals, leave requests, templates

-- 1. Leave / Permission Requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('sick', 'annual', 'emergency', 'permission', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  escalation_to UUID REFERENCES user_profiles(id),
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Department Managers
CREATE TABLE IF NOT EXISTS department_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL,
  manager_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  deputy_id UUID REFERENCES user_profiles(id),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(department, manager_id)
);

-- 3. Approval Templates
CREATE TABLE IF NOT EXISTS approval_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT NOT NULL,
  name_ar TEXT,
  module_code TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  department TEXT,
  workflow_id UUID REFERENCES workflow_definitions(id) ON DELETE SET NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Add department column to attendance_records if not exists
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shift_definitions(id);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS deduction_hours DECIMAL(5,2) DEFAULT 0;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS is_random_verified BOOLEAN DEFAULT false;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS random_verified_at TIMESTAMPTZ;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS notes TEXT;

-- 5. Add columns to approval_requests for scheduling
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES approval_templates(id);
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS department TEXT;
