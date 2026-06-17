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
