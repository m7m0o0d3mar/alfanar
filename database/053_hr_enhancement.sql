-- ============================================================
-- Phase 3: HR Enhancement (Self-Service, Contracts, Org Chart)
-- Inspired by Edarahr + Dafater HR best practices
-- ============================================================

-- 1. Department / Org Structure
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  parent_id UUID REFERENCES departments(id),
  manager_id UUID REFERENCES user_profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Employee Contracts
CREATE TABLE IF NOT EXISTS employee_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES user_profiles(id),
  contract_no VARCHAR(50) NOT NULL UNIQUE,
  contract_type VARCHAR(30) DEFAULT 'full_time' CHECK (contract_type IN ('full_time','part_time','fixed_term','freelance','trainee')),
  start_date DATE NOT NULL,
  end_date DATE,
  probation_end_date DATE,
  basic_salary NUMERIC(12,2) DEFAULT 0,
  housing_allowance NUMERIC(12,2) DEFAULT 0,
  transport_allowance NUMERIC(12,2) DEFAULT 0,
  other_allowances NUMERIC(12,2) DEFAULT 0,
  total_salary NUMERIC(12,2) GENERATED ALWAYS AS (
    COALESCE(basic_salary,0) + COALESCE(housing_allowance,0) + COALESCE(transport_allowance,0) + COALESCE(other_allowances,0)
  ) STORED,
  status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('draft','active','expired','terminated','renewed')),
  attachment_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Shift Management
CREATE TABLE IF NOT EXISTS shift_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  grace_minutes INT DEFAULT 0,
  is_night_shift BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS employee_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES user_profiles(id),
  shift_id UUID NOT NULL REFERENCES shift_definitions(id),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Employee Advances / Loans
CREATE TABLE IF NOT EXISTS employee_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_no VARCHAR(50) NOT NULL UNIQUE,
  employee_id UUID NOT NULL REFERENCES user_profiles(id),
  type VARCHAR(30) DEFAULT 'salary_advance' CHECK (type IN ('salary_advance','personal_loan','travel_advance','other')),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  installment_count INT DEFAULT 1,
  installment_amount NUMERIC(12,2) DEFAULT 0,
  reason TEXT,
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','rejected','disbursed','fully_paid')),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  disbursed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS advance_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id UUID NOT NULL REFERENCES employee_advances(id) ON DELETE CASCADE,
  installment_no INT NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  paid_date DATE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','waived'))
);

-- 5. Employee Documents
CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES user_profiles(id),
  document_type VARCHAR(100) NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  issue_date DATE,
  expiry_date DATE,
  is_verified BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Add department_id to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS employment_status VARCHAR(30) DEFAULT 'active' CHECK (employment_status IN ('active','suspended','terminated','resigned'));
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS nationality VARCHAR(100);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS id_number VARCHAR(50);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);

-- RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dept_read" ON departments;
CREATE POLICY "dept_read" ON departments FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "dept_insert" ON departments;
CREATE POLICY "dept_insert" ON departments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "dept_update" ON departments;
CREATE POLICY "dept_update" ON departments FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ec_read" ON employee_contracts;
CREATE POLICY "ec_read" ON employee_contracts FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ec_insert" ON employee_contracts;
CREATE POLICY "ec_insert" ON employee_contracts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ec_update" ON employee_contracts;
CREATE POLICY "ec_update" ON employee_contracts FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "sd_read" ON shift_definitions;
CREATE POLICY "sd_read" ON shift_definitions FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "sd_insert" ON shift_definitions;
CREATE POLICY "sd_insert" ON shift_definitions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "es_read" ON employee_shifts;
CREATE POLICY "es_read" ON employee_shifts FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "es_insert" ON employee_shifts;
CREATE POLICY "es_insert" ON employee_shifts FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ea_read" ON employee_advances;
CREATE POLICY "ea_read" ON employee_advances FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ea_insert" ON employee_advances;
CREATE POLICY "ea_insert" ON employee_advances FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ea_update" ON employee_advances;
CREATE POLICY "ea_update" ON employee_advances FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ai_read" ON advance_installments;
CREATE POLICY "ai_read" ON advance_installments FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ai_insert" ON advance_installments;
CREATE POLICY "ai_insert" ON advance_installments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ed_read" ON employee_documents;
CREATE POLICY "ed_read" ON employee_documents FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ed_insert" ON employee_documents;
CREATE POLICY "ed_insert" ON employee_documents FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ed_delete" ON employee_documents;
CREATE POLICY "ed_delete" ON employee_documents FOR DELETE USING (auth.role() = 'authenticated');

-- Seed shifts
INSERT INTO shift_definitions (code, name_en, name_ar, start_time, end_time, grace_minutes) VALUES
  ('MORNING', 'Morning Shift', 'الفترة الصباحية', '08:00', '17:00', 15),
  ('EVENING', 'Evening Shift', 'الفترة المسائية', '14:00', '22:00', 10),
  ('NIGHT', 'Night Shift', 'الفترة الليلية', '22:00', '06:00', 10),
  ('FLEX', 'Flexible', 'مرن', '08:00', '17:00', 30)
ON CONFLICT (code) DO NOTHING;
