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
