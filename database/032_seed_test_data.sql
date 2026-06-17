-- ============================================================================
-- 032: بيانات تجريبية لاختبار جميع وحدات النظام (Seed Test Data)
-- ============================================================================
-- يتم تشغيل هذا الملف بعد تنفيذ جميع ملفات الترحيل (001–031)
-- جميع البيانات باللغة العربية ومنسجمة مع قيود المفاتيح الخارجية
-- آمن لإعادة التشغيل: يستخدم ON CONFLICT DO NOTHING
-- ============================================================================

DO $$
DECLARE
  -- ==========================================================================
  -- المتغيرات العامة للمشاريع
  -- ==========================================================================
  v_prj1 UUID; v_prj2 UUID; v_prj3 UUID;
  v_unit1 UUID; v_unit2 UUID; v_unit3 UUID; v_unit4 UUID; v_unit5 UUID;
  v_pm   UUID; v_qc   UUID; v_consult UUID;
  v_cust1 UUID; v_cust2 UUID; v_cust3 UUID; v_cust4 UUID; v_cust5 UUID;
  v_sup1 UUID; v_sup2 UUID; v_sup3 UUID; v_sup4 UUID; v_sup5 UUID;
  v_emp1 UUID; v_emp2 UUID; v_emp3 UUID; v_emp4 UUID; v_emp5 UUID;
  v_wh1 UUID; v_wh2 UUID;
  v_mat1 UUID; v_mat2 UUID; v_mat3 UUID; v_mat4 UUID; v_mat5 UUID;
  v_comp1 UUID; v_comp2 UUID; v_comp3 UUID;
  v_contact1 UUID; v_contact2 UUID; v_contact3 UUID; v_contact4 UUID; v_contact5 UUID;
  v_stage1 UUID; v_stage2 UUID; v_stage3 UUID;
BEGIN

  -- ==========================================================================
  -- ضمان وجود الأعمدة المفقودة (قد لا تكون جميع الترحيلات مشغّلة)
  -- ==========================================================================
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_no TEXT;

  -- ==========================================================================
  -- ضمان وجود UNIQUE CONSTRAINTS لتمكين ON CONFLICT لجميع الجداول
  -- ==========================================================================
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_code_unique') THEN ALTER TABLE projects ADD CONSTRAINT projects_code_unique UNIQUE (project_code); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'units_code_unique') THEN ALTER TABLE units ADD CONSTRAINT units_code_unique UNIQUE (project_id, unit_code); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'item_definitions_code_unique') THEN ALTER TABLE item_definitions ADD CONSTRAINT item_definitions_code_unique UNIQUE (project_id, wbs_code); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_requests_code_unique') THEN ALTER TABLE work_requests ADD CONSTRAINT work_requests_code_unique UNIQUE (project_id, wir_no); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_tasks_code_unique') THEN ALTER TABLE work_tasks ADD CONSTRAINT work_tasks_code_unique UNIQUE (project_id, task_code); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_code_unique') THEN ALTER TABLE customers ADD CONSTRAINT customers_code_unique UNIQUE (customer_code); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_code_unique') THEN ALTER TABLE suppliers ADD CONSTRAINT suppliers_code_unique UNIQUE (supplier_code); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_code_unique') THEN ALTER TABLE employees ADD CONSTRAINT employees_code_unique UNIQUE (employee_code); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_code_unique') THEN ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_code_unique UNIQUE (project_id, po_no); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budget_code_unique') THEN ALTER TABLE budget ADD CONSTRAINT budget_code_unique UNIQUE (budget_code); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'technical_tickets_code_unique') THEN ALTER TABLE technical_tickets ADD CONSTRAINT technical_tickets_code_unique UNIQUE (project_id, ticket_no); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'safety_incidents_code_unique') THEN ALTER TABLE safety_incidents ADD CONSTRAINT safety_incidents_code_unique UNIQUE (project_id, incident_no); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'safety_observations_code_unique') THEN ALTER TABLE safety_observations ADD CONSTRAINT safety_observations_code_unique UNIQUE (project_id, observation_no); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unit_sales_unit_unique') THEN ALTER TABLE unit_sales ADD CONSTRAINT unit_sales_unit_unique UNIQUE (unit_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_code_unique') THEN ALTER TABLE leads ADD CONSTRAINT leads_code_unique UNIQUE (lead_no); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warehouses_code_unique') THEN ALTER TABLE warehouses ADD CONSTRAINT warehouses_code_unique UNIQUE (code); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'materials_code_unique') THEN ALTER TABLE materials ADD CONSTRAINT materials_code_unique UNIQUE (code); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_unique') THEN ALTER TABLE inventory ADD CONSTRAINT inventory_unique UNIQUE (warehouse_id, material_id, batch_no); END IF;
  -- جداول CRM (فقط إذا كانت الجداول موجودة)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_companies') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_companies_reg_unique') THEN ALTER TABLE crm_companies ADD CONSTRAINT crm_companies_reg_unique UNIQUE (registration_number); END IF;
  END IF;


  -- ==========================================================================
  -- 1. المشاريع (Projects) - 3 مشاريع
  -- ==========================================================================

  INSERT INTO projects (id, project_code, name_en, name_ar, project_type, status, start_date, end_date, location, latitude, longitude, budget_amount, progress_percent, consultant_name, consultant_company, consultant_phone, consultant_email, project_manager_id, is_active)
  SELECT gen_random_uuid(), 'PRJ-TEST-001', 'Residential Villa - Riyadh', 'فيلا سكنية - الرياض', 'residential', 'active', '2026-01-15', '2026-12-31', 'حي النرجس، الرياض', 24.77426500, 46.73858600, 5000000.00, 25.00, 'م. عبدالله القحطاني', 'مكتب القحطاني للاستشارات', '+966 50 111 2233', 'a.qahtani@consult.com', NULL, true
  ON CONFLICT (project_code) DO NOTHING
  RETURNING id INTO v_prj1;

  IF v_prj1 IS NULL THEN SELECT id INTO v_prj1 FROM projects WHERE project_code = 'PRJ-TEST-001'; END IF;

  INSERT INTO projects (id, project_code, name_en, name_ar, project_type, status, start_date, end_date, location, latitude, longitude, budget_amount, progress_percent, consultant_name, consultant_company, consultant_phone, consultant_email, project_manager_id, is_active)
  SELECT gen_random_uuid(), 'PRJ-TEST-002', 'Commercial Complex - Jeddah', 'مجمع تجاري - جدة', 'commercial', 'active', '2026-03-01', '2027-06-30', 'طريق الملك، جدة', 21.54333300, 39.17277800, 25000000.00, 10.00, 'م. فيصل الشهري', 'مكتب الشهري الهندسي', '+966 50 222 3344', 'f.shehri@consult.com', NULL, true
  ON CONFLICT (project_code) DO NOTHING
  RETURNING id INTO v_prj2;

  IF v_prj2 IS NULL THEN SELECT id INTO v_prj2 FROM projects WHERE project_code = 'PRJ-TEST-002'; END IF;

  INSERT INTO projects (id, project_code, name_en, name_ar, project_type, status, start_date, end_date, location, latitude, longitude, budget_amount, progress_percent, consultant_name, consultant_company, consultant_phone, consultant_email, project_manager_id, is_active)
  SELECT gen_random_uuid(), 'PRJ-TEST-003', 'Residential Tower - Dammam', 'برج سكني - الدمام', 'residential', 'planning', '2026-09-01', '2028-12-31', 'الخبر، الدمام', 26.42070000, 50.08880000, 80000000.00, 0.00, 'م. سعود المطيري', 'مكتب المطيري للاستشارات', '+966 50 333 4455', 's.almutairi@consult.com', NULL, true
  ON CONFLICT (project_code) DO NOTHING
  RETURNING id INTO v_prj3;

  IF v_prj3 IS NULL THEN SELECT id INTO v_prj3 FROM projects WHERE project_code = 'PRJ-TEST-003'; END IF;

  -- ==========================================================================
  -- 2. الوحدات (Units) - 5 وحدات للمشروع الأول
  -- ==========================================================================

  INSERT INTO units (id, project_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, is_active)
  SELECT gen_random_uuid(), v_prj1, 'U-TEST-001', 'villa', 0, 250.00, 3, 2, 'available', 850000.00, 'المنطقة أ', 'البلوك 1', 'فيلا قياسية 3 غرف', 200.00, 6000.00, 3500.00, true
  ON CONFLICT (project_id, unit_code) DO NOTHING
  RETURNING id INTO v_unit1;

  IF v_unit1 IS NULL THEN SELECT id INTO v_unit1 FROM units WHERE project_id = v_prj1 AND unit_code = 'U-TEST-001'; END IF;

  INSERT INTO units (id, project_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, is_active)
  SELECT gen_random_uuid(), v_prj1, 'U-TEST-002', 'villa', 0, 320.00, 4, 3, 'available', 1100000.00, 'المنطقة أ', 'البلوك 1', 'فيلا قياسية 4 غرف', 250.00, 6200.00, 3800.00, true
  ON CONFLICT (project_id, unit_code) DO NOTHING
  RETURNING id INTO v_unit2;

  IF v_unit2 IS NULL THEN SELECT id INTO v_unit2 FROM units WHERE project_id = v_prj1 AND unit_code = 'U-TEST-002'; END IF;

  INSERT INTO units (id, project_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, is_active)
  SELECT gen_random_uuid(), v_prj1, 'U-TEST-003', 'villa', 0, 180.00, 2, 2, 'available', 620000.00, 'المنطقة أ', 'البلوك 2', 'فيلا صغيرة 2 غرف', 150.00, 5800.00, 3400.00, true
  ON CONFLICT (project_id, unit_code) DO NOTHING
  RETURNING id INTO v_unit3;

  IF v_unit3 IS NULL THEN SELECT id INTO v_unit3 FROM units WHERE project_id = v_prj1 AND unit_code = 'U-TEST-003'; END IF;

  INSERT INTO units (id, project_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, is_active)
  SELECT gen_random_uuid(), v_prj1, 'U-TEST-004', 'villa', 1, 450.00, 5, 4, 'available', 1500000.00, 'المنطقة أ', 'البلوك 1', 'فيلا كبيرة 5 غرف', 350.00, 6500.00, 4000.00, true
  ON CONFLICT (project_id, unit_code) DO NOTHING
  RETURNING id INTO v_unit4;

  IF v_unit4 IS NULL THEN SELECT id INTO v_unit4 FROM units WHERE project_id = v_prj1 AND unit_code = 'U-TEST-004'; END IF;

  INSERT INTO units (id, project_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, zone, block, unit_model, land_area, building_price_per_m2, land_price_per_m2, is_active)
  SELECT gen_random_uuid(), v_prj1, 'U-TEST-005', 'villa', 1, 270.00, 3, 2, 'reserved', 920000.00, 'المنطقة ب', 'البلوك 2', 'فيلا قياسية 3 غرف دور أول', 200.00, 6100.00, 3700.00, true
  ON CONFLICT (project_id, unit_code) DO NOTHING
  RETURNING id INTO v_unit5;

  IF v_unit5 IS NULL THEN SELECT id INTO v_unit5 FROM units WHERE project_id = v_prj1 AND unit_code = 'U-TEST-005'; END IF;

  -- ==========================================================================
  -- 3. المستخدمين (user_profiles) - 3 مستخدمين تجريبيين
  -- ==========================================================================
  -- يحاول الإدراج في auth.users أولاً ثم user_profiles
  -- إذا فشل (عدم صلاحية)، يستخدم NULL
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, created_at, updated_at)
    SELECT gen_random_uuid(), 'pm_test@erp.test', '$2a$10$dummyhash', now(), '{"provider":"email"}', '{}', 'authenticated', now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'pm_test@erp.test')
    RETURNING id INTO v_pm;
    INSERT INTO user_profiles (id, email, full_name_en, full_name_ar, phone, role, default_language, is_active)
    SELECT v_pm, 'pm_test@erp.test', 'Ahmed Al-Test', 'أحمد الاختبار', '+966 50 999 0001', 'project_manager', 'ar', true
    WHERE v_pm IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_profiles WHERE email = 'pm_test@erp.test');

    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, created_at, updated_at)
    SELECT gen_random_uuid(), 'qc_test@erp.test', '$2a$10$dummyhash', now(), '{"provider":"email"}', '{}', 'authenticated', now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'qc_test@erp.test')
    RETURNING id INTO v_qc;
    INSERT INTO user_profiles (id, email, full_name_en, full_name_ar, phone, role, default_language, is_active)
    SELECT v_qc, 'qc_test@erp.test', 'Khalid Al-Test', 'خالد الاختبار', '+966 50 999 0002', 'quality', 'ar', true
    WHERE v_qc IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_profiles WHERE email = 'qc_test@erp.test');

    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, created_at, updated_at)
    SELECT gen_random_uuid(), 'consult_test@erp.test', '$2a$10$dummyhash', now(), '{"provider":"email"}', '{}', 'authenticated', now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'consult_test@erp.test')
    RETURNING id INTO v_consult;
    INSERT INTO user_profiles (id, email, full_name_en, full_name_ar, phone, role, default_language, is_active)
    SELECT v_consult, 'consult_test@erp.test', 'Faisal Al-Test', 'فيصل الاختبار', '+966 50 999 0003', 'consultant', 'ar', true
    WHERE v_consult IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_profiles WHERE email = 'consult_test@erp.test');
  EXCEPTION WHEN OTHERS THEN
    v_pm := NULL; v_qc := NULL; v_consult := NULL;
    RAISE NOTICE 'تعذر إنشاء المستخدمين (قد تحتاج صلاحية service_role). استخدم NULL بدلاً من ذلك.';
  END;

  -- محاولة قراءة المستخدمين الموجودين إذا فشل الإدراج
  IF v_pm IS NULL THEN SELECT id INTO v_pm FROM user_profiles WHERE email = 'pm_test@erp.test'; END IF;
  IF v_qc IS NULL THEN SELECT id INTO v_qc FROM user_profiles WHERE email = 'qc_test@erp.test'; END IF;
  IF v_consult IS NULL THEN SELECT id INTO v_consult FROM user_profiles WHERE email = 'consult_test@erp.test'; END IF;

  -- ==========================================================================
  -- 4. بنود العمل (item_definitions) - 8 بنود
  -- ==========================================================================

  INSERT INTO item_definitions (id, project_id, division, sub_division, activity, activity_weight, wbs_code, wbs_description, booked_budget, open_budget, budget_rate, quantity, unit_price)
  SELECT gen_random_uuid(), v_prj1, 'أعمال هيكلية', 'أساسات', 'خرسانة أساسات مسلحة', 20.00, 'WBS-TEST-001', 'أعمال الخرسانة المسلحة للأساسات', 500000.00, 450000.00, 450.00, 1000.00, 450.00
  ON CONFLICT (project_id, wbs_code) DO NOTHING;

  INSERT INTO item_definitions (id, project_id, division, sub_division, activity, activity_weight, wbs_code, wbs_description, booked_budget, open_budget, budget_rate, quantity, unit_price)
  SELECT gen_random_uuid(), v_prj1, 'أعمال هيكلية', 'أعمدة', 'حديد تسليح أعمدة', 15.00, 'WBS-TEST-002', 'أعمال حديد التسليح للأعمدة', 350000.00, 315000.00, 3200.00, 100.00, 3200.00
  ON CONFLICT (project_id, wbs_code) DO NOTHING;

  INSERT INTO item_definitions (id, project_id, division, sub_division, activity, activity_weight, wbs_code, wbs_description, booked_budget, open_budget, budget_rate, quantity, unit_price)
  SELECT gen_random_uuid(), v_prj1, 'أعمال معمارية', 'جدران', 'بناء جدران بلوك', 15.00, 'WBS-TEST-003', 'أعمال بناء جدران البلوك الداخلية', 200000.00, 180000.00, 85.00, 2400.00, 85.00
  ON CONFLICT (project_id, wbs_code) DO NOTHING;

  INSERT INTO item_definitions (id, project_id, division, sub_division, activity, activity_weight, wbs_code, wbs_description, booked_budget, open_budget, budget_rate, quantity, unit_price)
  SELECT gen_random_uuid(), v_prj1, 'أعمال معمارية', 'تشطيب', 'دهان جدران داخلي', 10.00, 'WBS-TEST-004', 'أعمال الدهان الداخلي للجدران', 120000.00, 108000.00, 35.00, 3400.00, 35.00
  ON CONFLICT (project_id, wbs_code) DO NOTHING;

  INSERT INTO item_definitions (id, project_id, division, sub_division, activity, activity_weight, wbs_code, wbs_description, booked_budget, open_budget, budget_rate, quantity, unit_price)
  SELECT gen_random_uuid(), v_prj1, 'أعمال كهربائية', 'تمديدات', 'تمديدات كهربائية أساسية', 12.00, 'WBS-TEST-005', 'تمديد الأسلاك والقنوات الكهربائية', 180000.00, 162000.00, 120.00, 1500.00, 120.00
  ON CONFLICT (project_id, wbs_code) DO NOTHING;

  INSERT INTO item_definitions (id, project_id, division, sub_division, activity, activity_weight, wbs_code, wbs_description, booked_budget, open_budget, budget_rate, quantity, unit_price)
  SELECT gen_random_uuid(), v_prj1, 'أعمال كهربائية', 'لوحات توزيع', 'تركيب لوحات كهربائية رئيسية', 10.00, 'WBS-TEST-006', 'توريد وتركيب لوحات التوزيع الكهربائية', 95000.00, 85500.00, 3500.00, 25.00, 3500.00
  ON CONFLICT (project_id, wbs_code) DO NOTHING;

  INSERT INTO item_definitions (id, project_id, division, sub_division, activity, activity_weight, wbs_code, wbs_description, booked_budget, open_budget, budget_rate, quantity, unit_price)
  SELECT gen_random_uuid(), v_prj1, 'أعمال ميكانيكية', 'سباكة', 'شبكة تغذية مياه', 10.00, 'WBS-TEST-007', 'شبكة تغذية المياه الباردة والساخنة', 140000.00, 126000.00, 180.00, 780.00, 180.00
  ON CONFLICT (project_id, wbs_code) DO NOTHING;

  INSERT INTO item_definitions (id, project_id, division, sub_division, activity, activity_weight, wbs_code, wbs_description, booked_budget, open_budget, budget_rate, quantity, unit_price)
  SELECT gen_random_uuid(), v_prj1, 'أعمال ميكانيكية', 'تكييف', 'نظام تكييف مركزي', 8.00, 'WBS-TEST-008', 'توريد وتركيب نظام التكييف المركزي', 250000.00, 225000.00, 8500.00, 28.00, 8500.00
  ON CONFLICT (project_id, wbs_code) DO NOTHING;

  -- ==========================================================================
  -- 5. طلبات فحص العمل (work_requests) - 5 طلبات
  -- ==========================================================================

  INSERT INTO work_requests (id, project_id, unit_id, wir_no, title_en, title_ar, description, request_date, requested_by, inspected_by, status, priority, location, notes, is_ncr)
  SELECT gen_random_uuid(), v_prj1, v_unit1, 'WR-TEST-001', 'Foundation Concrete Inspection', 'فحص خرسانة الأساسات', 'فحص جودة صب الخرسانة للأساسات المسلحة', '2026-02-15', v_qc, v_consult, 'approved', 'high', 'الموقع أ - الأساسات', 'تم الفحص والموافقة', false
  ON CONFLICT (project_id, wir_no) DO NOTHING;

  INSERT INTO work_requests (id, project_id, unit_id, wir_no, title_en, title_ar, description, request_date, requested_by, inspected_by, status, priority, location, notes, is_ncr)
  SELECT gen_random_uuid(), v_prj1, v_unit2, 'WR-TEST-002', 'Column Reinforcement Check', 'تدقيق تسليح الأعمدة', 'التأكد من تطابق تسليح الأعمدة مع المخططات', '2026-03-10', v_qc, v_consult, 'qc_review', 'high', 'الموقع ب - الأعمدة', 'بانتظار مراجعة الاستشاري', false
  ON CONFLICT (project_id, wir_no) DO NOTHING;

  INSERT INTO work_requests (id, project_id, unit_id, wir_no, title_en, title_ar, description, request_date, requested_by, inspected_by, status, priority, location, notes, is_ncr)
  SELECT gen_random_uuid(), v_prj1, v_unit3, 'WR-TEST-003', 'Wall Plastering Inspection', 'فحص تجصيص الجدران', 'فحص أعمال اللياسة والتجصيص للجدران الداخلية', '2026-04-05', v_qc, NULL, 'pending', 'medium', 'الموقع أ - الجدران', 'بانتظار تحديد المفتش', false
  ON CONFLICT (project_id, wir_no) DO NOTHING;

  INSERT INTO work_requests (id, project_id, unit_id, wir_no, title_en, title_ar, description, request_date, requested_by, inspected_by, status, priority, location, notes, is_ncr)
  SELECT gen_random_uuid(), v_prj1, v_unit1, 'WR-TEST-004', 'Electrical Wiring Test', 'اختبار التمديدات الكهربائية', 'اختبار سلامة التمديدات الكهربائية قبل التغطية', '2026-04-20', v_qc, v_consult, 'consultant_review', 'high', 'الموقع أ - كهرباء', 'بانتظار اعتماد الاستشاري', false
  ON CONFLICT (project_id, wir_no) DO NOTHING;

  INSERT INTO work_requests (id, project_id, unit_id, wir_no, title_en, title_ar, description, request_date, requested_by, inspected_by, status, priority, location, notes, is_ncr)
  SELECT gen_random_uuid(), v_prj1, v_unit5, 'WR-TEST-005', 'Waterproofing Failure', 'فشل العزل المائي', 'تسرب مياه من سقف الدور الأول - عزل غير مطابق', '2026-05-01', v_qc, NULL, 'rejected', 'critical', 'الموقع ب - السقف', 'مطلوب إعادة العزل حسب المواصفات', true
  ON CONFLICT (project_id, wir_no) DO NOTHING;

  -- ==========================================================================
  -- 6. مهام العمل (work_tasks) - 5 مهام
  -- ==========================================================================

  INSERT INTO work_tasks (id, project_id, unit_id, task_code, title_en, title_ar, description, start_date, end_date, status, priority, progress)
  SELECT gen_random_uuid(), v_prj1, v_unit1, 'TSK-TEST-001', 'Excavation for Foundation', 'حفر الأساسات', 'حفر وإعداد الموقع للأساسات المسلحة', '2026-01-20', '2026-02-10', 'completed', 'high', 100.00
  ON CONFLICT (project_id, task_code) DO NOTHING;

  INSERT INTO work_tasks (id, project_id, unit_id, task_code, title_en, title_ar, description, start_date, end_date, status, priority, progress)
  SELECT gen_random_uuid(), v_prj1, v_unit1, 'TSK-TEST-002', 'Foundation Concrete Pour', 'صب خرسانة الأساسات', 'صب خرسانة الأساسات المسلحة', '2026-02-11', '2026-03-01', 'completed', 'high', 100.00
  ON CONFLICT (project_id, task_code) DO NOTHING;

  INSERT INTO work_tasks (id, project_id, unit_id, task_code, title_en, title_ar, description, start_date, end_date, status, priority, progress)
  SELECT gen_random_uuid(), v_prj1, v_unit2, 'TSK-TEST-003', 'Column Construction', 'بناء الأعمدة', 'صب وتسليح أعمدة الدور الأرضي', '2026-03-05', '2026-04-15', 'in_progress', 'high', 55.00
  ON CONFLICT (project_id, task_code) DO NOTHING;

  INSERT INTO work_tasks (id, project_id, unit_id, task_code, title_en, title_ar, description, start_date, end_date, status, priority, progress)
  SELECT gen_random_uuid(), v_prj1, v_unit3, 'TSK-TEST-004', 'First Floor Slab', 'بلاطة الدور الأول', 'صَب بلاطة الدور الأول', '2026-04-20', '2026-05-30', 'pending', 'medium', 0.00
  ON CONFLICT (project_id, task_code) DO NOTHING;

  INSERT INTO work_tasks (id, project_id, unit_id, task_code, title_en, title_ar, description, start_date, end_date, status, priority, progress)
  SELECT gen_random_uuid(), v_prj1, v_unit1, 'TSK-TEST-005', 'Electrical Rough-In', 'تمديدات كهربائية أولية', 'تمديد القنوات والأسلاك الكهربائية للوحدة', '2026-05-15', '2026-06-30', 'pending', 'medium', 0.00
  ON CONFLICT (project_id, task_code) DO NOTHING;

  -- ==========================================================================
  -- 7. العملاء (customers) - 5 عملاء
  -- ==========================================================================

  INSERT INTO customers (id, customer_code, full_name_en, full_name_ar, phone, email, address, national_id, customer_type, is_active)
  SELECT gen_random_uuid(), 'CUST-TEST-001', 'Mohammed Al-Ahmad', 'محمد الأحمد', '+966 55 100 2001', 'm.ahmad@email.com', 'الرياض، حي الملقا', '1011234567', 'individual', true
  ON CONFLICT (customer_code) DO NOTHING
  RETURNING id INTO v_cust1;

  IF v_cust1 IS NULL THEN SELECT id INTO v_cust1 FROM customers WHERE customer_code = 'CUST-TEST-001'; END IF;

  INSERT INTO customers (id, customer_code, full_name_en, full_name_ar, phone, email, address, national_id, customer_type, is_active)
  SELECT gen_random_uuid(), 'CUST-TEST-002', 'Saud Al-Harbi', 'سعود الحربي', '+966 55 100 2002', 's.alharbi@email.com', 'جدة، حي الشاطئ', '1022345678', 'individual', true
  ON CONFLICT (customer_code) DO NOTHING
  RETURNING id INTO v_cust2;

  IF v_cust2 IS NULL THEN SELECT id INTO v_cust2 FROM customers WHERE customer_code = 'CUST-TEST-002'; END IF;

  INSERT INTO customers (id, customer_code, full_name_en, full_name_ar, phone, email, address, national_id, customer_type, is_active)
  SELECT gen_random_uuid(), 'CUST-TEST-003', 'Abdullah Al-Dosari', 'عبدالله الدوسري', '+966 55 100 2003', 'a.dosari@email.com', 'الدمام، حي الفيصلية', '1033456789', 'individual', true
  ON CONFLICT (customer_code) DO NOTHING
  RETURNING id INTO v_cust3;

  IF v_cust3 IS NULL THEN SELECT id INTO v_cust3 FROM customers WHERE customer_code = 'CUST-TEST-003'; END IF;

  INSERT INTO customers (id, customer_code, full_name_en, full_name_ar, phone, email, address, national_id, customer_type, is_active)
  SELECT gen_random_uuid(), 'CUST-TEST-004', 'Fahad Al-Otaibi', 'فهـد العتيبي', '+966 55 100 2004', 'f.alotaibi@email.com', 'مكة المكرمة، حي العوالي', '1044567890', 'individual', true
  ON CONFLICT (customer_code) DO NOTHING
  RETURNING id INTO v_cust4;

  IF v_cust4 IS NULL THEN SELECT id INTO v_cust4 FROM customers WHERE customer_code = 'CUST-TEST-004'; END IF;

  INSERT INTO customers (id, customer_code, full_name_en, full_name_ar, phone, email, address, national_id, customer_type, is_active)
  SELECT gen_random_uuid(), 'CUST-TEST-005', 'Noura Al-Shammari', 'نورة الشمري', '+966 55 100 2005', 'n.alshammari@email.com', 'الخبر، حي العقربية', '1055678901', 'individual', true
  ON CONFLICT (customer_code) DO NOTHING
  RETURNING id INTO v_cust5;

  IF v_cust5 IS NULL THEN SELECT id INTO v_cust5 FROM customers WHERE customer_code = 'CUST-TEST-005'; END IF;

  -- ==========================================================================
  -- 8. الموردين (suppliers) - 5 موردين
  -- ==========================================================================

  INSERT INTO suppliers (id, supplier_code, name_en, name_ar, phone, email, address, cr_number, vat_number, is_approved, rating)
  SELECT gen_random_uuid(), 'SUP-TEST-001', 'Saudi Concrete Supply Co.', 'شركة توريد الخرسانة السعودية', '+966 55 200 1001', 'info@saudi-concrete.com', 'الرياض، المنطقة الصناعية', 'CR-TEST-001', 'VAT-TEST-001', true, 4.5
  ON CONFLICT (supplier_code) DO NOTHING
  RETURNING id INTO v_sup1;

  IF v_sup1 IS NULL THEN SELECT id INTO v_sup1 FROM suppliers WHERE supplier_code = 'SUP-TEST-001'; END IF;

  INSERT INTO suppliers (id, supplier_code, name_en, name_ar, phone, email, address, cr_number, vat_number, is_approved, rating)
  SELECT gen_random_uuid(), 'SUP-TEST-002', 'Al-Mutairi Steel Trading', 'تجارة الحديد المطيري', '+966 55 200 1002', 'info@mutairisteel.com', 'جدة، شارع الصناعة', 'CR-TEST-002', 'VAT-TEST-002', true, 4.2
  ON CONFLICT (supplier_code) DO NOTHING
  RETURNING id INTO v_sup2;

  IF v_sup2 IS NULL THEN SELECT id INTO v_sup2 FROM suppliers WHERE supplier_code = 'SUP-TEST-002'; END IF;

  INSERT INTO suppliers (id, supplier_code, name_en, name_ar, phone, email, address, cr_number, vat_number, is_approved, rating)
  SELECT gen_random_uuid(), 'SUP-TEST-003', 'Arabian Electrical Supplies', 'التجهيزات الكهربائية العربية', '+966 55 200 1003', 'sales@arabian-electric.com', 'الدمام، طريق الملك فهد', 'CR-TEST-003', 'VAT-TEST-003', true, 4.0
  ON CONFLICT (supplier_code) DO NOTHING
  RETURNING id INTO v_sup3;

  IF v_sup3 IS NULL THEN SELECT id INTO v_sup3 FROM suppliers WHERE supplier_code = 'SUP-TEST-003'; END IF;

  INSERT INTO suppliers (id, supplier_code, name_en, name_ar, phone, email, address, cr_number, vat_number, is_approved, rating)
  SELECT gen_random_uuid(), 'SUP-TEST-004', 'Al-Qahtani Plumbing Materials', 'مواد السباكة القحطاني', '+966 55 200 1004', 'info@qahtani-plumb.com', 'الرياض، حي السلي', 'CR-TEST-004', 'VAT-TEST-004', true, 3.8
  ON CONFLICT (supplier_code) DO NOTHING
  RETURNING id INTO v_sup4;

  IF v_sup4 IS NULL THEN SELECT id INTO v_sup4 FROM suppliers WHERE supplier_code = 'SUP-TEST-004'; END IF;

  INSERT INTO suppliers (id, supplier_code, name_en, name_ar, phone, email, address, cr_number, vat_number, is_approved, rating)
  SELECT gen_random_uuid(), 'SUP-TEST-005', 'Modern HVAC Systems Co.', 'شركة أنظمة التكييف الحديثة', '+966 55 200 1005', 'info@modernhvac.com', 'جدة، حي السلامة', 'CR-TEST-005', 'VAT-TEST-005', false, 3.5
  ON CONFLICT (supplier_code) DO NOTHING
  RETURNING id INTO v_sup5;

  IF v_sup5 IS NULL THEN SELECT id INTO v_sup5 FROM suppliers WHERE supplier_code = 'SUP-TEST-005'; END IF;

  -- ==========================================================================
  -- 9. الموظفين (employees) - 5 موظفين
  -- ==========================================================================

  INSERT INTO employees (id, project_id, employee_code, full_name_en, full_name_ar, job_title, department, employee_type, basic_salary, phone, email, nationality, hire_date, status)
  SELECT gen_random_uuid(), v_prj1, 'EMP-TEST-001', 'Sultan Al-Ghamdi', 'سلطان الغامدي', 'مهندس موقع', 'الهندسة', 'engineer', 15000.00, '+966 55 300 1001', 's.ghamdi@test.com', 'سعودي', '2026-01-01', 'active'
  ON CONFLICT (employee_code) DO NOTHING
  RETURNING id INTO v_emp1;

  IF v_emp1 IS NULL THEN SELECT id INTO v_emp1 FROM employees WHERE employee_code = 'EMP-TEST-001'; END IF;

  INSERT INTO employees (id, project_id, employee_code, full_name_en, full_name_ar, job_title, department, employee_type, basic_salary, phone, email, nationality, hire_date, status)
  SELECT gen_random_uuid(), v_prj1, 'EMP-TEST-002', 'Mansour Al-Zahrani', 'منصور الزهراني', 'مراقب جودة', 'الجودة', 'supervisor', 10000.00, '+966 55 300 1002', 'm.zahrani@test.com', 'سعودي', '2026-01-15', 'active'
  ON CONFLICT (employee_code) DO NOTHING
  RETURNING id INTO v_emp2;

  IF v_emp2 IS NULL THEN SELECT id INTO v_emp2 FROM employees WHERE employee_code = 'EMP-TEST-002'; END IF;

  INSERT INTO employees (id, project_id, employee_code, full_name_en, full_name_ar, job_title, department, employee_type, basic_salary, phone, email, nationality, hire_date, status)
  SELECT gen_random_uuid(), v_prj1, 'EMP-TEST-003', 'Nasser Al-Anezi', 'ناصر العنزي', 'مهندس سلامة', 'السلامة', 'engineer', 12000.00, '+966 55 300 1003', 'n.anezi@test.com', 'سعودي', '2026-02-01', 'active'
  ON CONFLICT (employee_code) DO NOTHING
  RETURNING id INTO v_emp3;

  IF v_emp3 IS NULL THEN SELECT id INTO v_emp3 FROM employees WHERE employee_code = 'EMP-TEST-003'; END IF;

  INSERT INTO employees (id, project_id, employee_code, full_name_en, full_name_ar, job_title, department, employee_type, basic_salary, phone, email, nationality, hire_date, status)
  SELECT gen_random_uuid(), v_prj2, 'EMP-TEST-004', 'Hassan Al-Balawi', 'حسن البلوي', 'محاسب مشروع', 'المالية', 'staff', 11000.00, '+966 55 300 1004', 'h.balawi@test.com', 'سعودي', '2026-02-15', 'active'
  ON CONFLICT (employee_code) DO NOTHING
  RETURNING id INTO v_emp4;

  IF v_emp4 IS NULL THEN SELECT id INTO v_emp4 FROM employees WHERE employee_code = 'EMP-TEST-004'; END IF;

  INSERT INTO employees (id, project_id, employee_code, full_name_en, full_name_ar, job_title, department, employee_type, basic_salary, phone, email, nationality, hire_date, status)
  SELECT gen_random_uuid(), v_prj3, 'EMP-TEST-005', 'Saeed Al-Mutairi', 'سعيد المطيري', 'أخصائي مشتريات', 'المشتريات', 'staff', 9000.00, '+966 55 300 1005', 's.mutairi@test.com', 'سعودي', '2026-03-01', 'active'
  ON CONFLICT (employee_code) DO NOTHING
  RETURNING id INTO v_emp5;

  IF v_emp5 IS NULL THEN SELECT id INTO v_emp5 FROM employees WHERE employee_code = 'EMP-TEST-005'; END IF;

  -- ==========================================================================
  -- 10. عقود المشتريات (purchase_orders) - 3 أوامر شراء
  -- ==========================================================================

  INSERT INTO purchase_orders (id, project_id, supplier_id, po_no, title, order_date, total_amount, tax_amount, grand_total, status)
  SELECT gen_random_uuid(), v_prj1, v_sup1, 'PO-TEST-001', 'توريد خرسانة جاهزة للمشروع الأول', '2026-01-20', 450000.00, 67500.00, 517500.00, 'approved'
  ON CONFLICT (project_id, po_no) DO NOTHING;

  INSERT INTO purchase_orders (id, project_id, supplier_id, po_no, title, order_date, total_amount, tax_amount, grand_total, status)
  SELECT gen_random_uuid(), v_prj1, v_sup2, 'PO-TEST-002', 'توريد حديد تسليح للأعمدة', '2026-02-10', 320000.00, 48000.00, 368000.00, 'approved'
  ON CONFLICT (project_id, po_no) DO NOTHING;

  INSERT INTO purchase_orders (id, project_id, supplier_id, po_no, title, order_date, total_amount, tax_amount, grand_total, status)
  SELECT gen_random_uuid(), v_prj2, v_sup3, 'PO-TEST-003', 'توريد مواد كهربائية للمجمع التجاري', '2026-03-15', 180000.00, 27000.00, 207000.00, 'pending'
  ON CONFLICT (project_id, po_no) DO NOTHING;

  -- ==========================================================================
  -- 11. الفواتير (contract_invoices) - 3 فواتير
  -- ==========================================================================

  INSERT INTO contract_invoices (id, contract_id, invoice_no, invoice_type, invoice_date, amount, retention_pct, retention_amount, status, due_date, notes)
  SELECT gen_random_uuid(), c.id, 'INV-TEST-001', 'advance', '2026-01-25', 500000.00, 0, 0, 'paid', '2026-02-10', 'دفعة مقدمة - يرتبط بأمر الشراء PO-TEST-001'
  FROM contracts c WHERE c.project_id = v_prj1 AND c.contract_no = 'CNT-2025-001'
  ON CONFLICT (contract_id, invoice_no) DO NOTHING;

  INSERT INTO contract_invoices (id, contract_id, invoice_no, invoice_type, invoice_date, amount, retention_pct, retention_amount, status, due_date, notes)
  SELECT gen_random_uuid(), c.id, 'INV-TEST-002', 'progress', '2026-03-15', 350000.00, 10.00, 35000.00, 'pending', '2026-04-15', 'دفعة تقدم - يرتبط بأمر الشراء PO-TEST-002'
  FROM contracts c WHERE c.project_id = v_prj1 AND c.contract_no = 'CNT-2025-001'
  ON CONFLICT (contract_id, invoice_no) DO NOTHING;

  INSERT INTO contract_invoices (id, contract_id, invoice_no, invoice_type, invoice_date, amount, retention_pct, retention_amount, status, due_date, notes)
  SELECT gen_random_uuid(), c.id, 'INV-TEST-003', 'progress', '2026-04-20', 280000.00, 10.00, 28000.00, 'pending', '2026-05-20', 'دفعة تقدم للمشروع الثاني - يرتبط بأمر الشراء PO-TEST-003'
  FROM contracts c WHERE c.project_id = v_prj2 AND c.contract_no = 'CNT-2025-002'
  ON CONFLICT (contract_id, invoice_no) DO NOTHING;

  -- ==========================================================================
  -- 12. الميزانية (budget) - 4 بنود ميزانية
  -- ==========================================================================

  INSERT INTO budget (id, budget_code, category, total_budget, used_amount, project_id, budget_type, status)
  SELECT gen_random_uuid(), 'BUG-TEST-001', 'أعمال هيكلية', 1500000.00, 650000.00, v_prj1, 'material', 'active'
  ON CONFLICT (budget_code) DO NOTHING;

  INSERT INTO budget (id, budget_code, category, total_budget, used_amount, project_id, budget_type, status)
  SELECT gen_random_uuid(), 'BUG-TEST-002', 'أعمال معمارية', 800000.00, 120000.00, v_prj1, 'material', 'active'
  ON CONFLICT (budget_code) DO NOTHING;

  INSERT INTO budget (id, budget_code, category, total_budget, used_amount, project_id, budget_type, status)
  SELECT gen_random_uuid(), 'BUG-TEST-003', 'أعمال كهربائية', 450000.00, 50000.00, v_prj1, 'material', 'active'
  ON CONFLICT (budget_code) DO NOTHING;

  INSERT INTO budget (id, budget_code, category, total_budget, used_amount, project_id, budget_type, status)
  SELECT gen_random_uuid(), 'BUG-TEST-004', 'أعمال ميكانيكية', 500000.00, 0.00, v_prj1, 'material', 'active'
  ON CONFLICT (budget_code) DO NOTHING;

  -- ==========================================================================
  -- 13. تذاكر فنية (technical_tickets) - 3 تذاكر
  -- ==========================================================================

  INSERT INTO technical_tickets (id, project_id, ticket_no, ticket_type, title_en, title_ar, description, priority, status, requested_by, assigned_to, due_date)
  SELECT gen_random_uuid(), v_prj1, 'RFI-TEST-001', 'rfi', 'Clarify Foundation Depth', 'توضيح عمق الأساسات', 'طلب توضيح بخصوص عمق الأساسات حسب المخطط الهيكلي S-101', 'high', 'open', v_qc, v_consult, '2026-03-01'
  ON CONFLICT (project_id, ticket_no) DO NOTHING;

  INSERT INTO technical_tickets (id, project_id, ticket_no, ticket_type, title_en, title_ar, description, priority, status, requested_by, assigned_to, due_date)
  SELECT gen_random_uuid(), v_prj1, 'RFI-TEST-002', 'design_query', 'Window Detail Confirmation', 'تأكيد تفاصيل الشبابيك', 'استفسار تصميمي بخصوص أبعاد شبابيك الواجهة الشمالية', 'medium', 'open', v_qc, v_consult, '2026-03-15'
  ON CONFLICT (project_id, ticket_no) DO NOTHING;

  INSERT INTO technical_tickets (id, project_id, ticket_no, ticket_type, title_en, title_ar, description, priority, status, requested_by, assigned_to, due_date)
  SELECT gen_random_uuid(), v_prj2, 'SNG-TEST-001', 'site_instruction', 'Crack in Wall Finish', 'شرخ في تشطيب الجدار', 'وجود شرخ في تشطيب جدار الواجهة الرئيسية - المبنى التجاري', 'medium', 'open', v_qc, v_consult, '2026-04-10'
  ON CONFLICT (project_id, ticket_no) DO NOTHING;

  -- ==========================================================================
  -- 14. حوادث السلامة (safety_incidents) - 3 حوادث
  -- ==========================================================================

  INSERT INTO safety_incidents (id, project_id, incident_no, incident_date, incident_type, severity, location, description, immediate_action, status, reported_by)
  SELECT gen_random_uuid(), v_prj1, 'IS-TEST-001', '2026-02-20', 'minor_injury', 'low', 'الموقع أ - منطقة الحفر', 'إصابة عامل بجرح بسيط في اليد أثناء استخدام قاطع الحديد', 'تم تقديم الإسعافات الأولية وعاد العامل للعمل', 'closed', v_qc
  ON CONFLICT (project_id, incident_no) DO NOTHING;

  INSERT INTO safety_incidents (id, project_id, incident_no, incident_date, incident_type, severity, location, description, immediate_action, status, reported_by)
  SELECT gen_random_uuid(), v_prj1, 'IS-TEST-002', '2026-03-15', 'near_miss', 'medium', 'الموقع ب - الرافعة', 'كادت حمولة أن تسقط من الرافعة البرجية بسبب سوء التثبيت', 'تم إيقاف العمل وإعادة تثبيت الحمولة', 'closed', v_qc
  ON CONFLICT (project_id, incident_no) DO NOTHING;

  INSERT INTO safety_incidents (id, project_id, incident_no, incident_date, incident_type, severity, location, description, immediate_action, status, reported_by)
  SELECT gen_random_uuid(), v_prj2, 'IS-TEST-003', '2026-04-10', 'first_aid', 'low', 'المجمع التجاري - جدة', 'عامل يعاني من حساسية جلدية بسبب مادة الأسمنت', 'تم تقديم العلاج وإعطاء العامل إجازة', 'open', v_qc
  ON CONFLICT (project_id, incident_no) DO NOTHING;

  -- ==========================================================================
  -- 15. ملاحظات السلامة (safety_observations) - 3 ملاحظات
  -- ==========================================================================

  INSERT INTO safety_observations (id, project_id, observation_no, observation_date, observation_type, location, description, recommended_action, status, observed_by)
  SELECT gen_random_uuid(), v_prj1, 'OS-TEST-001', '2026-02-25', 'unsafe_act', 'موقع الحفر', 'عامل يعمل بدون خوذة أمان في منطقة الحفر', 'إيقاف العمل فوراً وتنبيه العامل', 'closed', v_qc
  ON CONFLICT (project_id, observation_no) DO NOTHING;

  INSERT INTO safety_observations (id, project_id, observation_no, observation_date, observation_type, location, description, recommended_action, status, observed_by)
  SELECT gen_random_uuid(), v_prj1, 'OS-TEST-002', '2026-03-20', 'unsafe_condition', 'منطقة تخزين المواد', 'كومة حديد تسليح غير مثبتة وقد تتدحرج', 'تثبيت حديد التسليح بالسلاسل', 'open', v_qc
  ON CONFLICT (project_id, observation_no) DO NOTHING;

  INSERT INTO safety_observations (id, project_id, observation_no, observation_date, observation_type, location, description, recommended_action, status, observed_by)
  SELECT gen_random_uuid(), v_prj2, 'OS-TEST-003', '2026-04-05', 'safe_act', 'المجمع التجاري', 'مشرف الموقع يقوم بعمل جولة تفتيش سلامة يومية', 'شكر وتقدير للمشرف على الالتزام', 'closed', v_qc
  ON CONFLICT (project_id, observation_no) DO NOTHING;

  -- ==========================================================================
  -- 16. مبيعات الوحدات (unit_sales) - عمليتي بيع
  -- ==========================================================================

  INSERT INTO unit_sales (id, unit_id, customer_id, project_id, sale_date, sale_price, payment_method, status, notes)
  SELECT gen_random_uuid(), v_unit1, v_cust1, v_prj1, '2026-03-01', 850000.00, 'cash', 'reserved', 'حجز فيلا - سيتم توقيع العقد قريباً'
  ON CONFLICT (unit_id) DO NOTHING;

  INSERT INTO unit_sales (id, unit_id, customer_id, project_id, sale_date, sale_price, payment_method, status, notes)
  SELECT gen_random_uuid(), v_unit5, v_cust2, v_prj1, '2026-04-01', 920000.00, 'installments', 'reserved', 'حجز فيلا بنظام الأقساط - دفع 20% دفعة أولى'
  ON CONFLICT (unit_id) DO NOTHING;

  -- ==========================================================================
  -- 17. العروض (leads) - 3 عروض
  -- ==========================================================================

  INSERT INTO leads (id, project_id, lead_source, full_name, phone, email, preferred_unit_type, budget_range, notes, status, lead_no)
  SELECT gen_random_uuid(), v_prj1, 'website', 'Ibrahim Al-Saleh', '+966 55 400 1001', 's.alharbi@email.com', 'villa', '800000-1000000', 'عميل مهتم بالفيلات في الرياض', 'new', 'LD-TEST-001'
  ON CONFLICT (lead_no) DO NOTHING;

  INSERT INTO leads (id, project_id, lead_source, full_name, phone, email, preferred_unit_type, budget_range, notes, status, lead_no)
  SELECT gen_random_uuid(), v_prj1, 'referral', 'Sami Al-Qahtani', '+966 55 400 1002', 's.qahtani@email.com', 'villa', '900000-1200000', 'تمت الإحالة من عميل سابق', 'contacted', 'LD-TEST-002'
  ON CONFLICT (lead_no) DO NOTHING;

  INSERT INTO leads (id, project_id, lead_source, full_name, phone, email, preferred_unit_type, budget_range, notes, status, lead_no)
  SELECT gen_random_uuid(), v_prj2, 'social_media', 'Maha Al-Dosari', '+966 55 400 1003', 'm.dosari@email.com', 'apartment', '500000-700000', 'تواصلت عبر إنستغرام - مهتمة بشقة في جدة', 'new', 'LD-TEST-003'
  ON CONFLICT (lead_no) DO NOTHING;

  -- ==========================================================================
  -- 18. بيانات CRM (crm_companies, crm_contacts, crm_deals)
  -- ==========================================================================

  -- 18.1 الشركات (3 شركات)
  INSERT INTO crm_companies (id, company_name, trading_name, registration_number, vat_number, phone, email, industry, company_size, source, city, country, is_active)
  SELECT gen_random_uuid(), 'شركة البناء المتطور', 'Al-Bina Al-Mutatawer', 'CR-CRM-001', 'VAT-CRM-001', '+966 11 200 3001', 'info@mutatawer.com', 'Construction', '51-200', 'referral', 'الرياض', 'السعودية', true
  WHERE NOT EXISTS (SELECT 1 FROM crm_companies WHERE registration_number = 'CR-CRM-001')
  RETURNING id INTO v_comp1;

  IF v_comp1 IS NULL THEN SELECT id INTO v_comp1 FROM crm_companies WHERE registration_number = 'CR-CRM-001'; END IF;

  INSERT INTO crm_companies (id, company_name, trading_name, registration_number, vat_number, phone, email, industry, company_size, source, city, country, is_active)
  SELECT gen_random_uuid(), 'مؤسسة النخبة للمقاولات', 'Al-Nokhba Contracting Est.', 'CR-CRM-002', 'VAT-CRM-002', '+966 12 600 4001', 'info@nokhba.com', 'Construction', '11-50', 'website', 'جدة', 'السعودية', true
  WHERE NOT EXISTS (SELECT 1 FROM crm_companies WHERE registration_number = 'CR-CRM-002')
  RETURNING id INTO v_comp2;

  IF v_comp2 IS NULL THEN SELECT id INTO v_comp2 FROM crm_companies WHERE registration_number = 'CR-CRM-002'; END IF;

  INSERT INTO crm_companies (id, company_name, trading_name, registration_number, vat_number, phone, email, industry, company_size, source, city, country, is_active)
  SELECT gen_random_uuid(), 'شركة الخليج للتطوير العقاري', 'Gulf Real Estate Development Co.', 'CR-CRM-003', 'VAT-CRM-003', '+966 13 800 5001', 'info@gulf-realestate.com', 'Real Estate', '201-1000', 'referral', 'الدمام', 'السعودية', true
  WHERE NOT EXISTS (SELECT 1 FROM crm_companies WHERE registration_number = 'CR-CRM-003')
  RETURNING id INTO v_comp3;

  IF v_comp3 IS NULL THEN SELECT id INTO v_comp3 FROM crm_companies WHERE registration_number = 'CR-CRM-003'; END IF;

  -- 18.2 جهات الاتصال (5 جهات)
  INSERT INTO crm_contacts (id, company_id, first_name, last_name, email, phone, mobile, position, department, source, city, is_active)
  SELECT gen_random_uuid(), v_comp1, 'Khaled', 'Al-Harbi', 'k.alharbi@mutatawer.com', '+966 50 500 1001', '+966 55 500 1001', 'مدير المشاريع', 'إدارة المشاريع', 'referral', 'الرياض', true
  WHERE NOT EXISTS (SELECT 1 FROM crm_contacts WHERE email = 'k.alharbi@mutatawer.com')
  RETURNING id INTO v_contact1;

  IF v_contact1 IS NULL THEN SELECT id INTO v_contact1 FROM crm_contacts WHERE email = 'k.alharbi@mutatawer.com'; END IF;

  INSERT INTO crm_contacts (id, company_id, first_name, last_name, email, phone, mobile, position, department, source, city, is_active)
  SELECT gen_random_uuid(), v_comp1, 'Nawaf', 'Al-Otaibi', 'n.alotaibi@mutatawer.com', '+966 50 500 1002', '+966 55 500 1002', 'مهندس تقدير تكاليف', 'المالية', 'referral', 'الرياض', true
  WHERE NOT EXISTS (SELECT 1 FROM crm_contacts WHERE email = 'n.alotaibi@mutatawer.com')
  RETURNING id INTO v_contact2;

  IF v_contact2 IS NULL THEN SELECT id INTO v_contact2 FROM crm_contacts WHERE email = 'n.alotaibi@mutatawer.com'; END IF;

  INSERT INTO crm_contacts (id, company_id, first_name, last_name, email, phone, mobile, position, department, source, city, is_active)
  SELECT gen_random_uuid(), v_comp2, 'Majed', 'Al-Shammari', 'm.shammari@nokhba.com', '+966 50 500 1003', '+966 55 500 1003', 'الرئيس التنفيذي', 'الإدارة العليا', 'website', 'جدة', true
  WHERE NOT EXISTS (SELECT 1 FROM crm_contacts WHERE email = 'm.shammari@nokhba.com')
  RETURNING id INTO v_contact3;

  IF v_contact3 IS NULL THEN SELECT id INTO v_contact3 FROM crm_contacts WHERE email = 'm.shammari@nokhba.com'; END IF;

  INSERT INTO crm_contacts (id, company_id, first_name, last_name, email, phone, mobile, position, department, source, city, is_active)
  SELECT gen_random_uuid(), v_comp2, 'Faisal', 'Al-Ghamdi', 'f.alghamdi@nokhba.com', '+966 50 500 1004', '+966 55 500 1004', 'مدير المشتريات', 'المشتريات', 'website', 'جدة', true
  WHERE NOT EXISTS (SELECT 1 FROM crm_contacts WHERE email = 'f.alghamdi@nokhba.com')
  RETURNING id INTO v_contact4;

  IF v_contact4 IS NULL THEN SELECT id INTO v_contact4 FROM crm_contacts WHERE email = 'f.alghamdi@nokhba.com'; END IF;

  INSERT INTO crm_contacts (id, company_id, first_name, last_name, email, phone, mobile, position, department, source, city, is_active)
  SELECT gen_random_uuid(), v_comp3, 'Abdulaziz', 'Al-Dosari', 'a.dosari@gulf-re.com', '+966 50 500 1005', '+966 55 500 1005', 'مدير التطوير العقاري', 'التطوير', 'referral', 'الدمام', true
  WHERE NOT EXISTS (SELECT 1 FROM crm_contacts WHERE email = 'a.dosari@gulf-re.com')
  RETURNING id INTO v_contact5;

  IF v_contact5 IS NULL THEN SELECT id INTO v_contact5 FROM crm_contacts WHERE email = 'a.dosari@gulf-re.com'; END IF;

  -- 18.3 مراحل البيع (لا يتم إدراجها لأن 031 ينشئها تلقائياً)
  -- يتم جلبها من الجدول الموجود
  SELECT id INTO v_stage1 FROM crm_pipeline_stages ORDER BY sort_order LIMIT 1 OFFSET 2;
  SELECT id INTO v_stage2 FROM crm_pipeline_stages ORDER BY sort_order LIMIT 1 OFFSET 3;
  SELECT id INTO v_stage3 FROM crm_pipeline_stages ORDER BY sort_order LIMIT 1 OFFSET 4;

  -- 18.4 الصفقات (3 صفقات)
  INSERT INTO crm_deals (id, deal_name, company_id, contact_id, pipeline_stage_id, amount, currency, probability, expected_close_date, source, description, assigned_to)
  SELECT gen_random_uuid(), 'توريد خرسانة للمشروع الأول', v_comp1, v_contact1, v_stage1, 450000.00, 'SAR', 40.00, '2026-06-30', 'referral', 'توريد خرسانة جاهزة لمشروع الفيلا السكنية بالرياض', v_pm
  WHERE v_stage1 IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO crm_deals (id, deal_name, company_id, contact_id, pipeline_stage_id, amount, currency, probability, expected_close_date, source, description, assigned_to)
  SELECT gen_random_uuid(), 'مقاولة تشطيب المجمع التجاري', v_comp2, v_contact3, v_stage2, 1200000.00, 'SAR', 60.00, '2026-08-15', 'website', 'أعمال التشطيب للمجمع التجاري بجدة', v_pm
  WHERE v_stage2 IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO crm_deals (id, deal_name, company_id, contact_id, pipeline_stage_id, amount, currency, probability, expected_close_date, source, description, assigned_to)
  SELECT gen_random_uuid(), 'استشارات هندسية للبرج السكني', v_comp3, v_contact5, v_stage3, 800000.00, 'SAR', 80.00, '2026-10-01', 'referral', 'تقديم استشارات هندسية لمشروع البرج السكني بالدمام', v_pm
  WHERE v_stage3 IS NOT NULL
  ON CONFLICT DO NOTHING;

  -- ==========================================================================
  -- 19. المخازن (warehouses) - مخزنين
  -- ==========================================================================

  INSERT INTO warehouses (id, code, name_en, name_ar, location, project_id, is_active)
  SELECT gen_random_uuid(), 'WH-TEST-001', 'Riyadh Test Warehouse', 'مستودع الرياض التجريبي', 'الرياض - المنطقة الصناعية', v_prj1, true
  ON CONFLICT (code) DO NOTHING
  RETURNING id INTO v_wh1;

  IF v_wh1 IS NULL THEN SELECT id INTO v_wh1 FROM warehouses WHERE code = 'WH-TEST-001'; END IF;

  INSERT INTO warehouses (id, code, name_en, name_ar, location, project_id, is_active)
  SELECT gen_random_uuid(), 'WH-TEST-002', 'Jeddah Test Warehouse', 'مستودع جدة التجريبي', 'جدة - حي الصناعية', v_prj2, true
  ON CONFLICT (code) DO NOTHING
  RETURNING id INTO v_wh2;

  IF v_wh2 IS NULL THEN SELECT id INTO v_wh2 FROM warehouses WHERE code = 'WH-TEST-002'; END IF;

  -- ==========================================================================
  -- 20. المواد (materials) - 5 مواد
  -- ==========================================================================

  INSERT INTO materials (id, code, name_en, name_ar, unit, default_price, is_active)
  SELECT gen_random_uuid(), 'MAT-TEST-001', 'Test Concrete 25MPa', 'خرسانة اختبارية 25 ميجا باسكال', 'm3', 280.00, true
  ON CONFLICT (code) DO NOTHING
  RETURNING id INTO v_mat1;

  IF v_mat1 IS NULL THEN SELECT id INTO v_mat1 FROM materials WHERE code = 'MAT-TEST-001'; END IF;

  INSERT INTO materials (id, code, name_en, name_ar, unit, default_price, is_active)
  SELECT gen_random_uuid(), 'MAT-TEST-002', 'Test Steel Rebar 14mm', 'حديد تسليح اختباري 14 مم', 'ton', 2850.00, true
  ON CONFLICT (code) DO NOTHING
  RETURNING id INTO v_mat2;

  IF v_mat2 IS NULL THEN SELECT id INTO v_mat2 FROM materials WHERE code = 'MAT-TEST-002'; END IF;

  INSERT INTO materials (id, code, name_en, name_ar, unit, default_price, is_active)
  SELECT gen_random_uuid(), 'MAT-TEST-003', 'Test Cement Type I', 'أسمنت اختباري نوع 1', 'bag', 18.50, true
  ON CONFLICT (code) DO NOTHING
  RETURNING id INTO v_mat3;

  IF v_mat3 IS NULL THEN SELECT id INTO v_mat3 FROM materials WHERE code = 'MAT-TEST-003'; END IF;

  INSERT INTO materials (id, code, name_en, name_ar, unit, default_price, is_active)
  SELECT gen_random_uuid(), 'MAT-TEST-004', 'Test Electrical Cable 4mm', 'سلك كهرباء اختباري 4 مم', 'm', 5.50, true
  ON CONFLICT (code) DO NOTHING
  RETURNING id INTO v_mat4;

  IF v_mat4 IS NULL THEN SELECT id INTO v_mat4 FROM materials WHERE code = 'MAT-TEST-004'; END IF;

  INSERT INTO materials (id, code, name_en, name_ar, unit, default_price, is_active)
  SELECT gen_random_uuid(), 'MAT-TEST-005', 'Test PVC Pipe 25mm', 'مواسير بي في سي اختبارية 25 مم', 'm', 11.50, true
  ON CONFLICT (code) DO NOTHING
  RETURNING id INTO v_mat5;

  IF v_mat5 IS NULL THEN SELECT id INTO v_mat5 FROM materials WHERE code = 'MAT-TEST-005'; END IF;

  -- ==========================================================================
  -- 21. المخزون (inventory) - 8 سجلات مخزون
  -- ==========================================================================

  INSERT INTO inventory (id, warehouse_id, material_id, quantity, min_quantity, unit_price, batch_no)
  SELECT gen_random_uuid(), v_wh1, v_mat1, 100.00, 30.00, 280.00, 'B-TEST-CONC-001'
  ON CONFLICT (warehouse_id, material_id, batch_no) DO NOTHING;

  INSERT INTO inventory (id, warehouse_id, material_id, quantity, min_quantity, unit_price, batch_no)
  SELECT gen_random_uuid(), v_wh1, v_mat2, 20.00, 5.00, 2850.00, 'B-TEST-STL-001'
  ON CONFLICT (warehouse_id, material_id, batch_no) DO NOTHING;

  INSERT INTO inventory (id, warehouse_id, material_id, quantity, min_quantity, unit_price, batch_no)
  SELECT gen_random_uuid(), v_wh1, v_mat3, 500.00, 100.00, 18.50, 'B-TEST-CEM-001'
  ON CONFLICT (warehouse_id, material_id, batch_no) DO NOTHING;

  INSERT INTO inventory (id, warehouse_id, material_id, quantity, min_quantity, unit_price, batch_no)
  SELECT gen_random_uuid(), v_wh1, v_mat4, 2000.00, 500.00, 5.50, 'B-TEST-ELC-001'
  ON CONFLICT (warehouse_id, material_id, batch_no) DO NOTHING;

  INSERT INTO inventory (id, warehouse_id, material_id, quantity, min_quantity, unit_price, batch_no)
  SELECT gen_random_uuid(), v_wh2, v_mat1, 50.00, 20.00, 282.00, 'B-TEST-CONC-002'
  ON CONFLICT (warehouse_id, material_id, batch_no) DO NOTHING;

  INSERT INTO inventory (id, warehouse_id, material_id, quantity, min_quantity, unit_price, batch_no)
  SELECT gen_random_uuid(), v_wh2, v_mat3, 300.00, 80.00, 18.00, 'B-TEST-CEM-002'
  ON CONFLICT (warehouse_id, material_id, batch_no) DO NOTHING;

  INSERT INTO inventory (id, warehouse_id, material_id, quantity, min_quantity, unit_price, batch_no)
  SELECT gen_random_uuid(), v_wh2, v_mat5, 800.00, 200.00, 11.50, 'B-TEST-PVC-001'
  ON CONFLICT (warehouse_id, material_id, batch_no) DO NOTHING;

  INSERT INTO inventory (id, warehouse_id, material_id, quantity, min_quantity, unit_price, batch_no)
  SELECT gen_random_uuid(), v_wh2, v_mat4, 1000.00, 300.00, 5.50, 'B-TEST-ELC-002'
  ON CONFLICT (warehouse_id, material_id, batch_no) DO NOTHING;

END $$;

-- ============================================================================
-- ملخص البيانات التي تم إدراجها
-- ============================================================================
-- المشاريع:     3 (PRJ-TEST-001, PRJ-TEST-002, PRJ-TEST-003)
-- الوحدات:      5 (U-TEST-001 إلى U-TEST-005)
-- المستخدمين:   3 (مدير مشروع، مهندس جودة، مهندس استشاري)
-- بنود العمل:   8 (WBS-TEST-001 إلى WBS-TEST-008)
-- طلبات الفحص:  5 (WR-TEST-001 إلى WR-TEST-005)
-- المهام:       5 (TSK-TEST-001 إلى TSK-TEST-005)
-- العملاء:      5 (CUST-TEST-001 إلى CUST-TEST-005)
-- الموردين:     5 (SUP-TEST-001 إلى SUP-TEST-005)
-- الموظفين:     5 (EMP-TEST-001 إلى EMP-TEST-005)
-- أوامر الشراء: 3 (PO-TEST-001 إلى PO-TEST-003)
-- الفواتير:     3 (INV-TEST-001 إلى INV-TEST-003)
-- الميزانية:    4 بنود
-- التذاكر الفنية: 3 (RFI-TEST-001, RFI-TEST-002, SNG-TEST-001)
-- حوادث السلامة: 3 (IS-TEST-001 إلى IS-TEST-003)
-- ملاحظات السلامة: 3 (OS-TEST-001 إلى OS-TEST-003)
-- مبيعات الوحدات: 2
-- العروض:        3 (LD-TEST-001 إلى LD-TEST-003)
-- CRM:          3 شركات، 5 جهات اتصال، 3 صفقات
-- المخازن:      2 (WH-TEST-001, WH-TEST-002)
-- المواد:       5 (MAT-TEST-001 إلى MAT-TEST-005)
-- المخزون:      8 سجلات
-- ============================================================================
