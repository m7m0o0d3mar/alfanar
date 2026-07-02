-- ============================================================================
-- RBAC REBUILD: Dynamic roles, specializations, job roles, regions, blocks,
-- page registry, and scoped permissions
-- ============================================================================

-- 1. ROLES TABLE (replaces hardcoded role enum in user_profiles)
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  hierarchy_level INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_select_all" ON roles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "roles_insert_admin" ON roles FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "roles_update_admin" ON roles FOR UPDATE USING (is_admin());
CREATE POLICY "roles_delete_admin" ON roles FOR DELETE USING (is_admin());

-- 2. SPECIALIZATIONS (e.g. Civil Engineer, MEP Engineer, Safety Officer)
CREATE TABLE IF NOT EXISTS specializations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE specializations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spec_select_all" ON specializations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "spec_insert_admin" ON specializations FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "spec_update_admin" ON specializations FOR UPDATE USING (is_admin());
CREATE POLICY "spec_delete_admin" ON specializations FOR DELETE USING (is_admin());

-- 3. JOB ROLES (e.g. Senior Engineer, Junior Engineer, Supervisor)
CREATE TABLE IF NOT EXISTS job_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  hierarchy_level INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE job_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jr_select_all" ON job_roles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "jr_insert_admin" ON job_roles FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "jr_update_admin" ON job_roles FOR UPDATE USING (is_admin());
CREATE POLICY "jr_delete_admin" ON job_roles FOR DELETE USING (is_admin());

-- 4. REGIONS (geographical regions)
CREATE TABLE IF NOT EXISTS regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regions_select_all" ON regions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "regions_insert_admin" ON regions FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "regions_update_admin" ON regions FOR UPDATE USING (is_admin());
CREATE POLICY "regions_delete_admin" ON regions FOR DELETE USING (is_admin());

-- 5. BLOCKS (sub-regions / districts within a region)
CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES regions(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(region_id, code)
);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks_select_all" ON blocks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "blocks_insert_admin" ON blocks FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "blocks_update_admin" ON blocks FOR UPDATE USING (is_admin());
CREATE POLICY "blocks_delete_admin" ON blocks FOR DELETE USING (is_admin());

-- 6. PAGE REGISTRY (replaces hardcoded nav items)
CREATE TABLE IF NOT EXISTS page_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  path VARCHAR(255) NOT NULL,
  icon VARCHAR(50),
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  parent_code VARCHAR(50) REFERENCES page_registry(code),
  section_key VARCHAR(50),
  section_label_en VARCHAR(100),
  section_label_ar VARCHAR(100),
  sort_order INT DEFAULT 0,
  is_enabled BOOLEAN DEFAULT true,
  is_admin BOOLEAN DEFAULT false,
  require_module VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE page_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pr_select_all" ON page_registry FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "pr_insert_admin" ON page_registry FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "pr_update_admin" ON page_registry FOR UPDATE USING (is_admin());
CREATE POLICY "pr_delete_admin" ON page_registry FOR DELETE USING (is_admin());

-- 7. EXTEND ROLE_PERMISSIONS WITH SCOPING
-- Add scope columns to the existing role_permissions table
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS scope_type TEXT DEFAULT 'global'
  CHECK (scope_type IN ('global', 'project', 'block', 'unit'));
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS scope_id UUID;
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id);
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS name_en VARCHAR(100);
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS name_ar VARCHAR(100);
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Allow multiple permission records per role (for different scopes)
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_pkey;
-- Keep the role column and add a new primary key
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- 8. ADD specialization_id AND job_role_id TO user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS specialization_id UUID REFERENCES specializations(id);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS job_role_id UUID REFERENCES job_roles(id);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS block_id UUID REFERENCES blocks(id);

-- 9. SEED ROLES
INSERT INTO roles (code, name_en, name_ar, is_system, hierarchy_level) VALUES
  ('admin', 'Administrator', 'مدير النظام', true, 100),
  ('developer', 'Developer', 'مطور', true, 90),
  ('project_manager', 'Project Manager', 'مدير مشروع', true, 80),
  ('main_contractor', 'Main Contractor', 'مقاول رئيسي', true, 70),
  ('subcontractor', 'Subcontractor', 'مقاول فرعي', true, 60),
  ('engineer', 'Site Engineer', 'مهندس موقع', true, 50),
  ('quality', 'QC Inspector', 'مفتش جودة', true, 40),
  ('hse', 'HSE Officer', 'مسؤول سلامة', true, 40),
  ('hr', 'HR Manager', 'مدير موارد بشرية', true, 50),
  ('finance', 'Finance Officer', 'مسؤول مالي', true, 50),
  ('sales', 'Sales', 'مبيعات', true, 30),
  ('consultant', 'Consultant', 'استشاري', true, 60),
  ('client', 'Client', 'عميل', true, 20)
ON CONFLICT (code) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_ar = EXCLUDED.name_ar,
  is_system = true;

-- 10. SEED SPECIALIZATIONS
INSERT INTO specializations (code, name_en, name_ar) VALUES
  ('civil_eng', 'Civil Engineer', 'مهندس مدني'),
  ('mep_eng', 'MEP Engineer', 'مهندس ميكانيكا/كهرباء/سباكة'),
  ('arch_eng', 'Architectural Engineer', 'مهندس معماري'),
  ('structural_eng', 'Structural Engineer', 'مهندس إنشائي'),
  ('electrical_eng', 'Electrical Engineer', 'مهندس كهرباء'),
  ('mechanical_eng', 'Mechanical Engineer', 'مهندس ميكانيكا'),
  ('safety_officer', 'Safety Officer', 'مسؤول سلامة'),
  ('quality_eng', 'Quality Engineer', 'مهندس جودة'),
  ('surveyor', 'Quantity Surveyor', 'مساح كميات'),
  ('project_coordinator', 'Project Coordinator', 'منسق مشروع'),
  ('accountant', 'Accountant', 'محاسب'),
  ('hr_specialist', 'HR Specialist', 'أخصائي موارد بشرية'),
  ('sales_rep', 'Sales Representative', 'مندوب مبيعات'),
  ('procurement_officer', 'Procurement Officer', 'مسؤول مشتريات'),
  ('storekeeper', 'Storekeeper', 'أمين مستودع')
ON CONFLICT (code) DO NOTHING;

-- 11. SEED JOB ROLES
INSERT INTO job_roles (code, name_en, name_ar, hierarchy_level) VALUES
  ('director', 'Director', 'مدير', 90),
  ('senior_eng', 'Senior Engineer', 'مهندس أول', 80),
  ('engineer', 'Engineer', 'مهندس', 70),
  ('junior_eng', 'Junior Engineer', 'مهندس مبتدئ', 60),
  ('supervisor', 'Supervisor', 'مشرف', 70),
  ('technician', 'Technician', 'فني', 50),
  ('coordinator', 'Coordinator', 'منسق', 50),
  ('officer', 'Officer', 'مسؤول', 50),
  ('specialist', 'Specialist', 'أخصائي', 60),
  ('trainee', 'Trainee', 'متدرب', 10)
ON CONFLICT (code) DO NOTHING;

-- 12. SEED REGIONS
INSERT INTO regions (code, name_en, name_ar) VALUES
  ('riyadh', 'Riyadh Region', 'منطقة الرياض'),
  ('makkah', 'Makkah Region', 'منطقة مكة المكرمة'),
  ('eastern', 'Eastern Province', 'المنطقة الشرقية'),
  ('madina', 'Madina Region', 'منطقة المدينة المنورة'),
  ('qassim', 'Qassim Region', 'منطقة القصيم'),
  ('asir', 'Asir Region', 'منطقة عسير'),
  ('tabuk', 'Tabuk Region', 'منطقة تبوك'),
  ('hail', 'Hail Region', 'منطقة حائل'),
  ('northern', 'Northern Borders', 'منطقة الحدود الشمالية'),
  ('jazan', 'Jazan Region', 'منطقة جازان'),
  ('najran', 'Najran Region', 'منطقة نجران'),
  ('bahah', 'Al-Bahah Region', 'منطقة الباحة'),
  ('jouf', 'Al-Jouf Region', 'منطقة الجوف')
ON CONFLICT (code) DO NOTHING;

-- 13. SEED PAGE REGISTRY
INSERT INTO page_registry (code, path, icon, name_en, name_ar, section_key, section_label_en, section_label_ar, sort_order, is_admin) VALUES
  ('dashboard', '/', 'LayoutDashboard', 'Dashboard', 'لوحة التحكم', 'main', '', '', 1, false),
  ('projects', '/projects', 'Building2', 'Projects', 'المشاريع', 'projects', 'Projects', 'المشاريع', 10, false),
  ('units', '/units', 'Grid3X3', 'Units', 'الوحدات', 'projects', 'Projects', 'المشاريع', 11, false),
  ('timelines', '/timelines', 'CalendarRange', 'Timelines', 'الجداول الزمنية', 'projects', 'Projects', 'المشاريع', 12, false),
  ('maps', '/maps', 'Map', 'Maps', 'الخرائط', 'projects', 'Projects', 'المشاريع', 13, false),
  ('execution', '/execution', 'HardHat', 'Execution', 'التنفيذ', 'operations', 'Operations', 'العمليات', 20, false),
  ('quality', '/quality', 'ShieldCheck', 'Quality', 'الجودة', 'operations', 'Operations', 'العمليات', 21, false),
  ('hse', '/hse', 'ShieldCheck', 'HSE', 'السلامة', 'operations', 'Operations', 'العمليات', 22, false),
  ('warehouse', '/warehouse', 'Warehouse', 'Warehouse', 'المخازن', 'operations', 'Operations', 'العمليات', 23, false),
  ('hr', '/hr', 'Users', 'HR & Payroll', 'الموارد البشرية', 'resources', 'Resources', 'الموارد', 30, false),
  ('attendance', '/attendance', 'Clock', 'Attendance', 'الحضور', 'resources', 'Resources', 'الموارد', 31, false),
  ('procurement', '/procurement', 'ShoppingCart', 'Procurement', 'المشتريات', 'resources', 'Resources', 'الموارد', 32, false),
  ('finance', '/finance', 'DollarSign', 'Finance', 'المالية', 'resources', 'Resources', 'الموارد', 33, false),
  ('resources', '/resources', 'Briefcase', 'Resources', 'الموارد', 'resources', 'Resources', 'الموارد', 34, false),
  ('sales', '/sales', 'TrendingUp', 'Sales', 'المبيعات', 'sales', 'Sales & CRM', 'المبيعات', 40, false),
  ('crm', '/crm', 'Contact', 'CRM', 'CRM', 'sales', 'Sales & CRM', 'المبيعات', 41, false),
  ('technical', '/technical', 'Wrench', 'Technical Office', 'المكتب الفني', 'docs', 'Documents', 'الوثائق', 50, false),
  ('documents', '/documents', 'FolderOpen', 'Documents', 'الوثائق', 'docs', 'Documents', 'الوثائق', 51, false),
  ('approvals', '/approvals', 'CheckSquare', 'Approvals', 'الموافقات', 'docs', 'Documents', 'الوثائق', 52, false),
  ('settings', '/settings', 'Cog', 'Settings', 'الإعدادات', 'system', 'System', 'النظام', 60, false),
  ('admin_users', '/admin/users', 'UserCog', 'Users', 'المستخدمين', 'admin', 'Administration', 'الإدارة', 100, true),
  ('admin_roles', '/admin/roles', 'Shield', 'Roles & Permissions', 'الأدوار والصلاحيات', 'admin', 'Administration', 'الإدارة', 101, true),
  ('admin_branding', '/admin/branding', 'Palette', 'Branding', 'العلامة التجارية', 'admin', 'Administration', 'الإدارة', 102, true),
  ('admin_settings', '/admin/settings', 'Cog', 'System Settings', 'إعدادات النظام', 'admin', 'Administration', 'الإدارة', 103, true),
  ('admin_sql', '/admin/sql', 'Terminal', 'SQL Editor', 'محرر SQL', 'admin', 'Administration', 'الإدارة', 104, true)
ON CONFLICT (code) DO UPDATE SET
  path = EXCLUDED.path, icon = EXCLUDED.icon,
  name_en = EXCLUDED.name_en, name_ar = EXCLUDED.name_ar,
  sort_order = EXCLUDED.sort_order;

-- 14. MIGRATE existing role_permissions to use new scoped format
-- Update existing records to have the new columns populated
UPDATE role_permissions SET
  scope_type = 'global',
  scope_id = NULL,
  is_active = true,
  created_at = COALESCE(updated_at, now()),
  role_id = (SELECT id FROM roles WHERE roles.code = role_permissions.role)
WHERE role_id IS NULL;

-- 15. UPDATE user_profiles with FK to roles (migrate existing)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role') THEN
    -- Add role_id column
    ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id);
    -- Migrate existing role text to role_id
    UPDATE user_profiles SET
      role_id = (SELECT id FROM roles WHERE roles.code = user_profiles.role)
    WHERE role_id IS NULL AND role IS NOT NULL;
  END IF;
END $$;

-- 16. SEED scoped permissions from existing role_permissions data
-- (keep existing data, just ensure it's properly structured)

-- Ensure RLS on all new tables is enabled (already done per-table above)

-- 17. HELPER FUNCTION: check if user has permission for a scope
CREATE OR REPLACE FUNCTION public.has_permission(perm_key TEXT, scope_type TEXT DEFAULT 'global', scope_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  perms JSONB;
BEGIN
  SELECT role INTO user_role FROM user_profiles WHERE id = auth.uid();
  IF user_role IS NULL THEN RETURN false; END IF;

  -- Admin always has all permissions
  IF user_role = 'admin' THEN RETURN true; END IF;

  -- Check global permissions first
  SELECT permissions INTO perms FROM role_permissions
  WHERE role = user_role AND scope_type = 'global' AND is_active = true
  LIMIT 1;

  IF perms IS NOT NULL THEN
    IF perms ? 'all_modules' AND (perms->>'all_modules')::boolean = true THEN RETURN true; END IF;
    IF perms ? perm_key AND (perms->>perm_key)::boolean = true THEN RETURN true; END IF;
    IF perms ? 'all_modules' AND perms->'all_modules' @> to_jsonb(perm_key) THEN RETURN true; END IF;
  END IF;

  -- Check scoped permissions if scope specified
  IF scope_type != 'global' AND scope_id IS NOT NULL THEN
    SELECT permissions INTO perms FROM role_permissions
    WHERE role = user_role AND scope_type = scope_type AND scope_id = scope_id AND is_active = true
    LIMIT 1;

    IF perms IS NOT NULL THEN
      IF perms ? 'all_modules' AND (perms->>'all_modules')::boolean = true THEN RETURN true; END IF;
      IF perms ? perm_key AND (perms->>perm_key)::boolean = true THEN RETURN true; END IF;
    END IF;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(TEXT, TEXT, UUID) TO authenticated;
