-- ============================================================================
-- 027: Comprehensive Features - Projects, Units, Commissions, Item Definitions
-- ============================================================================
-- Run after: 026_fix_inventory_price.sql
-- Adds:
--   1. Additional columns to projects (consultant info, project manager, etc.)
--   2. Additional columns to units (pricing fields, discounts, sales tracking)
--   3. commissions table (new)
--   4. item_definitions table (new) for execution/budget tracking
--   5. Work request approval workflow tracking columns (QC, consultant, PM)
--   6. Auto-calculate trigger for unit prices
--   7. Audit trigger for item_definitions
--   8. RLS policies for all new tables
-- ============================================================================

-- ============================================================================
-- 1. PROJECTS TABLE ADDITIONS
-- ============================================================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS consultant_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS consultant_company TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS consultant_phone TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS consultant_email TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_manager_id UUID REFERENCES user_profiles(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS partners TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stakeholders TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS logo_url TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_pm ON projects(project_manager_id);

-- ============================================================================
-- 2. UNITS TABLE ADDITIONS
-- ============================================================================
ALTER TABLE units ADD COLUMN IF NOT EXISTS zone TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS block TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS unit_model TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS land_area DECIMAL(12,2);
ALTER TABLE units ADD COLUMN IF NOT EXISTS building_price_per_m2 DECIMAL(12,2) DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS land_price_per_m2 DECIMAL(12,2) DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS land_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS building_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS total_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS discount_land_pct DECIMAL(5,2) DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS discount_bua_pct DECIMAL(5,2) DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS discount_land_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS discount_bua_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS salesperson_id UUID REFERENCES employees(id);
ALTER TABLE units ADD COLUMN IF NOT EXISTS commission_id UUID;
ALTER TABLE units ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'offline' CHECK (sale_type IN ('online', 'offline', 'other'));
ALTER TABLE units ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS update_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_units_zone ON units(zone);
CREATE INDEX IF NOT EXISTS idx_units_salesperson ON units(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_units_sale_type ON units(sale_type);

-- ============================================================================
-- 3. COMMISSIONS TABLE (NEW)
-- ============================================================================
CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commission_code TEXT NOT NULL UNIQUE,
  commission_name_en TEXT,
  commission_name_ar TEXT,
  commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  commission_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  salesperson_id UUID REFERENCES employees(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_salesperson ON commissions(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_commissions_active ON commissions(is_active);

-- Add FK from units.commission_id to commissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_units_commission'
  ) THEN
    ALTER TABLE units ADD CONSTRAINT fk_units_commission
      FOREIGN KEY (commission_id) REFERENCES commissions(id);
  END IF;
END $$;

-- ============================================================================
-- 4. ITEM DEFINITIONS TABLE (NEW) - for execution/budget
-- ============================================================================
CREATE TABLE IF NOT EXISTS item_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  division TEXT NOT NULL,
  sub_division TEXT,
  activity TEXT NOT NULL,
  activity_weight DECIMAL(5,2) DEFAULT 0,
  wbs_code TEXT NOT NULL,
  wbs_description TEXT,
  booked_budget DECIMAL(14,2) DEFAULT 0,
  open_budget DECIMAL(14,2) DEFAULT 0,
  budget_rate DECIMAL(12,2) DEFAULT 0,
  contingency DECIMAL(14,2) GENERATED ALWAYS AS (COALESCE(open_budget, 0) * 0.1) STORED,
  quantity DECIMAL(12,2) DEFAULT 0,
  unit_price DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, wbs_code)
);

CREATE INDEX IF NOT EXISTS idx_item_defs_project ON item_definitions(project_id);
CREATE INDEX IF NOT EXISTS idx_item_defs_division ON item_definitions(division);
CREATE INDEX IF NOT EXISTS idx_item_defs_wbs ON item_definitions(wbs_code);

-- ============================================================================
-- 5. WORK REQUEST APPROVAL WORKFLOW ADDITIONS
-- ============================================================================
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS qc_approved BOOLEAN DEFAULT false;
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS qc_approved_by UUID REFERENCES user_profiles(id);
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS qc_approved_at TIMESTAMPTZ;
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS consultant_approved BOOLEAN DEFAULT false;
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS consultant_approved_by UUID REFERENCES user_profiles(id);
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS consultant_approved_at TIMESTAMPTZ;
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS pm_approved BOOLEAN DEFAULT false;
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS pm_approved_by UUID REFERENCES user_profiles(id);
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS pm_approved_at TIMESTAMPTZ;
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS item_definition_id UUID REFERENCES item_definitions(id);

CREATE INDEX IF NOT EXISTS idx_wir_qc ON work_requests(qc_approved);
CREATE INDEX IF NOT EXISTS idx_wir_consultant ON work_requests(consultant_approved);
CREATE INDEX IF NOT EXISTS idx_wir_pm ON work_requests(pm_approved);
CREATE INDEX IF NOT EXISTS idx_wir_item_def ON work_requests(item_definition_id);

-- ============================================================================
-- 6. AUTO-CALCULATE TRIGGER FOR UNIT PRICES
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_calc_unit_prices()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.land_price := COALESCE(NEW.land_area, 0) * COALESCE(NEW.land_price_per_m2, 0);
  NEW.building_price := COALESCE(NEW.area_built, 0) * COALESCE(NEW.building_price_per_m2, 0);
  NEW.discount_land_amount := NEW.land_price * (COALESCE(NEW.discount_land_pct, 0) / 100);
  NEW.discount_bua_amount := NEW.building_price * (COALESCE(NEW.discount_bua_pct, 0) / 100);
  NEW.total_price := (NEW.land_price - NEW.discount_land_amount) + (NEW.building_price - NEW.discount_bua_amount);
  NEW.update_date := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calc_unit_prices ON units;
CREATE TRIGGER trg_calc_unit_prices
  BEFORE INSERT OR UPDATE OF land_area, area_built, building_price_per_m2, land_price_per_m2, discount_land_pct, discount_bua_pct
  ON units
  FOR EACH ROW
  EXECUTE FUNCTION trg_calc_unit_prices();

-- ============================================================================
-- 7. AUDIT TRIGGER FOR ITEM DEFINITIONS
-- ============================================================================
DROP TRIGGER IF EXISTS trg_audit_item_definitions ON item_definitions;
CREATE TRIGGER trg_audit_item_definitions
  AFTER INSERT OR UPDATE OR DELETE ON item_definitions
  FOR EACH ROW EXECUTE FUNCTION trg_audit_log();

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) FOR NEW TABLES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_definitions ENABLE ROW LEVEL SECURITY;

-- Commissions RLS
DROP POLICY IF EXISTS "commissions_select" ON commissions;
CREATE POLICY "commissions_select" ON commissions FOR SELECT USING (
  is_admin() OR current_user_role() IN ('sales', 'finance', 'project_manager')
);

DROP POLICY IF EXISTS "commissions_insert" ON commissions;
CREATE POLICY "commissions_insert" ON commissions FOR INSERT WITH CHECK (
  is_admin() OR current_user_role() IN ('sales', 'finance')
);

DROP POLICY IF EXISTS "commissions_update" ON commissions;
CREATE POLICY "commissions_update" ON commissions FOR UPDATE USING (
  is_admin() OR current_user_role() = 'finance'
);

DROP POLICY IF EXISTS "commissions_delete" ON commissions;
CREATE POLICY "commissions_delete" ON commissions FOR DELETE USING (is_admin());

-- Item Definitions RLS
DROP POLICY IF EXISTS "item_definitions_select" ON item_definitions;
CREATE POLICY "item_definitions_select" ON item_definitions FOR SELECT USING (
  is_admin() OR has_project_access(project_id)
);

DROP POLICY IF EXISTS "item_definitions_insert" ON item_definitions;
CREATE POLICY "item_definitions_insert" ON item_definitions FOR INSERT WITH CHECK (
  is_admin() OR has_project_role(project_id, 'project_manager') OR has_project_role(project_id, 'engineer')
);

DROP POLICY IF EXISTS "item_definitions_update" ON item_definitions;
CREATE POLICY "item_definitions_update" ON item_definitions FOR UPDATE USING (
  is_admin() OR has_project_role(project_id, 'project_manager')
);

DROP POLICY IF EXISTS "item_definitions_delete" ON item_definitions;
CREATE POLICY "item_definitions_delete" ON item_definitions FOR DELETE USING (is_admin());

-- ============================================================================
-- 9. ADD item_definitions TO EXISTING BULK AUDIT TRIGGER LIST (if using DO block)
-- ============================================================================
-- Note: item_definitions already has a dedicated audit trigger (trg_audit_item_definitions)
-- created in section 7 above, so the DO block in migration 018 already covers it.
-- ============================================================================
