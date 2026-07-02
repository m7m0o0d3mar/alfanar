import type { SupabaseClient } from '@supabase/supabase-js';

export const MISSING_TABLES_DDL = [
  `CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_code TEXT NOT NULL UNIQUE, name_en TEXT NOT NULL,
    name_ar TEXT, contact_person TEXT, phone TEXT, email TEXT,
    address TEXT, cr_number TEXT, vat_number TEXT,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID, po_no TEXT NOT NULL, title TEXT NOT NULL,
    supplier_id UUID, order_date DATE, status TEXT DEFAULT 'draft',
    total_amount DECIMAL(20,2) DEFAULT 0,
    grand_total DECIMAL(20,2) DEFAULT 0,
    currency TEXT DEFAULT 'SAR', notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS contractors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contractor_type TEXT, is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID, contract_no TEXT NOT NULL,
    contractor_id UUID, title_en TEXT NOT NULL,
    contract_type TEXT, contract_amount DECIMAL(20,2) DEFAULT 0,
    currency TEXT DEFAULT 'SAR', status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS subcontracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_contract_id UUID, subcontractor_id UUID,
    subcontract_no TEXT NOT NULL, title_en TEXT NOT NULL,
    amount DECIMAL(20,2) DEFAULT 0, status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS contract_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID, invoice_no TEXT NOT NULL,
    invoice_type TEXT, invoice_date DATE,
    amount DECIMAL(20,2) DEFAULT 0,
    retention_pct DECIMAL(5,2) DEFAULT 10,
    retention_amount DECIMAL(20,2) DEFAULT 0,
    status TEXT DEFAULT 'draft',
    due_date DATE, paid_date DATE, paid_amount DECIMAL(20,2) DEFAULT 0,
    notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS budget (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID, budget_code TEXT NOT NULL UNIQUE,
    description TEXT, category TEXT, budget_type TEXT,
    total_budget DECIMAL(20,2) DEFAULT 0,
    used_amount DECIMAL(20,2) DEFAULT 0,
    currency TEXT DEFAULT 'SAR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_no TEXT, title_en TEXT NOT NULL,
    module_code TEXT NOT NULL, description TEXT,
    project_id UUID, approver_id UUID, ref_record_id UUID,
    requested_by UUID, status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS approval_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_request_id UUID NOT NULL,
    step_order INT NOT NULL, step_user_id UUID,
    step_role TEXT, status TEXT DEFAULT 'pending',
    comment TEXT, decided_at TIMESTAMPTZ,
    acted_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS approval_activity_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_request_id UUID, activity_id UUID, unit_id UUID,
    quantity_approved DECIMAL(15,2) DEFAULT 1, notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS project_phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL, phase_code TEXT NOT NULL,
    name_en TEXT NOT NULL, name_ar TEXT, description TEXT,
    start_date DATE, end_date DATE,
    budget DECIMAL(20,2), progress_percent DECIMAL(5,2) DEFAULT 0,
    status TEXT DEFAULT 'pending', "order" INT DEFAULT 0,
    UNIQUE(project_id, phase_code)
  )`,
  `CREATE TABLE IF NOT EXISTS work_breakdown_structure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL, wbs_code TEXT NOT NULL,
    parent_id UUID, level INT DEFAULT 1,
    name_en TEXT NOT NULL, name_ar TEXT,
    weight_percent DECIMAL(5,2) DEFAULT 0,
    UNIQUE(project_id, wbs_code)
  )`,
  `CREATE TABLE IF NOT EXISTS work_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL, wbs_id UUID, unit_id UUID,
    contract_id UUID,
    task_code TEXT NOT NULL, title_en TEXT NOT NULL,
    title_ar TEXT, description TEXT, assigned_to UUID,
    start_date DATE, end_date DATE, status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium', progress DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, task_code)
  )`,
  `CREATE TABLE IF NOT EXISTS task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL, predecessor_id UUID NOT NULL,
    successor_id UUID NOT NULL,
    dependency_type TEXT DEFAULT 'FS',
    lag_days INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en TEXT NOT NULL, name_ar TEXT,
    resource_type TEXT, unit_of_measure TEXT,
    unit_price DECIMAL(15,2) DEFAULT 0,
    currency TEXT DEFAULT 'SAR', is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS task_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL, resource_id UUID NOT NULL,
    allocated_units DECIMAL(15,2) DEFAULT 1,
    unit_price DECIMAL(15,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID, name TEXT NOT NULL,
    baseline_no INT DEFAULT 1, is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID
  )`,
  `CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL, block_id UUID,
    unit_code TEXT NOT NULL, unit_no TEXT,
    unit_type TEXT, floor_number INT,
    area_sqm DECIMAL(10,2), area_built DECIMAL(10,2),
    bedrooms INT DEFAULT 0, bathrooms INT DEFAULT 0,
    status TEXT DEFAULT 'available',
    price DECIMAL(20,2), currency TEXT DEFAULT 'SAR',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, unit_code)
  )`,
  `CREATE TABLE IF NOT EXISTS safety_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    incident_no TEXT NOT NULL,
    incident_date DATE NOT NULL,
    incident_time TIME,
    incident_type TEXT NOT NULL,
    severity TEXT,
    location TEXT,
    description TEXT NOT NULL,
    immediate_action TEXT,
    corrective_action TEXT,
    status TEXT NOT NULL DEFAULT 'reported',
    reported_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, incident_no)
  )`,
  `CREATE TABLE IF NOT EXISTS safety_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    observation_no TEXT NOT NULL,
    observation_date DATE NOT NULL,
    observation_type TEXT,
    location TEXT,
    description TEXT NOT NULL,
    recommended_action TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    observed_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, observation_no)
  )`,
  `CREATE TABLE IF NOT EXISTS safety_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    audit_no TEXT NOT NULL,
    audit_date DATE NOT NULL,
    auditor TEXT NOT NULL,
    scope TEXT,
    score DECIMAL(5,2),
    findings TEXT,
    recommendations TEXT,
    status TEXT NOT NULL DEFAULT 'planned',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, audit_no)
  )`,
  `CREATE TABLE IF NOT EXISTS toolbox_talks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    talk_date DATE NOT NULL,
    topic_en TEXT NOT NULL,
    topic_ar TEXT,
    conductor TEXT,
    duration_minutes INT,
    attendees_count INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS ppe_issuance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    employee_name TEXT,
    ppe_type TEXT NOT NULL,
    brand TEXT,
    size TEXT,
    quantity INT NOT NULL DEFAULT 1,
    issue_date DATE NOT NULL,
    expiry_date DATE,
    issued_by UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE IF EXISTS ppe_issuance ADD COLUMN IF NOT EXISTS employee_name TEXT`,
  `ALTER TABLE IF EXISTS safety_incidents DISABLE ROW LEVEL SECURITY`,
  `ALTER TABLE IF EXISTS safety_observations DISABLE ROW LEVEL SECURITY`,
  `ALTER TABLE IF EXISTS safety_audits DISABLE ROW LEVEL SECURITY`,
  `ALTER TABLE IF EXISTS toolbox_talks DISABLE ROW LEVEL SECURITY`,
  `ALTER TABLE IF EXISTS ppe_issuance DISABLE ROW LEVEL SECURITY`,
  `CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(20) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    channel VARCHAR(20) NOT NULL DEFAULT 'web',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    severity VARCHAR(20) DEFAULT 'minor',
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    category VARCHAR(100),
    contact_id UUID, company_id UUID, deal_id UUID,
    assigned_to UUID, created_by UUID,
    sla_respond_by TIMESTAMPTZ, sla_resolve_by TIMESTAMPTZ,
    first_responded_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ, is_escalated BOOLEAN DEFAULT false,
    tags TEXT[], is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    comment TEXT NOT NULL, is_internal BOOLEAN DEFAULT false,
    author_id UUID, created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS crm_lead_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL,
    score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    engagement_score INTEGER DEFAULT 0,
    fit_score INTEGER DEFAULT 0,
    intent_score INTEGER DEFAULT 0,
    last_activity_date TIMESTAMPTZ,
    interaction_count INTEGER DEFAULT 0,
    scoring_version INTEGER DEFAULT 1,
    last_scored_at TIMESTAMPTZ DEFAULT NOW(),
    score_factors JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE OR REPLACE VIEW v_crm_sales_kpis AS SELECT
    COUNT(DISTINCT d.id) AS total_deals,
    COUNT(DISTINCT d.id) FILTER (WHERE d.is_won = true) AS won_deals,
    COUNT(DISTINCT d.id) FILTER (WHERE d.is_lost = true) AS lost_deals,
    COUNT(DISTINCT d.id) FILTER (WHERE d.is_won = false AND d.is_lost = false) AS open_deals,
    COALESCE(SUM(d.amount) FILTER (WHERE d.is_won = true), 0) AS won_amount,
    COALESCE(SUM(d.amount) FILTER (WHERE d.is_won = false AND d.is_lost = false), 0) AS pipeline_value,
    CASE WHEN COUNT(DISTINCT d.id) > 0 THEN ROUND(COUNT(DISTINCT d.id) FILTER (WHERE d.is_won = true) * 100.0 / COUNT(DISTINCT d.id), 1) ELSE 0 END AS win_rate,
    COUNT(DISTINCT c.id) AS total_companies, COUNT(DISTINCT ct.id) AS total_contacts,
    COUNT(DISTINCT i.id) AS total_interactions, COUNT(DISTINCT t.id) AS total_tasks,
    COUNT(DISTINCT s.id) AS total_tickets
  FROM crm_deals d
  CROSS JOIN (SELECT COUNT(*) AS id FROM crm_companies) c
  CROSS JOIN (SELECT COUNT(*) AS id FROM crm_contacts) ct
  CROSS JOIN (SELECT COUNT(*) AS id FROM crm_interactions) i
  CROSS JOIN (SELECT COUNT(*) AS id FROM crm_tasks) t
  CROSS JOIN (SELECT COUNT(*) AS id FROM support_tickets) s`,
  `CREATE OR REPLACE VIEW v_crm_pipeline_analytics AS SELECT
    ps.id AS stage_id, ps.name_en AS stage_name, ps.name_ar AS stage_name_ar,
    ps.sort_order, ps.color, COUNT(d.id) AS deal_count,
    COALESCE(SUM(d.amount), 0) AS total_amount,
    COALESCE(AVG(d.amount), 0) AS avg_deal_amount
  FROM crm_pipeline_stages ps
  LEFT JOIN crm_deals d ON d.pipeline_stage_id = ps.id AND d.is_lost = false AND d.is_won = false
  GROUP BY ps.id, ps.name_en, ps.name_ar, ps.sort_order, ps.color
  ORDER BY ps.sort_order`,
  `CREATE OR REPLACE VIEW v_support_kpis AS SELECT
    COUNT(*) AS total_tickets,
    COUNT(*) FILTER (WHERE status = 'open') AS open_tickets,
    COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_tickets,
    COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_tickets,
    COUNT(*) FILTER (WHERE status = 'closed') AS closed_tickets,
    COUNT(*) FILTER (WHERE is_escalated = true) AS escalated_tickets,
    COUNT(*) FILTER (WHERE priority = 'urgent' AND status NOT IN ('resolved', 'closed', 'cancelled')) AS urgent_open_tickets,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS tickets_7d
  FROM support_tickets`,
  `CREATE OR REPLACE FUNCTION generate_ticket_number()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $$ BEGIN
    NEW.ticket_number := 'TKT-' || LPAD(COALESCE((SELECT MAX(NULLIF(regexp_replace(ticket_number, '^TKT-', ''), ''))::INTEGER FROM support_tickets), 0) + 1::TEXT, 5, '0');
    RETURN NEW;
  END; $$`,
  `DROP TRIGGER IF EXISTS trg_support_tickets_number ON support_tickets`,
  `CREATE TRIGGER trg_support_tickets_number
    BEFORE INSERT ON support_tickets
    FOR EACH ROW
    WHEN (NEW.ticket_number IS NULL OR NEW.ticket_number = '')
    EXECUTE FUNCTION generate_ticket_number()`,
  `ALTER TABLE IF EXISTS support_tickets DISABLE ROW LEVEL SECURITY`,
  `ALTER TABLE IF EXISTS ticket_comments DISABLE ROW LEVEL SECURITY`,
  `ALTER TABLE IF EXISTS crm_lead_scores DISABLE ROW LEVEL SECURITY`,
  `CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100),
    sort_order INT DEFAULT 0,
    color VARCHAR(20),
    probability DECIMAL(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE IF EXISTS crm_pipeline_stages DISABLE ROW LEVEL SECURITY`,
  `INSERT INTO page_registry (code, path, icon, name_en, section_key, section_label_en, is_admin, is_enabled, sort_order) VALUES ('portal', '/portal', 'Globe', 'Customer Portal', 'crm', 'CRM', false, true, 90) ON CONFLICT (code) DO NOTHING`,
  `INSERT INTO crm_pipeline_stages (name_en, name_ar, sort_order, color, probability)
    SELECT * FROM (VALUES
      ('Lead Qualification', 'تأهيل العميل', 1, '#6B7280', 10.00),
      ('Needs Assessment', 'تقييم الاحتياجات', 2, '#3B82F6', 20.00),
      ('Proposal Sent', 'إرسال العرض', 3, '#F59E0B', 40.00),
      ('Negotiation', 'التفاوض', 4, '#8B5CF6', 60.00),
      ('Contract Review', 'مراجعة العقد', 5, '#EC4899', 80.00),
      ('Won', 'فوز', 6, '#10B981', 100.00),
      ('Lost', 'خسارة', 7, '#EF4444', 0.00)
    ) AS s(name_en, name_ar, sort_order, color, probability)
    WHERE NOT EXISTS (SELECT 1 FROM crm_pipeline_stages WHERE name_en = s.name_en)`,
  `CREATE OR REPLACE FUNCTION auto_log_stage_change() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    DECLARE v_new_en VARCHAR(100); v_old_en VARCHAR(100); BEGIN
    SELECT name_en INTO v_new_en FROM crm_pipeline_stages WHERE id = NEW.pipeline_stage_id;
    SELECT name_en INTO v_old_en FROM crm_pipeline_stages WHERE id = OLD.pipeline_stage_id;
    INSERT INTO crm_interactions (interaction_type, subject, description, contact_id, company_id, deal_id, interaction_date, direction, created_by)
    VALUES ('note', 'Deal moved: ' || COALESCE(v_old_en,'?') || ' -> ' || COALESCE(v_new_en,'?'),
    'Auto: deal "' || NEW.deal_name || '" moved.', NEW.contact_id, NEW.company_id, NEW.id, NOW(), 'outbound', NEW.assigned_to); RETURN NEW; END; $$`,
  `DROP TRIGGER IF EXISTS trg_deal_stage_change ON crm_deals`,
  `CREATE TRIGGER trg_deal_stage_change AFTER UPDATE OF pipeline_stage_id ON crm_deals FOR EACH ROW WHEN (OLD.pipeline_stage_id IS DISTINCT FROM NEW.pipeline_stage_id) EXECUTE FUNCTION auto_log_stage_change()`,
  `CREATE OR REPLACE FUNCTION auto_task_deal_won() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
    INSERT INTO crm_tasks (task_type, subject, description, contact_id, company_id, deal_id, due_date, priority, status, assigned_to)
    VALUES ('follow_up', 'Follow up on won deal: ' || NEW.deal_name, 'Auto: deal won.', NEW.contact_id, NEW.company_id, NEW.id, (NOW()+INTERVAL '7 days')::DATE, 'high', 'pending', NEW.assigned_to);
    INSERT INTO crm_interactions (interaction_type, subject, description, contact_id, company_id, deal_id, interaction_date, direction, created_by)
    VALUES ('note', 'Deal won: ' || NEW.deal_name, 'Auto: deal won.', NEW.contact_id, NEW.company_id, NEW.id, NOW(), 'outbound', NEW.assigned_to); RETURN NEW; END; $$`,
  `DROP TRIGGER IF EXISTS trg_deal_won ON crm_deals`,
  `CREATE TRIGGER trg_deal_won AFTER UPDATE OF is_won ON crm_deals FOR EACH ROW WHEN (OLD.is_won = false AND NEW.is_won = true) EXECUTE FUNCTION auto_task_deal_won()`,
  `CREATE OR REPLACE FUNCTION auto_task_deal_lost() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
    INSERT INTO crm_interactions (interaction_type, subject, description, contact_id, company_id, deal_id, interaction_date, direction, created_by)
    VALUES ('note', 'Deal lost: ' || NEW.deal_name, 'Auto: deal lost.' || CASE WHEN NEW.loss_reason IS NOT NULL THEN ' Reason: ' || NEW.loss_reason ELSE '' END,
    NEW.contact_id, NEW.company_id, NEW.id, NOW(), 'inbound', NEW.assigned_to); RETURN NEW; END; $$`,
  `DROP TRIGGER IF EXISTS trg_deal_lost ON crm_deals`,
  `CREATE TRIGGER trg_deal_lost AFTER UPDATE OF is_lost ON crm_deals FOR EACH ROW WHEN (OLD.is_lost = false AND NEW.is_lost = true) EXECUTE FUNCTION auto_task_deal_lost()`,
  `CREATE OR REPLACE FUNCTION auto_task_ticket_escalated() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
    INSERT INTO crm_tasks (task_type, subject, description, contact_id, company_id, deal_id, due_date, priority, status, assigned_to)
    VALUES ('follow_up', 'Escalated ticket: ' || NEW.subject, 'Auto: ticket escalated.', NEW.contact_id, NEW.company_id, NEW.deal_id, NOW()::DATE, 'urgent', 'pending', NEW.assigned_to); RETURN NEW; END; $$`,
  `DROP TRIGGER IF EXISTS trg_ticket_escalated ON support_tickets`,
  `CREATE TRIGGER trg_ticket_escalated AFTER UPDATE OF is_escalated ON support_tickets FOR EACH ROW WHEN (OLD.is_escalated = false AND NEW.is_escalated = true) EXECUTE FUNCTION auto_task_ticket_escalated()`,
  `CREATE TABLE IF NOT EXISTS qc_checklist_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code VARCHAR(50) UNIQUE NOT NULL,
    name_en VARCHAR(255) NOT NULL, name_ar VARCHAR(255),
    category VARCHAR(100) NOT NULL DEFAULT 'general', description TEXT,
    is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE IF EXISTS qc_checklist_templates DISABLE ROW LEVEL SECURITY`,
  `CREATE TABLE IF NOT EXISTS qc_template_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES qc_checklist_templates(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0, description_en TEXT NOT NULL, description_ar TEXT,
    expected_value TEXT, is_critical BOOLEAN DEFAULT false,
    weight DECIMAL(5,2) DEFAULT 1.00, created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE IF EXISTS qc_template_items DISABLE ROW LEVEL SECURITY`,
  `CREATE TABLE IF NOT EXISTS qc_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES qc_checklist_templates(id),
    inspection_no VARCHAR(50) NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
    material_id UUID REFERENCES materials_catalog(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL, inspection_date DATE NOT NULL,
    inspector_id UUID REFERENCES user_profiles(id),
    status VARCHAR(50) DEFAULT 'draft', score_percent DECIMAL(5,2),
    notes TEXT, signed_by VARCHAR(255), signed_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE IF EXISTS qc_inspections DISABLE ROW LEVEL SECURITY`,
  `CREATE TABLE IF NOT EXISTS qc_inspection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES qc_inspections(id) ON DELETE CASCADE,
    template_item_id UUID REFERENCES qc_template_items(id),
    result VARCHAR(20) CHECK (result IN ('pass','fail','na')),
    actual_value TEXT, notes TEXT, photo_urls TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE IF EXISTS qc_inspection_items DISABLE ROW LEVEL SECURITY`,
  `CREATE TABLE IF NOT EXISTS qc_ncr (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ncr_no VARCHAR(50) NOT NULL, source_type VARCHAR(50) DEFAULT 'inspection',
    source_id UUID, project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL, description TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'minor', status VARCHAR(50) DEFAULT 'open',
    root_cause TEXT, detected_date DATE DEFAULT CURRENT_DATE,
    closed_date DATE, assigned_to UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE IF EXISTS qc_ncr DISABLE ROW LEVEL SECURITY`,
  `CREATE TABLE IF NOT EXISTS qc_capa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capa_no VARCHAR(50) NOT NULL, ncr_id UUID REFERENCES qc_ncr(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL, description TEXT,
    action_type VARCHAR(20) NOT NULL DEFAULT 'corrective',
    root_cause TEXT, proposed_action TEXT,
    assigned_to UUID REFERENCES user_profiles(id), deadline DATE,
    status VARCHAR(50) DEFAULT 'open', effectiveness_review TEXT,
    closed_date DATE, created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE IF EXISTS qc_capa DISABLE ROW LEVEL SECURITY`,
  `CREATE TABLE IF NOT EXISTS fs_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
    equipment_code VARCHAR(100) NOT NULL, name VARCHAR(255) NOT NULL,
    model VARCHAR(255), serial_number VARCHAR(255),
    installation_date DATE, warranty_expiry DATE,
    location TEXT, status VARCHAR(50) DEFAULT 'active',
    notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE IF EXISTS fs_equipment DISABLE ROW LEVEL SECURITY`,
  `CREATE TABLE IF NOT EXISTS fs_work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wo_no VARCHAR(50) NOT NULL, ticket_id UUID REFERENCES technical_tickets(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    equipment_id UUID REFERENCES fs_equipment(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL, description TEXT,
    priority VARCHAR(20) DEFAULT 'medium', status VARCHAR(50) DEFAULT 'pending',
    scheduled_date DATE, completed_date DATE,
    assigned_technician UUID REFERENCES employees(id) ON DELETE SET NULL,
    labor_hours DECIMAL(10,2) DEFAULT 0, parts_cost DECIMAL(14,2) DEFAULT 0,
    labor_cost DECIMAL(14,2) DEFAULT 0, total_cost DECIMAL(14,2) DEFAULT 0,
    customer_signature TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE IF EXISTS fs_work_orders DISABLE ROW LEVEL SECURITY`,
  `CREATE TABLE IF NOT EXISTS fs_work_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES fs_work_orders(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL DEFAULT 'labor', description TEXT NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 1, unit_price DECIMAL(14,2) DEFAULT 0,
    total_price DECIMAL(14,2) DEFAULT 0,
    material_id UUID REFERENCES materials_catalog(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE IF EXISTS fs_work_order_items DISABLE ROW LEVEL SECURITY`,
  `CREATE TABLE IF NOT EXISTS fs_time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    work_order_id UUID REFERENCES fs_work_orders(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    clock_in TIMESTAMPTZ NOT NULL, clock_out TIMESTAMPTZ,
    total_hours DECIMAL(10,2), notes TEXT,
    latitude DECIMAL(10,7), longitude DECIMAL(10,7),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE IF EXISTS fs_time_entries DISABLE ROW LEVEL SECURITY`,
  `INSERT INTO page_registry (code, path, icon, name_en, section_key, section_label_en, is_admin, is_enabled, sort_order) VALUES ('field-service', '/field-service', 'Wrench', 'Field Service', 'operations', 'Operations', false, true, 65) ON CONFLICT (code) DO NOTHING`,
  `CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_number VARCHAR(50) NOT NULL, to_number VARCHAR(50) NOT NULL,
    message_body TEXT, media_url TEXT, status VARCHAR(20) DEFAULT 'pending',
    whatsapp_message_id VARCHAR(255),
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
    sent_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ, read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE IF EXISTS whatsapp_messages DISABLE ROW LEVEL SECURITY`,
  `INSERT INTO page_registry (code, path, icon, name_en, section_key, section_label_en, is_admin, is_enabled, sort_order) VALUES ('whatsapp', '/whatsapp', 'MessageCircle', 'WhatsApp', 'crm', 'CRM', false, true, 43) ON CONFLICT (code) DO NOTHING`,
  `CREATE TABLE IF NOT EXISTS zatca_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_no VARCHAR(50) UNIQUE NOT NULL,
    invoice_type VARCHAR(20) NOT NULL DEFAULT 'standard',
    direction VARCHAR(10) NOT NULL DEFAULT 'outbound',
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    seller_name VARCHAR(255) NOT NULL, seller_vat VARCHAR(50) NOT NULL,
    seller_cr VARCHAR(100), seller_address TEXT,
    buyer_name VARCHAR(255), buyer_vat VARCHAR(50), buyer_address TEXT,
    currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
    total_excluding_vat DECIMAL(20,2) NOT NULL DEFAULT 0,
    total_vat DECIMAL(20,2) NOT NULL DEFAULT 0,
    total_including_vat DECIMAL(20,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(20,2) DEFAULT 0,
    vat_rate DECIMAL(5,2) DEFAULT 15.00,
    qr_code TEXT, qr_base64 TEXT, cryptographic_stamp TEXT,
    cryptographic_stamp_uuid UUID DEFAULT gen_random_uuid(),
    invoice_xml TEXT, invoice_json JSONB,
    zatca_pih TEXT, zatca_response_code VARCHAR(50), zatca_response_msg TEXT,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ, reported_at TIMESTAMPTZ
  )`,
  `ALTER TABLE IF EXISTS zatca_invoices DISABLE ROW LEVEL SECURITY`,
  `CREATE TABLE IF NOT EXISTS zatca_invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES zatca_invoices(id) ON DELETE CASCADE,
    line_no INT DEFAULT 1, description TEXT NOT NULL,
    quantity DECIMAL(15,2) DEFAULT 1, unit_price DECIMAL(20,2) DEFAULT 0,
    total_excluding_vat DECIMAL(20,2) DEFAULT 0,
    vat_rate DECIMAL(5,2) DEFAULT 15.00,
    vat_amount DECIMAL(20,2) DEFAULT 0,
    total_including_vat DECIMAL(20,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE IF EXISTS zatca_invoice_lines DISABLE ROW LEVEL SECURITY`,
  `INSERT INTO page_registry (code, path, icon, name_en, section_key, section_label_en, is_admin, is_enabled, sort_order) VALUES ('zatca', '/zatca', 'Receipt', 'E-Invoicing', 'finance', 'Finance', false, true, 55) ON CONFLICT (code) DO NOTHING`,
  `DO $$ DECLARE v_safety_id UUID; v_quality_id UUID; v_supplier_id UUID; v_material_id UUID; BEGIN
    INSERT INTO qc_checklist_templates (code, name_en, category, description, is_active) VALUES ('SAFETY-001', 'Site Safety Inspection', 'safety', 'Standard site safety walkthrough covering PPE, fire safety, electrical, and emergency preparedness.', true) ON CONFLICT (code) DO NOTHING RETURNING id INTO v_safety_id;
    IF v_safety_id IS NOT NULL THEN
      INSERT INTO qc_template_items (template_id, sort_order, description_en, is_critical, weight) VALUES (v_safety_id, 1, 'All personnel wearing appropriate PPE (helmet, vest, gloves, boots)', true, 5), (v_safety_id, 2, 'Fire extinguishers present, accessible, and within expiry date', true, 5), (v_safety_id, 3, 'Emergency exits clearly marked and unobstructed', true, 4), (v_safety_id, 4, 'First aid kit available and adequately stocked', false, 3), (v_safety_id, 5, 'Electrical cables and switches properly insulated and labeled', false, 3), (v_safety_id, 6, 'Warning signs and barricades in place around hazards', false, 2), (v_safety_id, 7, 'Scaffolding and ladders inspected and tagged', true, 4), (v_safety_id, 8, 'Gas cylinders secured upright with caps on', false, 3), (v_safety_id, 9, 'Housekeeping — walkways clear of debris and trip hazards', false, 2), (v_safety_id, 10, 'Emergency contact numbers posted prominently', false, 1);
    END IF;
    INSERT INTO qc_checklist_templates (code, name_en, category, description, is_active) VALUES ('QUAL-001', 'Construction Quality Inspection', 'quality', 'General quality inspection for construction work including materials, workmanship, and finishing.', true) ON CONFLICT (code) DO NOTHING RETURNING id INTO v_quality_id;
    IF v_quality_id IS NOT NULL THEN
      INSERT INTO qc_template_items (template_id, sort_order, description_en, is_critical, weight) VALUES (v_quality_id, 1, 'Materials conform to approved specifications and submittals', true, 5), (v_quality_id, 2, 'Workmanship meets industry standards and project specs', true, 5), (v_quality_id, 3, 'Dimensions and tolerances within approved drawings', true, 4), (v_quality_id, 4, 'Surface finish uniform — no cracks, spalls, or defects', false, 3), (v_quality_id, 5, 'Welding/joining visually inspected and compliant with WPS', false, 3), (v_quality_id, 6, 'Installation alignment checked with survey instruments', true, 4), (v_quality_id, 7, 'Concrete slump and compressive strength test results available', false, 2), (v_quality_id, 8, 'Rebar placement and cover verified per structural drawings', true, 4);
    END IF;
    INSERT INTO qc_checklist_templates (code, name_en, category, description, is_active) VALUES ('SUPPLIER-AUDIT-001', 'Supplier Quality Audit', 'supplier_audit', 'Supplier facility audit covering QMS, production capacity, HSE compliance, and delivery capability.', true) ON CONFLICT (code) DO NOTHING RETURNING id INTO v_supplier_id;
    IF v_supplier_id IS NOT NULL THEN
      INSERT INTO qc_template_items (template_id, sort_order, description_en, is_critical, weight) VALUES (v_supplier_id, 1, 'Quality Management System (ISO 9001 or equivalent) certified', true, 5), (v_supplier_id, 2, 'Production capacity meets project volume and timeline requirements', true, 4), (v_supplier_id, 3, 'Material test certificates and traceability records available', true, 4), (v_supplier_id, 4, 'Delivery track record — no significant delays in last 12 months', false, 3), (v_supplier_id, 5, 'Health & Safety policy and records in place', false, 2), (v_supplier_id, 6, 'Environmental compliance (ISO 14001 or equivalent)', false, 2), (v_supplier_id, 7, 'Pricing competitive and within budget benchmarks', false, 1), (v_supplier_id, 8, 'Financial stability — no outstanding legal or credit issues', true, 3);
    END IF;
    INSERT INTO qc_checklist_templates (code, name_en, category, description, is_active) VALUES ('MAT-INSP-001', 'Incoming Material Inspection', 'material_inspection', 'Receiving inspection for materials delivered to site — checks grade, quantity, damage, and documentation.', true) ON CONFLICT (code) DO NOTHING RETURNING id INTO v_material_id;
    IF v_material_id IS NOT NULL THEN
      INSERT INTO qc_template_items (template_id, sort_order, description_en, is_critical, weight) VALUES (v_material_id, 1, 'Material grade and specification match purchase order', true, 5), (v_material_id, 2, 'Physical dimensions within acceptable tolerances', true, 4), (v_material_id, 3, 'Quantity received matches delivery note and PO', true, 4), (v_material_id, 4, 'No visible damage — dents, corrosion, cracks, or moisture', true, 5), (v_material_id, 5, 'Manufacturer test certificates and mill certificates attached', false, 3), (v_material_id, 6, 'Packaging and labeling compliant with project requirements', false, 2), (v_material_id, 7, 'Batch/lot numbers recorded and match documentation', false, 2), (v_material_id, 8, 'Expiry date (if applicable) checked and valid', true, 3);
    END IF;
  END $$`,
];

let _hasAdminAccess: boolean | null = null;

async function hasAdminAccess(supabase: SupabaseClient): Promise<boolean> {
  if (_hasAdminAccess !== null) return _hasAdminAccess;
  const { error } = await supabase.auth.admin.listUsers();
  _hasAdminAccess = !error;
  return _hasAdminAccess;
}

export async function cleanupTestData(supabase: SupabaseClient) {
  const testEmails = [
    'test-admin@erp-test.local',
    'test-pm@erp-test.local',
    'test-eng@erp-test.local',
    'test-hse@erp-test.local',
    'test-client@erp-test.local',
    'test-fin@erp-test.local',
  ];

  for (const email of testEmails) {
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email);

    if (users && users.length > 0) {
      await supabase.from('user_profiles').delete().in('id', users.map(u => u.id));
    }
  }

  await supabase.from('ticket_comments').delete().in('ticket_id', (await supabase.from('support_tickets').select('id').like('ticket_number', 'TKT-TEST-%')).data?.map(t => t.id) || []);
  await supabase.from('support_tickets').delete().like('ticket_number', 'TKT-TEST-%');
  await supabase.from('crm_lead_scores').delete().not('contact_id', 'is', null);
  await supabase.from('crm_tasks').delete().like('subject', 'TEST-%');
  await supabase.from('crm_interactions').delete().like('subject', 'TEST-%');
  await supabase.from('crm_deals').delete().like('deal_name', 'TEST-%');

  const { data: testProjects } = await supabase.from('projects').select('id').like('project_code', 'TEST-%');
  if (testProjects && testProjects.length > 0) {
    const ids = testProjects.map(p => p.id);
    for (const table of ['safety_incidents', 'safety_observations', 'safety_audits', 'toolbox_talks', 'ppe_issuance']) {
      await supabase.from(table).delete().in('project_id', ids);
    }
  }
  await supabase.from('projects').delete().like('project_code', 'TEST-%');
  await supabase.from('units').delete().like('unit_no', '%-TEST');
  await supabase.from('suppliers').delete().like('supplier_code', 'TEST-%');
}

export async function seedTestData(supabase: SupabaseClient) {
  const testUsers = [
    { email: 'test-admin@erp-test.local', role: 'admin', full_name_en: 'Test Admin', is_active: true, default_language: 'en' },
    { email: 'test-pm@erp-test.local', role: 'project_manager', full_name_en: 'Test PM', is_active: true, default_language: 'en' },
    { email: 'test-eng@erp-test.local', role: 'engineer', full_name_en: 'Test Engineer', is_active: true, default_language: 'en' },
    { email: 'test-hse@erp-test.local', role: 'hse', full_name_en: 'Test HSE', is_active: true, default_language: 'en' },
    { email: 'test-client@erp-test.local', role: 'client', full_name_en: 'Test Client', is_active: true, default_language: 'en' },
    { email: 'test-fin@erp-test.local', role: 'finance', full_name_en: 'Test Finance', is_active: true, default_language: 'en' },
  ];

  const getPassword = (role: string) => {
    const passwords: Record<string, string> = {
      admin: 'TestAdmin@2024!',
      project_manager: 'TestPM@2024!',
      engineer: 'TestEng@2024!',
      hse: 'TestHSE@2024!',
      client: 'TestClient@2024!',
      finance: 'TestFin@2024!',
    };
    return passwords[role] || 'TestDefault@2024!';
  };

  const admin = await hasAdminAccess(supabase);
  const allAuthUsers = admin ? (await supabase.auth.admin.listUsers()).data?.users : undefined;

  for (const user of testUsers) {
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', user.email)
      .single();

    if (existing) continue;

    let authUserId: string | null = null;

    if (admin && allAuthUsers) {
      const existingAuthUser = allAuthUsers.find(u => u.email === user.email);
      if (existingAuthUser) {
        authUserId = existingAuthUser.id;
        if (!existingAuthUser.email_confirmed_at) {
          await supabase.auth.admin.updateUserById(existingAuthUser.id, { email_confirm: true });
        }
      } else {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: getPassword(user.role),
          email_confirm: true,
        });
        if (authError) {
          console.error(`Failed to create auth user ${user.email}:`, authError.message);
          continue;
        }
        authUserId = authData?.user?.id ?? null;
      }
    } else {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: user.email,
        password: getPassword(user.role),
        options: { data: { role: user.role, full_name_en: user.full_name_en } },
      });
      if (authError) {
        console.error(`Failed to sign up ${user.email}:`, authError.message);
        continue;
      }
      authUserId = authData?.user?.id ?? null;
    }

    if (authUserId) {
      const { error: profileError } = await supabase.from('user_profiles').upsert({
        id: authUserId,
        email: user.email,
        role: user.role,
        full_name_en: user.full_name_en,
        is_active: user.is_active,
        default_language: user.default_language,
      });
      if (profileError) {
        console.error(`Failed to create profile for ${user.email}:`, profileError.message);
      }
    }
  }

  const { data: projectData } = await supabase.from('projects').select('id').eq('project_code', 'TEST-PRJ-001').single();
  if (!projectData) {
    await supabase.from('projects').insert({
      project_code: 'TEST-PRJ-001',
      name_en: 'Test Project E2E',
      name_ar: 'مشروع اختبار',
      status: 'active',
      is_active: true,
      location: 'Riyadh Test Area',
    });
  }
}
