-- ============================================================================
-- HR & PAYROLL
-- ============================================================================

-- 41. EMPLOYEES
CREATE TABLE employees (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id),
    company_id      UUID REFERENCES companies(id),
    employee_code   TEXT NOT NULL,
    full_name_en    TEXT NOT NULL,
    full_name_ar    TEXT,
    national_id     TEXT,
    passport_no     TEXT,
    nationality     TEXT,
    phone           TEXT,
    email           TEXT,
    job_title       TEXT,
    department      TEXT,
    employee_type   TEXT NOT NULL CHECK (employee_type IN ('staff','labor','supervisor','engineer','manager','admin','other')),
    labor_group_id  UUID,
    hire_date       DATE NOT NULL,
    contract_end    DATE,
    basic_salary    DECIMAL(15,2) DEFAULT 0,
    allowances      DECIMAL(15,2) DEFAULT 0,
    bank_account    TEXT,
    insurance_no    TEXT,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','terminated','on_leave')),
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(employee_code)
);
CREATE INDEX idx_employees_project ON employees(project_id);
CREATE INDEX idx_employees_company ON employees(company_id);
CREATE INDEX idx_employees_status ON employees(status);

-- 42. LABOR GROUPS
CREATE TABLE labor_groups (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    group_code      TEXT NOT NULL,
    name_en         TEXT NOT NULL,
    name_ar         TEXT,
    contractor_id   UUID REFERENCES contractors(id),
    supervisor_name TEXT,
    headcount       INT DEFAULT 0,
    UNIQUE(project_id, group_code)
);

-- Update employees FK after labor_groups exists
ALTER TABLE employees ADD CONSTRAINT fk_employee_labor_group
    FOREIGN KEY (labor_group_id) REFERENCES labor_groups(id);

-- 43. ATTENDANCE
CREATE TABLE attendance (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    clock_in        TIME,
    clock_out       TIME,
    hours_worked    DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN clock_in IS NOT NULL AND clock_out IS NOT NULL
             THEN EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600
             ELSE 0
        END
    ) STORED,
    status          TEXT NOT NULL CHECK (status IN ('present','absent','late','half_day','holiday','weekend')),
    absent_reason   TEXT,
    overtime_hours  DECIMAL(5,2) DEFAULT 0,
    approved_by     UUID REFERENCES user_profiles(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(employee_id, attendance_date)
);
CREATE INDEX idx_attendance_employee ON attendance(employee_id, attendance_date);
CREATE INDEX idx_attendance_date ON attendance(attendance_date);

-- 44. SHIFTS
CREATE TABLE shifts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    shift_code      TEXT NOT NULL,
    name_en         TEXT NOT NULL,
    name_ar         TEXT,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    grace_minutes   INT DEFAULT 0,
    UNIQUE(project_id, shift_code)
);

-- 45. PAYROLL RUNS
CREATE TABLE payroll_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    run_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','calculated','approved','paid','cancelled')),
    total_salaries  DECIMAL(20,2) DEFAULT 0,
    total_deductions DECIMAL(20,2) DEFAULT 0,
    total_allowances DECIMAL(20,2) DEFAULT 0,
    net_total       DECIMAL(20,2) DEFAULT 0,
    approved_by     UUID REFERENCES user_profiles(id),
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payroll_project ON payroll_runs(project_id);

-- 46. PAYROLL DETAILS
CREATE TABLE payroll_details (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_run_id  UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id     UUID NOT NULL REFERENCES employees(id),
    basic_salary    DECIMAL(15,2) DEFAULT 0,
    allowances      DECIMAL(15,2) DEFAULT 0,
    overtime_amount DECIMAL(15,2) DEFAULT 0,
    deductions      DECIMAL(15,2) DEFAULT 0,
    bonuses         DECIMAL(15,2) DEFAULT 0,
    net_salary      DECIMAL(15,2) GENERATED ALWAYS AS (basic_salary + allowances + overtime_amount + bonuses - deductions) STORED,
    work_days       INT DEFAULT 0,
    absent_days     INT DEFAULT 0,
    notes           TEXT,
    UNIQUE(payroll_run_id, employee_id)
);

-- 47. PAYROLL SETTINGS
CREATE TABLE payroll_settings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key             TEXT NOT NULL,
    value           JSONB NOT NULL,
    UNIQUE(project_id, key)
);

-- ============================================================================
-- PROCUREMENT & INVENTORY
-- ============================================================================

-- 48. SUPPLIERS
CREATE TABLE suppliers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID REFERENCES companies(id),
    supplier_code   TEXT NOT NULL UNIQUE,
    name_en         TEXT NOT NULL,
    name_ar         TEXT,
    contact_person  TEXT,
    phone           TEXT,
    email           TEXT,
    payment_terms   TEXT,
    lead_time_days  INT,
    is_approved     BOOLEAN DEFAULT false,
    rating          DECIMAL(3,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 49. MATERIALS CATALOG
CREATE TABLE materials_catalog (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_code   TEXT NOT NULL UNIQUE,
    name_en         TEXT NOT NULL,
    name_ar         TEXT,
    category        TEXT,
    unit_of_measure TEXT DEFAULT 'each',
    unit_price      DECIMAL(15,2) DEFAULT 0,
    currency        TEXT DEFAULT 'SAR',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 50. PURCHASE REQUESTS (PR)
CREATE TABLE purchase_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    pr_no           TEXT NOT NULL,
    title           TEXT NOT NULL,
    requested_by    UUID NOT NULL REFERENCES user_profiles(id),
    request_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    required_date   DATE,
    status          TEXT NOT NULL DEFAULT 'draft',
    approved_by     UUID REFERENCES user_profiles(id),
    approved_at     TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, pr_no)
);
CREATE INDEX idx_pr_project ON purchase_requests(project_id);
CREATE INDEX idx_pr_status ON purchase_requests(status);

-- 51. PURCHASE REQUEST ITEMS
CREATE TABLE purchase_request_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    material_id     UUID REFERENCES materials_catalog(id),
    item_description TEXT NOT NULL,
    quantity        DECIMAL(15,2) NOT NULL,
    unit_of_measure TEXT DEFAULT 'each',
    estimated_price DECIMAL(15,2),
    notes           TEXT
);

-- 52. PURCHASE ORDERS (PO)
CREATE TABLE purchase_orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    pr_id           UUID REFERENCES purchase_requests(id),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    po_no           TEXT NOT NULL,
    title           TEXT NOT NULL,
    order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date   DATE,
    total_amount    DECIMAL(20,2) DEFAULT 0,
    tax_amount      DECIMAL(20,2) DEFAULT 0,
    grand_total     DECIMAL(20,2) DEFAULT 0,
    currency         TEXT DEFAULT 'SAR',
    status          TEXT NOT NULL DEFAULT 'draft',
    approved_by     UUID REFERENCES user_profiles(id),
    approved_at     TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, po_no)
);
CREATE INDEX idx_po_project ON purchase_orders(project_id);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_status ON purchase_orders(status);

-- 53. PURCHASE ORDER ITEMS
CREATE TABLE purchase_order_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_id           UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    material_id     UUID REFERENCES materials_catalog(id),
    item_description TEXT NOT NULL,
    quantity        DECIMAL(15,2) NOT NULL,
    unit_price      DECIMAL(15,2) NOT NULL,
    total_price     DECIMAL(20,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    received_qty    DECIMAL(15,2) DEFAULT 0,
    notes           TEXT
);

-- 54. GOODS RECEIPTS (GRN)
CREATE TABLE goods_receipts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    po_id           UUID NOT NULL REFERENCES purchase_orders(id),
    grn_no          TEXT NOT NULL,
    receipt_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    received_by     UUID NOT NULL REFERENCES user_profiles(id),
    delivery_note   TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, grn_no)
);

-- 55. GOODS RECEIPT ITEMS
CREATE TABLE goods_receipt_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    po_item_id      UUID NOT NULL REFERENCES purchase_order_items(id),
    quantity_received DECIMAL(15,2) NOT NULL,
    quantity_accepted DECIMAL(15,2),
    quantity_rejected DECIMAL(15,2) DEFAULT 0,
    rejection_reason TEXT,
    batch_no        TEXT,
    expiry_date     DATE
);

-- 56. INVENTORY STOCKS
CREATE TABLE inventory_stocks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    material_id     UUID NOT NULL REFERENCES materials_catalog(id),
    warehouse       TEXT DEFAULT 'main',
    quantity        DECIMAL(15,2) NOT NULL DEFAULT 0,
    reserved_qty    DECIMAL(15,2) DEFAULT 0,
    min_stock_level DECIMAL(15,2) DEFAULT 0,
    unit_of_measure TEXT DEFAULT 'each',
    last_updated    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, material_id, warehouse)
);
CREATE INDEX idx_stocks_material ON inventory_stocks(material_id);

-- 57. MATERIAL ISSUES
CREATE TABLE material_issues (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    issue_no        TEXT NOT NULL,
    issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    issued_to       UUID REFERENCES user_profiles(id),
    unit_id         UUID REFERENCES units(id),
    task_id         UUID REFERENCES work_tasks(id),
    status          TEXT NOT NULL DEFAULT 'draft',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, issue_no)
);

-- 58. MATERIAL ISSUE ITEMS
CREATE TABLE material_issue_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_issue_id UUID NOT NULL REFERENCES material_issues(id) ON DELETE CASCADE,
    material_id     UUID NOT NULL REFERENCES materials_catalog(id),
    quantity        DECIMAL(15,2) NOT NULL,
    unit_of_measure TEXT DEFAULT 'each',
    notes           TEXT
);

-- ============================================================================
-- SALES & CUSTOMERS
-- ============================================================================

-- 59. LEADS
CREATE TABLE leads (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id),
    lead_source     TEXT CHECK (lead_source IN ('website','referral','agent','walk_in','social_media','phone','other')),
    full_name       TEXT NOT NULL,
    phone           TEXT,
    email           TEXT,
    preferred_unit_type TEXT,
    budget_range    TEXT,
    notes           TEXT,
    status          TEXT NOT NULL DEFAULT 'new',
    assigned_to     UUID REFERENCES user_profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_status ON leads(status);

-- 60. CUSTOMERS
CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID REFERENCES companies(id),
    customer_code   TEXT NOT NULL UNIQUE,
    full_name_en    TEXT NOT NULL,
    full_name_ar    TEXT,
    phone           TEXT,
    email           TEXT,
    national_id     TEXT,
    address         TEXT,
    customer_type   TEXT CHECK (customer_type IN ('individual','company','investor','government')),
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 61. UNIT SALES
CREATE TABLE unit_sales (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id         UUID NOT NULL REFERENCES units(id),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    project_id      UUID NOT NULL REFERENCES projects(id),
    sale_date       DATE NOT NULL,
    sale_price      DECIMAL(20,2) NOT NULL,
    currency        TEXT DEFAULT 'SAR',
    payment_method  TEXT,
    status          TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN (
                        'reserved','under_contract','completed','cancelled'
                    )),
    contract_no     TEXT,
    handover_date   DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(unit_id)
);
CREATE INDEX idx_sales_unit ON unit_sales(unit_id);
CREATE INDEX idx_sales_customer ON unit_sales(customer_id);

-- 62. PAYMENT PLANS
CREATE TABLE payment_plans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_sale_id    UUID NOT NULL REFERENCES unit_sales(id) ON DELETE CASCADE,
    plan_name_en    TEXT NOT NULL,
    plan_name_ar    TEXT,
    down_payment_pct DECIMAL(5,2) DEFAULT 0,
    down_payment_amount DECIMAL(20,2) DEFAULT 0,
    installments_count INT DEFAULT 0,
    total_amount    DECIMAL(20,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 63. COLLECTIONS SCHEDULE
CREATE TABLE collections_schedule (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_sale_id    UUID NOT NULL REFERENCES unit_sales(id) ON DELETE CASCADE,
    payment_plan_id UUID REFERENCES payment_plans(id),
    installment_no  INT NOT NULL,
    due_date        DATE NOT NULL,
    amount          DECIMAL(20,2) NOT NULL,
    paid_amount     DECIMAL(20,2) DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','waived')),
    payment_date    DATE,
    payment_method  TEXT,
    notes           TEXT,
    UNIQUE(unit_sale_id, installment_no)
);
CREATE INDEX idx_collections_sale ON collections_schedule(unit_sale_id);
CREATE INDEX idx_collections_status ON collections_schedule(status);

-- 64. HANDOVER RECORDS
CREATE TABLE handover_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_sale_id    UUID NOT NULL REFERENCES unit_sales(id) ON DELETE CASCADE,
    unit_id         UUID NOT NULL REFERENCES units(id),
    handover_date   DATE NOT NULL,
    handover_type   TEXT CHECK (handover_type IN ('temporary','final')),
    status          TEXT NOT NULL DEFAULT 'pending',
    defects_list    TEXT,
    customer_notes  TEXT,
    handover_by     UUID REFERENCES user_profiles(id),
    attachment_url  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- TECHNICAL OFFICE & RFIs
-- ============================================================================

-- 65. TECHNICAL TICKETS (RFI, Design Query, ShopDrawing Review, etc.)
CREATE TABLE technical_tickets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    ticket_no       TEXT NOT NULL,
    ticket_type     TEXT NOT NULL CHECK (ticket_type IN (
                        'rfi','design_query','shop_drawing_review',
                        'method_statement_review','submittal_review',
                        'site_instruction','technical_query','other'
                    )),
    title_en        TEXT NOT NULL,
    title_ar        TEXT,
    description     TEXT NOT NULL,
    priority        TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
    status          TEXT NOT NULL DEFAULT 'open',
    requested_by    UUID NOT NULL REFERENCES user_profiles(id),
    assigned_to     UUID REFERENCES user_profiles(id),
    due_date        DATE,
    closed_date     DATE,
    response        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, ticket_no)
);
CREATE INDEX idx_tech_tickets_project ON technical_tickets(project_id);
CREATE INDEX idx_tech_tickets_type ON technical_tickets(ticket_type);
CREATE INDEX idx_tech_tickets_status ON technical_tickets(status);
CREATE INDEX idx_tech_tickets_assigned ON technical_tickets(assigned_to);

-- 66. TICKET COMMENTS
CREATE TABLE ticket_comments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id       UUID NOT NULL REFERENCES technical_tickets(id) ON DELETE CASCADE,
    comment_text    TEXT NOT NULL,
    created_by      UUID NOT NULL REFERENCES user_profiles(id),
    attachment_url  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 67. TICKET REFERENCES (polymorphic links to other records)
CREATE TABLE ticket_references (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id       UUID NOT NULL REFERENCES technical_tickets(id) ON DELETE CASCADE,
    ref_module_code TEXT NOT NULL,
    ref_record_id   UUID NOT NULL,
    ref_description TEXT,
    UNIQUE(ticket_id, ref_module_code, ref_record_id)
);
CREATE INDEX idx_ticket_refs ON ticket_references(ticket_id);

-- ============================================================================
-- APPROVALS (Generic Admin/Workflow Approvals)
-- ============================================================================

-- 68. APPROVAL REQUESTS
CREATE TABLE approval_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_code     TEXT NOT NULL,
    record_id       UUID NOT NULL,
    title_en        TEXT NOT NULL,
    title_ar        TEXT,
    description     TEXT,
    current_step    INT DEFAULT 1,
    total_steps     INT DEFAULT 1,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','approved','rejected','cancelled')),
    requested_by    UUID NOT NULL REFERENCES user_profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_approval_record ON approval_requests(module_code, record_id);
CREATE INDEX idx_approval_status ON approval_requests(status);

-- 69. APPROVAL STEPS
CREATE TABLE approval_steps (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    step_order      INT NOT NULL,
    step_role       TEXT NOT NULL,
    step_user_id    UUID REFERENCES user_profiles(id),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','skipped')),
    comment         TEXT,
    decided_at      TIMESTAMPTZ,
    decided_by      UUID REFERENCES user_profiles(id),
    UNIQUE(approval_request_id, step_order)
);

-- ============================================================================
-- DOCUMENTS & DRAWINGS
-- ============================================================================

-- 70. DOCUMENTS
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    doc_code        TEXT NOT NULL,
    title_en        TEXT NOT NULL,
    title_ar        TEXT,
    doc_type        TEXT NOT NULL CHECK (doc_type IN (
                        'drawing','contract','specification','report',
                        'method_statement','submittal','permit',
                        'correspondence','invoice','photo','other'
                    )),
    category        TEXT,
    description     TEXT,
    file_url        TEXT,
    file_size       BIGINT,
    file_type       TEXT,
    revision        TEXT DEFAULT 'A',
    status          TEXT DEFAULT 'current' CHECK (status IN ('current','obsolete','under_review','draft')),
    confidentiality TEXT DEFAULT 'internal' CHECK (confidentiality IN ('public','internal','confidential','restricted')),
    uploaded_by     UUID NOT NULL REFERENCES user_profiles(id),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, doc_code, revision)
);
CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_documents_type ON documents(doc_type);

-- 71. DOCUMENT VERSIONS
CREATE TABLE document_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_no      TEXT NOT NULL,
    file_url        TEXT NOT NULL,
    file_size       BIGINT,
    change_notes    TEXT,
    uploaded_by     UUID NOT NULL REFERENCES user_profiles(id),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(document_id, version_no)
);

-- 72. DOCUMENT REFERENCES (link documents to any record)
CREATE TABLE document_references (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    ref_module_code TEXT NOT NULL,
    ref_record_id   UUID NOT NULL,
    ref_description TEXT,
    UNIQUE(document_id, ref_module_code, ref_record_id)
);
CREATE INDEX idx_doc_refs ON document_references(ref_module_code, ref_record_id);

-- ============================================================================
-- SYSTEM AUDIT & SEED DATA
-- ============================================================================

-- 73. SYSTEM ACTIVITY LOG
CREATE TABLE activity_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES user_profiles(id),
    action          TEXT NOT NULL,
    module_code     TEXT,
    record_id       UUID,
    metadata        JSONB,
    ip_address      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_user ON activity_log(user_id, created_at);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Additional cross-cutting indexes
CREATE INDEX idx_custom_fields_module ON custom_fields(module_code);
CREATE INDEX idx_status_def_module ON status_definitions(module_code);
CREATE INDEX idx_workflow_def_module ON workflow_definitions(module_code);
CREATE INDEX idx_workflow_steps_workflow ON workflow_steps(workflow_id);
CREATE INDEX idx_audit_trail_created ON audit_trail(created_at DESC);
CREATE INDEX idx_daily_report_items_report ON daily_report_items(daily_report_id);
CREATE INDEX idx_toolbox_talks_project ON toolbox_talks(project_id, talk_date);
CREATE INDEX idx_safety_observations_project ON safety_observations(project_id);
CREATE INDEX idx_safety_audits_project ON safety_audits(project_id);

-- Full-text search support
CREATE INDEX idx_projects_name_search ON projects USING gin(to_tsvector('simple', name_en || ' ' || coalesce(name_ar, '')));
CREATE INDEX idx_employees_name_search ON employees USING gin(to_tsvector('simple', full_name_en || ' ' || coalesce(full_name_ar, '')));
