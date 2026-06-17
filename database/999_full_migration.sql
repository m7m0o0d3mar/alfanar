-- ============================================================================
-- CONSTRUCTION ERP - SUPABASE COMPLETE SCHEMA
-- ============================================================================
-- Part 1: CORE DYNAMIC TABLES (System Designer Foundation)
-- ============================================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. SYSTEM SETTINGS (key-value store for app-wide config)
CREATE TABLE system_settings (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. MODULES
CREATE TABLE modules (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        TEXT NOT NULL UNIQUE,
    name_en     TEXT NOT NULL,
    name_ar     TEXT NOT NULL,
    icon        TEXT DEFAULT 'folder',
    is_enabled  BOOLEAN NOT NULL DEFAULT true,
    "order"     INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. MODULE SETTINGS
CREATE TABLE module_settings (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_code TEXT NOT NULL REFERENCES modules(code) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    value       JSONB NOT NULL DEFAULT '{}',
    UNIQUE(module_code, key)
);

-- 4. STATUS DEFINITIONS (per module)
CREATE TABLE status_definitions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_code TEXT NOT NULL REFERENCES modules(code) ON DELETE CASCADE,
    status_code TEXT NOT NULL,
    label_en    TEXT NOT NULL,
    label_ar    TEXT NOT NULL,
    color       TEXT DEFAULT '#6b7280',
    icon        TEXT,
    "order"     INT NOT NULL DEFAULT 0,
    is_default  BOOLEAN NOT NULL DEFAULT false,
    is_final    BOOLEAN NOT NULL DEFAULT false,
    is_cancelled BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(module_code, status_code)
);

-- 5. WORKFLOW DEFINITIONS
CREATE TABLE workflow_definitions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_code TEXT NOT NULL REFERENCES modules(code) ON DELETE CASCADE,
    name_en     TEXT NOT NULL,
    name_ar     TEXT NOT NULL,
    is_default  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. WORKFLOW STEPS
CREATE TABLE workflow_steps (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id     UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    step_order      INT NOT NULL,
    from_status_code TEXT NOT NULL,
    to_status_code   TEXT NOT NULL,
    allowed_roles   TEXT[] NOT NULL DEFAULT '{}',
    action_label_en TEXT NOT NULL,
    action_label_ar TEXT NOT NULL,
    require_attachment BOOLEAN NOT NULL DEFAULT false,
    require_comment    BOOLEAN NOT NULL DEFAULT false,
    notify_roles       TEXT[] DEFAULT '{}',
    UNIQUE(workflow_id, step_order)
);

-- 7. CUSTOM FIELDS (per module)
CREATE TABLE custom_fields (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_code TEXT NOT NULL REFERENCES modules(code) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    label_en    TEXT NOT NULL,
    label_ar    TEXT NOT NULL,
    field_type  TEXT NOT NULL CHECK (field_type IN ('text','number','date','enum','lookup','boolean','textarea','json')),
    enum_values JSONB,
    lookup_module TEXT,
    is_required BOOLEAN NOT NULL DEFAULT false,
    is_visible  BOOLEAN NOT NULL DEFAULT true,
    "order"     INT NOT NULL DEFAULT 0,
    UNIQUE(module_code, name)
);

-- 8. CUSTOM FIELD VALUES (polymorphic)
CREATE TABLE custom_field_values (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_code TEXT NOT NULL REFERENCES modules(code) ON DELETE CASCADE,
    field_id    UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
    record_id   UUID NOT NULL,
    value       JSONB NOT NULL,
    UNIQUE(field_id, record_id)
);
CREATE INDEX idx_cfv_record ON custom_field_values(module_code, record_id);

-- 9. KPI DEFINITIONS
CREATE TABLE kpi_definitions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_code TEXT NOT NULL REFERENCES modules(code) ON DELETE CASCADE,
    code        TEXT NOT NULL,
    name_en     TEXT NOT NULL,
    name_ar     TEXT NOT NULL,
    formula_type TEXT NOT NULL CHECK (formula_type IN ('count','sum','ratio','avg_duration','custom')),
    config_json  JSONB NOT NULL DEFAULT '{}',
    unit         TEXT DEFAULT 'count',
    target_value DECIMAL(20,2),
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(module_code, code)
);

-- 10. KPI LOGS (historical snapshots)
CREATE TABLE kpi_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kpi_id      UUID NOT NULL REFERENCES kpi_definitions(id) ON DELETE CASCADE,
    value       DECIMAL(20,2) NOT NULL,
    period      DATE NOT NULL,
    context_id  UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kpi_log_period ON kpi_logs(kpi_id, period);

-- ============================================================================
-- USERS & AUTH (extends Supabase auth.users)
-- ============================================================================

-- 11. USER PROFILES
CREATE TABLE user_profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           TEXT,
    full_name_en    TEXT NOT NULL,
    full_name_ar    TEXT,
    phone           TEXT,
    avatar_url      TEXT,
    role            TEXT NOT NULL CHECK (role IN (
                        'admin','developer','main_contractor','subcontractor',
                        'engineer','quality','hse','hr','finance',
                        'consultant','client','sales','project_manager'
                    )),
    default_language TEXT NOT NULL DEFAULT 'ar' CHECK (default_language IN ('ar','en')),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- 12. USER PROJECTS (user-project role assignments)
CREATE TABLE user_projects (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    project_id  UUID NOT NULL,
    project_role TEXT NOT NULL CHECK (project_role IN (
                    'owner','main_contractor','subcontractor',
                    'consultant','engineer','quality','hse',
                    'hr','finance','sales','client','project_manager'
                )),
    UNIQUE(user_id, project_id, project_role)
);
CREATE INDEX idx_user_projects_user ON user_projects(user_id);
CREATE INDEX idx_user_projects_project ON user_projects(project_id);
-- ============================================================================
-- BUSINESS MODULES
-- ============================================================================

-- 13. COMPANIES (universal: developer, contractors, suppliers, consultants)
CREATE TABLE companies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_type    TEXT NOT NULL CHECK (company_type IN (
                        'developer','main_contractor','subcontractor',
                        'supplier','consultant','client','other'
                    )),
    name_en         TEXT NOT NULL,
    name_ar         TEXT,
    tax_id          TEXT,
    commercial_reg  TEXT,
    phone           TEXT,
    email           TEXT,
    website         TEXT,
    address         TEXT,
    logo_url        TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_companies_type ON companies(company_type);

-- 14. CONTRACTORS (extends companies for main/sub contractor relations)
CREATE TABLE contractors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contractor_type TEXT NOT NULL CHECK (contractor_type IN ('main','sub')),
    parent_contractor_id UUID REFERENCES contractors(id),
    license_number  TEXT,
    classification  TEXT,
    is_approved     BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(company_id, contractor_type)
);

-- 15. PROJECTS
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_code    TEXT NOT NULL UNIQUE,
    name_en         TEXT NOT NULL,
    name_ar         TEXT,
    description     TEXT,
    company_id      UUID REFERENCES companies(id),
    project_type    TEXT NOT NULL CHECK (project_type IN (
                        'residential','commercial','industrial',
                        'infrastructure','mixed_use','government'
                    )),
    status          TEXT NOT NULL DEFAULT 'planning',
    start_date      DATE,
    end_date        DATE,
    actual_end_date DATE,
    location        TEXT,
    latitude        DECIMAL(10,8),
    longitude       DECIMAL(11,8),
    total_area      DECIMAL(20,2),
    built_up_area   DECIMAL(20,2),
    budget_amount   DECIMAL(20,2),
    currency        TEXT DEFAULT 'SAR',
    progress_percent DECIMAL(5,2) DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_company ON projects(company_id);

-- 16. PROJECT PHASES
CREATE TABLE project_phases (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase_code      TEXT NOT NULL,
    name_en         TEXT NOT NULL,
    name_ar         TEXT,
    description     TEXT,
    start_date      DATE,
    end_date        DATE,
    budget          DECIMAL(20,2),
    progress_percent DECIMAL(5,2) DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending',
    "order"         INT NOT NULL DEFAULT 0,
    UNIQUE(project_id, phase_code)
);
CREATE INDEX idx_phases_project ON project_phases(project_id);

-- 17. PROJECT STAKEHOLDERS
CREATE TABLE project_stakeholders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN (
                        'owner','main_contractor','subcontractor',
                        'consultant','designer','supplier'
                    )),
    contract_value  DECIMAL(20,2),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(project_id, company_id, role)
);
CREATE INDEX idx_stakeholders_project ON project_stakeholders(project_id);

-- 18. BLOCKS / BUILDINGS
CREATE TABLE blocks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    block_code      TEXT NOT NULL,
    name_en         TEXT NOT NULL,
    name_ar         TEXT,
    block_type      TEXT CHECK (block_type IN ('building','villa','tower','wing','phase')),
    floor_count     INT,
    total_units     INT DEFAULT 0,
    progress_percent DECIMAL(5,2) DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'planning',
    UNIQUE(project_id, block_code)
);
CREATE INDEX idx_blocks_project ON blocks(project_id);

-- 19. UNITS
CREATE TABLE units (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    block_id        UUID REFERENCES blocks(id) ON DELETE SET NULL,
    unit_code       TEXT NOT NULL,
    unit_type       TEXT NOT NULL CHECK (unit_type IN (
                        'apartment','villa','office','shop','warehouse',
                        'penthouse','duplex','studio','plot','floor'
                    )),
    floor_number    INT,
    area_sqm        DECIMAL(10,2),
    area_built      DECIMAL(10,2),
    bedrooms        INT DEFAULT 0,
    bathrooms       INT DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'available',
    price           DECIMAL(20,2),
    currency         TEXT DEFAULT 'SAR',
    handover_date   DATE,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, unit_code)
);
CREATE INDEX idx_units_project ON units(project_id);
CREATE INDEX idx_units_block ON units(block_id);
CREATE INDEX idx_units_status ON units(status);

-- 20. UNIT PROGRESS (milestone-based progress tracking)
CREATE TABLE unit_progress (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id         UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    milestone_code  TEXT NOT NULL,
    milestone_name_en TEXT NOT NULL,
    milestone_name_ar TEXT,
    weight_percent  DECIMAL(5,2) NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending',
    achieved_date   DATE,
    notes           TEXT,
    UNIQUE(unit_id, milestone_code)
);
CREATE INDEX idx_unit_progress_unit ON unit_progress(unit_id);

-- 21. ITEM PROGRESS (fine-grained item tracking within unit milestones)
CREATE TABLE item_progress (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_progress_id UUID NOT NULL REFERENCES unit_progress(id) ON DELETE CASCADE,
    item_name_en    TEXT NOT NULL,
    item_name_ar    TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    weight_percent  DECIMAL(5,2) DEFAULT 0,
    achieved_date   DATE,
    notes           TEXT
);

-- 22. DAILY REPORTS
CREATE TABLE daily_reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    report_date     DATE NOT NULL,
    title           TEXT,
    weather         TEXT,
    temperature     TEXT,
    labor_count     INT DEFAULT 0,
    equipment_count INT DEFAULT 0,
    summary         TEXT,
    created_by      UUID NOT NULL REFERENCES user_profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, report_date)
);
CREATE INDEX idx_daily_reports_project ON daily_reports(project_id, report_date);

-- 23. DAILY REPORT ITEMS
CREATE TABLE daily_report_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    description     TEXT NOT NULL,
    category        TEXT CHECK (category IN ('work_done','issues','materials','safety','quality','other')),
    status          TEXT,
    notes           TEXT
);
-- ============================================================================
-- CONTRACTS & CONTRACTORS
-- ============================================================================

-- 24. CONTRACTS (main contracts with developer)
CREATE TABLE contracts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contract_no     TEXT NOT NULL,
    contractor_id   UUID NOT NULL REFERENCES contractors(id),
    contract_type   TEXT NOT NULL CHECK (contract_type IN (
                        'lump_sum','unit_price','cost_plus','time_material','other'
                    )),
    title_en        TEXT NOT NULL,
    title_ar        TEXT,
    signing_date    DATE,
    start_date      DATE,
    end_date        DATE,
    contract_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
    variations_total DECIMAL(20,2) DEFAULT 0,
    currency        TEXT DEFAULT 'SAR',
    status          TEXT NOT NULL DEFAULT 'draft',
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, contract_no)
);
CREATE INDEX idx_contracts_project ON contracts(project_id);
CREATE INDEX idx_contracts_contractor ON contracts(contractor_id);

-- 25. SUBCONTRACTS
CREATE TABLE subcontracts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    subcontractor_id   UUID NOT NULL REFERENCES contractors(id),
    subcontract_no  TEXT NOT NULL,
    title_en        TEXT NOT NULL,
    title_ar        TEXT,
    amount          DECIMAL(20,2) NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'draft',
    signing_date    DATE,
    start_date      DATE,
    end_date        DATE,
    UNIQUE(parent_contract_id, subcontract_no)
);
CREATE INDEX idx_subcontracts_parent ON subcontracts(parent_contract_id);

-- 26. CONTRACT SCOPE ITEMS (BOQ / Work Breakdown)
CREATE TABLE contract_scope_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id     UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    item_code       TEXT NOT NULL,
    parent_item_id  UUID REFERENCES contract_scope_items(id),
    description_en  TEXT NOT NULL,
    description_ar  TEXT,
    unit_of_measure TEXT DEFAULT 'each',
    quantity        DECIMAL(20,2) NOT NULL DEFAULT 1,
    unit_price      DECIMAL(20,2) NOT NULL DEFAULT 0,
    total_price     DECIMAL(20,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    executed_qty    DECIMAL(20,2) DEFAULT 0,
    status          TEXT DEFAULT 'active',
    "order"         INT DEFAULT 0,
    UNIQUE(contract_id, item_code)
);
CREATE INDEX idx_scope_contract ON contract_scope_items(contract_id);

-- 27. CONTRACT VARIATIONS / CHANGE ORDERS
CREATE TABLE contract_variations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id     UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    variation_no    TEXT NOT NULL,
    title_en        TEXT NOT NULL,
    title_ar        TEXT,
    description     TEXT,
    variation_type  TEXT NOT NULL CHECK (variation_type IN ('addition','deduction','omission','other')),
    amount          DECIMAL(20,2) NOT NULL DEFAULT 0,
    reason          TEXT,
    status          TEXT NOT NULL DEFAULT 'draft',
    approved_by     UUID REFERENCES user_profiles(id),
    approved_at     TIMESTAMPTZ,
    created_by      UUID REFERENCES user_profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(contract_id, variation_no)
);

-- 28. CONTRACT INVOICES (payment certificates / invoices)
CREATE TABLE contract_invoices (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id     UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    subcontract_id  UUID REFERENCES subcontracts(id),
    invoice_no      TEXT NOT NULL,
    invoice_type    TEXT NOT NULL CHECK (invoice_type IN ('progress','advance','final','retention','other')),
    invoice_date    DATE NOT NULL,
    amount          DECIMAL(20,2) NOT NULL DEFAULT 0,
    retention_pct   DECIMAL(5,2) DEFAULT 10,
    retention_amount DECIMAL(20,2) DEFAULT 0,
    net_amount      DECIMAL(20,2) GENERATED ALWAYS AS (amount - retention_amount) STORED,
    status          TEXT NOT NULL DEFAULT 'draft',
    due_date        DATE,
    paid_date       DATE,
    paid_amount     DECIMAL(20,2) DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(contract_id, invoice_no)
);
CREATE INDEX idx_invoices_contract ON contract_invoices(contract_id);

-- 29. CONTRACT INVOICE ITEMS (links to scope items)
CREATE TABLE contract_invoice_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id      UUID NOT NULL REFERENCES contract_invoices(id) ON DELETE CASCADE,
    scope_item_id   UUID NOT NULL REFERENCES contract_scope_items(id),
    quantity        DECIMAL(20,2) NOT NULL DEFAULT 0,
    unit_price      DECIMAL(20,2) NOT NULL DEFAULT 0,
    total_amount    DECIMAL(20,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    notes           TEXT
);

-- ============================================================================
-- WORK EXECUTION & QUALITY (WIR / NCR)
-- ============================================================================

-- 30. WORK ITEMS (standard work definitions)
CREATE TABLE work_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    item_code       TEXT NOT NULL,
    name_en         TEXT NOT NULL,
    name_ar         TEXT,
    category        TEXT,
    unit_of_measure TEXT DEFAULT 'each',
    is_active       BOOLEAN DEFAULT true,
    UNIQUE(project_id, item_code)
);

-- 31. WORK BREAKDOWN STRUCTURE
CREATE TABLE work_breakdown_structure (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    wbs_code        TEXT NOT NULL,
    parent_id       UUID REFERENCES work_breakdown_structure(id),
    level           INT NOT NULL DEFAULT 1,
    name_en         TEXT NOT NULL,
    name_ar         TEXT,
    weight_percent  DECIMAL(5,2) DEFAULT 0,
    UNIQUE(project_id, wbs_code)
);

-- 32. WORK TASKS
CREATE TABLE work_tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    wbs_id          UUID REFERENCES work_breakdown_structure(id),
    unit_id         UUID REFERENCES units(id),
    contract_id     UUID REFERENCES contracts(id),
    task_code       TEXT NOT NULL,
    title_en        TEXT NOT NULL,
    title_ar        TEXT,
    description     TEXT,
    assigned_to     UUID REFERENCES user_profiles(id),
    start_date      DATE,
    end_date        DATE,
    status          TEXT NOT NULL DEFAULT 'pending',
    priority        TEXT DEFAULT 'medium',
    progress        DECIMAL(5,2) DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, task_code)
);
CREATE INDEX idx_work_tasks_project ON work_tasks(project_id);
CREATE INDEX idx_work_tasks_unit ON work_tasks(unit_id);

-- 33. WORK REQUESTS (WIR - Work Inspection Requests)
CREATE TABLE work_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    unit_id         UUID REFERENCES units(id),
    contract_id     UUID REFERENCES contracts(id),
    task_id         UUID REFERENCES work_tasks(id),
    wir_no          TEXT NOT NULL,
    title_en        TEXT NOT NULL,
    title_ar        TEXT,
    description     TEXT,
    request_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    requested_by    UUID NOT NULL REFERENCES user_profiles(id),
    inspected_by    UUID REFERENCES user_profiles(id),
    status          TEXT NOT NULL DEFAULT 'draft',
    is_ncr          BOOLEAN NOT NULL DEFAULT false,
    ncr_reason      TEXT,
    rework_required BOOLEAN NOT NULL DEFAULT false,
    rework_closed   BOOLEAN NOT NULL DEFAULT false,
    rejection_reason TEXT,
    location        TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, wir_no)
);
CREATE INDEX idx_wir_project ON work_requests(project_id);
CREATE INDEX idx_wir_unit ON work_requests(unit_id);
CREATE INDEX idx_wir_status ON work_requests(status);

-- 34. WORK REQUEST LINES (inspection items within WIR)
CREATE TABLE work_request_lines (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_request_id UUID NOT NULL REFERENCES work_requests(id) ON DELETE CASCADE,
    line_no         INT NOT NULL,
    description_en  TEXT NOT NULL,
    description_ar  TEXT,
    specification   TEXT,
    result          TEXT CHECK (result IN ('pass','fail','na')),
    remarks         TEXT,
    attachment_url  TEXT
);
CREATE INDEX idx_wir_lines_request ON work_request_lines(work_request_id);

-- 35. AUDIT TRAIL (generic for all modules)
CREATE TABLE audit_trail (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_code     TEXT NOT NULL,
    record_id       UUID NOT NULL,
    action          TEXT NOT NULL CHECK (action IN ('created','updated','deleted','status_changed','submitted','approved','rejected')),
    old_status      TEXT,
    new_status      TEXT,
    changes         JSONB,
    performed_by    UUID NOT NULL REFERENCES user_profiles(id),
    comment         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_record ON audit_trail(module_code, record_id);
CREATE INDEX idx_audit_user ON audit_trail(performed_by);
CREATE INDEX idx_audit_created ON audit_trail(created_at);

-- ============================================================================
-- HSE (HEALTH, SAFETY, ENVIRONMENT)
-- ============================================================================

-- 36. SAFETY INCIDENTS
CREATE TABLE safety_incidents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    incident_no     TEXT NOT NULL,
    incident_date   DATE NOT NULL,
    incident_time   TIME,
    incident_type   TEXT NOT NULL CHECK (incident_type IN (
                        'fatality','serious_injury','minor_injury',
                        'first_aid','near_miss','property_damage',
                        'fire','environmental','other'
                    )),
    severity        TEXT CHECK (severity IN ('low','medium','high','critical')),
    location        TEXT,
    description     TEXT NOT NULL,
    immediate_action TEXT,
    root_cause      TEXT,
    corrective_action TEXT,
    status          TEXT NOT NULL DEFAULT 'reported',
    reported_by     UUID NOT NULL REFERENCES user_profiles(id),
    closed_date     DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, incident_no)
);
CREATE INDEX idx_hse_incidents_project ON safety_incidents(project_id);

-- 37. SAFETY OBSERVATIONS
CREATE TABLE safety_observations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    observation_no  TEXT NOT NULL,
    observation_date DATE NOT NULL,
    observation_type TEXT CHECK (observation_type IN ('safe_act','unsafe_act','unsafe_condition','positive')),
    location        TEXT,
    description     TEXT NOT NULL,
    recommended_action TEXT,
    status          TEXT NOT NULL DEFAULT 'open',
    observed_by     UUID NOT NULL REFERENCES user_profiles(id),
    closed_by       UUID REFERENCES user_profiles(id),
    closed_date     DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, observation_no)
);

-- 38. TOOLBOX TALKS
CREATE TABLE toolbox_talks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    talk_date       DATE NOT NULL,
    topic_en        TEXT NOT NULL,
    topic_ar        TEXT,
    conductor       TEXT,
    duration_minutes INT,
    attendees_count INT DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 39. PPE ISSUANCE
CREATE TABLE ppe_issuance (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    employee_id     UUID,
    ppe_type        TEXT NOT NULL,
    brand           TEXT,
    size            TEXT,
    quantity        INT NOT NULL DEFAULT 1,
    issue_date      DATE NOT NULL,
    expiry_date     DATE,
    issued_by       UUID REFERENCES user_profiles(id),
    notes           TEXT
);

-- 40. SAFETY AUDITS
CREATE TABLE safety_audits (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    audit_no        TEXT NOT NULL,
    audit_date      DATE NOT NULL,
    auditor         TEXT NOT NULL,
    scope           TEXT,
    score           DECIMAL(5,2),
    findings        TEXT,
    recommendations TEXT,
    status          TEXT NOT NULL DEFAULT 'planned',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, audit_no)
);
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

