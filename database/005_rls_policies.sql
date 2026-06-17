-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Strategy:
--   1. Admin sees everything
--   2. Developer (owner) sees their own projects
--   3. MainContractor sees contracts/projects they are assigned to
--   4. Subcontractor sees their own work items/WIRs
--   5. Consultant sees WIR/NCR/RFIs/Drawings for assigned projects
--   6. Client sees only their own units/sales
--   7. Engineer/Quality/HSE/HR/Finance see project-scoped data per role
-- ============================================================================

-- Helper function: check if user has global admin role
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

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

-- Helper function: check if user has project access (any role on that project)
CREATE OR REPLACE FUNCTION public.has_project_access(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_projects
    WHERE user_id = auth.uid()
      AND project_id = p_project_id
  );
$$;

-- Helper: check if user has a specific project role
CREATE OR REPLACE FUNCTION public.has_project_role(p_project_id UUID, p_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_projects
    WHERE user_id = auth.uid()
      AND project_id = p_project_id
      AND project_role = p_role
  );
$$;

-- Enable RLS on all tables
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_scope_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_breakdown_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_request_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE toolbox_talks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppe_issuance ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_issue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SYSTEM-WIDE POLICIES (apply to all authenticated users)
-- ============================================================================

-- System settings: admins can manage, all authenticated can read
CREATE POLICY "sys_settings_select_all" ON system_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "sys_settings_insert_admin" ON system_settings FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "sys_settings_update_admin" ON system_settings FOR UPDATE USING (is_admin());

-- Modules: all authenticated can read
CREATE POLICY "modules_select_all" ON modules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "modules_insert_admin" ON modules FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "modules_update_admin" ON modules FOR UPDATE USING (is_admin());

-- Module settings: admins only
CREATE POLICY "module_settings_select_admin" ON module_settings FOR SELECT USING (is_admin());
CREATE POLICY "module_settings_insert_admin" ON module_settings FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "module_settings_update_admin" ON module_settings FOR UPDATE USING (is_admin());

-- Status definitions: all authenticated read
CREATE POLICY "status_definitions_select_all" ON status_definitions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "status_definitions_insert_admin" ON status_definitions FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "status_definitions_update_admin" ON status_definitions FOR UPDATE USING (is_admin());

-- Workflow definitions: all authenticated read
CREATE POLICY "workflow_def_select_all" ON workflow_definitions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "workflow_def_insert_admin" ON workflow_definitions FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "workflow_def_update_admin" ON workflow_definitions FOR UPDATE USING (is_admin());

-- Workflow steps: all authenticated read
CREATE POLICY "workflow_steps_select_all" ON workflow_steps FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "workflow_steps_insert_admin" ON workflow_steps FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "workflow_steps_update_admin" ON workflow_steps FOR UPDATE USING (is_admin());

-- Custom fields: all authenticated read
CREATE POLICY "custom_fields_select_all" ON custom_fields FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "custom_fields_insert_admin" ON custom_fields FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "custom_fields_update_admin" ON custom_fields FOR UPDATE USING (is_admin());

-- Custom field values: CRUD by project-access users
CREATE POLICY "cfv_select_project" ON custom_field_values FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM user_projects up
        WHERE up.user_id = auth.uid()
    )
);
CREATE POLICY "cfv_insert_project" ON custom_field_values FOR INSERT WITH CHECK (
    is_admin() OR EXISTS (
        SELECT 1 FROM user_projects up
        WHERE up.user_id = auth.uid()
    )
);
CREATE POLICY "cfv_update_project" ON custom_field_values FOR UPDATE USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM user_projects up
        WHERE up.user_id = auth.uid()
    )
);
CREATE POLICY "cfv_delete_admin" ON custom_field_values FOR DELETE USING (is_admin());

-- KPI definitions: all authenticated read, admin manage
CREATE POLICY "kpi_def_select_all" ON kpi_definitions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "kpi_def_insert_admin" ON kpi_definitions FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "kpi_def_update_admin" ON kpi_definitions FOR UPDATE USING (is_admin());

-- KPI logs: all authenticated read
CREATE POLICY "kpi_logs_select_all" ON kpi_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "kpi_logs_insert_admin" ON kpi_logs FOR INSERT WITH CHECK (is_admin());

-- ============================================================================
-- USER PROFILES & PROJECTS
-- ============================================================================

-- User profiles: users see own profile, admins see all
CREATE POLICY "profiles_select_self" ON user_profiles FOR SELECT USING (
    id = auth.uid() OR is_admin()
);
CREATE POLICY "profiles_insert" ON user_profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_self" ON user_profiles FOR UPDATE USING (
    id = auth.uid() OR is_admin()
);

-- User projects: project-scoped visibility
CREATE POLICY "user_projects_select_all" ON user_projects FOR SELECT USING (
    is_admin() OR user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM user_projects up2 WHERE up2.project_id = user_projects.project_id AND up2.user_id = auth.uid())
);
CREATE POLICY "user_projects_insert_admin" ON user_projects FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "user_projects_update_admin" ON user_projects FOR UPDATE USING (is_admin());

-- ============================================================================
-- COMPANIES & CONTRACTORS
-- ============================================================================

CREATE POLICY "companies_select_project" ON companies FOR SELECT USING (
    is_admin() OR EXISTS (SELECT 1 FROM user_projects up WHERE up.user_id = auth.uid())
);
CREATE POLICY "companies_insert_admin" ON companies FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "companies_update_admin" ON companies FOR UPDATE USING (is_admin());

CREATE POLICY "contractors_select_project" ON contractors FOR SELECT USING (
    is_admin() OR EXISTS (SELECT 1 FROM user_projects up WHERE up.user_id = auth.uid())
);
CREATE POLICY "contractors_insert_admin" ON contractors FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "contractors_update_admin" ON contractors FOR UPDATE USING (is_admin());

-- ============================================================================
-- PROJECTS (core data - critical RLS)
-- ============================================================================

-- Projects: admin sees all; others see only their projects via user_projects
CREATE POLICY "projects_select" ON projects FOR SELECT USING (
    is_admin() OR has_project_access(id)
);
CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (
    is_admin() OR current_user_role() IN ('developer', 'project_manager')
);
CREATE POLICY "projects_update" ON projects FOR UPDATE USING (
    is_admin() OR has_project_role(id, 'owner') OR has_project_role(id, 'project_manager')
);

-- Project phases: same as projects
CREATE POLICY "phases_select" ON project_phases FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);
CREATE POLICY "phases_insert" ON project_phases FOR INSERT WITH CHECK (
    is_admin() OR has_project_role(project_id, 'project_manager')
);
CREATE POLICY "phases_update" ON project_phases FOR UPDATE USING (
    is_admin() OR has_project_role(project_id, 'project_manager')
);

-- Project stakeholders: same
CREATE POLICY "stakeholders_select" ON project_stakeholders FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);
CREATE POLICY "stakeholders_insert" ON project_stakeholders FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "stakeholders_update" ON project_stakeholders FOR UPDATE USING (is_admin());

-- Blocks
CREATE POLICY "blocks_select" ON blocks FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);
CREATE POLICY "blocks_insert" ON blocks FOR INSERT WITH CHECK (
    is_admin() OR has_project_role(project_id, 'project_manager')
);
CREATE POLICY "blocks_update" ON blocks FOR UPDATE USING (
    is_admin() OR has_project_role(project_id, 'project_manager')
);

-- Units
CREATE POLICY "units_select" ON units FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);
CREATE POLICY "units_insert" ON units FOR INSERT WITH CHECK (
    is_admin() OR has_project_role(project_id, 'project_manager')
);
CREATE POLICY "units_update" ON units FOR UPDATE USING (
    is_admin() OR has_project_role(project_id, 'project_manager') OR has_project_role(project_id, 'sales')
);

-- Unit progress / Item progress
CREATE POLICY "unit_progress_select" ON unit_progress FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM units u JOIN user_projects up ON u.project_id = up.project_id
        WHERE u.id = unit_progress.unit_id AND up.user_id = auth.uid()
    )
);
CREATE POLICY "unit_progress_insert" ON unit_progress FOR INSERT WITH CHECK (
    is_admin() OR has_project_role(
        (SELECT project_id FROM units WHERE id = unit_progress.unit_id), 'engineer'
    )
);
CREATE POLICY "unit_progress_update" ON unit_progress FOR UPDATE USING (
    is_admin() OR has_project_role(
        (SELECT project_id FROM units WHERE id = unit_progress.unit_id), 'engineer'
    )
);

CREATE POLICY "item_progress_select" ON item_progress FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM unit_progress up
        JOIN units u ON u.id = up.unit_id
        JOIN user_projects upj ON upj.project_id = u.project_id
        WHERE up.id = item_progress.unit_progress_id AND upj.user_id = auth.uid()
    )
);

-- Daily reports: project-scoped
CREATE POLICY "daily_reports_select" ON daily_reports FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);
CREATE POLICY "daily_reports_insert" ON daily_reports FOR INSERT WITH CHECK (
    is_admin() OR has_project_role(project_id, 'engineer') OR has_project_role(project_id, 'project_manager')
);
CREATE POLICY "daily_reports_update" ON daily_reports FOR UPDATE USING (
    is_admin() OR has_project_role(project_id, 'project_manager')
);

CREATE POLICY "daily_report_items_select" ON daily_report_items FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM daily_reports dr JOIN user_projects up ON dr.project_id = up.project_id
        WHERE dr.id = daily_report_items.daily_report_id AND up.user_id = auth.uid()
    )
);

-- ============================================================================
-- CONTRACTS
-- ============================================================================

CREATE POLICY "contracts_select" ON contracts FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);
CREATE POLICY "contracts_insert" ON contracts FOR INSERT WITH CHECK (
    is_admin() OR has_project_role(project_id, 'owner') OR has_project_role(project_id, 'project_manager')
);
CREATE POLICY "contracts_update" ON contracts FOR UPDATE USING (
    is_admin() OR has_project_role(project_id, 'owner') OR has_project_role(project_id, 'finance')
);

-- Subcontracts: inherit from parent contract's project
CREATE POLICY "subcontracts_select" ON subcontracts FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM contracts c JOIN user_projects up ON c.project_id = up.project_id
        WHERE c.id = subcontracts.parent_contract_id AND up.user_id = auth.uid()
    )
);

-- Contract scope items
CREATE POLICY "scope_items_select" ON contract_scope_items FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM contracts c JOIN user_projects up ON c.project_id = up.project_id
        WHERE c.id = contract_scope_items.contract_id AND up.user_id = auth.uid()
    )
);
CREATE POLICY "scope_items_insert" ON contract_scope_items FOR INSERT WITH CHECK (
    is_admin() OR EXISTS (
        SELECT 1 FROM contracts c WHERE c.id = contract_scope_items.contract_id
        AND (has_project_role(c.project_id, 'owner') OR has_project_role(c.project_id, 'project_manager'))
    )
);

-- Contract variations
CREATE POLICY "variations_select" ON contract_variations FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM contracts c JOIN user_projects up ON c.project_id = up.project_id
        WHERE c.id = contract_variations.contract_id AND up.user_id = auth.uid()
    )
);

-- Contract invoices
CREATE POLICY "invoices_select" ON contract_invoices FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM contracts c JOIN user_projects up ON c.project_id = up.project_id
        WHERE c.id = contract_invoices.contract_id AND up.user_id = auth.uid()
    )
);
CREATE POLICY "invoices_insert" ON contract_invoices FOR INSERT WITH CHECK (
    is_admin() OR has_project_role(
        (SELECT project_id FROM contracts WHERE id = contract_invoices.contract_id), 'finance'
    )
);

CREATE POLICY "invoice_items_select" ON contract_invoice_items FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM contract_invoices ci
        JOIN contracts c ON c.id = ci.contract_id
        JOIN user_projects up ON up.project_id = c.project_id
        WHERE ci.id = contract_invoice_items.invoice_id AND up.user_id = auth.uid()
    )
);

-- ============================================================================
-- WORK EXECUTION & QUALITY (WIR/NCR)
-- ============================================================================

-- Work items
CREATE POLICY "work_items_select" ON work_items FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);

-- WBS
CREATE POLICY "wbs_select" ON work_breakdown_structure FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);

-- Work tasks
CREATE POLICY "work_tasks_select" ON work_tasks FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);
CREATE POLICY "work_tasks_insert" ON work_tasks FOR INSERT WITH CHECK (
    is_admin() OR has_project_role(project_id, 'project_manager')
);
CREATE POLICY "work_tasks_update" ON work_tasks FOR UPDATE USING (
    is_admin() OR assigned_to = auth.uid() OR has_project_role(project_id, 'project_manager')
);

-- Work Requests (WIR) - complex RLS as WIR is central
CREATE POLICY "wir_select" ON work_requests FOR SELECT USING (
    is_admin() OR
    has_project_access(project_id) OR
    requested_by = auth.uid() OR
    inspected_by = auth.uid()
);
CREATE POLICY "wir_insert" ON work_requests FOR INSERT WITH CHECK (
    is_admin() OR
    current_user_role() IN ('engineer','quality','main_contractor','subcontractor') OR
    has_project_role(project_id, 'engineer')
);
CREATE POLICY "wir_update" ON work_requests FOR UPDATE USING (
    is_admin() OR
    requested_by = auth.uid() OR
    inspected_by = auth.uid() OR
    has_project_role(project_id, 'quality')
);

CREATE POLICY "wir_lines_select" ON work_request_lines FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM work_requests wr
        JOIN user_projects up ON wr.project_id = up.project_id
        WHERE wr.id = work_request_lines.work_request_id AND up.user_id = auth.uid()
    )
);
CREATE POLICY "wir_lines_insert" ON work_request_lines FOR INSERT WITH CHECK (
    is_admin() OR EXISTS (
        SELECT 1 FROM work_requests wr
        WHERE wr.id = work_request_lines.work_request_id
        AND (wr.requested_by = auth.uid() OR has_project_role(wr.project_id, 'engineer'))
    )
);

-- Audit trail: all project users can view
CREATE POLICY "audit_select" ON audit_trail FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM user_projects up WHERE up.user_id = auth.uid()
    )
);
CREATE POLICY "audit_insert" ON audit_trail FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- HSE
-- ============================================================================

CREATE POLICY "hse_select" ON safety_incidents FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);
CREATE POLICY "hse_insert" ON safety_incidents FOR INSERT WITH CHECK (
    is_admin() OR has_project_role(project_id, 'hse') OR current_user_role() = 'hse'
);
CREATE POLICY "hse_update" ON safety_incidents FOR UPDATE USING (
    is_admin() OR has_project_role(project_id, 'hse')
);

CREATE POLICY "hse_obs_select" ON safety_observations FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);
CREATE POLICY "hse_obs_insert" ON safety_observations FOR INSERT WITH CHECK (
    is_admin() OR has_project_role(project_id, 'hse')
);

CREATE POLICY "toolbox_select" ON toolbox_talks FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);
CREATE POLICY "toolbox_insert" ON toolbox_talks FOR INSERT WITH CHECK (
    is_admin() OR has_project_role(project_id, 'hse')
);

CREATE POLICY "ppe_select" ON ppe_issuance FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);

CREATE POLICY "safety_audits_select" ON safety_audits FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);

-- ============================================================================
-- HR & PAYROLL
-- ============================================================================

-- Employees: HR and project managers see all project employees
CREATE POLICY "employees_select" ON employees FOR SELECT USING (
    is_admin() OR
    has_project_access(project_id) OR
    current_user_role() IN ('hr', 'finance')
);
CREATE POLICY "employees_insert" ON employees FOR INSERT WITH CHECK (
    is_admin() OR current_user_role() = 'hr'
);
CREATE POLICY "employees_update" ON employees FOR UPDATE USING (
    is_admin() OR current_user_role() = 'hr'
);

CREATE POLICY "labor_groups_select" ON labor_groups FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);
CREATE POLICY "labor_groups_insert" ON labor_groups FOR INSERT WITH CHECK (
    is_admin() OR current_user_role() = 'hr'
);

CREATE POLICY "attendance_select" ON attendance FOR SELECT USING (
    is_admin() OR
    current_user_role() IN ('hr', 'finance') OR
    EXISTS (SELECT 1 FROM employees e WHERE e.id = attendance.employee_id AND e.project_id IN (
        SELECT project_id FROM user_projects WHERE user_id = auth.uid()
    ))
);
CREATE POLICY "attendance_insert" ON attendance FOR INSERT WITH CHECK (
    is_admin() OR current_user_role() = 'hr'
);
CREATE POLICY "attendance_update" ON attendance FOR UPDATE USING (
    is_admin() OR current_user_role() = 'hr'
);

CREATE POLICY "payroll_select" ON payroll_runs FOR SELECT USING (
    is_admin() OR
    current_user_role() IN ('hr', 'finance') OR
    has_project_access(project_id)
);
CREATE POLICY "payroll_insert" ON payroll_runs FOR INSERT WITH CHECK (
    is_admin() OR current_user_role() IN ('hr', 'finance')
);

CREATE POLICY "payroll_details_select" ON payroll_details FOR SELECT USING (
    is_admin() OR current_user_role() IN ('hr', 'finance')
);

CREATE POLICY "payroll_settings_select" ON payroll_settings FOR SELECT USING (
    is_admin() OR current_user_role() IN ('hr', 'finance')
);

-- ============================================================================
-- PROCUREMENT & INVENTORY
-- ============================================================================

CREATE POLICY "suppliers_select" ON suppliers FOR SELECT USING (
    is_admin() OR EXISTS (SELECT 1 FROM user_projects up WHERE up.user_id = auth.uid())
);

CREATE POLICY "materials_select" ON materials_catalog FOR SELECT USING (
    auth.role() = 'authenticated'
);

CREATE POLICY "pr_select" ON purchase_requests FOR SELECT USING (
    is_admin() OR
    has_project_access(project_id) OR
    requested_by = auth.uid()
);
CREATE POLICY "pr_insert" ON purchase_requests FOR INSERT WITH CHECK (
    is_admin() OR has_project_role(project_id, 'project_manager') OR current_user_role() IN ('engineer','main_contractor')
);
CREATE POLICY "pr_update" ON purchase_requests FOR UPDATE USING (
    is_admin() OR requested_by = auth.uid() OR current_user_role() = 'finance'
);

CREATE POLICY "pr_items_select" ON purchase_request_items FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM purchase_requests pr JOIN user_projects up ON pr.project_id = up.project_id
        WHERE pr.id = purchase_request_items.purchase_request_id AND up.user_id = auth.uid()
    )
);

CREATE POLICY "po_select" ON purchase_orders FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);
CREATE POLICY "po_insert" ON purchase_orders FOR INSERT WITH CHECK (
    is_admin() OR current_user_role() IN ('finance','project_manager')
);
CREATE POLICY "po_update" ON purchase_orders FOR UPDATE USING (
    is_admin() OR current_user_role() = 'finance'
);

CREATE POLICY "po_items_select" ON purchase_order_items FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM purchase_orders po JOIN user_projects up ON po.project_id = up.project_id
        WHERE po.id = purchase_order_items.po_id AND up.user_id = auth.uid()
    )
);

CREATE POLICY "grn_select" ON goods_receipts FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);
CREATE POLICY "grn_insert" ON goods_receipts FOR INSERT WITH CHECK (
    is_admin() OR current_user_role() IN ('engineer','main_contractor')
);

CREATE POLICY "stocks_select" ON inventory_stocks FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);
CREATE POLICY "stocks_update" ON inventory_stocks FOR UPDATE USING (is_admin());

CREATE POLICY "material_issues_select" ON material_issues FOR SELECT USING (
    is_admin() OR has_project_access(project_id)
);

-- ============================================================================
-- SALES & CUSTOMERS
-- ============================================================================

CREATE POLICY "leads_select" ON leads FOR SELECT USING (
    is_admin() OR assigned_to = auth.uid() OR current_user_role() = 'sales'
);
CREATE POLICY "leads_insert" ON leads FOR INSERT WITH CHECK (
    is_admin() OR current_user_role() = 'sales'
);
CREATE POLICY "leads_update" ON leads FOR UPDATE USING (
    is_admin() OR assigned_to = auth.uid() OR current_user_role() = 'sales'
);

CREATE POLICY "customers_select" ON customers FOR SELECT USING (
    is_admin() OR current_user_role() IN ('sales','finance')
);
CREATE POLICY "customers_insert" ON customers FOR INSERT WITH CHECK (is_admin() OR current_user_role() = 'sales');

-- Unit sales: sales team + client
CREATE POLICY "unit_sales_select" ON unit_sales FOR SELECT USING (
    is_admin() OR
    current_user_role() IN ('sales','finance') OR
    has_project_access(project_id) OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'client')
);
CREATE POLICY "unit_sales_insert" ON unit_sales FOR INSERT WITH CHECK (
    is_admin() OR current_user_role() = 'sales'
);
CREATE POLICY "unit_sales_update" ON unit_sales FOR UPDATE USING (
    is_admin() OR current_user_role() = 'sales'
);

CREATE POLICY "payment_plans_select" ON payment_plans FOR SELECT USING (
    is_admin() OR current_user_role() IN ('sales','finance','client')
);

CREATE POLICY "collections_select" ON collections_schedule FOR SELECT USING (
    is_admin() OR current_user_role() IN ('sales','finance','client')
);
CREATE POLICY "collections_update" ON collections_schedule FOR UPDATE USING (
    is_admin() OR current_user_role() IN ('finance')
);

CREATE POLICY "handover_select" ON handover_records FOR SELECT USING (
    is_admin() OR has_project_access(
        (SELECT project_id FROM units WHERE id = handover_records.unit_id)
    )
);

-- ============================================================================
-- TECHNICAL OFFICE & RFIs
-- ============================================================================

CREATE POLICY "tech_tickets_select" ON technical_tickets FOR SELECT USING (
    is_admin() OR
    has_project_access(project_id) OR
    requested_by = auth.uid() OR
    assigned_to = auth.uid()
);
CREATE POLICY "tech_tickets_insert" ON technical_tickets FOR INSERT WITH CHECK (
    is_admin() OR has_project_role(project_id, 'engineer') OR has_project_role(project_id, 'project_manager')
);
CREATE POLICY "tech_tickets_update" ON technical_tickets FOR UPDATE USING (
    is_admin() OR assigned_to = auth.uid() OR requested_by = auth.uid()
);

CREATE POLICY "ticket_comments_select" ON ticket_comments FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM technical_tickets tt
        JOIN user_projects up ON tt.project_id = up.project_id
        WHERE tt.id = ticket_comments.ticket_id AND up.user_id = auth.uid()
    )
);
CREATE POLICY "ticket_comments_insert" ON ticket_comments FOR INSERT WITH CHECK (
    is_admin() OR EXISTS (
        SELECT 1 FROM technical_tickets tt
        WHERE tt.id = ticket_comments.ticket_id AND (
            tt.requested_by = auth.uid() OR tt.assigned_to = auth.uid()
        )
    )
);

CREATE POLICY "ticket_refs_select" ON ticket_references FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM technical_tickets tt
        JOIN user_projects up ON tt.project_id = up.project_id
        WHERE tt.id = ticket_references.ticket_id AND up.user_id = auth.uid()
    )
);

-- ============================================================================
-- APPROVALS
-- ============================================================================

CREATE POLICY "approval_requests_select" ON approval_requests FOR SELECT USING (
    is_admin() OR requested_by = auth.uid() OR EXISTS (
        SELECT 1 FROM approval_steps aps
        WHERE aps.approval_request_id = approval_requests.id
        AND (aps.step_user_id = auth.uid() OR aps.step_role = current_user_role())
    )
);
CREATE POLICY "approval_requests_insert" ON approval_requests FOR INSERT WITH CHECK (
    is_admin() OR auth.role() = 'authenticated'
);

CREATE POLICY "approval_steps_select" ON approval_steps FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM approval_requests ar
        WHERE ar.id = approval_steps.approval_request_id
        AND (ar.requested_by = auth.uid() OR approval_steps.step_user_id = auth.uid())
    )
);
CREATE POLICY "approval_steps_update" ON approval_steps FOR UPDATE USING (
    is_admin() OR step_user_id = auth.uid()
);

-- ============================================================================
-- DOCUMENTS
-- ============================================================================

CREATE POLICY "documents_select" ON documents FOR SELECT USING (
    is_admin() OR has_project_access(project_id) OR
    (confidentiality IN ('public', 'internal'))
);
CREATE POLICY "documents_insert" ON documents FOR INSERT WITH CHECK (
    is_admin() OR has_project_access(project_id)
);
CREATE POLICY "documents_update" ON documents FOR UPDATE USING (
    is_admin() OR uploaded_by = auth.uid()
);

CREATE POLICY "doc_versions_select" ON document_versions FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM documents d
        JOIN user_projects up ON d.project_id = up.project_id
        WHERE d.id = document_versions.document_id AND up.user_id = auth.uid()
    )
);
CREATE POLICY "doc_versions_insert" ON document_versions FOR INSERT WITH CHECK (
    is_admin() OR EXISTS (
        SELECT 1 FROM documents d
        WHERE d.id = document_versions.document_id AND d.uploaded_by = auth.uid()
    )
);

CREATE POLICY "doc_refs_select" ON document_references FOR SELECT USING (
    is_admin() OR EXISTS (
        SELECT 1 FROM documents d
        JOIN user_projects up ON d.project_id = up.project_id
        WHERE d.id = document_references.document_id AND up.user_id = auth.uid()
    )
);

-- ============================================================================
-- ACTIVITY LOG
-- ============================================================================

CREATE POLICY "activity_log_select" ON activity_log FOR SELECT USING (is_admin());
CREATE POLICY "activity_log_insert" ON activity_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');

