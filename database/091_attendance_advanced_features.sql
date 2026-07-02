-- 091_attendance_advanced_features.sql
-- Advanced attendance features: shifts management, overtime rules, random verification, leave escalation

-- 1. Enhance shift_definitions with overtime & deduction rules
ALTER TABLE shift_definitions ADD COLUMN IF NOT EXISTS overtime_rate DECIMAL(5,2) DEFAULT 1.5;
ALTER TABLE shift_definitions ADD COLUMN IF NOT EXISTS deduction_rate DECIMAL(5,2) DEFAULT 1.0;
ALTER TABLE shift_definitions ADD COLUMN IF NOT EXISTS max_overtime_hours DECIMAL(5,2) DEFAULT 4;
ALTER TABLE shift_definitions ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Riyadh';
ALTER TABLE shift_definitions ADD COLUMN IF NOT EXISTS work_days TEXT[] DEFAULT ARRAY['Sun','Mon','Tue','Wed','Thu'];
ALTER TABLE shift_definitions ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6';
ALTER TABLE shift_definitions ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Overtime Rules (per project/shift/employee)
CREATE TABLE IF NOT EXISTS overtime_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shift_definitions(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  overtime_rate DECIMAL(5,2) NOT NULL DEFAULT 1.5,
  max_overtime_hours DECIMAL(5,2) DEFAULT 4,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Attendance Requests (leave, permission, escalation)
CREATE TABLE IF NOT EXISTS attendance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('leave', 'permission', 'remote', 'missed_punch', 'correction', 'escalation')),
  leave_type TEXT CHECK (leave_type IN ('sick', 'annual', 'emergency', 'personal', 'other')),
  title_en TEXT,
  title_ar TEXT,
  reason TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  total_days DECIMAL(5,1),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  escalation_to UUID REFERENCES user_profiles(id),
  escalation_reason TEXT,
  attachment_url TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Random Verification (biometric/photo check-in verification)
CREATE TABLE IF NOT EXISTS random_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_record_id UUID REFERENCES attendance_records(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('photo', 'location', 'biometric', 'qr_code', 'pin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed', 'expired')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  photo_url TEXT,
  location_lat DECIMAL(10,7),
  location_lng DECIMAL(10,7),
  location_name TEXT,
  pin_code TEXT,
  qr_code TEXT,
  notes TEXT,
  verified_by UUID REFERENCES user_profiles(id)
);

-- 5. Create auto-sequence for attendance_requests request numbers
CREATE SEQUENCE IF NOT EXISTS attendance_request_no_seq START 1;

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_requests_employee ON attendance_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_requests_status ON attendance_requests(status);
CREATE INDEX IF NOT EXISTS idx_attendance_requests_dates ON attendance_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_random_verifications_employee ON random_verifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_random_verifications_status ON random_verifications(status);
CREATE INDEX IF NOT EXISTS idx_overtime_rules_project ON overtime_rules(project_id);
CREATE INDEX IF NOT EXISTS idx_overtime_rules_shift ON overtime_rules(shift_id);
