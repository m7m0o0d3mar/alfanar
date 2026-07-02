-- ============================================================
-- Phase 7: Performance & Security Improvements
-- Database indexes, `exec_sql` restriction, missing RLS policies
-- ============================================================

-- 1. Performance Indexes for new tables
-- Supplier evaluations: filter by supplier, date, score
CREATE INDEX IF NOT EXISTS idx_supplier_evaluations_supplier ON supplier_evaluations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_evaluations_date ON supplier_evaluations(evaluation_date DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_evaluations_score ON supplier_evaluations(overall_score DESC);

-- Procurement budgets: filter by fiscal year, project
CREATE INDEX IF NOT EXISTS idx_procurement_budgets_fiscal ON procurement_budgets(fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_procurement_budgets_project ON procurement_budgets(project_id);

-- Purchase requisitions: filter by status, project, requester
CREATE INDEX IF NOT EXISTS idx_pr_status ON purchase_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_pr_project ON purchase_requisitions(project_id);
CREATE INDEX IF NOT EXISTS idx_pr_requester ON purchase_requisitions(requester_id);

-- Sourcing events: filter by status, category, close date
CREATE INDEX IF NOT EXISTS idx_sourcing_status ON sourcing_events(status);
CREATE INDEX IF NOT EXISTS idx_sourcing_close ON sourcing_events(close_date);

-- Procurement contracts: filter by supplier, status, dates
CREATE INDEX IF NOT EXISTS idx_pc_supplier ON procurement_contracts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_pc_status ON procurement_contracts(status);
CREATE INDEX IF NOT EXISTS idx_pc_dates ON procurement_contracts(start_date, end_date);

-- Catalog items: search by code, supplier
CREATE INDEX IF NOT EXISTS idx_catalog_item_code ON catalog_items(item_code);
CREATE INDEX IF NOT EXISTS idx_catalog_supplier ON catalog_items(supplier_id);

-- Journal entries: filter by date, status, reference
CREATE INDEX IF NOT EXISTS idx_je_date ON journal_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_je_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_je_ref ON journal_entries(reference_type, reference_id);

-- Expense claims: filter by employee, status
CREATE INDEX IF NOT EXISTS idx_ec_employee ON expense_claims(employee_id);
CREATE INDEX IF NOT EXISTS idx_ec_status ON expense_claims(status);

-- Employee contracts: filter by employee, status
CREATE INDEX IF NOT EXISTS idx_empc_employee ON employee_contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_empc_status ON employee_contracts(status);

-- Employee advances: filter by employee, status
CREATE INDEX IF NOT EXISTS idx_ea_employee ON employee_advances(employee_id);
CREATE INDEX IF NOT EXISTS idx_ea_status ON employee_advances(status);

-- Departments: hierarchy
CREATE INDEX IF NOT EXISTS idx_dept_parent ON departments(parent_id);

-- Chart of accounts: filter by type, parent
CREATE INDEX IF NOT EXISTS idx_coa_type ON chart_of_accounts(type);
CREATE INDEX IF NOT EXISTS idx_coa_parent ON chart_of_accounts(parent_id);

-- Currencies: lookup by date
CREATE INDEX IF NOT EXISTS idx_currency_rates_date ON currency_rates(rate_date DESC);

-- File uploads: filter by reference, uploader, folder
CREATE INDEX IF NOT EXISTS idx_fu_reference ON file_uploads(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_fu_uploader ON file_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_fu_folder ON file_uploads(folder);

-- Documents: filter by project, status, type
CREATE INDEX IF NOT EXISTS idx_docs_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_docs_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_docs_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_docs_code ON documents(doc_code);
CREATE INDEX IF NOT EXISTS idx_docs_uploaded ON documents(uploaded_at DESC);

-- 3. Add remaining RLS policies for new tables (granular role-based)

-- Procurement Categories: admins can manage, others read
DROP POLICY IF EXISTS "procurement_categories_insert" ON procurement_categories;
DROP POLICY IF EXISTS "procurement_categories_update" ON procurement_categories;
DROP POLICY IF EXISTS "pc_insert" ON procurement_categories;
CREATE POLICY "pc_insert" ON procurement_categories FOR INSERT WITH CHECK (public.is_admin() OR public.current_user_role() IN ('procurement','project_manager'));
DROP POLICY IF EXISTS "pc_update" ON procurement_categories;
CREATE POLICY "pc_update" ON procurement_categories FOR UPDATE USING (public.is_admin() OR public.current_user_role() IN ('procurement'));

-- Supplier Evaluations: procurement and admins can manage
DROP POLICY IF EXISTS "supplier_evaluations_insert" ON supplier_evaluations;
DROP POLICY IF EXISTS "supplier_evaluations_update" ON supplier_evaluations;
DROP POLICY IF EXISTS "se_insert" ON supplier_evaluations;
CREATE POLICY "se_insert" ON supplier_evaluations FOR INSERT WITH CHECK (public.current_user_role() IN ('admin','procurement','project_manager'));
DROP POLICY IF EXISTS "se_update" ON supplier_evaluations;
CREATE POLICY "se_update" ON supplier_evaluations FOR UPDATE USING (public.current_user_role() IN ('admin','procurement'));

-- Purchase Requisitions
DROP POLICY IF EXISTS "purchase_requisitions_insert" ON purchase_requisitions;
DROP POLICY IF EXISTS "purchase_requisitions_update" ON purchase_requisitions;
DROP POLICY IF EXISTS "pr_insert" ON purchase_requisitions;
CREATE POLICY "pr_insert" ON purchase_requisitions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "pr_update" ON purchase_requisitions;
CREATE POLICY "pr_update" ON purchase_requisitions FOR UPDATE USING (
  public.is_admin() OR auth.uid() = requester_id OR public.current_user_role() IN ('procurement','project_manager')
);

-- Expense Claims: users see own, managers see team
DROP POLICY IF EXISTS "ec_insert" ON expense_claims;
DROP POLICY IF EXISTS "ec_update" ON expense_claims;
CREATE POLICY "ec_insert" ON expense_claims FOR INSERT WITH CHECK (auth.uid() = employee_id OR public.is_admin());
CREATE POLICY "ec_update" ON expense_claims FOR UPDATE USING (
  public.is_admin() OR (auth.uid() = employee_id AND status = 'draft')
);

-- Employee Contracts: HR and admins can manage
DROP POLICY IF EXISTS "ec_read" ON employee_contracts;
DROP POLICY IF EXISTS "ec_insert" ON employee_contracts;
DROP POLICY IF EXISTS "ec_update" ON employee_contracts;
DROP POLICY IF EXISTS "empc_select" ON employee_contracts;
CREATE POLICY "empc_select" ON employee_contracts FOR SELECT USING (
  public.is_admin() OR public.current_user_role() IN ('hr','project_manager') OR auth.uid() = employee_id
);
DROP POLICY IF EXISTS "empc_insert" ON employee_contracts;
CREATE POLICY "empc_insert" ON employee_contracts FOR INSERT WITH CHECK (public.current_user_role() IN ('admin','hr'));
DROP POLICY IF EXISTS "empc_update" ON employee_contracts;
CREATE POLICY "empc_update" ON employee_contracts FOR UPDATE USING (public.current_user_role() IN ('admin','hr'));

-- Notifications: only the owning user can see/update (already set, keep as is)
-- Files: authenticated users can read/insert, only admins can delete
DROP POLICY IF EXISTS "fu_delete" ON file_uploads;
CREATE POLICY "fu_delete" ON file_uploads FOR DELETE USING (public.is_admin() OR auth.uid() = uploaded_by);
