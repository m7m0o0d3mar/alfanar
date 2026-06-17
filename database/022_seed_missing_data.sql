-- ============================================================================
-- 022: Seed labor_groups (M-9) and work_tasks (M-4)
-- ============================================================================
-- Run after 021_seed_suppliers.sql
-- ============================================================================

DO $$
DECLARE
  v_cid   UUID;  -- company
  v_ctid  UUID;  -- contractor
  v_p1    UUID;  -- project: Residential Tower
  v_p2    UUID;  -- project: Commercial Complex
  v_p3    UUID;  -- project: Infrastructure
  v_u1    UUID;  -- unit: Apartment 101
  v_u2    UUID;  -- unit: Apartment 102
  v_u3    UUID;  -- unit: Shop 01
  v_u4    UUID;  -- unit: Villa A1
  v_w1    UUID;  -- wbs: Substructure
  v_w2    UUID;  -- wbs: Superstructure
  v_w3    UUID;  -- wbs: Finishes
  v_w4    UUID;  -- wbs: MEP
  v_conv  UUID;  -- contract
  v_adm   UUID;  -- admin user
BEGIN

  -- ------------------------------------------------------------------
  -- 1. Seed parent reference data if not already present
  -- ------------------------------------------------------------------

  -- Company
  INSERT INTO companies (id, company_type, name_en, name_ar, tax_id, commercial_reg, phone, email, is_active)
  SELECT uuid_generate_v4(), 'main_contractor', 'Alfanar Construction Co.', 'شركة الفنار للإنشاءات', 'TAX-100001', 'CR-200001', '+966 11 200 1234', 'info@alfanar.com', true
  WHERE NOT EXISTS (SELECT 1 FROM companies WHERE tax_id = 'TAX-100001')
  RETURNING id INTO v_cid;

  IF v_cid IS NULL THEN
    SELECT id INTO v_cid FROM companies WHERE tax_id = 'TAX-100001';
  END IF;

  -- Contractor
  INSERT INTO contractors (id, company_id, contractor_type, license_number, classification, is_approved)
  SELECT uuid_generate_v4(), v_cid, 'main', 'LIC-MC-001', 'Grade A', true
  WHERE NOT EXISTS (SELECT 1 FROM contractors WHERE company_id = v_cid AND contractor_type = 'main')
  RETURNING id INTO v_ctid;

  IF v_ctid IS NULL THEN
    SELECT id INTO v_ctid FROM contractors WHERE company_id = v_cid AND contractor_type = 'main';
  END IF;

  -- Projects
  INSERT INTO projects (id, project_code, name_en, name_ar, company_id, project_type, status, start_date, end_date, location, is_active, budget_amount)
  SELECT uuid_generate_v4(), 'PRJ-2024-001', 'Residential Tower - Riyadh', 'البرج السكني - الرياض', v_cid, 'residential', 'in_progress', '2024-03-01', '2026-06-30', 'Olaya District, Riyadh', true, 85000000
  WHERE NOT EXISTS (SELECT 1 FROM projects WHERE project_code = 'PRJ-2024-001')
  RETURNING id INTO v_p1;

  IF v_p1 IS NULL THEN
    SELECT id INTO v_p1 FROM projects WHERE project_code = 'PRJ-2024-001';
  END IF;

  INSERT INTO projects (id, project_code, name_en, name_ar, company_id, project_type, status, start_date, end_date, location, is_active, budget_amount)
  SELECT uuid_generate_v4(), 'PRJ-2024-002', 'Commercial Complex - Jeddah', 'المجمع التجاري - جدة', v_cid, 'commercial', 'in_progress', '2024-06-15', '2027-03-31', 'Al-Hamra District, Jeddah', true, 120000000
  WHERE NOT EXISTS (SELECT 1 FROM projects WHERE project_code = 'PRJ-2024-002')
  RETURNING id INTO v_p2;

  IF v_p2 IS NULL THEN
    SELECT id INTO v_p2 FROM projects WHERE project_code = 'PRJ-2024-002';
  END IF;

  INSERT INTO projects (id, project_code, name_en, name_ar, company_id, project_type, status, start_date, end_date, location, is_active, budget_amount)
  SELECT uuid_generate_v4(), 'PRJ-2024-003', 'Infrastructure - Dammam', 'البنية التحتية - الدمام', v_cid, 'infrastructure', 'planning', '2025-01-01', '2027-12-31', 'Industrial Area, Dammam', true, 200000000
  WHERE NOT EXISTS (SELECT 1 FROM projects WHERE project_code = 'PRJ-2024-003')
  RETURNING id INTO v_p3;

  IF v_p3 IS NULL THEN
    SELECT id INTO v_p3 FROM projects WHERE project_code = 'PRJ-2024-003';
  END IF;

  -- Units (project 1)
  INSERT INTO units (id, project_id, unit_code, unit_type, floor_number, area_sqm, area_built, bedrooms, bathrooms, status)
  SELECT uuid_generate_v4(), v_p1, 'A-101', 'apartment', 1, 125.00, 110.50, 3, 2, 'available'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_p1 AND unit_code = 'A-101')
  RETURNING id INTO v_u1;

  IF v_u1 IS NULL THEN
    SELECT id INTO v_u1 FROM units WHERE project_id = v_p1 AND unit_code = 'A-101';
  END IF;

  INSERT INTO units (id, project_id, unit_code, unit_type, floor_number, area_sqm, area_built, bedrooms, bathrooms, status)
  SELECT uuid_generate_v4(), v_p1, 'A-102', 'apartment', 1, 95.00, 85.00, 2, 2, 'available'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_p1 AND unit_code = 'A-102')
  RETURNING id INTO v_u2;

  IF v_u2 IS NULL THEN
    SELECT id INTO v_u2 FROM units WHERE project_id = v_p1 AND unit_code = 'A-102';
  END IF;

  -- Units (project 2)
  INSERT INTO units (id, project_id, unit_code, unit_type, floor_number, area_sqm, area_built, status)
  SELECT uuid_generate_v4(), v_p2, 'S-01', 'shop', 1, 250.00, 220.00, 'available'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_p2 AND unit_code = 'S-01')
  RETURNING id INTO v_u3;

  IF v_u3 IS NULL THEN
    SELECT id INTO v_u3 FROM units WHERE project_id = v_p2 AND unit_code = 'S-01';
  END IF;

  INSERT INTO units (id, project_id, unit_code, unit_type, area_sqm, area_built, bedrooms, bathrooms, status)
  SELECT uuid_generate_v4(), v_p2, 'V-A1', 'villa', 450.00, 380.00, 5, 4, 'available'
  WHERE NOT EXISTS (SELECT 1 FROM units WHERE project_id = v_p2 AND unit_code = 'V-A1')
  RETURNING id INTO v_u4;

  IF v_u4 IS NULL THEN
    SELECT id INTO v_u4 FROM units WHERE project_id = v_p2 AND unit_code = 'V-A1';
  END IF;

  -- WBS (project 1)
  INSERT INTO work_breakdown_structure (id, project_id, wbs_code, parent_id, level, name_en, name_ar, weight_percent)
  SELECT uuid_generate_v4(), v_p1, 'WBS-01', NULL, 1, 'Substructure', 'الهيكل السفلي / الأساسات', 15.00
  WHERE NOT EXISTS (SELECT 1 FROM work_breakdown_structure WHERE project_id = v_p1 AND wbs_code = 'WBS-01')
  RETURNING id INTO v_w1;

  IF v_w1 IS NULL THEN
    SELECT id INTO v_w1 FROM work_breakdown_structure WHERE project_id = v_p1 AND wbs_code = 'WBS-01';
  END IF;

  INSERT INTO work_breakdown_structure (id, project_id, wbs_code, parent_id, level, name_en, name_ar, weight_percent)
  SELECT uuid_generate_v4(), v_p1, 'WBS-02', NULL, 1, 'Superstructure', 'الهيكل العلوي', 35.00
  WHERE NOT EXISTS (SELECT 1 FROM work_breakdown_structure WHERE project_id = v_p1 AND wbs_code = 'WBS-02')
  RETURNING id INTO v_w2;

  IF v_w2 IS NULL THEN
    SELECT id INTO v_w2 FROM work_breakdown_structure WHERE project_id = v_p1 AND wbs_code = 'WBS-02';
  END IF;

  INSERT INTO work_breakdown_structure (id, project_id, wbs_code, parent_id, level, name_en, name_ar, weight_percent)
  SELECT uuid_generate_v4(), v_p1, 'WBS-03', NULL, 1, 'Finishes & Fit-out', 'التشطيبات', 30.00
  WHERE NOT EXISTS (SELECT 1 FROM work_breakdown_structure WHERE project_id = v_p1 AND wbs_code = 'WBS-03')
  RETURNING id INTO v_w3;

  IF v_w3 IS NULL THEN
    SELECT id INTO v_w3 FROM work_breakdown_structure WHERE project_id = v_p1 AND wbs_code = 'WBS-03';
  END IF;

  INSERT INTO work_breakdown_structure (id, project_id, wbs_code, parent_id, level, name_en, name_ar, weight_percent)
  SELECT uuid_generate_v4(), v_p1, 'WBS-04', NULL, 1, 'MEP Services', 'خدمات الكهرباء والميكانيكا والسباكة', 20.00
  WHERE NOT EXISTS (SELECT 1 FROM work_breakdown_structure WHERE project_id = v_p1 AND wbs_code = 'WBS-04')
  RETURNING id INTO v_w4;

  IF v_w4 IS NULL THEN
    SELECT id INTO v_w4 FROM work_breakdown_structure WHERE project_id = v_p1 AND wbs_code = 'WBS-04';
  END IF;

  -- Contract (project 1)
  INSERT INTO contracts (id, project_id, contract_no, contractor_id, contract_type, title_en, title_ar, signing_date, start_date, end_date, contract_amount, status)
  SELECT uuid_generate_v4(), v_p1, 'CNT-MC-001', v_ctid, 'lump_sum', 'Main Construction Contract - Residential Tower', 'عقد الإنشاءات الرئيسي - البرج السكني', '2024-02-15', '2024-03-01', '2026-06-30', 75000000, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM contracts WHERE project_id = v_p1 AND contract_no = 'CNT-MC-001')
  RETURNING id INTO v_conv;

  IF v_conv IS NULL THEN
    SELECT id INTO v_conv FROM contracts WHERE project_id = v_p1 AND contract_no = 'CNT-MC-001';
  END IF;

  -- Admin user reference
  SELECT id INTO v_adm FROM user_profiles WHERE role = 'admin' LIMIT 1;

  -- ------------------------------------------------------------------
  -- 2. LABOR GROUPS (M-9)
  -- ------------------------------------------------------------------

  INSERT INTO labor_groups (id, project_id, group_code, name_en, name_ar, contractor_id, supervisor_name, headcount)
  VALUES
    (uuid_generate_v4(), v_p1, 'LG-CONC', 'Concrete Team', 'فريق الخرسانة', v_ctid, 'Ahmed Al-Qahtani', 30),
    (uuid_generate_v4(), v_p1, 'LG-STEEL', 'Steel Fixing Team', 'فريق حديد التسليح', v_ctid, 'Khalid Al-Omar', 20),
    (uuid_generate_v4(), v_p1, 'LG-FIN', 'Finishing Team', 'فريق التشطيبات', NULL, 'Mansour Al-Ghamdi', 25),
    (uuid_generate_v4(), v_p1, 'LG-MEP', 'MEP Team', 'فريق الكهرباء والميكانيكا', NULL, 'Faisal Al-Harbi', 15),
    (uuid_generate_v4(), v_p2, 'LG-LAND', 'Landscaping Team', 'فريق تنسيق الحدائق', NULL, 'Saeed Al-Zahrani', 12)
  ON CONFLICT (project_id, group_code) DO NOTHING;

  -- ------------------------------------------------------------------
  -- 3. WORK TASKS (M-4)
  -- ------------------------------------------------------------------

  INSERT INTO work_tasks (id, project_id, wbs_id, unit_id, contract_id, task_code, title_en, title_ar, description, assigned_to, start_date, end_date, status, priority, progress)
  VALUES
    (uuid_generate_v4(), v_p1, v_w1, NULL, v_conv, 'TASK-001', 'Excavation & Foundation Works', 'أعمال الحفر والأساسات', 'Excavation to founding depth, blinding concrete, and reinforcement for mat foundation', v_adm, '2024-03-01', '2024-05-15', 'completed', 'high', 100.00),

    (uuid_generate_v4(), v_p1, v_w1, NULL, v_conv, 'TASK-002', 'Basement Level Construction', 'إنشاء الطابق السفلي', 'Basement walls, waterproofing, and slab construction including retaining walls', v_adm, '2024-05-01', '2024-08-30', 'in_progress', 'high', 65.00),

    (uuid_generate_v4(), v_p1, v_w2, v_u1, v_conv, 'TASK-003', 'First Floor Slab & Columns', 'بلاطة وأعمدة الدور الأول', 'Formwork, reinforcement, and concrete pouring for first floor slab and columns', v_adm, '2024-08-01', '2024-10-15', 'pending', 'high', 0.00),

    (uuid_generate_v4(), v_p1, v_w3, v_u1, v_conv, 'TASK-004', 'Apartment A-101 Interior Finishing', 'تشطيبات داخلية للشقة A-101', 'Plastering, tiling, painting, doors installation, and sanitary works for apartment A-101', v_adm, '2025-01-15', '2025-04-30', 'pending', 'medium', 0.00),

    (uuid_generate_v4(), v_p2, v_w4, v_u3, NULL, 'TASK-005', 'Shop S-01 Electrical Installation', 'تمديدات كهربائية للمحل S-01', 'Conduiting, wiring, panel installation, and lighting for commercial shop S-01', v_adm, '2025-06-01', '2025-08-15', 'pending', 'medium', 0.00),

    (uuid_generate_v4(), v_p2, NULL, v_u4, NULL, 'TASK-006', 'Villa V-A1 Masonry Works', 'أعمال البناء للفيلا V-A1', 'Blockwork for internal and external walls of Villa A1 including lintels and rendering', v_adm, '2025-07-01', '2025-10-30', 'pending', 'medium', 0.00)
  ON CONFLICT (project_id, task_code) DO NOTHING;

END $$;
