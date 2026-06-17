-- ============================================================================
-- FIX: Admin RLS bypass + exec_sql RPC + missing INSERT/UPDATE policies
-- ============================================================================
-- Run this AFTER 012_fix_missing_columns_tables.sql
-- ============================================================================

-- 1. Re-deploy exec_sql RPC (fix Issue #1)
DROP FUNCTION IF EXISTS public.exec_sql(TEXT);

CREATE OR REPLACE FUNCTION public.exec_sql(query TEXT)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    admin_check BOOLEAN;
BEGIN
    SELECT is_admin() INTO admin_check;
    IF NOT admin_check THEN
        RAISE EXCEPTION 'Only admins can execute SQL';
    END IF;
    RETURN QUERY EXECUTE query;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO authenticated;

-- 2. Ensure is_admin() function is correct
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- 3. Add explicit admin full-access policies on all business tables
-- These ensure admin bypass works even if other policies are missing

-- Helper to create policy if not exists
DO $$
BEGIN
    -- Projects
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'projects_all_admin' AND tablename = 'projects') THEN
        CREATE POLICY "projects_all_admin" ON projects FOR ALL USING (is_admin());
    END IF;

    -- Units
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'units_all_admin' AND tablename = 'units') THEN
        CREATE POLICY "units_all_admin" ON units FOR ALL USING (is_admin());
    END IF;

    -- Blocks
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'blocks_all_admin' AND tablename = 'blocks') THEN
        CREATE POLICY "blocks_all_admin" ON blocks FOR ALL USING (is_admin());
    END IF;

    -- Work requests (WIR/NCR)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'wir_all_admin' AND tablename = 'work_requests') THEN
        CREATE POLICY "wir_all_admin" ON work_requests FOR ALL USING (is_admin());
    END IF;

    -- Work tasks
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'work_tasks_all_admin' AND tablename = 'work_tasks') THEN
        CREATE POLICY "work_tasks_all_admin" ON work_tasks FOR ALL USING (is_admin());
    END IF;

    -- Contracts
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'contracts_all_admin' AND tablename = 'contracts') THEN
        CREATE POLICY "contracts_all_admin" ON contracts FOR ALL USING (is_admin());
    END IF;

    -- Purchase orders
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'po_all_admin' AND tablename = 'purchase_orders') THEN
        CREATE POLICY "po_all_admin" ON purchase_orders FOR ALL USING (is_admin());
    END IF;

    -- Purchase requests
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pr_all_admin' AND tablename = 'purchase_requests') THEN
        CREATE POLICY "pr_all_admin" ON purchase_requests FOR ALL USING (is_admin());
    END IF;

    -- Suppliers
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'suppliers_all_admin' AND tablename = 'suppliers') THEN
        CREATE POLICY "suppliers_all_admin" ON suppliers FOR ALL USING (is_admin());
    END IF;

    -- Employees
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'employees_all_admin' AND tablename = 'employees') THEN
        CREATE POLICY "employees_all_admin" ON employees FOR ALL USING (is_admin());
    END IF;

    -- Payroll runs
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'payroll_runs_all_admin' AND tablename = 'payroll_runs') THEN
        CREATE POLICY "payroll_runs_all_admin" ON payroll_runs FOR ALL USING (is_admin());
    END IF;

    -- Leads
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'leads_all_admin' AND tablename = 'leads') THEN
        CREATE POLICY "leads_all_admin" ON leads FOR ALL USING (is_admin());
    END IF;

    -- Customers
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_all_admin' AND tablename = 'customers') THEN
        CREATE POLICY "customers_all_admin" ON customers FOR ALL USING (is_admin());
    END IF;

    -- Unit sales
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'unit_sales_all_admin' AND tablename = 'unit_sales') THEN
        CREATE POLICY "unit_sales_all_admin" ON unit_sales FOR ALL USING (is_admin());
    END IF;

    -- Technical tickets
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tech_tickets_all_admin' AND tablename = 'technical_tickets') THEN
        CREATE POLICY "tech_tickets_all_admin" ON technical_tickets FOR ALL USING (is_admin());
    END IF;

    -- Approval requests
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'approval_requests_all_admin' AND tablename = 'approval_requests') THEN
        CREATE POLICY "approval_requests_all_admin" ON approval_requests FOR ALL USING (is_admin());
    END IF;

    -- Documents
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'documents_all_admin' AND tablename = 'documents') THEN
        CREATE POLICY "documents_all_admin" ON documents FOR ALL USING (is_admin());
    END IF;

    -- Budget
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'budget_all_admin' AND tablename = 'budget') THEN
        CREATE POLICY "budget_all_admin" ON budget FOR ALL USING (is_admin());
    END IF;

    -- Safety incidents
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'safety_incidents_all_admin' AND tablename = 'safety_incidents') THEN
        CREATE POLICY "safety_incidents_all_admin" ON safety_incidents FOR ALL USING (is_admin());
    END IF;

    -- Safety observations
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'safety_observations_all_admin' AND tablename = 'safety_observations') THEN
        CREATE POLICY "safety_observations_all_admin" ON safety_observations FOR ALL USING (is_admin());
    END IF;

    -- Companies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'companies_all_admin' AND tablename = 'companies') THEN
        CREATE POLICY "companies_all_admin" ON companies FOR ALL USING (is_admin());
    END IF;

    -- Materials catalog
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'materials_all_admin' AND tablename = 'materials_catalog') THEN
        CREATE POLICY "materials_all_admin" ON materials_catalog FOR ALL USING (is_admin());
    END IF;

    -- Contract invoices (MISSING - was causing Finance Invoice save failure)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'contract_invoices_all_admin' AND tablename = 'contract_invoices') THEN
        CREATE POLICY "contract_invoices_all_admin" ON contract_invoices FOR ALL USING (is_admin());
    END IF;

    -- Safety audits
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'safety_audits_all_admin' AND tablename = 'safety_audits') THEN
        CREATE POLICY "safety_audits_all_admin" ON safety_audits FOR ALL USING (is_admin());
    END IF;

    -- Toolbox talks
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'toolbox_talks_all_admin' AND tablename = 'toolbox_talks') THEN
        CREATE POLICY "toolbox_talks_all_admin" ON toolbox_talks FOR ALL USING (is_admin());
    END IF;

    -- PPE issuance
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ppe_issuance_all_admin' AND tablename = 'ppe_issuance') THEN
        CREATE POLICY "ppe_issuance_all_admin" ON ppe_issuance FOR ALL USING (is_admin());
    END IF;

    -- Goods receipts
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'goods_receipts_all_admin' AND tablename = 'goods_receipts') THEN
        CREATE POLICY "goods_receipts_all_admin" ON goods_receipts FOR ALL USING (is_admin());
    END IF;

    -- Labor groups
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'labor_groups_all_admin' AND tablename = 'labor_groups') THEN
        CREATE POLICY "labor_groups_all_admin" ON labor_groups FOR ALL USING (is_admin());
    END IF;

    -- Attendance
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'attendance_all_admin' AND tablename = 'attendance') THEN
        CREATE POLICY "attendance_all_admin" ON attendance FOR ALL USING (is_admin());
    END IF;

    -- Subcontracts
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'subcontracts_all_admin' AND tablename = 'subcontracts') THEN
        CREATE POLICY "subcontracts_all_admin" ON subcontracts FOR ALL USING (is_admin());
    END IF;

    -- Daily reports
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'daily_reports_all_admin' AND tablename = 'daily_reports') THEN
        CREATE POLICY "daily_reports_all_admin" ON daily_reports FOR ALL USING (is_admin());
    END IF;
END $$;
