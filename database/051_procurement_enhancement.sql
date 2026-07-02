-- ============================================================
-- Phase 1: Procurement Enhancement (Source-to-Contract + P2P)
-- Inspired by Coupa + SCNSoft procurement best practices
-- ============================================================

-- 1. Procurement Categories (hierarchical)
CREATE TABLE IF NOT EXISTS procurement_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  parent_id UUID REFERENCES procurement_categories(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Purchase Requisitions (enhanced with approval workflow)
CREATE TABLE IF NOT EXISTS purchase_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_no VARCHAR(50) NOT NULL UNIQUE,
  title_en VARCHAR(500) NOT NULL,
  title_ar VARCHAR(500),
  project_id UUID REFERENCES projects(id),
  department VARCHAR(100),
  requester_id UUID REFERENCES user_profiles(id),
  urgency VARCHAR(20) DEFAULT 'normal' CHECK (urgency IN ('low','normal','high','critical')),
  category_id UUID REFERENCES procurement_categories(id),
  total_estimated NUMERIC(15,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'SAR',
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','rejected','cancelled','ordered')),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns that may be missing if table already existed from earlier migration
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS title_en VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS title_ar VARCHAR(500);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS requester_id UUID REFERENCES user_profiles(id);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'normal' CHECK (urgency IN ('low','normal','high','critical'));
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES procurement_categories(id);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS total_estimated NUMERIC(15,2) DEFAULT 0;
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'SAR';
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES user_profiles(id);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS pr_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id UUID NOT NULL REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
  line_no INT DEFAULT 1,
  description_en VARCHAR(500),
  description_ar VARCHAR(500),
  catalog_item_id UUID,
  quantity NUMERIC(15,3) DEFAULT 1,
  unit VARCHAR(50),
  estimated_unit_price NUMERIC(15,2) DEFAULT 0,
  estimated_total NUMERIC(15,2) DEFAULT 0,
  need_by_date DATE,
  notes TEXT
);

-- 3. Sourcing / RFQ Events
CREATE TABLE IF NOT EXISTS sourcing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_no VARCHAR(50) NOT NULL UNIQUE,
  title_en VARCHAR(500) NOT NULL,
  title_ar VARCHAR(500),
  type VARCHAR(30) DEFAULT 'rfq' CHECK (type IN ('rfq','rfi','rfp','auction')),
  category_id UUID REFERENCES procurement_categories(id),
  project_id UUID REFERENCES projects(id),
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','open','closed','awarded','cancelled')),
  issue_date DATE,
  close_date DATE,
  currency VARCHAR(3) DEFAULT 'SAR',
  budget_range_min NUMERIC(15,2),
  budget_range_max NUMERIC(15,2),
  terms_conditions TEXT,
  award_criteria TEXT,
  award_method VARCHAR(30) DEFAULT 'lowest_price' CHECK (award_method IN ('lowest_price','best_value','highest_score')),
  awarded_supplier_id UUID,
  awarded_amount NUMERIC(15,2),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sourcing_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES sourcing_events(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  bid_no VARCHAR(50),
  bid_date DATE,
  total_amount NUMERIC(15,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'SAR',
  delivery_days INT,
  validity_days INT,
  payment_terms VARCHAR(500),
  notes TEXT,
  score NUMERIC(5,2),
  rank INT,
  is_winner BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'submitted' CHECK (status IN ('submitted','evaluated','shortlisted','rejected','accepted')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Contract Management
CREATE TABLE IF NOT EXISTS procurement_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_no VARCHAR(50) NOT NULL UNIQUE,
  title_en VARCHAR(500) NOT NULL,
  title_ar VARCHAR(500),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  project_id UUID REFERENCES projects(id),
  sourcing_event_id UUID REFERENCES sourcing_events(id),
  type VARCHAR(30) DEFAULT 'purchase' CHECK (type IN ('purchase','service','framework','lease','maintenance')),
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','active','completed','terminated','expired')),
  start_date DATE,
  end_date DATE,
  total_value NUMERIC(15,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'SAR',
  payment_terms TEXT,
  delivery_terms TEXT,
  warranty_period INT,
  auto_renew BOOLEAN DEFAULT false,
  notice_period_days INT,
  attachment_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Supplier Evaluations (performance scoring)
CREATE TABLE IF NOT EXISTS supplier_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  contract_id UUID REFERENCES procurement_contracts(id),
  evaluated_by UUID REFERENCES user_profiles(id),
  evaluation_date DATE DEFAULT CURRENT_DATE,
  period VARCHAR(20) CHECK (period IN ('monthly','quarterly','biannual','annual','adhoc')),
  quality_score NUMERIC(3,1) CHECK (quality_score >= 0 AND quality_score <= 5),
  delivery_score NUMERIC(3,1) CHECK (delivery_score >= 0 AND delivery_score <= 5),
  price_score NUMERIC(3,1) CHECK (price_score >= 0 AND price_score <= 5),
  responsiveness_score NUMERIC(3,1) CHECK (responsiveness_score >= 0 AND responsiveness_score <= 5),
  compliance_score NUMERIC(3,1) CHECK (compliance_score >= 0 AND compliance_score <= 5),
  overall_score NUMERIC(3,1),
  rating VARCHAR(20),
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN supplier_evaluations.overall_score IS 'Computed as avg of quality/delivery/price/responsiveness/compliance scores';
COMMENT ON COLUMN supplier_evaluations.rating IS 'Derived: excellent(>=4.5), good(>=3.5), average(>=2.5), poor(>=1.5), critical(<1.5)';

-- Trigger to auto-compute overall_score and rating
CREATE OR REPLACE FUNCTION compute_supplier_rating()
RETURNS TRIGGER AS $$
BEGIN
  NEW.overall_score := ROUND((COALESCE(NEW.quality_score,0) + COALESCE(NEW.delivery_score,0) + COALESCE(NEW.price_score,0) + COALESCE(NEW.responsiveness_score,0) + COALESCE(NEW.compliance_score,0)) / 5, 1);
  NEW.rating := CASE
    WHEN NEW.overall_score >= 4.5 THEN 'excellent'
    WHEN NEW.overall_score >= 3.5 THEN 'good'
    WHEN NEW.overall_score >= 2.5 THEN 'average'
    WHEN NEW.overall_score >= 1.5 THEN 'poor'
    ELSE 'critical'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supplier_eval_rating ON supplier_evaluations;
CREATE TRIGGER trg_supplier_eval_rating
  BEFORE INSERT OR UPDATE ON supplier_evaluations
  FOR EACH ROW EXECUTE FUNCTION compute_supplier_rating();

-- 6. Procurement Budgets
CREATE TABLE IF NOT EXISTS procurement_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year INT NOT NULL,
  category_id UUID REFERENCES procurement_categories(id),
  project_id UUID REFERENCES projects(id),
  allocated_amount NUMERIC(15,2) DEFAULT 0,
  spent_amount NUMERIC(15,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'SAR',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Catalog Items (for procurement catalogs)
CREATE TABLE IF NOT EXISTS catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id),
  category_id UUID REFERENCES procurement_categories(id),
  item_code VARCHAR(100) NOT NULL,
  name_en VARCHAR(500) NOT NULL,
  name_ar VARCHAR(500),
  description TEXT,
  unit VARCHAR(50),
  unit_price NUMERIC(15,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'SAR',
  minimum_order_qty NUMERIC(15,3) DEFAULT 1,
  lead_time_days INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE procurement_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

-- RLS: drop existing policies first (idempotent)
DROP POLICY IF EXISTS "procurement_categories_read" ON procurement_categories;
DROP POLICY IF EXISTS "procurement_categories_insert" ON procurement_categories;
DROP POLICY IF EXISTS "procurement_categories_update" ON procurement_categories;
DROP POLICY IF EXISTS "purchase_requisitions_read" ON purchase_requisitions;
DROP POLICY IF EXISTS "purchase_requisitions_insert" ON purchase_requisitions;
DROP POLICY IF EXISTS "purchase_requisitions_update" ON purchase_requisitions;
DROP POLICY IF EXISTS "pr_line_items_read" ON pr_line_items;
DROP POLICY IF EXISTS "pr_line_items_insert" ON pr_line_items;
DROP POLICY IF EXISTS "pr_line_items_update" ON pr_line_items;
DROP POLICY IF EXISTS "pr_line_items_delete" ON pr_line_items;
DROP POLICY IF EXISTS "sourcing_events_read" ON sourcing_events;
DROP POLICY IF EXISTS "sourcing_events_insert" ON sourcing_events;
DROP POLICY IF EXISTS "sourcing_events_update" ON sourcing_events;
DROP POLICY IF EXISTS "sourcing_bids_read" ON sourcing_bids;
DROP POLICY IF EXISTS "sourcing_bids_insert" ON sourcing_bids;
DROP POLICY IF EXISTS "sourcing_bids_update" ON sourcing_bids;
DROP POLICY IF EXISTS "procurement_contracts_read" ON procurement_contracts;
DROP POLICY IF EXISTS "procurement_contracts_insert" ON procurement_contracts;
DROP POLICY IF EXISTS "procurement_contracts_update" ON procurement_contracts;
DROP POLICY IF EXISTS "procurement_budgets_read" ON procurement_budgets;
DROP POLICY IF EXISTS "procurement_budgets_insert" ON procurement_budgets;
DROP POLICY IF EXISTS "procurement_budgets_update" ON procurement_budgets;
DROP POLICY IF EXISTS "catalog_items_read" ON catalog_items;
DROP POLICY IF EXISTS "catalog_items_insert" ON catalog_items;
DROP POLICY IF EXISTS "catalog_items_update" ON catalog_items;

-- RLS: authenticated users can read all; insert/update only by role
CREATE POLICY "procurement_categories_read" ON procurement_categories FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "procurement_categories_insert" ON procurement_categories FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "procurement_categories_update" ON procurement_categories FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "purchase_requisitions_read" ON purchase_requisitions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "purchase_requisitions_insert" ON purchase_requisitions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "purchase_requisitions_update" ON purchase_requisitions FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "pr_line_items_read" ON pr_line_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "pr_line_items_insert" ON pr_line_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "pr_line_items_update" ON pr_line_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "pr_line_items_delete" ON pr_line_items FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "sourcing_events_read" ON sourcing_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "sourcing_events_insert" ON sourcing_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "sourcing_events_update" ON sourcing_events FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "sourcing_bids_read" ON sourcing_bids FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "sourcing_bids_insert" ON sourcing_bids FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "sourcing_bids_update" ON sourcing_bids FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "procurement_contracts_read" ON procurement_contracts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "procurement_contracts_insert" ON procurement_contracts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "procurement_contracts_update" ON procurement_contracts FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "procurement_budgets_read" ON procurement_budgets FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "procurement_budgets_insert" ON procurement_budgets FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "procurement_budgets_update" ON procurement_budgets FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "catalog_items_read" ON catalog_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "catalog_items_insert" ON catalog_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "catalog_items_update" ON catalog_items FOR UPDATE USING (auth.role() = 'authenticated');

-- Seed default procurement categories
INSERT INTO procurement_categories (code, name_en, name_ar) VALUES
  ('RAW_MAT', 'Raw Materials', 'المواد الخام'),
  ('EQUIP', 'Equipment & Machinery', 'المعدات والآلات'),
  ('SERVICES', 'Services', 'الخدمات'),
  ('IT', 'IT & Software', 'تقنية المعلومات والبرمجيات'),
  ('OFFICE', 'Office Supplies', 'اللوازم المكتبية'),
  ('SUBCONTRACT', 'Subcontracting', 'المقاولات الباطنة'),
  ('SAFETY', 'Safety & PPE', 'السلامة والمعدات الوقائية'),
  ('LOGISTICS', 'Logistics & Transport', 'الخدمات اللوجستية والنقل'),
  ('CONSULTING', 'Consulting', 'الاستشارات'),
  ('MAINTENANCE', 'Maintenance & Repairs', 'الصيانة والإصلاح')
ON CONFLICT (code) DO NOTHING;
