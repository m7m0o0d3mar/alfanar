-- ============================================================================
-- 017: Warehouse management + Activity definitions + Progress linking
-- ============================================================================
-- Run this in Supabase SQL Editor after 016_fix_rls_recursion_and_missing.sql
-- ============================================================================

-- 1. WAREHOUSE MODULE

CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  location TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS material_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  parent_id UUID REFERENCES material_categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  category_id UUID REFERENCES material_categories(id) ON DELETE SET NULL,
  unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
  default_price DECIMAL(12,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  min_quantity DECIMAL(12,2) DEFAULT 0,
  unit_price DECIMAL(12,2),
  batch_no VARCHAR(100),
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(warehouse_id, material_id, batch_no)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  movement_no VARCHAR(50) NOT NULL UNIQUE,
  movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('received','issued','transfer','adjustment','return')),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  warehouse_to_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  quantity DECIMAL(12,2) NOT NULL,
  unit_price DECIMAL(12,2),
  batch_no VARCHAR(100),
  reference_type VARCHAR(50),
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_requisitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pr_no VARCHAR(50) NOT NULL UNIQUE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_requisition_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pr_id UUID NOT NULL REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  description TEXT,
  quantity DECIMAL(12,2) NOT NULL,
  estimated_price DECIMAL(12,2),
  notes TEXT
);

-- 2. ACTIVITY DEFINITIONS

CREATE TABLE IF NOT EXISTS activity_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  category VARCHAR(100),
  unit VARCHAR(50) DEFAULT 'each',
  weight_percent DECIMAL(5,2) DEFAULT 0,
  target_quantity DECIMAL(12,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE activity_definitions ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES activity_definitions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS unit_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activity_definitions(id) ON DELETE CASCADE,
  weight_percent DECIMAL(5,2) DEFAULT 0,
  target_quantity DECIMAL(12,2),
  achieved_quantity DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(unit_id, activity_id)
);

-- Link work_tasks to activities
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES activity_definitions(id) ON DELETE SET NULL;

-- Link work_requests to activities
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES activity_definitions(id) ON DELETE SET NULL;

-- 3. LINK APPROVAL RESULTS → ACTIVITY PROGRESS

CREATE TABLE IF NOT EXISTS approval_activity_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activity_definitions(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  quantity_approved DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TRIGGER: auto-update unit_activities.achieved_quantity when approval_activity_results inserted
CREATE OR REPLACE FUNCTION public.trg_update_unit_activity_achieved()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NEW.unit_id IS NOT NULL THEN
    UPDATE unit_activities
    SET achieved_quantity = achieved_quantity + NEW.quantity_approved,
        updated_at = now()
    WHERE unit_id = NEW.unit_id AND activity_id = NEW.activity_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_approval_activity_achieved ON approval_activity_results;
CREATE TRIGGER trg_approval_activity_achieved
  AFTER INSERT ON approval_activity_results
  FOR EACH ROW EXECUTE FUNCTION trg_update_unit_activity_achieved();

-- 5. TRIGGER: recalculate project progress from activity weights
CREATE OR REPLACE FUNCTION public.trg_recalc_project_progress()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_project_id UUID;
  v_progress DECIMAL(5,2);
BEGIN
  SELECT project_id INTO v_project_id FROM units WHERE id = NEW.unit_id;
  IF v_project_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(
    (ua.achieved_quantity / NULLIF(ua.target_quantity, 0)) * ad.weight_percent
  ), 0)
  INTO v_progress
  FROM unit_activities ua
  JOIN activity_definitions ad ON ad.id = ua.activity_id
  JOIN units u ON u.id = ua.unit_id
  WHERE u.project_id = v_project_id;

  UPDATE projects SET progress_percent = v_progress WHERE id = v_project_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_project_progress_on_activity ON unit_activities;
CREATE TRIGGER trg_recalc_project_progress_on_activity
  AFTER UPDATE OF achieved_quantity ON unit_activities
  FOR EACH ROW EXECUTE FUNCTION trg_recalc_project_progress();

-- 6. RLS policies for new tables
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_activity_results ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY['warehouses','material_categories','materials','inventory','stock_movements','purchase_requisitions','purchase_requisition_items','activity_definitions','unit_activities','approval_activity_results'];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admin_all_%s" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "admin_all_%s" ON %I FOR ALL USING (is_admin()) WITH CHECK (is_admin())', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "auth_all_%s" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "auth_all_%s" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;
