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
