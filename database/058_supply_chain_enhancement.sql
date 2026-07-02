-- ============================================================
-- Phase 2: Supply Chain Enhancement
-- Goods Receipt, Bin Locations, Material Requests,
-- Contract Management, Supply Chain Analytics
-- ============================================================

-- Ensure reference columns exist on stock_movements
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS destination_warehouse_id UUID REFERENCES warehouses(id);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 1. Goods Receipt (PO Receiving)
CREATE TABLE IF NOT EXISTS goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no VARCHAR(50) NOT NULL UNIQUE,
  po_id UUID REFERENCES purchase_orders(id),
  warehouse_id UUID REFERENCES warehouses(id),
  received_by UUID REFERENCES user_profiles(id),
  receipt_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','completed','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goods_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id),
  quantity_received NUMERIC(15,3) DEFAULT 0,
  quantity_accepted NUMERIC(15,3) DEFAULT 0,
  quantity_rejected NUMERIC(15,3) DEFAULT 0,
  batch_no VARCHAR(100),
  unit_price NUMERIC(15,2) DEFAULT 0,
  notes TEXT
);

-- 2. Warehouse Bin Locations
CREATE TABLE IF NOT EXISTS warehouse_bins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(255),
  name_ar VARCHAR(255),
  zone VARCHAR(100),
  max_capacity NUMERIC(15,3),
  capacity_unit VARCHAR(20) DEFAULT 'pcs',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(warehouse_id, code)
);

CREATE TABLE IF NOT EXISTS inventory_bins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bin_id UUID NOT NULL REFERENCES warehouse_bins(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  quantity NUMERIC(15,3) DEFAULT 0,
  batch_no VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Material Requests (from Execution / Work Tasks)
CREATE TABLE IF NOT EXISTS material_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_no VARCHAR(50) NOT NULL UNIQUE,
  project_id UUID REFERENCES projects(id),
  task_id UUID,
  requested_by UUID REFERENCES user_profiles(id),
  warehouse_id UUID REFERENCES warehouses(id),
  request_date DATE DEFAULT CURRENT_DATE,
  required_date DATE,
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','partially_issued','issued','cancelled')),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS material_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  quantity_requested NUMERIC(15,3) DEFAULT 0,
  quantity_issued NUMERIC(15,3) DEFAULT 0,
  unit VARCHAR(50),
  notes TEXT
);

-- 4. Stock Adjustments (with approval workflow)
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_no VARCHAR(50) NOT NULL UNIQUE,
  warehouse_id UUID REFERENCES warehouses(id),
  adjustment_type VARCHAR(30) NOT NULL CHECK (adjustment_type IN ('surplus','damage','loss','expiry','correction','return')),
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','rejected','completed')),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_adjustment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  bin_id UUID REFERENCES warehouse_bins(id),
  current_quantity NUMERIC(15,3) DEFAULT 0,
  adjusted_quantity NUMERIC(15,3) DEFAULT 0,
  difference_quantity NUMERIC(15,3) DEFAULT 0,
  batch_no VARCHAR(100),
  unit_price NUMERIC(15,2) DEFAULT 0,
  notes TEXT
);

-- 5. Execution Contracts Enhancement
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_no VARCHAR(50);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS category VARCHAR(30) DEFAULT 'subcontract' CHECK (category IN ('subcontract','prime','service','supply','lease'));
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'SAR';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS performance_bond NUMERIC(15,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS retention_pct NUMERIC(5,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS advance_payment NUMERIC(15,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_days INT;

CREATE TABLE IF NOT EXISTS contract_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  amendment_no VARCHAR(50) NOT NULL,
  description TEXT,
  change_type VARCHAR(30) DEFAULT 'addition' CHECK (change_type IN ('addition','deduction','scope_change','time_extension')),
  amount NUMERIC(15,2) DEFAULT 0,
  previous_value NUMERIC(15,2) DEFAULT 0,
  new_value NUMERIC(15,2) DEFAULT 0,
  days_added INT DEFAULT 0,
  approved_by UUID REFERENCES user_profiles(id),
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contract_payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  milestone_no VARCHAR(50),
  description TEXT,
  amount NUMERIC(15,2) DEFAULT 0,
  percentage NUMERIC(5,2),
  due_date DATE,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','achieved','invoiced','paid')),
  achieved_date DATE,
  notes TEXT
);

-- 6. Supply Chain Dashboard Views
CREATE OR REPLACE VIEW scm_procurement_cycle AS
SELECT
  pr.id AS pr_id, pr.pr_no, pr.status AS pr_status, pr.created_at AS pr_date,
  po.id AS po_id, po.po_no, po.status AS po_status, po.order_date AS po_date,
  gr.id AS gr_id, gr.receipt_no, gr.status AS gr_status, gr.receipt_date,
  pr.project_id
FROM purchase_requisitions pr
FULL JOIN purchase_orders po ON po.project_id = pr.project_id
FULL JOIN goods_receipts gr ON gr.po_id = po.id;

CREATE OR REPLACE VIEW scm_inventory_status AS
SELECT
  m.id AS material_id, m.code AS material_code, m.name_en AS material_name,
  m.unit, COALESCE(SUM(i.quantity), 0) AS total_quantity,
  COALESCE(SUM(i.quantity * i.unit_price) / NULLIF(SUM(i.quantity), 0), 0) AS avg_price,
  COUNT(DISTINCT i.warehouse_id) AS warehouse_count,
  COUNT(DISTINCT i.batch_no) AS batch_count,
  MAX(m.default_price) AS default_price
FROM materials m
LEFT JOIN inventory i ON i.material_id = m.id
GROUP BY m.id, m.code, m.name_en, m.unit;

CREATE OR REPLACE VIEW scm_supplier_performance AS
SELECT
  s.id AS supplier_id, s.supplier_code, s.name_en AS supplier_name,
  COUNT(DISTINCT po.id) AS po_count,
  COALESCE(SUM(po.grand_total), 0) AS total_spend,
  AVG(se.overall_score) AS avg_score,
  MAX(se.rating) AS latest_rating,
  COUNT(DISTINCT ct.id) AS contract_count
FROM suppliers s
LEFT JOIN purchase_orders po ON po.supplier_id = s.id
LEFT JOIN supplier_evaluations se ON se.supplier_id = s.id
LEFT JOIN procurement_contracts ct ON ct.supplier_id = s.id
GROUP BY s.id, s.supplier_code, s.name_en;

-- 7. Trigger: Auto-create stock movement from goods receipt
CREATE OR REPLACE FUNCTION auto_create_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    INSERT INTO stock_movements (movement_no, movement_type, warehouse_id, material_id, quantity, unit_price, batch_no, notes, reference_type, reference_id)
    SELECT
      'GR-' || gi.id, 'received', gr.warehouse_id, gi.material_id,
      gi.quantity_accepted, gi.unit_price, gi.batch_no,
      'Auto from GR: ' || gr.receipt_no, 'goods_receipt', gr.id
    FROM goods_receipt_items gi
    JOIN goods_receipts gr ON gr.id = gi.receipt_id
    WHERE gr.id = NEW.id AND gi.quantity_accepted > 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gr_to_stock ON goods_receipts;
CREATE TRIGGER trg_gr_to_stock
  AFTER UPDATE OF status ON goods_receipts
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION auto_create_stock_movement();

-- 8. Trigger: Auto-create stock movement from material issue
CREATE OR REPLACE FUNCTION auto_issue_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('issued', 'partially_issued') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO stock_movements (movement_no, movement_type, warehouse_id, material_id, quantity, notes, reference_type, reference_id)
    SELECT
      'ISS-' || mi.id, 'issued', mr.warehouse_id, mi.material_id,
      mi.quantity_issued, 'Material Request: ' || mr.request_no, 'material_request', mr.id
    FROM material_request_items mi
    JOIN material_requests mr ON mr.id = mi.request_id
    WHERE mr.id = NEW.id AND mi.quantity_issued > 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mr_to_stock ON material_requests;
CREATE TRIGGER trg_mr_to_stock
  AFTER UPDATE OF status ON material_requests
  FOR EACH ROW
  WHEN (NEW.status IN ('issued', 'partially_issued'))
  EXECUTE FUNCTION auto_issue_stock_movement();

-- 9. Trigger: Sync inventory_balance on material_request issue
CREATE OR REPLACE FUNCTION sync_stock_on_material_issue()
RETURNS TRIGGER AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT mi.material_id, mi.quantity_issued, mr.warehouse_id
    FROM material_request_items mi
    JOIN material_requests mr ON mr.id = mi.request_id
    WHERE mr.id = NEW.id AND mi.quantity_issued > 0
  LOOP
    UPDATE inventory
    SET quantity = quantity - r.quantity_issued,
        updated_at = now()
    WHERE warehouse_id = r.warehouse_id AND material_id = r.material_id;

    IF NOT FOUND THEN
      INSERT INTO inventory (warehouse_id, material_id, quantity)
      VALUES (r.warehouse_id, r.material_id, -r.quantity_issued);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mr_sync_inventory ON material_requests;
CREATE TRIGGER trg_mr_sync_inventory
  AFTER UPDATE OF status ON material_requests
  FOR EACH ROW
  WHEN (NEW.status IN ('issued', 'partially_issued'))
  EXECUTE FUNCTION sync_stock_on_material_issue();

-- 10. Enable RLS
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_payment_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "goods_receipts_select" ON goods_receipts;
DROP POLICY IF EXISTS "goods_receipts_insert" ON goods_receipts;
DROP POLICY IF EXISTS "goods_receipts_update" ON goods_receipts;
DROP POLICY IF EXISTS "goods_receipt_items_select" ON goods_receipt_items;
DROP POLICY IF EXISTS "goods_receipt_items_insert" ON goods_receipt_items;
DROP POLICY IF EXISTS "goods_receipt_items_delete" ON goods_receipt_items;
DROP POLICY IF EXISTS "warehouse_bins_select" ON warehouse_bins;
DROP POLICY IF EXISTS "warehouse_bins_insert" ON warehouse_bins;
DROP POLICY IF EXISTS "warehouse_bins_update" ON warehouse_bins;
DROP POLICY IF EXISTS "inventory_bins_select" ON inventory_bins;
DROP POLICY IF EXISTS "inventory_bins_insert" ON inventory_bins;
DROP POLICY IF EXISTS "inventory_bins_update" ON inventory_bins;
DROP POLICY IF EXISTS "material_requests_select" ON material_requests;
DROP POLICY IF EXISTS "material_requests_insert" ON material_requests;
DROP POLICY IF EXISTS "material_requests_update" ON material_requests;
DROP POLICY IF EXISTS "material_request_items_select" ON material_request_items;
DROP POLICY IF EXISTS "material_request_items_insert" ON material_request_items;
DROP POLICY IF EXISTS "material_request_items_delete" ON material_request_items;
DROP POLICY IF EXISTS "stock_adjustments_select" ON stock_adjustments;
DROP POLICY IF EXISTS "stock_adjustments_insert" ON stock_adjustments;
DROP POLICY IF EXISTS "stock_adjustments_update" ON stock_adjustments;
DROP POLICY IF EXISTS "stock_adjustment_items_select" ON stock_adjustment_items;
DROP POLICY IF EXISTS "stock_adjustment_items_insert" ON stock_adjustment_items;
DROP POLICY IF EXISTS "stock_adjustment_items_delete" ON stock_adjustment_items;
DROP POLICY IF EXISTS "contract_amendments_select" ON contract_amendments;
DROP POLICY IF EXISTS "contract_amendments_insert" ON contract_amendments;
DROP POLICY IF EXISTS "contract_amendments_update" ON contract_amendments;
DROP POLICY IF EXISTS "contract_payment_schedules_select" ON contract_payment_schedules;
DROP POLICY IF EXISTS "contract_payment_schedules_insert" ON contract_payment_schedules;
DROP POLICY IF EXISTS "contract_payment_schedules_update" ON contract_payment_schedules;

CREATE POLICY "goods_receipts_select" ON goods_receipts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "goods_receipts_insert" ON goods_receipts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "goods_receipts_update" ON goods_receipts FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "goods_receipt_items_select" ON goods_receipt_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "goods_receipt_items_insert" ON goods_receipt_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "goods_receipt_items_delete" ON goods_receipt_items FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "warehouse_bins_select" ON warehouse_bins FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "warehouse_bins_insert" ON warehouse_bins FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "warehouse_bins_update" ON warehouse_bins FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "inventory_bins_select" ON inventory_bins FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inventory_bins_insert" ON inventory_bins FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "inventory_bins_update" ON inventory_bins FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "material_requests_select" ON material_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "material_requests_insert" ON material_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "material_requests_update" ON material_requests FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "material_request_items_select" ON material_request_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "material_request_items_insert" ON material_request_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "material_request_items_delete" ON material_request_items FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "stock_adjustments_select" ON stock_adjustments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "stock_adjustments_insert" ON stock_adjustments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "stock_adjustments_update" ON stock_adjustments FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "stock_adjustment_items_select" ON stock_adjustment_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "stock_adjustment_items_insert" ON stock_adjustment_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "stock_adjustment_items_delete" ON stock_adjustment_items FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "contract_amendments_select" ON contract_amendments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "contract_amendments_insert" ON contract_amendments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "contract_amendments_update" ON contract_amendments FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "contract_payment_schedules_select" ON contract_payment_schedules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "contract_payment_schedules_insert" ON contract_payment_schedules FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "contract_payment_schedules_update" ON contract_payment_schedules FOR UPDATE USING (auth.role() = 'authenticated');
