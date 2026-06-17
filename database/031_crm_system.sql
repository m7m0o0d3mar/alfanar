-- ============================================================================
-- 031: CRM System - Contacts, Companies, Pipeline, Deals, Interactions, Tasks
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

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

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'has_role'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    EXECUTE $create$
      CREATE FUNCTION public.has_role(role_name TEXT)
      RETURNS BOOLEAN
      LANGUAGE sql STABLE SECURITY DEFINER
      AS $func$
        SELECT EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid()
            AND role = role_name
            AND is_active = true
        );
      $func$;
    $create$;
  END IF;
END;
$block$;

-- ============================================================================
-- CRM COMPANIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL,
  trading_name VARCHAR(255),
  registration_number VARCHAR(100),
  vat_number VARCHAR(50),
  phone VARCHAR(50),
  email VARCHAR(255),
  website TEXT,
  industry VARCHAR(100),
  company_size VARCHAR(50) CHECK (company_size IN ('1-10', '11-50', '51-200', '201-1000', '1000+')),
  source VARCHAR(50),
  tags TEXT[],
  notes TEXT,
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  assigned_to UUID REFERENCES user_profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CRM CONTACTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  mobile VARCHAR(50),
  position VARCHAR(200),
  department VARCHAR(200),
  linkedin_url TEXT,
  source VARCHAR(50) CHECK (source IN ('referral', 'website', 'cold_call', 'social_media', 'event', 'other')),
  tags TEXT[],
  notes TEXT,
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  assigned_to UUID REFERENCES user_profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CRM PIPELINE STAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  color VARCHAR(20) DEFAULT '#6B7280',
  probability DECIMAL(5,2) DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CRM DEALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_name VARCHAR(255) NOT NULL,
  company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  pipeline_stage_id UUID NOT NULL REFERENCES crm_pipeline_stages(id),
  amount DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'SAR',
  probability DECIMAL(5,2) CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100)),
  expected_close_date DATE,
  actual_close_date DATE,
  source VARCHAR(50),
  description TEXT,
  notes TEXT,
  assigned_to UUID REFERENCES user_profiles(id),
  is_won BOOLEAN DEFAULT false,
  is_lost BOOLEAN DEFAULT false,
  loss_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CRM INTERACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_type VARCHAR(50) NOT NULL CHECK (interaction_type IN ('call', 'email', 'meeting', 'site_visit', 'note', 'other')),
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  interaction_date TIMESTAMPTZ DEFAULT NOW(),
  duration_minutes INTEGER,
  direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
  outcome VARCHAR(100) CHECK (outcome IN ('completed', 'no_answer', 'rescheduled')),
  follow_up_date DATE,
  follow_up_notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CRM TASKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type VARCHAR(50) NOT NULL CHECK (task_type IN ('call', 'email', 'meeting', 'follow_up', 'reminder', 'other')),
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  due_date DATE,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  assigned_to UUID REFERENCES user_profiles(id),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE crm_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;

-- crm_companies
DROP POLICY IF EXISTS "crm_companies_select" ON crm_companies;
CREATE POLICY "crm_companies_select" ON crm_companies FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "crm_companies_insert" ON crm_companies;
CREATE POLICY "crm_companies_insert" ON crm_companies FOR INSERT WITH CHECK (is_admin() OR assigned_to = auth.uid());

DROP POLICY IF EXISTS "crm_companies_update" ON crm_companies;
CREATE POLICY "crm_companies_update" ON crm_companies FOR UPDATE USING (is_admin() OR assigned_to = auth.uid());

DROP POLICY IF EXISTS "crm_companies_delete" ON crm_companies;
CREATE POLICY "crm_companies_delete" ON crm_companies FOR DELETE USING (is_admin() OR assigned_to = auth.uid());

-- crm_contacts
DROP POLICY IF EXISTS "crm_contacts_select" ON crm_contacts;
CREATE POLICY "crm_contacts_select" ON crm_contacts FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "crm_contacts_insert" ON crm_contacts;
CREATE POLICY "crm_contacts_insert" ON crm_contacts FOR INSERT WITH CHECK (is_admin() OR assigned_to = auth.uid());

DROP POLICY IF EXISTS "crm_contacts_update" ON crm_contacts;
CREATE POLICY "crm_contacts_update" ON crm_contacts FOR UPDATE USING (is_admin() OR assigned_to = auth.uid());

DROP POLICY IF EXISTS "crm_contacts_delete" ON crm_contacts;
CREATE POLICY "crm_contacts_delete" ON crm_contacts FOR DELETE USING (is_admin() OR assigned_to = auth.uid());

-- crm_pipeline_stages
DROP POLICY IF EXISTS "crm_pipeline_stages_select" ON crm_pipeline_stages;
CREATE POLICY "crm_pipeline_stages_select" ON crm_pipeline_stages FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "crm_pipeline_stages_insert" ON crm_pipeline_stages;
CREATE POLICY "crm_pipeline_stages_insert" ON crm_pipeline_stages FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "crm_pipeline_stages_update" ON crm_pipeline_stages;
CREATE POLICY "crm_pipeline_stages_update" ON crm_pipeline_stages FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "crm_pipeline_stages_delete" ON crm_pipeline_stages;
CREATE POLICY "crm_pipeline_stages_delete" ON crm_pipeline_stages FOR DELETE USING (is_admin());

-- crm_deals
DROP POLICY IF EXISTS "crm_deals_select" ON crm_deals;
CREATE POLICY "crm_deals_select" ON crm_deals FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "crm_deals_insert" ON crm_deals;
CREATE POLICY "crm_deals_insert" ON crm_deals FOR INSERT WITH CHECK (is_admin() OR assigned_to = auth.uid());

DROP POLICY IF EXISTS "crm_deals_update" ON crm_deals;
CREATE POLICY "crm_deals_update" ON crm_deals FOR UPDATE USING (is_admin() OR assigned_to = auth.uid());

DROP POLICY IF EXISTS "crm_deals_delete" ON crm_deals;
CREATE POLICY "crm_deals_delete" ON crm_deals FOR DELETE USING (is_admin() OR assigned_to = auth.uid());

-- crm_interactions
DROP POLICY IF EXISTS "crm_interactions_select" ON crm_interactions;
CREATE POLICY "crm_interactions_select" ON crm_interactions FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "crm_interactions_insert" ON crm_interactions;
CREATE POLICY "crm_interactions_insert" ON crm_interactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "crm_interactions_update" ON crm_interactions;
CREATE POLICY "crm_interactions_update" ON crm_interactions FOR UPDATE USING (is_admin() OR created_by = auth.uid());

DROP POLICY IF EXISTS "crm_interactions_delete" ON crm_interactions;
CREATE POLICY "crm_interactions_delete" ON crm_interactions FOR DELETE USING (is_admin() OR created_by = auth.uid());

-- crm_tasks
DROP POLICY IF EXISTS "crm_tasks_select" ON crm_tasks;
CREATE POLICY "crm_tasks_select" ON crm_tasks FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "crm_tasks_insert" ON crm_tasks;
CREATE POLICY "crm_tasks_insert" ON crm_tasks FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "crm_tasks_update" ON crm_tasks;
CREATE POLICY "crm_tasks_update" ON crm_tasks FOR UPDATE USING (is_admin() OR assigned_to = auth.uid() OR created_by = auth.uid());

DROP POLICY IF EXISTS "crm_tasks_delete" ON crm_tasks;
CREATE POLICY "crm_tasks_delete" ON crm_tasks FOR DELETE USING (is_admin() OR assigned_to = auth.uid() OR created_by = auth.uid());

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_crm_contacts_assigned_to ON crm_contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company_id ON crm_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_is_active ON crm_contacts(is_active);

CREATE INDEX IF NOT EXISTS idx_crm_companies_assigned_to ON crm_companies(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_companies_email ON crm_companies(email);
CREATE INDEX IF NOT EXISTS idx_crm_companies_is_active ON crm_companies(is_active);

CREATE INDEX IF NOT EXISTS idx_crm_deals_pipeline_stage_id ON crm_deals(pipeline_stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_assigned_to ON crm_deals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_deals_company_id ON crm_deals(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_won_lost ON crm_deals(is_won, is_lost);

CREATE INDEX IF NOT EXISTS idx_crm_interactions_contact_id ON crm_interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_company_id ON crm_interactions(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_deal_id ON crm_interactions(deal_id);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_created_by ON crm_interactions(created_by);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_date ON crm_interactions(interaction_date);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_contact_id ON crm_tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_company_id ON crm_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_deal_id ON crm_tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned_to ON crm_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due_date ON crm_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON crm_tasks(status);

-- ============================================================================
-- TRIGGERS: updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY['crm_companies', 'crm_contacts', 'crm_deals', 'crm_tasks'];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', tbl, tbl);
  END LOOP;
END;
$$;

-- ============================================================================
-- TRIGGERS: audit (only if audit_logs table exists)
-- ============================================================================

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY['crm_contacts', 'crm_companies', 'crm_deals'];
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    FOREACH tbl IN ARRAY tables
    LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON %I', tbl, tbl);
      EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION trg_audit_log()', tbl, tbl);
    END LOOP;
  END IF;
END;
$$;

-- ============================================================================
-- SEED: Default Pipeline Stages
-- ============================================================================

INSERT INTO crm_pipeline_stages (name_en, name_ar, sort_order, color, probability)
SELECT * FROM (VALUES
  ('Lead Qualification', 'تأهيل العميل', 1, '#6B7280', 10.00),
  ('Needs Assessment', 'تقييم الاحتياجات', 2, '#3B82F6', 20.00),
  ('Proposal Sent', 'إرسال العرض', 3, '#F59E0B', 40.00),
  ('Negotiation', 'التفاوض', 4, '#8B5CF6', 60.00),
  ('Contract Review', 'مراجعة العقد', 5, '#EC4899', 80.00),
  ('Won', 'فوز', 6, '#10B981', 100.00),
  ('Lost', 'خسارة', 7, '#EF4444', 0.00)
) AS s(name_en, name_ar, sort_order, color, probability)
WHERE NOT EXISTS (
  SELECT 1 FROM crm_pipeline_stages WHERE name_en = s.name_en
);
