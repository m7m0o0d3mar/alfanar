-- ============================================================================
-- FIX: Direct RLS policies for 3 problematic tables + verify admin
-- ============================================================================
-- Run this entire file in Supabase SQL Editor

-- 1. Ensure admin exists in user_profiles
INSERT INTO user_profiles (id, email, full_name_en, role)
SELECT id, email, 'Mahmoud Abdelaziz', 'admin'
FROM auth.users
WHERE email = 'mahmoud.abdelaziz@alfanar.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true;

-- 2. Finance invoices
ALTER TABLE contract_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_auth" ON contract_invoices;
CREATE POLICY "allow_all_auth" ON contract_invoices
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Work tasks (NOT project_tasks)
ALTER TABLE work_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_auth" ON work_tasks;
CREATE POLICY "allow_all_auth" ON work_tasks
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Safety incidents (NOT hse_incidents)
ALTER TABLE safety_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_auth" ON safety_incidents;
CREATE POLICY "allow_all_auth" ON safety_incidents
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Verify
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('contract_invoices','work_tasks','safety_incidents')
ORDER BY tablename;