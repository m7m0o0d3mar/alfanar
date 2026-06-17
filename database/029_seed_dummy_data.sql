-- ============================================================================
-- 029: Comprehensive Dummy Data Seed — All Tables
-- ============================================================================
-- Idempotent: uses WHERE NOT EXISTS / ON CONFLICT DO NOTHING
-- Run after: 028_phase2_features.sql
-- ============================================================================

-- Fix activity_weight to accept decimal percentages (e.g. 0.50, 0.125)
-- Must drop dependent views first, then recreate
DROP VIEW IF EXISTS project_progress;
ALTER TABLE item_definitions ALTER COLUMN activity_weight TYPE DECIMAL(7,4);
ALTER TABLE work_requests ALTER COLUMN activity_weight TYPE DECIMAL(7,4);
-- Recreate the project_progress view
CREATE OR REPLACE VIEW project_progress AS
SELECT
  p.id AS project_id,
  p.name_en AS project_name,
  COUNT(DISTINCT wr.id) FILTER (WHERE wr.status = 'approved') AS approved_requests,
  COUNT(DISTINCT wr.id) FILTER (WHERE wr.status NOT IN ('approved', 'rejected', 'draft')) AS pending_requests,
  COUNT(DISTINCT wr.id) FILTER (WHERE wr.status = 'rejected') AS rejected_requests,
  COALESCE(AVG(idf.activity_weight) FILTER (WHERE wr.status = 'approved'), 0) AS progress_percent,
  COUNT(DISTINCT u.id) AS total_units,
  COUNT(DISTINCT u.id) FILTER (WHERE wr.status = 'approved' AND wr.unit_id IS NOT NULL) AS completed_units
FROM projects p
LEFT JOIN work_requests wr ON wr.project_id = p.id
LEFT JOIN item_definitions idf ON idf.id = wr.item_definition_id
LEFT JOIN units u ON u.project_id = p.id
GROUP BY p.id, p.name_en;

DO $$
DECLARE
  -- Companies
  v_alfanar  UUID; v_binladin UUID; v_saico   UUID;
  -- Contractors
  v_main_con UUID; v_sub_con  UUID;
  -- Projects
  v_prj1 UUID; v_prj2 UUID; v_prj3 UUID; v_prj4 UUID;
  -- Blocks
  v_blk1 UUID; v_blk2 UUID; v_blk3 UUID;
  -- Units (project 1)
  v_u1 UUID; v_u2 UUID; v_u3 UUID; v_u4 UUID; v_u5 UUID;
  -- Units (project 2)
  v_u6 UUID; v_u7 UUID; v_u8 UUID; v_u9 UUID; v_u10 UUID;
  -- Units (project 3)
  v_u11 UUID; v_u12 UUID; v_u13 UUID; v_u14 UUID;
  -- Units (project 4)
  v_u15 UUID; v_u16 UUID; v_u17 UUID;
  -- User profiles (auth users + profiles)
  v_admin UUID; v_pm UUID; v_eng UUID; v_qc UUID; v_consult UUID;
  v_fin  UUID; v_hr  UUID; v_sales UUID; v_wh UUID; v_proc UUID;
  v_admin_id UUID; v_pm_id UUID; v_eng_id UUID; v_qc_id UUID; v_consult_id UUID;
  v_fin_id  UUID; v_hr_id UUID; v_sales_id UUID; v_wh_id UUID; v_proc_id UUID;
  -- Material categories
  v_cat1 UUID; v_cat2 UUID; v_cat3 UUID; v_cat4 UUID; v_cat5 UUID;
  v_cat6 UUID; v_cat7 UUID; v_cat8 UUID; v_cat9 UUID; v_cat10 UUID;
  -- Materials
  v_mat1 UUID; v_mat2 UUID; v_mat3 UUID; v_mat4 UUID; v_mat5 UUID;
  v_mat6 UUID; v_mat7 UUID; v_mat8 UUID; v_mat9 UUID; v_mat10 UUID;
  -- Warehouses
  v_wh1 UUID; v_wh2 UUID; v_wh3 UUID;
  -- Suppliers
  v_sup1 UUID; v_sup2 UUID;
  -- Item definitions
  v_item1 UUID; v_item2 UUID; v_item3 UUID; v_item4 UUID; v_item5 UUID;
  v_item6 UUID; v_item7 UUID; v_item8 UUID; v_item9 UUID; v_item10 UUID;
  -- WBS
  v_wbs1 UUID; v_wbs2 UUID; v_wbs3 UUID;
  -- Contracts
  v_cont1 UUID; v_cont2 UUID;
  -- Employees
  v_emp1 UUID; v_emp2 UUID; v_emp3 UUID; v_emp4 UUID; v_emp5 UUID;
  v_emp6 UUID; v_emp7 UUID; v_emp8 UUID; v_emp9 UUID; v_emp10 UUID;
  -- Commissions
  v_com1 UUID; v_com2 UUID; v_com3 UUID;
  -- Purchase requisitions
  v_pr1 UUID; v_pr2 UUID;
  -- Approval requests
  v_app1 UUID; v_app2 UUID;
BEGIN

  -- ==========================================================================
  -- 1. COMPANIES / CONTRACTORS
  -- ==========================================================================

  INSERT INTO companies (id, company_type, name_en, name_ar, commercial_reg, tax_id, phone, email, address, is_active)
  SELECT gen_random_uuid(), 'main_contractor', 'Alfanar Construction Co.', 'شركة الفنار للإنشاءات', 'CR-200001', 'TAX-100001', '+966 11 200 1234', 'info@alfanar.com', 'Olaya Street, Riyadh 12211', true
  WHERE NOT EXISTS (SELECT 1 FROM companies WHERE commercial_reg = 'CR-200001')
  RETURNING id INTO v_alfanar;

  IF v_alfanar IS NULL THEN SELECT id INTO v_alfanar FROM companies WHERE commercial_reg = 'CR-200001'; END IF;

  INSERT INTO companies (id, company_type, name_en, name_ar, commercial_reg, tax_id, phone, email, address, is_active)
  SELECT gen_random_uuid(), 'subcontractor', 'Saudi Binladin Group', 'مجموعة بن لادن السعودية', 'CR-200002', 'TAX-100002', '+966 12 660 2000', 'info@binladin.com', 'King Abdulaziz Road, Jeddah 21589', true
  WHERE NOT EXISTS (SELECT 1 FROM companies WHERE commercial_reg = 'CR-200002')
  RETURNING id INTO v_binladin;

  IF v_binladin IS NULL THEN SELECT id INTO v_binladin FROM companies WHERE commercial_reg = 'CR-200002'; END IF;

  INSERT INTO companies (id, company_type, name_en, name_ar, commercial_reg, tax_id, phone, email, address, is_active)
  SELECT gen_random_uuid(), 'consultant', 'SAICO Consulting Engineers', 'سايكو للاستشارات الهندسية', 'CR-200003', 'TAX-100003', '+966 13 820 3000', 'info@saico.com', 'Prince Mohammed Street, Dammam 31422', true
  WHERE NOT EXISTS (SELECT 1 FROM companies WHERE commercial_reg = 'CR-200003')
  RETURNING id INTO v_saico;

  IF v_saico IS NULL THEN SELECT id INTO v_saico FROM companies WHERE commercial_reg = 'CR-200003'; END IF;

  -- Contractors
  INSERT INTO contractors (id, company_id, contractor_type, license_number, classification, is_approved)
  SELECT gen_random_uuid(), v_alfanar, 'main', 'LIC-MC-001', 'Grade A', true
  WHERE NOT EXISTS (SELECT 1 FROM contractors WHERE company_id = v_alfanar AND contractor_type = 'main')
  RETURNING id INTO v_main_con;

  IF v_main_con IS NULL THEN SELECT id INTO v_main_con FROM contractors WHERE company_id = v_alfanar AND contractor_type = 'main'; END IF;

  INSERT INTO contractors (id, company_id, contractor_type, parent_contractor_id, license_number, classification, is_approved)
  SELECT gen_random_uuid(), v_binladin, 'sub', v_main_con, 'LIC-SC-001', 'Grade B', true
  WHERE NOT EXISTS (SELECT 1 FROM contractors WHERE company_id = v_binladin AND contractor_type = 'sub')
  RETURNING id INTO v_sub_con;

  IF v_sub_con IS NULL THEN SELECT id INTO v_sub_con FROM contractors WHERE company_id = v_binladin AND contractor_type = 'sub'; END IF;

  -- ==========================================================================
  -- 2. PROJECTS (4 projects)
  -- ==========================================================================

  INSERT INTO projects (id, project_code, name_en, name_ar, company_id, project_type, status, start_date, end_date, location, latitude, longitude, total_area, built_up_area, budget_amount, progress_percent, client_name, consultant_name, consultant_company, is_active)
  SELECT gen_random_uuid(), 'PRJ-2025-001', 'Riyadh Residential Tower', 'برج الرياض السكني', v_alfanar, 'residential', 'in_progress', '2025-01-15', '2026-12-31', 'Olaya District, Riyadh', 24.7136, 46.6753, 5000.00, 8500.00, 95000000.00, 35.00, 'Al-Othman Holding', 'Engineer Abdullah Hassan', v_saico, true
  WHERE NOT EXISTS (SELECT 1 FROM projects WHERE project_code = 'PRJ-2025-001')
  RETURNING id INTO v_prj1;

  IF v_prj1 IS NULL THEN SELECT id INTO v_prj1 FROM projects WHERE project_code = 'PRJ-2025-001'; END IF;

  INSERT INTO projects (id, project_code, name_en, name_ar, company_id, project_type, status, start_date, end_date, location, latitude, longitude, total_area, built_up_area, budget_amount, progress_percent, client_name, consultant_name, consultant_company, is_active)
  SELECT gen_random_uuid(), 'PRJ-2025-002', 'Jubail Commercial Complex', 'مجمع الجبيل التجاري', v_alfanar, 'commercial', 'in_progress', '2025-03-01', '2027-06-30', 'Al-Jubail Industrial City', 27.0050, 49.6580, 12000.00, 18500.00, 180000000.00, 18.00, 'Jubail Development Co.', 'Saud Al-Mutairi Consulting', v_saico, true
  WHERE NOT EXISTS (SELECT 1 FROM projects WHERE project_code = 'PRJ-2025-002')
  RETURNING id INTO v_prj2;

  IF v_prj2 IS NULL THEN SELECT id INTO v_prj2 FROM projects WHERE project_code = 'PRJ-2025-002'; END IF;

  INSERT INTO projects (id, project_code, name_en, name_ar, company_id, project_type, status, start_date, end_date, location, latitude, longitude, total_area, built_up_area, budget_amount, progress_percent, client_name, consultant_name, consultant_company, is_active)
  SELECT gen_random_uuid(), 'PRJ-2025-003', 'Dammam Infrastructure Project', 'مشروع البنية التحتية - الدمام', v_alfanar, 'infrastructure', 'planning', '2025-09-01', '2028-03-31', 'Industrial Area, Dammam', 26.4207, 50.0888, 50000.00, 5000.00, 250000000.00, 5.00, 'Dammam Municipality', 'Parsons Saudi Arabia', v_saico, true
  WHERE NOT EXISTS (SELECT 1 FROM projects WHERE project_code = 'PRJ-2025-003')
  RETURNING id INTO v_prj3;

  IF v_prj3 IS NULL THEN SELECT id INTO v_prj3 FROM projects WHERE project_code = 'PRJ-2025-003'; END IF;

  INSERT INTO projects (id, project_code, name_en, name_ar, company_id, project_type, status, start_date, end_date, location, latitude, longitude, total_area, built_up_area, budget_amount, progress_percent, actual_end_date, client_name, is_active)
  SELECT gen_random_uuid(), 'PRJ-2024-004', 'Al-Olaya Luxury Villa', 'فيلا العليا الفاخرة', v_alfanar, 'residential', 'completed', '2024-06-01', '2025-05-31', 'Al-Olaya, Riyadh', 24.6800, 46.6800, 1200.00, 950.00, 8500000.00, 100.00, '2025-05-15', 'Prince Faisal bin Sultan', true
  WHERE NOT EXISTS (SELECT 1 FROM projects WHERE project_code = 'PRJ-2024-004')
  RETURNING id INTO v_prj4;

  IF v_prj4 IS NULL THEN SELECT id INTO v_prj4 FROM projects WHERE project_code = 'PRJ-2024-004'; END IF;

  -- ==========================================================================
  -- 3. BLOCKS
  -- ==========================================================================

  INSERT INTO blocks (id, project_id, block_code, name_en, name_ar, block_type, floor_count, total_units, status)
  SELECT gen_random_uuid(), v_prj1, 'BLK-A', 'Tower A', 'البرج أ', 'tower', 20, 80, 'in_progress'
  WHERE NOT EXISTS (SELECT 1 FROM blocks WHERE project_id = v_prj1 AND block_code = 'BLK-A')
  RETURNING id INTO v_blk1;

  IF v_blk1 IS NULL THEN SELECT id INTO v_blk1 FROM blocks WHERE project_id = v_prj1 AND block_code = 'BLK-A'; END IF;

  INSERT INTO blocks (id, project_id, block_code, name_en, name_ar, block_type, floor_count, total_units, status)
  SELECT gen_random_uuid(), v_prj2, 'BLK-B', 'Main Mall Building', 'مبنى المول الرئيسي', 'building', 4, 40, 'in_progress'
  WHERE NOT EXISTS (SELECT 1 FROM blocks WHERE project_id = v_prj2 AND block_code = 'BLK-B')
  RETURNING id INTO v_blk2;

  IF v_blk2 IS NULL THEN SELECT id INTO v_blk2 FROM blocks WHERE project_id = v_prj2 AND block_code = 'BLK-B'; END IF;

  INSERT INTO blocks (id, project_id, block_code, name_en, name_ar, block_type, floor_count, total_units, status)
  SELECT gen_random_uuid(), v_prj2, 'BLK-C', 'Villa Compound', 'مجمع الفيلات', 'villa', 2, 12, 'planning'
  WHERE NOT EXISTS (SELECT 1 FROM blocks WHERE project_id = v_prj2 AND block_code = 'BLK-C')
  RETURNING id INTO v_blk3;

  IF v_blk3 IS NULL THEN SELECT id INTO v_blk3 FROM blocks WHERE project_id = v_prj2 AND block_code = 'BLK-C'; END IF;

  -- ==========================================================================
  -- 4. UNITS (17 units across projects)
  -- ==========================================================================

  -- Project 1: Tower units
  INSERT INTO units (id, project_id, block_id, unit_code, unit_type, floor_number, area_sqm, area_built, bedrooms, bathrooms, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, sale_type)
  SELECT gen_random_uuid(), v_prj1, v_blk1, 'A-101', 'apartment', 1, 125.00, 110.00, 3, 2, 'available', 950000.00, 'Zone A', 'Block 1', 'Standard 3BR', 50.00, 6500.00, 4000.00, 'offline'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_prj1 AND unit_code = 'A-101')
  RETURNING id INTO v_u1;

  IF v_u1 IS NULL THEN SELECT id INTO v_u1 FROM units WHERE project_id = v_prj1 AND unit_code = 'A-101'; END IF;

  INSERT INTO units (id, project_id, block_id, unit_code, unit_type, floor_number, area_sqm, area_built, bedrooms, bathrooms, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, sale_type)
  SELECT gen_random_uuid(), v_prj1, v_blk1, 'A-102', 'apartment', 1, 95.00, 85.00, 2, 2, 'sold', 720000.00, 'Zone A', 'Block 1', 'Standard 2BR', 40.00, 6200.00, 3800.00, 'offline'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_prj1 AND unit_code = 'A-102')
  RETURNING id INTO v_u2;

  IF v_u2 IS NULL THEN SELECT id INTO v_u2 FROM units WHERE project_id = v_prj1 AND unit_code = 'A-102'; END IF;

  INSERT INTO units (id, project_id, block_id, unit_code, unit_type, floor_number, area_sqm, area_built, bedrooms, bathrooms, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, sale_type)
  SELECT gen_random_uuid(), v_prj1, v_blk1, 'A-201', 'apartment', 2, 150.00, 135.00, 4, 3, 'available', 1250000.00, 'Zone A', 'Block 1', 'Premium 4BR', 55.00, 7000.00, 4200.00, 'offline'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_prj1 AND unit_code = 'A-201')
  RETURNING id INTO v_u3;

  IF v_u3 IS NULL THEN SELECT id INTO v_u3 FROM units WHERE project_id = v_prj1 AND unit_code = 'A-201'; END IF;

  INSERT INTO units (id, project_id, block_id, unit_code, unit_type, floor_number, area_sqm, area_built, bedrooms, bathrooms, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, sale_type)
  SELECT gen_random_uuid(), v_prj1, v_blk1, 'A-301', 'penthouse', 3, 250.00, 220.00, 5, 4, 'available', 2500000.00, 'Zone A', 'Block 1', 'Penthouse Deluxe', 80.00, 8500.00, 5000.00, 'online'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_prj1 AND unit_code = 'A-301')
  RETURNING id INTO v_u4;

  IF v_u4 IS NULL THEN SELECT id INTO v_u4 FROM units WHERE project_id = v_prj1 AND unit_code = 'A-301'; END IF;

  INSERT INTO units (id, project_id, block_id, unit_code, unit_type, floor_number, area_sqm, area_built, bedrooms, bathrooms, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, sale_type)
  SELECT gen_random_uuid(), v_prj1, v_blk1, 'A-302', 'studio', 3, 35.00, 30.00, 0, 1, 'reserved', 320000.00, 'Zone A', 'Block 1', 'Studio Compact', 15.00, 5800.00, 3500.00, 'offline'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_prj1 AND unit_code = 'A-302')
  RETURNING id INTO v_u5;

  IF v_u5 IS NULL THEN SELECT id INTO v_u5 FROM units WHERE project_id = v_prj1 AND unit_code = 'A-302'; END IF;

  -- Project 2: Commercial units
  INSERT INTO units (id, project_id, block_id, unit_code, unit_type, floor_number, area_sqm, area_built, bedrooms, bathrooms, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, sale_type)
  SELECT gen_random_uuid(), v_prj2, v_blk2, 'S-01', 'shop', 1, 180.00, 160.00, 0, 1, 'available', 2100000.00, 'Retail Zone', 'Block B', 'Retail Shop Medium', 60.00, 9000.00, 6000.00, 'offline'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_prj2 AND unit_code = 'S-01')
  RETURNING id INTO v_u6;

  IF v_u6 IS NULL THEN SELECT id INTO v_u6 FROM units WHERE project_id = v_prj2 AND unit_code = 'S-01'; END IF;

  INSERT INTO units (id, project_id, block_id, unit_code, unit_type, floor_number, area_sqm, area_built, bedrooms, bathrooms, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, sale_type)
  SELECT gen_random_uuid(), v_prj2, v_blk2, 'S-02', 'shop', 1, 220.00, 195.00, 0, 2, 'available', 2800000.00, 'Retail Zone', 'Block B', 'Retail Shop Large', 75.00, 9500.00, 6500.00, 'offline'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_prj2 AND unit_code = 'S-02')
  RETURNING id INTO v_u7;

  IF v_u7 IS NULL THEN SELECT id INTO v_u7 FROM units WHERE project_id = v_prj2 AND unit_code = 'S-02'; END IF;

  INSERT INTO units (id, project_id, block_id, unit_code, unit_type, floor_number, area_sqm, area_built, bedrooms, bathrooms, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, sale_type)
  SELECT gen_random_uuid(), v_prj2, v_blk2, 'O-01', 'office', 2, 300.00, 270.00, 0, 2, 'available', 3600000.00, 'Office Zone', 'Block B', 'Office Suite', 100.00, 8500.00, 5500.00, 'online'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_prj2 AND unit_code = 'O-01')
  RETURNING id INTO v_u8;

  IF v_u8 IS NULL THEN SELECT id INTO v_u8 FROM units WHERE project_id = v_prj2 AND unit_code = 'O-01'; END IF;

  INSERT INTO units (id, project_id, block_id, unit_code, unit_type, floor_number, area_sqm, area_built, bedrooms, bathrooms, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, sale_type)
  SELECT gen_random_uuid(), v_prj2, v_blk2, 'O-02', 'office', 3, 150.00, 135.00, 0, 1, 'available', 1750000.00, 'Office Zone', 'Block B', 'Office Small', 50.00, 8000.00, 5000.00, 'offline'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_prj2 AND unit_code = 'O-02')
  RETURNING id INTO v_u9;

  IF v_u9 IS NULL THEN SELECT id INTO v_u9 FROM units WHERE project_id = v_prj2 AND unit_code = 'O-02'; END IF;

  INSERT INTO units (id, project_id, block_id, unit_code, unit_type, floor_number, area_sqm, area_built, bedrooms, bathrooms, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, sale_type)
  SELECT gen_random_uuid(), v_prj2, v_blk3, 'V-A1', 'villa', 1, 450.00, 380.00, 5, 4, 'available', 3200000.00, 'Villa Zone', 'Block C', 'Villa Standard', 350.00, 5500.00, 3500.00, 'offline'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_prj2 AND unit_code = 'V-A1')
  RETURNING id INTO v_u10;

  IF v_u10 IS NULL THEN SELECT id INTO v_u10 FROM units WHERE project_id = v_prj2 AND unit_code = 'V-A1'; END IF;

  -- Project 3: Infrastructure (plots / land)
  INSERT INTO units (id, project_id, unit_code, unit_type, area_sqm, area_built, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, sale_type)
  SELECT gen_random_uuid(), v_prj3, 'PL-01', 'plot', 5000.00, 500.00, 'available', 5000000.00, 'Industrial', 'Plot Block 1', 'Industrial Plot', 5000.00, 200.00, 1000.00, 'offline'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_prj3 AND unit_code = 'PL-01')
  RETURNING id INTO v_u11;

  IF v_u11 IS NULL THEN SELECT id INTO v_u11 FROM units WHERE project_id = v_prj3 AND unit_code = 'PL-01'; END IF;

  INSERT INTO units (id, project_id, unit_code, unit_type, area_sqm, area_built, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, sale_type)
  SELECT gen_random_uuid(), v_prj3, 'PL-02', 'plot', 3000.00, 300.00, 'available', 2800000.00, 'Industrial', 'Plot Block 1', 'Industrial Plot', 3000.00, 200.00, 900.00, 'offline'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_prj3 AND unit_code = 'PL-02')
  RETURNING id INTO v_u12;

  IF v_u12 IS NULL THEN SELECT id INTO v_u12 FROM units WHERE project_id = v_prj3 AND unit_code = 'PL-02'; END IF;

  INSERT INTO units (id, project_id, unit_code, unit_type, area_sqm, area_built, bedrooms, bathrooms, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, sale_type)
  SELECT gen_random_uuid(), v_prj3, 'WH-01', 'warehouse', 1000.00, 900.00, 0, 2, 'available', 1800000.00, 'Logistics', 'Warehouse Block', 'Storage Warehouse', 800.00, 1500.00, 800.00, 'offline'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_prj3 AND unit_code = 'WH-01')
  RETURNING id INTO v_u13;

  IF v_u13 IS NULL THEN SELECT id INTO v_u13 FROM units WHERE project_id = v_prj3 AND unit_code = 'WH-01'; END IF;

  INSERT INTO units (id, project_id, unit_code, unit_type, area_sqm, area_built, bedrooms, bathrooms, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, sale_type)
  SELECT gen_random_uuid(), v_prj3, 'WH-02', 'warehouse', 800.00, 700.00, 0, 1, 'available', 1400000.00, 'Logistics', 'Warehouse Block', 'Storage Warehouse', 650.00, 1400.00, 750.00, 'offline'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_prj3 AND unit_code = 'WH-02')
  RETURNING id INTO v_u14;

  IF v_u14 IS NULL THEN SELECT id INTO v_u14 FROM units WHERE project_id = v_prj3 AND unit_code = 'WH-02'; END IF;

  -- Project 4: Luxury Villa (completed)
  INSERT INTO units (id, project_id, unit_code, unit_type, area_sqm, area_built, bedrooms, bathrooms, status, price, handover_date, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, sale_type)
  SELECT gen_random_uuid(), v_prj4, 'V-M1', 'villa', 800.00, 650.00, 6, 6, 'sold', 7500000.00, '2025-05-10', 'Villa Zone', 'Main Villa', 'Executive Villa', 600.00, 8000.00, 5000.00, 'offline'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_prj4 AND unit_code = 'V-M1')
  RETURNING id INTO v_u15;

  IF v_u15 IS NULL THEN SELECT id INTO v_u15 FROM units WHERE project_id = v_prj4 AND unit_code = 'V-M1'; END IF;

  INSERT INTO units (id, project_id, unit_code, unit_type, area_sqm, area_built, bedrooms, bathrooms, status, price, handover_date, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, sale_type)
  SELECT gen_random_uuid(), v_prj4, 'G-01', 'duplex', 400.00, 350.00, 4, 3, 'sold', 2800000.00, '2025-04-20', 'Guest House', 'Main Villa', 'Guest Duplex', 300.00, 6000.00, 3500.00, 'offline'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_prj4 AND unit_code = 'G-01')
  RETURNING id INTO v_u16;

  IF v_u16 IS NULL THEN SELECT id INTO v_u16 FROM units WHERE project_id = v_prj4 AND unit_code = 'G-01'; END IF;

  INSERT INTO units (id, project_id, unit_code, unit_type, area_sqm, area_built, bedrooms, bathrooms, status, price, handover_date, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, sale_type)
  SELECT gen_random_uuid(), v_prj4, 'S-01', 'studio', 50.00, 45.00, 1, 1, 'sold', 450000.00, '2025-05-01', 'Staff Quarters', 'Main Villa', 'Staff Studio', 25.00, 7000.00, 4000.00, 'offline'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_prj4 AND unit_code = 'S-01')
  RETURNING id INTO v_u17;

  IF v_u17 IS NULL THEN SELECT id INTO v_u17 FROM units WHERE project_id = v_prj4 AND unit_code = 'S-01'; END IF;

  -- ==========================================================================
  -- 5. AUTH USERS + USER PROFILES (10 users)
  -- ==========================================================================

  -- First, create auth.users entries (required FK for user_profiles)
  -- Use fixed UUIDs so we can reference them consistently
  v_admin_id := gen_random_uuid(); v_pm_id := gen_random_uuid();
  v_eng_id := gen_random_uuid(); v_qc_id := gen_random_uuid();
  v_consult_id := gen_random_uuid(); v_fin_id := gen_random_uuid();
  v_hr_id := gen_random_uuid(); v_sales_id := gen_random_uuid();
  v_wh_id := gen_random_uuid(); v_proc_id := gen_random_uuid();

  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, confirmation_sent_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
  SELECT u.id, u.email, '$2a$10$dummyhash', now(), now(), now(), now(), '{"provider":"email"}'::jsonb, jsonb_build_object('full_name', u.full_name_en), false, 'authenticated'
  FROM (VALUES
    (v_admin_id, 'admin@alfanar.com', 'Abdullah Al-Qahtani'),
    (v_pm_id, 'pm@alfanar.com', 'Ahmed Al-Otaibi'),
    (v_eng_id, 'engineer@alfanar.com', 'Khalid Al-Harbi'),
    (v_qc_id, 'qc@alfanar.com', 'Nasser Al-Ghamdi'),
    (v_consult_id, 'consultant@saico.com', 'Faisal Al-Shehri'),
    (v_fin_id, 'finance@alfanar.com', 'Mohammed Al-Zahrani'),
    (v_hr_id, 'hr@alfanar.com', 'Sara Al-Mutairi'),
    (v_sales_id, 'sales@alfanar.com', 'Noura Al-Dosari'),
    (v_wh_id, 'warehouse@alfanar.com', 'Mansour Al-Anezi'),
    (v_proc_id, 'procurement@alfanar.com', 'Sultan Al-Balawi')
  ) AS u(id, email, full_name_en)
  WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = u.email)
  ON CONFLICT (id) DO NOTHING;

  -- Then insert into user_profiles
  INSERT INTO user_profiles (id, email, full_name_en, full_name_ar, phone, role, default_language, is_active)
  SELECT u.id, u.email, u.full_name_en, u.full_name_ar, u.phone, u.role, u.lang, true
  FROM (VALUES
    (v_admin_id, 'admin@alfanar.com', 'Abdullah Al-Qahtani', 'عبدالله القحطاني', '+966 50 000 0001', 'admin', 'ar'),
    (v_pm_id, 'pm@alfanar.com', 'Ahmed Al-Otaibi', 'أحمد العتيبي', '+966 50 000 0002', 'project_manager', 'ar'),
    (v_eng_id, 'engineer@alfanar.com', 'Khalid Al-Harbi', 'خالد الحربي', '+966 50 000 0003', 'engineer', 'ar'),
    (v_qc_id, 'qc@alfanar.com', 'Nasser Al-Ghamdi', 'ناصر الغامدي', '+966 50 000 0004', 'quality', 'ar'),
    (v_consult_id, 'consultant@saico.com', 'Faisal Al-Shehri', 'فيصل الشهري', '+966 50 000 0005', 'consultant', 'en'),
    (v_fin_id, 'finance@alfanar.com', 'Mohammed Al-Zahrani', 'محمد الزهراني', '+966 50 000 0006', 'finance', 'ar'),
    (v_hr_id, 'hr@alfanar.com', 'Sara Al-Mutairi', 'سارة المطيري', '+966 50 000 0007', 'hr', 'ar'),
    (v_sales_id, 'sales@alfanar.com', 'Noura Al-Dosari', 'نورة الدوسري', '+966 50 000 0008', 'sales', 'ar'),
    (v_wh_id, 'warehouse@alfanar.com', 'Mansour Al-Anezi', 'منصور العنزي', '+966 50 000 0009', 'engineer', 'ar'),
    (v_proc_id, 'procurement@alfanar.com', 'Sultan Al-Balawi', 'سلطان البلوي', '+966 50 000 0010', 'engineer', 'en')
  ) AS u(id, email, full_name_en, full_name_ar, phone, role, lang)
  WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE email = u.email)
  ON CONFLICT (id) DO NOTHING;

  v_admin := v_admin_id; v_pm := v_pm_id; v_eng := v_eng_id; v_qc := v_qc_id;
  v_consult := v_consult_id; v_fin := v_fin_id; v_hr := v_hr_id;
  v_sales := v_sales_id; v_wh := v_wh_id; v_proc := v_proc_id;

  -- ==========================================================================
  -- 6. MATERIAL CATEGORIES + MATERIALS
  -- ==========================================================================

  INSERT INTO material_categories (id, code, name_en, name_ar, is_active)
  VALUES
    (gen_random_uuid(), 'CONC', 'Concrete', 'خرسانة', true),
    (gen_random_uuid(), 'STEL', 'Steel Reinforcement', 'حديد تسليح', true),
    (gen_random_uuid(), 'BLOC', 'Blocks & Bricks', 'بلوك وطوب', true),
    (gen_random_uuid(), 'SAND', 'Sand & Aggregates', 'رمل وزلط', true),
    (gen_random_uuid(), 'CEM', 'Cement', 'أسمنت', true),
    (gen_random_uuid(), 'PLUM', 'Plumbing', 'مواد سباكة', true),
    (gen_random_uuid(), 'ELEC', 'Electrical', 'مواد كهربائية', true),
    (gen_random_uuid(), 'FINS', 'Finishes', 'مواد التشطيب', true),
    (gen_random_uuid(), 'WOOD', 'Wood & Carpentry', 'أخشاب ونجارة', true),
    (gen_random_uuid(), 'SAFE', 'Safety Equipment', 'معدات سلامة', true)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_cat1 FROM material_categories WHERE code = 'CONC';
  SELECT id INTO v_cat2 FROM material_categories WHERE code = 'STEL';
  SELECT id INTO v_cat3 FROM material_categories WHERE code = 'BLOC';
  SELECT id INTO v_cat4 FROM material_categories WHERE code = 'SAND';
  SELECT id INTO v_cat5 FROM material_categories WHERE code = 'CEM';
  SELECT id INTO v_cat6 FROM material_categories WHERE code = 'PLUM';
  SELECT id INTO v_cat7 FROM material_categories WHERE code = 'ELEC';
  SELECT id INTO v_cat8 FROM material_categories WHERE code = 'FINS';
  SELECT id INTO v_cat9 FROM material_categories WHERE code = 'WOOD';
  SELECT id INTO v_cat10 FROM material_categories WHERE code = 'SAFE';

  INSERT INTO materials (id, code, name_en, name_ar, category_id, unit, default_price, is_active)
  VALUES
    (gen_random_uuid(), 'CONC-25', 'Ready Mix Concrete 25 MPa', 'خرسانة جاهزة 25 ميجا باسكال', v_cat1, 'm3', 280.00, true),
    (gen_random_uuid(), 'CONC-30', 'Ready Mix Concrete 30 MPa', 'خرسانة جاهزة 30 ميجا باسكال', v_cat1, 'm3', 320.00, true),
    (gen_random_uuid(), 'STL-12', 'Steel Rebar 12mm', 'حديد تسليح 12 مم', v_cat2, 'ton', 2800.00, true),
    (gen_random_uuid(), 'STL-16', 'Steel Rebar 16mm', 'حديد تسليح 16 مم', v_cat2, 'ton', 2750.00, true),
    (gen_random_uuid(), 'BLK-20', 'Concrete Block 20cm', 'بلوك خرساني 20 سم', v_cat3, 'pcs', 4.50, true),
    (gen_random_uuid(), 'BLK-15', 'Concrete Block 15cm', 'بلوك خرساني 15 سم', v_cat3, 'pcs', 3.80, true),
    (gen_random_uuid(), 'SND-W', 'Washed Sand', 'رمل مغسول', v_cat4, 'm3', 65.00, true),
    (gen_random_uuid(), 'AGR-20', 'Aggregate 20mm', 'زلط 20 مم', v_cat4, 'm3', 85.00, true),
    (gen_random_uuid(), 'CEM-I', 'Portland Cement Type I', 'أسمنت بورتلاند نوع 1', v_cat5, 'bag', 18.00, true),
    (gen_random_uuid(), 'PLB-25', 'PVC Pipe 25mm', 'مواسير بي في سي 25 مم', v_cat6, 'm', 12.00, true),
    (gen_random_uuid(), 'PLB-50', 'PVC Pipe 50mm', 'مواسير بي في سي 50 مم', v_cat6, 'm', 22.00, true),
    (gen_random_uuid(), 'ELC-2.5', 'Electric Cable 2.5mm', 'سلك كهرباء 2.5 مم', v_cat7, 'm', 3.50, true),
    (gen_random_uuid(), 'ELC-4', 'Electric Cable 4mm', 'سلك كهرباء 4 مم', v_cat7, 'm', 5.80, true),
    (gen_random_uuid(), 'ELC-SW', 'Switch Socket Outlet', 'مفتاح ومخرج كهرباء', v_cat7, 'pcs', 15.00, true),
    (gen_random_uuid(), 'FIN-CER', 'Ceramic Floor Tile 60x60', 'بلاط سيراميك أرضيات 60×60', v_cat8, 'm2', 55.00, true),
    (gen_random_uuid(), 'FIN-PNT', 'Interior Wall Paint White', 'دهان جدران داخلي أبيض', v_cat8, 'gallon', 85.00, true),
    (gen_random_uuid(), 'FIN-GYP', 'Gypsum Board 12mm', 'جبسم بورد 12 مم', v_cat8, 'pcs', 28.00, true),
    (gen_random_uuid(), 'FIN-MAR', 'Marble Floor Tile 80x80', 'بلاط رخام أرضيات 80×80', v_cat8, 'm2', 180.00, true),
    (gen_random_uuid(), 'WD-PLY', 'Plywood 18mm', 'خشب أبلاكاج 18 مم', v_cat9, 'pcs', 95.00, true),
    (gen_random_uuid(), 'WD-FRM', 'Timber Frame 2x4', 'خشب هيكلي 2×4', v_cat9, 'm', 12.00, true),
    (gen_random_uuid(), 'SAF-HLM', 'Safety Helmet', 'خوذة أمان', v_cat10, 'pcs', 35.00, true),
    (gen_random_uuid(), 'SAF-VST', 'Safety Vest', 'سترة أمان', v_cat10, 'pcs', 25.00, true),
    (gen_random_uuid(), 'SAF-GLO', 'Safety Gloves', 'قفازات أمان', v_cat10, 'pair', 15.00, true),
    (gen_random_uuid(), 'CONC-PR', 'Concrete Paver Interlock', 'إنترلوك بلاط خرساني', v_cat1, 'm2', 42.00, true),
    (gen_random_uuid(), 'STL-MSH', 'Steel Wire Mesh 150x150', 'شبك حديد ملحوم 150×150', v_cat2, 'pcs', 120.00, true),
    (gen_random_uuid(), 'FIN-WDW', 'UPVC Window 1.2x1.0m', 'نافذة يو بي في سي 1.2×1.0 م', v_cat8, 'pcs', 450.00, true),
    (gen_random_uuid(), 'ELC-DB', 'Distribution Board 18-way', 'لوحة توزيع 18 دائرة', v_cat7, 'pcs', 320.00, true),
    (gen_random_uuid(), 'PLB-TNK', 'Water Tank 2000L', 'خزان مياه 2000 لتر', v_cat6, 'pcs', 850.00, true),
    (gen_random_uuid(), 'SAF-CON', 'Safety Cone', 'مخروط أمان', v_cat10, 'pcs', 45.00, true),
    (gen_random_uuid(), 'FIN-DOR', 'Interior Door Wooden', 'باب داخلي خشبي', v_cat8, 'pcs', 680.00, true)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_mat1 FROM materials WHERE code = 'CONC-25';
  SELECT id INTO v_mat2 FROM materials WHERE code = 'CONC-30';
  SELECT id INTO v_mat3 FROM materials WHERE code = 'STL-12';
  SELECT id INTO v_mat4 FROM materials WHERE code = 'STL-16';
  SELECT id INTO v_mat5 FROM materials WHERE code = 'BLK-20';
  SELECT id INTO v_mat6 FROM materials WHERE code = 'CEM-I';
  SELECT id INTO v_mat7 FROM materials WHERE code = 'FIN-CER';
  SELECT id INTO v_mat8 FROM materials WHERE code = 'ELC-2.5';
  SELECT id INTO v_mat9 FROM materials WHERE code = 'FIN-PNT';
  SELECT id INTO v_mat10 FROM materials WHERE code = 'SAF-HLM';

  -- ==========================================================================
  -- 7. WAREHOUSES + INVENTORY
  -- ==========================================================================

  INSERT INTO warehouses (id, code, name_en, name_ar, location, project_id, is_active)
  VALUES
    (gen_random_uuid(), 'WH-RYD-01', 'Riyadh Main Warehouse', 'مستودع الرياض الرئيسي', 'Industrial City, Riyadh', v_prj1, true),
    (gen_random_uuid(), 'WH-JED-01', 'Jeddah Site Warehouse', 'مستودع الموقع - جدة', 'Al-Hamra, Jeddah', v_prj2, true),
    (gen_random_uuid(), 'WH-DMM-01', 'Dammam Logistics Warehouse', 'مستودع الدمام اللوجستي', 'Industrial Area, Dammam', v_prj3, true)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_wh1 FROM warehouses WHERE code = 'WH-RYD-01';
  SELECT id INTO v_wh2 FROM warehouses WHERE code = 'WH-JED-01';
  SELECT id INTO v_wh3 FROM warehouses WHERE code = 'WH-DMM-01';

  -- Inventory stock across warehouses
  INSERT INTO inventory (warehouse_id, material_id, quantity, min_quantity, unit_price, batch_no)
  VALUES
    (v_wh1, v_mat1, 150.00, 50.00, 280.00, 'B-CONC-001'),
    (v_wh1, v_mat3, 25.00, 10.00, 2800.00, 'B-STL-001'),
    (v_wh1, v_mat5, 5000.00, 1000.00, 4.50, 'B-BLK-001'),
    (v_wh1, v_mat6, 800.00, 200.00, 18.00, 'B-CEM-001'),
    (v_wh1, v_mat7, 1200.00, 300.00, 55.00, 'B-FIN-001'),
    (v_wh2, v_mat2, 80.00, 30.00, 320.00, 'B-CONC-002'),
    (v_wh2, v_mat4, 15.00, 5.00, 2750.00, 'B-STL-002'),
    (v_wh2, v_mat8, 2000.00, 500.00, 3.50, 'B-ELC-001'),
    (v_wh2, v_mat9, 300.00, 100.00, 85.00, 'B-PNT-001'),
    (v_wh3, v_mat1, 200.00, 60.00, 285.00, 'B-CONC-003'),
    (v_wh3, v_mat5, 3000.00, 800.00, 4.20, 'B-BLK-002'),
    (v_wh3, v_mat6, 500.00, 150.00, 17.50, 'B-CEM-002'),
    (v_wh3, v_mat10, 100.00, 30.00, 35.00, 'B-SAF-001')
  ON CONFLICT (warehouse_id, material_id, batch_no) DO NOTHING;

  -- ==========================================================================
  -- 8. SUPPLIERS (additional beyond 021_seed_suppliers.sql)
  -- ==========================================================================

  INSERT INTO suppliers (id, supplier_code, name_en, name_ar, contact_person, phone, email, cr_number, vat_number, payment_terms, is_approved, rating)
  VALUES
    (gen_random_uuid(), 'SUP-008', 'Al-Jazirah Concrete Products', 'منتجات الجزيرة للخرسانة', 'Majed Al-Anazi', '+966 55 444 5555', 'info@jazirahconc.com', 'CR-100008', 'VAT-300000008', 'net_30', true, 4.3),
    (gen_random_uuid(), 'SUP-009', 'Arabian Ceramics Co.', 'شركة الخزف العربية', 'Hassan Al-Qahtani', '+966 53 777 8888', 'sales@arabianceramics.com', 'CR-100009', 'VAT-300000009', 'net_45', true, 4.0)
  ON CONFLICT (supplier_code) DO NOTHING;

  SELECT id INTO v_sup1 FROM suppliers WHERE supplier_code = 'SUP-008';
  SELECT id INTO v_sup2 FROM suppliers WHERE supplier_code = 'SUP-009';

  -- ==========================================================================
  -- 9. EMPLOYEES (10 employees)
  -- ==========================================================================

  INSERT INTO employees (id, project_id, company_id, employee_code, full_name_en, full_name_ar, national_id, nationality, phone, email, job_title, department, employee_type, hire_date, basic_salary, allowances, status, iqama_number, contract_type)
  VALUES
    (gen_random_uuid(), v_prj1, v_alfanar, 'EMP-006', 'Ahmed Al-Qahtani', 'أحمد القحطاني', '104-1234-5678', 'Saudi', '+966 55 111 2233', 'ahmed.q@alfanar.com', 'Senior Project Manager', 'Operations', 'manager', '2023-01-15', 28000.00, 5000.00, 'active', 'IQ-EMP-006', 'full_time'),
    (gen_random_uuid(), v_prj1, v_alfanar, 'EMP-007', 'Mohammed Al-Otaibi', 'محمد العتيبي', '105-2345-6789', 'Saudi', '+966 55 222 3344', 'mohammed.o@alfanar.com', 'Site Engineer', 'Engineering', 'engineer', '2023-03-01', 15000.00, 3000.00, 'active', 'IQ-EMP-007', 'full_time'),
    (gen_random_uuid(), v_prj1, v_alfanar, 'EMP-008', 'Khalid Al-Zahrani', 'خالد الزهراني', '106-3456-7890', 'Saudi', '+966 55 333 4455', 'khalid.z@alfanar.com', 'QC Inspector', 'Quality', 'engineer', '2023-06-01', 14000.00, 2500.00, 'active', 'IQ-EMP-008', 'full_time'),
    (gen_random_uuid(), v_prj1, v_alfanar, 'EMP-009', 'Nasser Al-Dosari', 'ناصر الدوسري', '107-4567-8901', 'Saudi', '+966 55 444 5566', 'nasser.d@alfanar.com', 'Safety Officer', 'HSE', 'supervisor', '2023-04-01', 12000.00, 2000.00, 'active', 'IQ-EMP-009', 'full_time'),
    (gen_random_uuid(), v_prj2, v_alfanar, 'EMP-010', 'Faisal Al-Harbi', 'فيصل الحربي', '108-5678-9012', 'Saudi', '+966 55 555 6677', 'faisal.h@alfanar.com', 'Civil Engineer', 'Engineering', 'engineer', '2024-02-01', 16000.00, 3500.00, 'active', 'IQ-EMP-010', 'full_time'),
    (gen_random_uuid(), v_prj2, v_alfanar, 'EMP-011', 'Sultan Al-Ghamdi', 'سلطان الغامدي', '109-6789-0123', 'Saudi', '+966 55 666 7788', 'sultan.g@alfanar.com', 'Electrical Engineer', 'Engineering', 'engineer', '2024-03-15', 15500.00, 3000.00, 'active', 'IQ-EMP-011', 'full_time'),
    (gen_random_uuid(), v_prj3, v_alfanar, 'EMP-012', 'Mansour Al-Anezi', 'منصور العنزي', '110-7890-1234', 'Saudi', '+966 55 777 8899', 'mansour.a@alfanar.com', 'Procurement Officer', 'Supply Chain', 'staff', '2024-05-01', 11000.00, 1500.00, 'active', 'IQ-EMP-012', 'full_time'),
    (gen_random_uuid(), v_prj3, v_alfanar, 'EMP-013', 'Abdullah Al-Shammari', 'عبدالله الشمري', '111-8901-2345', 'Saudi', '+966 55 888 9900', 'abdullah.s@alfanar.com', 'Surveyor', 'Engineering', 'engineer', '2024-07-01', 13000.00, 2000.00, 'active', 'IQ-EMP-013', 'full_time'),
    (gen_random_uuid(), v_prj4, v_alfanar, 'EMP-014', 'Noura Al-Mutairi', 'نورة المطيري', '112-9012-3456', 'Saudi', '+966 55 999 0011', 'noura.m@alfanar.com', 'HR Coordinator', 'Human Resources', 'staff', '2023-09-01', 10000.00, 1500.00, 'active', 'IQ-EMP-014', 'full_time'),
    (gen_random_uuid(), NULL, v_alfanar, 'EMP-015', 'Saeed Al-Balawi', 'سعيد البلوي', '113-0123-4567', 'Saudi', '+966 55 000 1122', 'saeed.b@alfanar.com', 'Accountant', 'Finance', 'staff', '2023-08-15', 12000.00, 2000.00, 'active', 'IQ-EMP-015', 'full_time')
  ON CONFLICT (employee_code) DO NOTHING;

  SELECT id INTO v_emp1 FROM employees WHERE employee_code = 'EMP-006';
  SELECT id INTO v_emp2 FROM employees WHERE employee_code = 'EMP-007';
  SELECT id INTO v_emp3 FROM employees WHERE employee_code = 'EMP-008';
  SELECT id INTO v_emp4 FROM employees WHERE employee_code = 'EMP-009';
  SELECT id INTO v_emp5 FROM employees WHERE employee_code = 'EMP-010';
  SELECT id INTO v_emp6 FROM employees WHERE employee_code = 'EMP-011';
  SELECT id INTO v_emp7 FROM employees WHERE employee_code = 'EMP-012';
  SELECT id INTO v_emp8 FROM employees WHERE employee_code = 'EMP-013';
  SELECT id INTO v_emp9 FROM employees WHERE employee_code = 'EMP-014';
  SELECT id INTO v_emp10 FROM employees WHERE employee_code = 'EMP-015';

  -- ==========================================================================
  -- 10. COMMISSIONS (5 commission plans)
  -- ==========================================================================

  INSERT INTO commissions (id, commission_code, commission_name_en, commission_name_ar, commission_type, commission_value, salesperson_id, is_active)
  VALUES
    (gen_random_uuid(), 'COM-001', 'Standard Sales Commission 2%', 'عمولة مبيعات قياسية 2%', 'percentage', 2.00, v_emp1, true),
    (gen_random_uuid(), 'COM-002', 'Premium Unit Commission 3%', 'عمولة وحدة ممتازة 3%', 'percentage', 3.00, v_emp1, true),
    (gen_random_uuid(), 'COM-003', 'Fixed Commission Villa', 'عمولة ثابتة فيلا', 'fixed', 50000.00, v_emp5, true),
    (gen_random_uuid(), 'COM-004', 'Bulk Sale Commission 1.5%', 'عمولة بيع بالجملة 1.5%', 'percentage', 1.50, v_emp1, true),
    (gen_random_uuid(), 'COM-005', 'Referral Fixed Fee', 'رسوم إحالة ثابتة', 'fixed', 10000.00, NULL, true)
  ON CONFLICT (commission_code) DO NOTHING;

  SELECT id INTO v_com1 FROM commissions WHERE commission_code = 'COM-001';
  SELECT id INTO v_com2 FROM commissions WHERE commission_code = 'COM-002';
  SELECT id INTO v_com3 FROM commissions WHERE commission_code = 'COM-003';

  -- ==========================================================================
  -- 11. WBS (Work Breakdown Structure) — project 1
  -- ==========================================================================

  INSERT INTO work_breakdown_structure (id, project_id, wbs_code, parent_id, level, name_en, name_ar, weight_percent)
  SELECT gen_random_uuid(), v_prj1, 'WBS-101', NULL, 1, 'Substructure & Foundations', 'الهيكل السفلي والأساسات', 20.00
  WHERE NOT EXISTS (SELECT 1 FROM work_breakdown_structure WHERE project_id = v_prj1 AND wbs_code = 'WBS-101')
  RETURNING id INTO v_wbs1;

  IF v_wbs1 IS NULL THEN SELECT id INTO v_wbs1 FROM work_breakdown_structure WHERE project_id = v_prj1 AND wbs_code = 'WBS-101'; END IF;

  INSERT INTO work_breakdown_structure (id, project_id, wbs_code, parent_id, level, name_en, name_ar, weight_percent)
  SELECT gen_random_uuid(), v_prj1, 'WBS-102', NULL, 1, 'Superstructure', 'الهيكل العلوي', 40.00
  WHERE NOT EXISTS (SELECT 1 FROM work_breakdown_structure WHERE project_id = v_prj1 AND wbs_code = 'WBS-102')
  RETURNING id INTO v_wbs2;

  IF v_wbs2 IS NULL THEN SELECT id INTO v_wbs2 FROM work_breakdown_structure WHERE project_id = v_prj1 AND wbs_code = 'WBS-102'; END IF;

  INSERT INTO work_breakdown_structure (id, project_id, wbs_code, parent_id, level, name_en, name_ar, weight_percent)
  SELECT gen_random_uuid(), v_prj1, 'WBS-103', NULL, 1, 'Finishes & MEP', 'التشطيبات والخدمات', 40.00
  WHERE NOT EXISTS (SELECT 1 FROM work_breakdown_structure WHERE project_id = v_prj1 AND wbs_code = 'WBS-103')
  RETURNING id INTO v_wbs3;

  IF v_wbs3 IS NULL THEN SELECT id INTO v_wbs3 FROM work_breakdown_structure WHERE project_id = v_prj1 AND wbs_code = 'WBS-103'; END IF;

  -- ==========================================================================
  -- 12. ITEM DEFINITIONS (10 items across projects)
  -- ==========================================================================

  INSERT INTO item_definitions (id, project_id, division, sub_division, activity, activity_weight, wbs_code, wbs_description, booked_budget, open_budget, budget_rate, quantity, unit_price)
  VALUES
    (gen_random_uuid(), v_prj1, 'Civil', 'Earthworks', 'Excavation for Foundation', 5.00, 'WBS-101-01', 'Bulk excavation to founding level', 1200000.00, 1080000.00, 85.00, 14000.00, 85.00),
    (gen_random_uuid(), v_prj1, 'Civil', 'Foundation', 'Concrete Works Mat Foundation', 10.00, 'WBS-101-02', 'Mat foundation concrete and reinforcement', 3500000.00, 3150000.00, 650.00, 4500.00, 650.00),
    (gen_random_uuid(), v_prj1, 'Structural', 'Columns', 'Ground Floor Columns', 8.00, 'WBS-102-01', 'RC columns ground floor', 1800000.00, 1620000.00, 520.00, 2800.00, 520.00),
    (gen_random_uuid(), v_prj1, 'Structural', 'Slabs', 'First Floor Slab', 7.00, 'WBS-102-02', 'Two-way slab first floor', 2200000.00, 1980000.00, 480.00, 3800.00, 480.00),
    (gen_random_uuid(), v_prj1, 'MEP', 'Electrical', 'Electrical Rough-in', 8.00, 'WBS-103-01', 'Conduiting, wiring, panel installation', 1500000.00, 1350000.00, 350.00, 4200.00, 350.00),
    (gen_random_uuid(), v_prj1, 'MEP', 'Plumbing', 'Plumbing Rough-in', 6.00, 'WBS-103-02', 'Water supply and drainage rough-in', 1200000.00, 1080000.00, 280.00, 3600.00, 280.00),
    (gen_random_uuid(), v_prj2, 'Civil', 'Foundation', 'Strip Foundation', 10.00, 'WBS-201-01', 'Strip foundation for mall building', 2800000.00, 2520000.00, 580.00, 4800.00, 580.00),
    (gen_random_uuid(), v_prj2, 'MEP', 'HVAC', 'HVAC Ducting & Units', 12.00, 'WBS-203-01', 'HVAC installation for commercial complex', 3500000.00, 3150000.00, 450.00, 7800.00, 450.00),
    (gen_random_uuid(), v_prj3, 'Civil', 'Roads', 'Road Base Course', 15.00, 'WBS-301-01', 'Base course for industrial roads', 5000000.00, 4500000.00, 120.00, 37500.00, 120.00),
    (gen_random_uuid(), v_prj3, 'Civil', 'Drainage', 'Storm Water Drainage Network', 10.00, 'WBS-302-01', 'Storm water pipes and manholes', 3200000.00, 2880000.00, 450.00, 6400.00, 450.00)
  ON CONFLICT (project_id, wbs_code) DO NOTHING;

  SELECT id INTO v_item1 FROM item_definitions WHERE project_id = v_prj1 AND wbs_code = 'WBS-101-01';
  SELECT id INTO v_item2 FROM item_definitions WHERE project_id = v_prj1 AND wbs_code = 'WBS-101-02';
  SELECT id INTO v_item3 FROM item_definitions WHERE project_id = v_prj1 AND wbs_code = 'WBS-102-01';
  SELECT id INTO v_item4 FROM item_definitions WHERE project_id = v_prj1 AND wbs_code = 'WBS-102-02';
  SELECT id INTO v_item5 FROM item_definitions WHERE project_id = v_prj1 AND wbs_code = 'WBS-103-01';
  SELECT id INTO v_item6 FROM item_definitions WHERE project_id = v_prj1 AND wbs_code = 'WBS-103-02';
  SELECT id INTO v_item7 FROM item_definitions WHERE project_id = v_prj2 AND wbs_code = 'WBS-201-01';
  SELECT id INTO v_item8 FROM item_definitions WHERE project_id = v_prj2 AND wbs_code = 'WBS-203-01';
  SELECT id INTO v_item9 FROM item_definitions WHERE project_id = v_prj3 AND wbs_code = 'WBS-301-01';
  SELECT id INTO v_item10 FROM item_definitions WHERE project_id = v_prj3 AND wbs_code = 'WBS-302-01';

  -- ==========================================================================
  -- 13. CONTRACTS + SCOPE ITEMS + INVOICES
  -- ==========================================================================

  INSERT INTO contracts (id, project_id, contract_no, contractor_id, contract_type, title_en, title_ar, signing_date, start_date, end_date, contract_amount, status)
  SELECT gen_random_uuid(), v_prj1, 'CNT-2025-001', v_main_con, 'lump_sum', 'Main Building Contract - Riyadh Tower', 'عقد المبنى الرئيسي - برج الرياض', '2025-01-01', '2025-01-15', '2026-12-31', 82000000.00, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM contracts WHERE project_id = v_prj1 AND contract_no = 'CNT-2025-001')
  RETURNING id INTO v_cont1;

  IF v_cont1 IS NULL THEN SELECT id INTO v_cont1 FROM contracts WHERE project_id = v_prj1 AND contract_no = 'CNT-2025-001'; END IF;

  INSERT INTO contracts (id, project_id, contract_no, contractor_id, contract_type, title_en, title_ar, signing_date, start_date, end_date, contract_amount, status)
  SELECT gen_random_uuid(), v_prj2, 'CNT-2025-002', v_main_con, 'unit_price', 'Commercial Complex Construction', 'تشييد المجمع التجاري', '2025-02-15', '2025-03-01', '2027-06-30', 150000000.00, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM contracts WHERE project_id = v_prj2 AND contract_no = 'CNT-2025-002')
  RETURNING id INTO v_cont2;

  IF v_cont2 IS NULL THEN SELECT id INTO v_cont2 FROM contracts WHERE project_id = v_prj2 AND contract_no = 'CNT-2025-002'; END IF;

  -- Contract scope items
  INSERT INTO contract_scope_items (id, contract_id, item_code, description_en, description_ar, unit_of_measure, quantity, unit_price, executed_qty, status)
  VALUES
    (gen_random_uuid(), v_cont1, 'CSI-001', 'Excavation Works', 'أعمال الحفر', 'm3', 14000.00, 85.00, 9500.00, 'active'),
    (gen_random_uuid(), v_cont1, 'CSI-002', 'Concrete Works Grade 30', 'أعمال الخرسانة درجة 30', 'm3', 4500.00, 650.00, 2800.00, 'active'),
    (gen_random_uuid(), v_cont1, 'CSI-003', 'Steel Reinforcement', 'حديد التسليح', 'ton', 850.00, 3200.00, 520.00, 'active'),
    (gen_random_uuid(), v_cont2, 'CSI-004', 'Strip Foundation Concrete', 'خرسانة الأساسات الشريطية', 'm3', 4800.00, 580.00, 1200.00, 'active'),
    (gen_random_uuid(), v_cont2, 'CSI-005', 'Steel Structure Erection', 'تركيب الهيكل الحديدي', 'ton', 1200.00, 4500.00, 450.00, 'active')
  ON CONFLICT (contract_id, item_code) DO NOTHING;

  -- Contract invoices
  INSERT INTO contract_invoices (id, contract_id, invoice_no, invoice_type, invoice_date, amount, retention_pct, status, due_date, notes)
  VALUES
    (gen_random_uuid(), v_cont1, 'INV-2025-001', 'advance', '2025-02-01', 8200000.00, 0, 'paid', '2025-02-15', 'Advance payment 10%'),
    (gen_random_uuid(), v_cont1, 'INV-2025-002', 'progress', '2025-05-15', 4500000.00, 10.00, 'paid', '2025-06-15', 'First progress payment - excavation complete'),
    (gen_random_uuid(), v_cont1, 'INV-2025-003', 'progress', '2025-08-20', 6200000.00, 10.00, 'paid', '2025-09-20', 'Second progress - foundation works'),
    (gen_random_uuid(), v_cont2, 'INV-2025-004', 'advance', '2025-03-15', 15000000.00, 0, 'paid', '2025-03-30', 'Advance payment 10%'),
    (gen_random_uuid(), v_cont2, 'INV-2025-005', 'progress', '2025-07-10', 3800000.00, 10.00, 'pending', '2025-08-10', 'First progress - site preparation'),
    (gen_random_uuid(), v_cont2, 'INV-2025-006', 'progress', '2025-10-05', 5500000.00, 10.00, 'pending', '2025-11-05', 'Second progress - foundation concrete')
  ON CONFLICT (contract_id, invoice_no) DO NOTHING;

  -- ==========================================================================
  -- 14. WORK REQUESTS (WIRs — 10 requests with varying statuses)
  -- ==========================================================================

  INSERT INTO work_requests (id, project_id, unit_id, contract_id, wir_no, title_en, title_ar, description, request_date, requested_by, inspected_by, status, is_ncr, priority, division, sub_division, activity, zone, block, qc_engineer_id, consultant_engineer_id, item_definition_id)
  VALUES
    (gen_random_uuid(), v_prj1, v_u1, v_cont1, 'WR-001', 'Inspect Foundation Concrete', 'فحص خرسانة الأساسات', 'Inspect mat foundation concrete pour quality and curing', '2025-04-10', v_eng, v_qc, 'approved', false, 'high', 'Civil', 'Foundation', 'Concrete Works', 'Zone A', 'Block 1', v_qc, v_consult, v_item2),
    (gen_random_uuid(), v_prj1, NULL, v_cont1, 'WR-002', 'Column Reinforcement Check', 'تدقيق حديد تسليح الأعمدة', 'Verify column rebar placement for ground floor columns', '2025-05-12', v_eng, v_qc, 'approved', false, 'high', 'Structural', 'Columns', 'Rebar Works', 'Zone A', 'Block 1', v_qc, v_consult, v_item3),
    (gen_random_uuid(), v_prj1, v_u2, v_cont1, 'WR-003', 'First Floor Slab Formwork', 'فحص شدات بلاطة الدور الأول', 'Inspect formwork and reinforcement before concrete', '2025-06-20', v_eng, v_qc, 'in_progress', false, 'high', 'Structural', 'Slabs', 'Formwork', 'Zone A', 'Block 1', v_qc, v_consult, v_item4),
    (gen_random_uuid(), v_prj1, v_u1, v_cont1, 'WR-004', 'Electrical Conduit Inspection', 'فحص تمديدات الكهرباء', 'Inspect electrical conduits in apartment A-101', '2025-07-05', v_eng, v_qc, 'draft', false, 'medium', 'MEP', 'Electrical', 'Rough-in', 'Zone A', 'Block 1', v_qc, v_consult, v_item5),
    (gen_random_uuid(), v_prj1, v_u2, v_cont1, 'WR-005', 'Plumbing Pressure Test', 'اختبار ضغط السباكة', 'Pressure test for water supply lines in A-102', '2025-07-08', v_eng, v_qc, 'pending_qc', false, 'medium', 'MEP', 'Plumbing', 'Testing', 'Zone A', 'Block 1', v_qc, v_consult, v_item6),
    (gen_random_uuid(), v_prj1, v_u3, v_cont1, 'WR-006', 'Waterproofing Inspection Basement', 'فحص العزل المائي للطابق السفلي', 'Inspect waterproofing membrane installation at basement level', '2025-08-01', v_eng, v_qc, 'rejected', true, 'critical', 'Civil', 'Waterproofing', 'Basement', 'Zone A', 'Block 1', v_qc, v_consult, NULL),
    (gen_random_uuid(), v_prj2, v_u6, v_cont2, 'WR-007', 'Strip Foundation Rebar Check', 'تدقيق حديد الأساسات الشريطية', 'Verify rebar placement for strip foundations in Shop S-01', '2025-06-15', v_eng, v_qc, 'approved', false, 'high', 'Civil', 'Foundation', 'Rebar Works', 'Retail Zone', 'Block B', v_qc, v_consult, v_item7),
    (gen_random_uuid(), v_prj2, v_u7, v_cont2, 'WR-008', 'HVAC Duct Installation Review', 'مراجعة تركيب مجاري التكييف', 'Shop S-02 HVAC duct installation compliance check', '2025-09-10', v_eng, v_qc, 'pending_consultant', false, 'medium', 'MEP', 'HVAC', 'Ducting', 'Retail Zone', 'Block B', v_qc, v_consult, v_item8),
    (gen_random_uuid(), v_prj3, v_u11, NULL, 'WR-009', 'Road Base Compaction Test', 'اختبار ضغط طبقة الأساس للطريق', 'Test compaction results for road base course layer', '2025-10-01', v_eng, v_qc, 'draft', false, 'high', 'Civil', 'Roads', 'Earthworks', 'Industrial', 'Plot Block 1', v_qc, v_consult, v_item9),
    (gen_random_uuid(), v_prj3, v_u13, NULL, 'WR-010', 'Storm Water Pipe Alignment', 'محاذاة مواسير تصريف الأمطار', 'Check alignment and bedding of storm water drainage pipes', '2025-10-20', v_eng, v_qc, 'pending_pm', false, 'medium', 'Civil', 'Drainage', 'Pipe Laying', 'Logistics', 'Warehouse Block', v_qc, v_consult, v_item10)
  ON CONFLICT (project_id, wir_no) DO NOTHING;

  -- ==========================================================================
  -- 15. WORK TASKS (10 tasks)
  -- ==========================================================================

  INSERT INTO work_tasks (id, project_id, wbs_id, unit_id, contract_id, task_code, title_en, title_ar, description, assigned_to, start_date, end_date, status, priority, progress, division, sub_division, activity, zone, block, target_date)
  VALUES
    (gen_random_uuid(), v_prj1, v_wbs1, NULL, v_cont1, 'T-001', 'Excavate Foundation Pit', 'حفر حفرة الأساس', 'Excavate to -6.5m depth for mat foundation', v_eng, '2025-02-01', '2025-03-15', 'completed', 'high', 100.00, 'Civil', 'Earthworks', 'Excavation', 'Zone A', 'Block 1', '2025-03-01'),
    (gen_random_uuid(), v_prj1, v_wbs1, NULL, v_cont1, 'T-002', 'Pour Mat Foundation Concrete', 'صب خرسانة الأساس المسلح', 'Pour 4500 m3 of concrete for mat foundation', v_eng, '2025-03-20', '2025-05-15', 'completed', 'high', 100.00, 'Civil', 'Foundation', 'Concrete Works', 'Zone A', 'Block 1', '2025-05-10'),
    (gen_random_uuid(), v_prj1, v_wbs2, v_u1, v_cont1, 'T-003', 'Ground Floor Columns & Slab', 'أعمدة وبلاطة الدور الأرضي', 'Form, reinforce and cast ground floor vertical elements', v_eng, '2025-05-20', '2025-08-30', 'in_progress', 'high', 60.00, 'Structural', 'Columns', 'Formwork and Concrete', 'Zone A', 'Block 1', '2025-08-15'),
    (gen_random_uuid(), v_prj1, v_wbs3, v_u1, v_cont1, 'T-004', 'Apartment A-101 Electrical Works', 'أعمال كهرباء الشقة A-101', 'Complete electrical rough-in for apartment unit', v_eng, '2025-09-01', '2025-10-15', 'pending', 'medium', 0.00, 'MEP', 'Electrical', 'Rough-in', 'Zone A', 'Block 1', '2025-10-01'),
    (gen_random_uuid(), v_prj1, v_wbs3, v_u1, v_cont1, 'T-005', 'Apartment A-101 Plastering', 'تجصيص الشقة A-101', 'Internal wall plastering and rendering', v_eng, '2025-10-01', '2025-11-15', 'pending', 'medium', 0.00, 'Finishes', 'Plaster', 'Wall Finishes', 'Zone A', 'Block 1', '2025-11-01'),
    (gen_random_uuid(), v_prj2, NULL, v_u6, v_cont2, 'T-006', 'Shop S-01 Foundation Work', 'أعمال أساس المحل S-01', 'Strip foundation excavation and concrete for commercial shop', v_eng, '2025-04-01', '2025-06-30', 'completed', 'high', 100.00, 'Civil', 'Foundation', 'Strip Foundation', 'Retail Zone', 'Block B', '2025-06-15'),
    (gen_random_uuid(), v_prj2, NULL, NULL, v_cont2, 'T-007', 'Main Mall Structural Steel', 'الهيكل الحديدي للمول الرئيسي', 'Erection of structural steel frame for mall building', v_eng, '2025-07-01', '2025-11-30', 'pending', 'high', 0.00, 'Structural', 'Steel Structure', 'Erection', 'Retail Zone', 'Block B', '2025-11-15'),
    (gen_random_uuid(), v_prj2, NULL, v_u10, v_cont2, 'T-008', 'Villa V-A1 Block Work', 'أعمال البناء للفيلا V-A1', 'Concrete block masonry for villa walls', v_eng, '2025-08-01', '2025-10-31', 'pending', 'medium', 0.00, 'Civil', 'Masonry', 'Block Work', 'Villa Zone', 'Block C', '2025-10-15'),
    (gen_random_uuid(), v_prj3, NULL, NULL, NULL, 'T-009', 'Road Subgrade Preparation', 'تجهيز الطبقة التحتية للطريق', 'Grade and compact subgrade for industrial access road', v_eng, '2025-10-01', '2025-12-15', 'pending', 'high', 0.00, 'Civil', 'Roads', 'Subgrade', 'Industrial', 'Plot Block 1', '2025-12-01'),
    (gen_random_uuid(), v_prj3, NULL, v_u13, NULL, 'T-010', 'Warehouse WH-01 Foundation', 'أساس المستودع WH-01', 'Shallow foundation for storage warehouse building', v_eng, '2025-11-01', '2026-01-31', 'pending', 'medium', 0.00, 'Civil', 'Foundation', 'Shallow Foundation', 'Logistics', 'Warehouse Block', '2026-01-15')
  ON CONFLICT (project_id, task_code) DO NOTHING;

  -- ==========================================================================
  -- 16. SAFETY INCIDENTS & OBSERVATIONS
  -- ==========================================================================

  INSERT INTO safety_incidents (id, project_id, incident_no, incident_date, incident_time, incident_type, severity, location, description, immediate_action, root_cause, status, reported_by, closed_date)
  VALUES
    (gen_random_uuid(), v_prj1, 'SI-2025-001', '2025-03-15', '09:30:00', 'minor_injury', 'low', 'Level 1, Tower A', 'Worker sustained minor cut on hand while cutting rebar', 'First aid administered, worker returned to duty', 'Improper use of cutting tool', 'closed', v_admin, '2025-03-16'),
    (gen_random_uuid(), v_prj1, 'SI-2025-002', '2025-05-20', '14:15:00', 'near_miss', 'medium', 'Excavation Area', 'Excavation edge collapse near worker during trenching', 'Area cordoned off, safety meeting held', 'Insufficient shoring in trench', 'closed', v_pm, '2025-05-25'),
    (gen_random_uuid(), v_prj2, 'SI-2025-003', '2025-07-10', '11:00:00', 'property_damage', 'low', 'Shop S-01 Area', 'Concrete pump hose burst causing spill on fresh slab', 'Work stopped, cleanup initiated', 'Worn hose fitting', 'closed', v_admin, '2025-07-12'),
    (gen_random_uuid(), v_prj1, 'SI-2025-004', '2025-08-05', '08:45:00', 'first_aid', 'low', 'Level 2, Tower A', 'Worker reported eye irritation from dust', 'Eye wash station used, worker monitored', 'Inadequate dust control measures', 'reported', v_qc, NULL)
  ON CONFLICT (project_id, incident_no) DO NOTHING;

  INSERT INTO safety_observations (id, project_id, observation_no, observation_date, observation_type, location, description, recommended_action, status, observed_by)
  VALUES
    (gen_random_uuid(), v_prj1, 'SO-2025-001', '2025-04-10', 'unsafe_act', 'Level 1 Staircase', 'Worker not wearing safety harness while working at height on staircase', 'Immediate stop work, retrain worker on harness use', 'closed', v_admin),
    (gen_random_uuid(), v_prj1, 'SO-2025-002', '2025-06-15', 'safe_act', 'Foundation Area', 'Foreman properly conducting daily toolbox talk', 'Recognize and reward positive behavior', 'closed', v_pm),
    (gen_random_uuid(), v_prj2, 'SO-2025-003', '2025-08-22', 'unsafe_condition', 'Material Storage Yard', 'Stacked rebar not properly secured, risk of rolling', 'Secure rebar stacks with chains', 'open', v_admin),
    (gen_random_uuid(), v_prj1, 'SO-2025-004', '2025-09-01', 'unsafe_act', 'Loading Dock', 'Worker operating forklift without valid license', 'Suspend operator until license verified', 'open', v_qc)
  ON CONFLICT (project_id, observation_no) DO NOTHING;

  -- ==========================================================================
  -- 17. TECHNICAL TICKETS (RFIs, Design Queries)
  -- ==========================================================================

  INSERT INTO technical_tickets (id, project_id, ticket_no, ticket_type, title_en, title_ar, description, priority, status, requested_by, assigned_to, due_date, response)
  VALUES
    (gen_random_uuid(), v_prj1, 'RFI-001', 'rfi', 'Clarify Foundation Reinforcement Detail', 'توضيح تفاصيل تسليح الأساسات', 'Request clarification on rebar spacing at mat foundation edge per dwg S-102', 'high', 'closed', v_eng, v_consult, '2025-03-01', 'Use 150mm spacing as per section detail S-102/A'),
    (gen_random_uuid(), v_prj1, 'RFI-002', 'shop_drawing_review', 'Review Shop Drawing - Level 1 Slab', 'مراجعة المخطط التنفيذي - بلاطة الدور الأول', 'Submit shop drawing for first floor slab reinforcement', 'medium', 'open', v_eng, v_consult, '2025-08-15', NULL),
    (gen_random_uuid(), v_prj2, 'RFI-003', 'rfi', 'HVAC Duct Routing Conflict', 'تعارض مسار مجاري التكييف', 'Duct routing conflicts with structural beam at grid B-3', 'urgent', 'open', v_eng, v_consult, '2025-09-20', NULL),
    (gen_random_uuid(), v_prj2, 'DQ-001', 'design_query', 'Shop S-02 Electrical Load Query', 'استفسار حمل كهربائي للمحل S-02', 'Confirm electrical load capacity for food court equipment', 'low', 'closed', v_eng, v_consult, '2025-06-10', 'Shop load capacity confirmed at 150A'),
    (gen_random_uuid(), v_prj1, 'SI-001', 'site_instruction', 'Temporary Access Road Reroute', 'تغيير مسار الطريق المؤقت', 'Instruct contractor to reroute temporary access road away from utility trench', 'medium', 'closed', v_consult, v_eng, '2025-07-01', 'Instruction issued and implemented')
  ON CONFLICT (project_id, ticket_no) DO NOTHING;

  -- ==========================================================================
  -- 18. DOCUMENTS (8 documents across projects)
  -- ==========================================================================

  INSERT INTO documents (id, project_id, doc_code, title_en, title_ar, doc_type, category, description, file_url, revision, status, confidentiality, uploaded_by)
  VALUES
    (gen_random_uuid(), v_prj1, 'DWG-S-101', 'Foundation Plan', 'مخطط الأساسات', 'drawing', 'Structural', 'Mat foundation plan and section details', '/docs/prj1/dwg-s-101.pdf', 'B', 'current', 'internal', v_eng),
    (gen_random_uuid(), v_prj1, 'DWG-A-102', 'Floor Plan Level 1', 'مخطط دور أرضي', 'drawing', 'Architectural', 'First floor architectural plan with dimensions', '/docs/prj1/dwg-a-102.pdf', 'A', 'current', 'public', v_eng),
    (gen_random_uuid(), v_prj1, 'SPC-001', 'Concrete Specification', 'مواصفات الخرسانة', 'specification', 'Civil', 'Technical specifications for ready mix concrete', '/docs/prj1/spc-001.pdf', 'A', 'current', 'internal', v_eng),
    (gen_random_uuid(), v_prj2, 'DWG-M-101', 'HVAC Layout Plan', 'مخطط توزيع التكييف', 'drawing', 'MEP', 'HVAC ductwork layout for commercial mall', '/docs/prj2/dwg-m-101.pdf', 'A', 'current', 'confidential', v_eng),
    (gen_random_uuid(), v_prj2, 'RPT-001', 'Geotechnical Report', 'تقرير التربة', 'report', 'Civil', 'Geotechnical investigation report for Jubail site', '/docs/prj2/rpt-001.pdf', 'A', 'current', 'confidential', v_admin),
    (gen_random_uuid(), v_prj1, 'SUB-001', 'Rebar Shop Drawing Submission', 'تسليم المخطط التنفيذي للحديد', 'submittal', 'Structural', 'Rebar bending schedule and shop drawings submission', '/docs/prj1/sub-001.pdf', 'A', 'under_review', 'internal', v_eng),
    (gen_random_uuid(), v_prj3, 'PRM-001', 'Construction Permit', 'تصريح البناء', 'permit', 'Legal', 'Municipal construction permit for infrastructure works', '/docs/prj3/prm-001.pdf', 'A', 'current', 'public', v_admin),
    (gen_random_uuid(), v_prj1, 'CRR-001', 'Foundation Concrete Test Results', 'نتائج اختبار خرسانة الأساسات', 'report', 'Quality', 'Concrete cylinder test results for mat foundation', '/docs/prj1/crr-001.pdf', 'A', 'current', 'internal', v_qc)
  ON CONFLICT (project_id, doc_code, revision) DO NOTHING;

  -- ==========================================================================
  -- 19. STOCK MOVEMENTS (10 movements)
  -- ==========================================================================

  INSERT INTO stock_movements (id, movement_no, movement_type, warehouse_id, warehouse_to_id, material_id, quantity, unit_price, batch_no, notes, created_by)
  VALUES
    (gen_random_uuid(), 'MOV-001', 'received', v_wh1, NULL, v_mat1, 50.00, 280.00, 'B-CONC-001', 'Initial stock receipt ready mix concrete', v_wh),
    (gen_random_uuid(), 'MOV-002', 'received', v_wh1, NULL, v_mat3, 10.00, 2800.00, 'B-STL-001', 'Steel rebar 12mm delivery', v_wh),
    (gen_random_uuid(), 'MOV-003', 'issued', v_wh1, NULL, v_mat1, 20.00, 280.00, 'B-CONC-001', 'Issued to foundation works on site', v_wh),
    (gen_random_uuid(), 'MOV-004', 'received', v_wh2, NULL, v_mat2, 30.00, 320.00, 'B-CONC-002', 'Concrete 30MPa for Jeddah site', v_wh),
    (gen_random_uuid(), 'MOV-005', 'transfer', v_wh1, v_wh2, v_mat6, 100.00, 18.00, 'B-CEM-001', 'Transfer to Jeddah site from Riyadh main WH', v_wh),
    (gen_random_uuid(), 'MOV-006', 'received', v_wh3, NULL, v_mat1, 80.00, 285.00, 'B-CONC-003', 'Concrete stock for Dammam project', v_wh),
    (gen_random_uuid(), 'MOV-007', 'issued', v_wh2, NULL, v_mat4, 5.00, 2750.00, 'B-STL-002', '16mm rebar issued to Shop S-01 foundation', v_wh),
    (gen_random_uuid(), 'MOV-008', 'adjustment', v_wh1, NULL, v_mat5, 4800.00, 4.50, 'B-BLK-001', 'Inventory adjustment after physical count', v_wh),
    (gen_random_uuid(), 'MOV-009', 'received', v_wh2, NULL, v_mat8, 1000.00, 3.50, 'B-ELC-001', 'Electrical cable stock for mall rough-in', v_wh),
    (gen_random_uuid(), 'MOV-010', 'received', v_wh3, NULL, v_mat10, 50.00, 35.00, 'B-SAF-001', 'Safety helmets for Dammam project', v_wh)
  ON CONFLICT (movement_no) DO NOTHING;

  -- ==========================================================================
  -- 20. PURCHASE REQUISITIONS + ITEMS
  -- ==========================================================================

  INSERT INTO purchase_requisitions (id, pr_no, project_id, requested_by, status, notes)
  VALUES
    (gen_random_uuid(), 'PR-2025-001', v_prj1, v_proc, 'approved', 'Steel reinforcement for Level 2 column works'),
    (gen_random_uuid(), 'PR-2025-002', v_prj2, v_proc, 'pending', 'Electrical materials for mall rough-in'),
    (gen_random_uuid(), 'PR-2025-003', v_prj1, v_proc, 'draft', 'Finishing materials for apartment interiors'),
    (gen_random_uuid(), 'PR-2025-004', v_prj3, v_proc, 'approved', 'Storm water drainage pipes and fittings'),
    (gen_random_uuid(), 'PR-2025-005', v_prj2, v_proc, 'pending', 'HVAC equipment for commercial complex')
  ON CONFLICT (pr_no) DO NOTHING;

  SELECT id INTO v_pr1 FROM purchase_requisitions WHERE pr_no = 'PR-2025-001';
  SELECT id INTO v_pr2 FROM purchase_requisitions WHERE pr_no = 'PR-2025-002';

  INSERT INTO purchase_requisition_items (id, pr_id, material_id, description, quantity, estimated_price, notes)
  VALUES
    (gen_random_uuid(), v_pr1, v_mat3, 'Steel Rebar 12mm for columns Level 2', 15.00, 2800.00, 'Delivery required within 2 weeks'),
    (gen_random_uuid(), v_pr1, v_mat4, 'Steel Rebar 16mm for beams Level 2', 12.00, 2750.00, NULL),
    (gen_random_uuid(), v_pr2, v_mat8, 'Electrical cable 2.5mm for mall outlets', 5000.00, 3.50, 'Red and black colors needed'),
    (gen_random_uuid(), v_pr2, NULL, 'PVC Conduit 20mm', 3000.00, 2.00, 'Standard electrical conduit')
  ON CONFLICT DO NOTHING;

  -- ==========================================================================
  -- 21. APPROVAL REQUESTS + STEPS
  -- ==========================================================================

  INSERT INTO approval_requests (id, module_code, record_id, project_id, title_en, title_ar, description, current_step, total_steps, status, requested_by, request_no)
  VALUES
    (gen_random_uuid(), 'purchase_requisitions', v_pr1, v_prj1, 'Approve PR-2025-001 Steel Purchase', 'اعتماد طلب شراء حديد', 'Steel reinforcement for Level 2 column works', 2, 3, 'in_progress', v_proc, 'APR-2025-001'),
    (gen_random_uuid(), 'purchase_requisitions', v_pr2, v_prj2, 'Approve PR-2025-002 Electrical Materials', 'اعتماد طلب شراء مواد كهربائية', 'Electrical materials for mall rough-in works', 1, 3, 'pending', v_proc, 'APR-2025-002'),
    (gen_random_uuid(), 'work_requests', (SELECT id FROM work_requests WHERE wir_no = 'WR-001' AND project_id = v_prj1), v_prj1, 'Approve WR-001 Foundation Inspection', 'اعتماد فحص الخرسانة', 'Inspect mat foundation concrete pour quality', 1, 1, 'approved', v_eng, 'APR-2025-003'),
    (gen_random_uuid(), 'contracts', v_cont1, v_prj1, 'Approve Progress Payment INV-002', 'اعتماد دفعة تقدم', 'Second progress payment for foundation works', 1, 2, 'in_progress', v_eng, 'APR-2025-004')
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_app1 FROM approval_requests WHERE request_no = 'APR-2025-001';
  SELECT id INTO v_app2 FROM approval_requests WHERE request_no = 'APR-2025-002';

  INSERT INTO approval_steps (id, approval_request_id, step_order, step_role, step_user_id, status, comment, decided_at)
  VALUES
    (gen_random_uuid(), v_app1, 1, 'project_manager', v_pm, 'approved', 'Budget allocated, proceed with procurement', '2025-04-01 10:00:00+03'),
    (gen_random_uuid(), v_app1, 2, 'finance', v_fin, 'approved', 'Sufficient budget in material category', '2025-04-02 11:30:00+03'),
    (gen_random_uuid(), v_app1, 3, 'admin', v_admin, 'pending', NULL, NULL),
    (gen_random_uuid(), v_app2, 1, 'project_manager', v_pm, 'pending', NULL, NULL)
  ON CONFLICT DO NOTHING;

END $$;
