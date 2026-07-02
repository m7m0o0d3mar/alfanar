-- Field Service Management Module
-- Inspired by Acumatica (work orders, equipment), GoAudits (mobile field inspections)

-- 1. Customer Equipment Registry
CREATE TABLE IF NOT EXISTS fs_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
  equipment_code VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  model VARCHAR(255),
  serial_number VARCHAR(255),
  installation_date DATE,
  warranty_expiry DATE,
  location TEXT,
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Service Work Orders
CREATE TABLE IF NOT EXISTS fs_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_no VARCHAR(50) NOT NULL,
  ticket_id UUID REFERENCES technical_tickets(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  equipment_id UUID REFERENCES fs_equipment(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(50) DEFAULT 'pending',
  scheduled_date DATE,
  completed_date DATE,
  assigned_technician UUID REFERENCES employees(id) ON DELETE SET NULL,
  labor_hours DECIMAL(10,2) DEFAULT 0,
  parts_cost DECIMAL(14,2) DEFAULT 0,
  labor_cost DECIMAL(14,2) DEFAULT 0,
  total_cost DECIMAL(14,2) DEFAULT 0,
  customer_signature TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Work Order Items (labor, parts, expenses)
CREATE TABLE IF NOT EXISTS fs_work_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES fs_work_orders(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL DEFAULT 'labor',
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(14,2) DEFAULT 0,
  total_price DECIMAL(14,2) DEFAULT 0,
  material_id UUID REFERENCES materials_catalog(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Mobile Time Tracking (field clock-in/out)
CREATE TABLE IF NOT EXISTS fs_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  work_order_id UUID REFERENCES fs_work_orders(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  total_hours DECIMAL(10,2),
  notes TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE fs_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE fs_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE fs_work_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fs_time_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can read fs_equipment" ON fs_equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert fs_equipment" ON fs_equipment FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update fs_equipment" ON fs_equipment FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete fs_equipment" ON fs_equipment FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can read fs_work_orders" ON fs_work_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert fs_work_orders" ON fs_work_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update fs_work_orders" ON fs_work_orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete fs_work_orders" ON fs_work_orders FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can read fs_work_order_items" ON fs_work_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert fs_work_order_items" ON fs_work_order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update fs_work_order_items" ON fs_work_order_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete fs_work_order_items" ON fs_work_order_items FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can read fs_time_entries" ON fs_time_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert fs_time_entries" ON fs_time_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update fs_time_entries" ON fs_time_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete fs_time_entries" ON fs_time_entries FOR DELETE TO authenticated USING (true);
