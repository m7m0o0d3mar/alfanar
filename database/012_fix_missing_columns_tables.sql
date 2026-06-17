-- ============================================================================
-- FIX: Add missing columns and tables that the frontend depends on
-- ============================================================================
-- This migration adds:
--   1. budget table (referenced by FinancePage but never created)
--   2. Missing columns on employees (iqama_number, contract_type)
--   3. Missing columns on work_requests (discipline, inspection_date, contractor, priority)
--   4. Missing columns on projects (client_name)
--   5. Missing columns on approval_requests (request_no, project_id, approver_id, ref_record_id)
--   6. Missing columns on suppliers (address, cr_number, vat_number)
--   7. Missing columns on leads (lead_no)
--   8. Missing columns on payroll_runs (payroll_code, total_amount)
--   9. RLS policies for budget table
-- ============================================================================

-- 0. Extensions (safe to re-run)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CREATE BUDGET TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS budget (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    budget_code     TEXT NOT NULL,
    description     TEXT,
    total_budget    DECIMAL(20,2) DEFAULT 0,
    used_amount     DECIMAL(20,2) DEFAULT 0,
    project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
    category        TEXT,
    budget_type     TEXT NOT NULL DEFAULT 'operating' CHECK (budget_type IN ('operating','capital','maintenance','labor','material','equipment','overhead','other')),
    currency        TEXT DEFAULT 'SAR',
    status          TEXT NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_project ON budget(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_type ON budget(budget_type);

-- ============================================================================
-- 2. ADD MISSING COLUMNS TO employees
-- ============================================================================
ALTER TABLE employees ADD COLUMN IF NOT EXISTS iqama_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_type TEXT NOT NULL DEFAULT 'full_time' CHECK (contract_type IN ('full_time','part_time','temporary','contract','probation'));

-- ============================================================================
-- 3. ADD MISSING COLUMNS TO work_requests
-- ============================================================================
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS discipline TEXT;
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS inspection_date DATE;
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS contractor TEXT;
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical'));

-- ============================================================================
-- 4. ADD MISSING COLUMNS TO projects
-- ============================================================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_name TEXT;

-- ============================================================================
-- 5. ADD MISSING COLUMNS TO approval_requests
-- ============================================================================
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS request_no TEXT;
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS approver_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS ref_record_id UUID;
ALTER TABLE approval_requests ALTER COLUMN record_id SET DEFAULT uuid_generate_v4();

CREATE INDEX IF NOT EXISTS idx_approval_requests_project ON approval_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_approver ON approval_requests(approver_id);

-- ============================================================================
-- 6. ADD MISSING COLUMNS TO suppliers
-- ============================================================================
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS cr_number TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS vat_number TEXT;

-- ============================================================================
-- 7. ADD MISSING COLUMNS TO leads
-- ============================================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_no TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_lead_no ON leads(lead_no);

-- ============================================================================
-- 8. ADD MISSING COLUMNS TO payroll_runs
-- ============================================================================
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS payroll_code TEXT;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS total_amount DECIMAL(20,2) DEFAULT 0;

-- ============================================================================
-- 8b. ADD MISSING COLUMNS TO purchase_orders
-- ============================================================================
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_terms TEXT;

-- ============================================================================
-- 9. RLS POLICIES FOR budget TABLE
-- ============================================================================
ALTER TABLE budget ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'budget_select_project') THEN
        CREATE POLICY "budget_select_project" ON budget FOR SELECT USING (
            is_admin() OR has_project_access(project_id)
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'budget_insert_admin') THEN
        CREATE POLICY "budget_insert_admin" ON budget FOR INSERT WITH CHECK (
            is_admin() OR current_user_role() IN ('finance', 'project_manager')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'budget_update_admin') THEN
        CREATE POLICY "budget_update_admin" ON budget FOR UPDATE USING (
            is_admin() OR current_user_role() = 'finance'
        );
    END IF;
END $$;

-- ============================================================================
-- 10. ADD MISSING RLS POLICIES FOR OTHER TABLES
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'suppliers_insert_procurement') THEN
        CREATE POLICY "suppliers_insert_procurement" ON suppliers FOR INSERT WITH CHECK (
            is_admin() OR current_user_role() IN ('finance', 'project_manager')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'suppliers_update_procurement') THEN
        CREATE POLICY "suppliers_update_procurement" ON suppliers FOR UPDATE USING (
            is_admin() OR current_user_role() IN ('finance', 'project_manager')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'leads_delete_admin') THEN
        CREATE POLICY "leads_delete_admin" ON leads FOR DELETE USING (is_admin());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'payroll_update') THEN
        CREATE POLICY "payroll_update" ON payroll_runs FOR UPDATE USING (
            is_admin() OR current_user_role() IN ('hr', 'finance')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'approval_requests_update') THEN
        CREATE POLICY "approval_requests_update" ON approval_requests FOR UPDATE USING (
            is_admin() OR requested_by = auth.uid()
        );
    END IF;
END $$;
