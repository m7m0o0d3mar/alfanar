-- ============================================================================
-- SEED ADDITIONAL DEMO DATA — employees, customers, suppliers, etc.
-- ============================================================================
-- Run via: Get-Content scripts\seed_additional.sql -Raw -Encoding UTF8 | supabase db query --linked
-- ============================================================================
DO $$
DECLARE
    admin_id       UUID;
    project_id     UUID;
    company_id     UUID;
    emp_mgr_id     UUID;
    emp_site1_id   UUID;
    emp_site2_id   UUID;
    emp_fin_id     UUID;
    emp_hr_id      UUID;
    cust1_id       UUID;
    cust2_id       UUID;
    cust3_id       UUID;
    cust4_id       UUID;
    sup1_id        UUID;
    sup2_id        UUID;
    sup3_id        UUID;
    sup4_id        UUID;
    wh_main_id     UUID;
    wh_mat_id      UUID;
    mat_cem_id     UUID;
    mat_steel_id   UUID;
    mat_brick_id   UUID;
    mat_tile_id    UUID;
    mat_paint_id   UUID;
    mat_pipe_id    UUID;
    unit_1_id      UUID;
    unit_2_id      UUID;
    unit_3_id      UUID;
BEGIN

    -- Get existing IDs
    SELECT id INTO admin_id FROM user_profiles WHERE role = 'admin' AND is_active = true LIMIT 1;
    SELECT id INTO project_id FROM projects LIMIT 1;
    SELECT id INTO company_id FROM companies LIMIT 1;
    SELECT id INTO unit_1_id FROM units WHERE unit_code = 'A1-101' LIMIT 1;
    SELECT id INTO unit_2_id FROM units WHERE unit_code = 'A1-103' LIMIT 1;
    SELECT id INTO unit_3_id FROM units WHERE unit_code = 'A2-101' LIMIT 1;

    IF project_id IS NULL THEN
        RAISE EXCEPTION 'No project found. Run seed_demo_data.sql first.';
    END IF;

    -- ======================================================================
    -- 1. EMPLOYEES
    -- ======================================================================
    INSERT INTO employees (id, project_id, employee_code, full_name_en, full_name_ar, national_id, nationality, phone, email, job_title, department, employee_type, hire_date, basic_salary, status, contract_type)
    VALUES (gen_random_uuid(), project_id, 'EMP-001', 'Khalid Al-Otaibi', 'خالد العتيبي', '1012345678', 'Saudi', '+966 55 111 1111', 'khalid@alfanar.com', 'Project Manager', 'Project Management', 'manager', '2025-01-01', 25000, 'active', 'full_time')
    RETURNING id INTO emp_mgr_id;

    INSERT INTO employees (id, project_id, employee_code, full_name_en, full_name_ar, national_id, nationality, phone, email, job_title, department, employee_type, hire_date, basic_salary, status, contract_type)
    VALUES (gen_random_uuid(), project_id, 'EMP-002', 'Ahmed Al-Ghamdi', 'أحمد الغامدي', '1023456789', 'Saudi', '+966 55 222 2222', 'ahmed@alfanar.com', 'Site Engineer', 'Engineering', 'engineer', '2025-02-01', 15000, 'active', 'full_time')
    RETURNING id INTO emp_site1_id;

    INSERT INTO employees (id, project_id, employee_code, full_name_en, full_name_ar, national_id, nationality, phone, email, job_title, department, employee_type, hire_date, basic_salary, status, contract_type)
    VALUES (gen_random_uuid(), project_id, 'EMP-003', 'Mohammed Al-Harbi', 'محمد الحربي', '1034567890', 'Saudi', '+966 55 333 3333', 'mohammed@alfanar.com', 'QC Engineer', 'Quality', 'engineer', '2025-03-01', 14000, 'active', 'full_time')
    RETURNING id INTO emp_site2_id;

    INSERT INTO employees (id, project_id, employee_code, full_name_en, full_name_ar, national_id, nationality, phone, email, job_title, department, employee_type, hire_date, basic_salary, status, contract_type)
    VALUES (gen_random_uuid(), project_id, 'EMP-004', 'Faisal Al-Dosari', 'فيصل الدوسري', '1045678901', 'Saudi', '+966 55 444 4444', 'faisal@alfanar.com', 'Finance Officer', 'Finance', 'staff', '2025-01-15', 12000, 'active', 'full_time')
    RETURNING id INTO emp_fin_id;

    INSERT INTO employees (id, project_id, employee_code, full_name_en, full_name_ar, national_id, nationality, phone, email, job_title, department, employee_type, hire_date, basic_salary, status, contract_type)
    VALUES (gen_random_uuid(), project_id, 'EMP-005', 'Nawaf Al-Anazi', 'نواف العنزي', '1056789012', 'Saudi', '+966 55 555 5555', 'nawaf@alfanar.com', 'HR Coordinator', 'Human Resources', 'staff', '2025-02-15', 10000, 'active', 'full_time')
    RETURNING id INTO emp_hr_id;

    -- ======================================================================
    -- 2. CUSTOMERS
    -- ======================================================================
    INSERT INTO customers (id, customer_code, full_name_en, full_name_ar, phone, email, national_id, address, customer_type, is_active)
    VALUES (gen_random_uuid(), 'CUST-001', 'Sami Al-Qahtani', 'سامي القحطاني', '+966 50 111 1111', 'sami@email.com', '1067890123', 'Riyadh, Al-Olaya', 'individual', true)
    RETURNING id INTO cust1_id;

    INSERT INTO customers (id, customer_code, full_name_en, full_name_ar, phone, email, national_id, address, customer_type, is_active)
    VALUES (gen_random_uuid(), 'CUST-002', 'Abdullah Al-Shehri', 'عبدالله الشهري', '+966 50 222 2222', 'abdullah@email.com', '1078901234', 'Riyadh, Al-Nakheel', 'individual', true)
    RETURNING id INTO cust2_id;

    INSERT INTO customers (id, customer_code, full_name_en, full_name_ar, phone, email, national_id, address, customer_type, is_active)
    VALUES (gen_random_uuid(), 'CUST-003', 'Sara Al-Mutairi', 'سارة المطيري', '+966 50 333 3333', 'sara@email.com', '1089012345', 'Riyadh, Al-Malqa', 'individual', true)
    RETURNING id INTO cust3_id;

    INSERT INTO customers (id, customer_code, full_name_en, full_name_ar, phone, email, national_id, address, customer_type, is_active)
    VALUES (gen_random_uuid(), 'CUST-004', 'Al Rajhi Investment Co.', 'شركة الراجحي للاستثمار', '+966 11 888 8888', 'info@alrajhi-inv.com', '3101234567', 'Riyadh, Al-Murooj', 'company', true)
    RETURNING id INTO cust4_id;

    -- ======================================================================
    -- 3. LEADS
    -- ======================================================================
    INSERT INTO leads (id, project_id, lead_source, full_name, phone, email, preferred_unit_type, budget_range, notes, status, assigned_to)
    VALUES (gen_random_uuid(), project_id, 'website', 'Hassan Al-Zahrani', '+966 54 111 1111', 'hassan@email.com', 'apartment', '400K-600K', 'Interested in 2BR apartment in Block A', 'new', admin_id);

    INSERT INTO leads (id, project_id, lead_source, full_name, phone, email, preferred_unit_type, budget_range, notes, status, assigned_to)
    VALUES (gen_random_uuid(), project_id, 'referral', 'Mansour Al-Ajmi', '+966 54 222 2222', 'mansour@email.com', 'villa', '1M-1.5M', 'Looking for villa in Block A, ready to pay deposit', 'contacted', admin_id);

    INSERT INTO leads (id, project_id, lead_source, full_name, phone, email, preferred_unit_type, budget_range, notes, status, assigned_to)
    VALUES (gen_random_uuid(), project_id, 'social_media', 'Noura Al-Shammari', '+966 54 333 3333', 'noura@email.com', 'office', '200K-400K', 'Wants office space for her startup', 'qualified', admin_id);

    -- ======================================================================
    -- 4. SUPPLIERS
    -- ======================================================================
    INSERT INTO suppliers (id, supplier_code, name_en, name_ar, contact_person, phone, email, payment_terms, lead_time_days, is_approved, rating, cr_number, vat_number)
    VALUES (gen_random_uuid(), 'SUP-001', 'Saudi Cement Company', 'شركة الأسمنت السعودية', 'Fahad Al-Otaibi', '+966 55 666 6666', 'sales@saudicement.com', 'net_60', 7, true, 4.5, '1234567890', '310123456700003')
    RETURNING id INTO sup1_id;

    INSERT INTO suppliers (id, supplier_code, name_en, name_ar, contact_person, phone, email, payment_terms, lead_time_days, is_approved, rating, cr_number, vat_number)
    VALUES (gen_random_uuid(), 'SUP-002', 'Al-Rajhi Steel', 'الراجحي للحديد', 'Majed Al-Rajhi', '+966 55 777 7777', 'info@alrajhisteel.com', 'net_30', 5, true, 5.0, '2345678901', '310234567800004')
    RETURNING id INTO sup2_id;

    INSERT INTO suppliers (id, supplier_code, name_en, name_ar, contact_person, phone, email, payment_terms, lead_time_days, is_approved, rating, cr_number, vat_number)
    VALUES (gen_random_uuid(), 'SUP-003', 'Al-Fanar Electrical Supplies', 'الفتان للمستلزمات الكهربائية', 'Khalid Al-Qahtani', '+966 55 888 8888', 'electrical@alfanar.com', 'net_45', 3, true, 4.0, '3456789012', '310345678900005')
    RETURNING id INTO sup3_id;

    INSERT INTO suppliers (id, supplier_code, name_en, name_ar, contact_person, phone, email, payment_terms, lead_time_days, is_approved, rating, cr_number, vat_number)
    VALUES (gen_random_uuid(), 'SUP-004', 'National Plumbing Co.', 'الشركة الوطنية للسباكة', 'Ibrahim Al-Dossary', '+966 55 999 9999', 'info@nationalplumbing.com', 'net_30', 10, true, 3.5, '4567890123', '310456789000006')
    RETURNING id INTO sup4_id;

    -- ======================================================================
    -- 5. CONTRACTORS (linked to company) + CONTRACTS
    -- ======================================================================
    INSERT INTO contractors (id, company_id, contractor_type, license_number, classification, is_approved)
    VALUES (gen_random_uuid(), company_id, 'main', 'LIC-2026-001', 'Grade A', true);
    INSERT INTO contractors (id, company_id, contractor_type, license_number, classification, is_approved)
    VALUES (gen_random_uuid(), company_id, 'sub', 'LIC-2026-002', 'Grade B', true);

    INSERT INTO contracts (id, project_id, contractor_id, contract_no, contract_type, title_en, title_ar, signing_date, start_date, end_date, contract_amount, variations_total, currency, status, description, performance_bond, retention_pct, advance_payment, contract_days)
    SELECT gen_random_uuid(), project_id, c.id, 'CON-2026-001', 'lump_sum', 'Steel Structure Contract - Building A1 & A2', 'عقد الهيكل الحديدي - مبنى أ1 وأ2',
            '2026-01-10', '2026-02-01', '2026-08-30', 8500000, 250000, 'SAR', 'active',
            'Supply and installation of steel reinforcement for Buildings A1 and A2', 850000, 5, 850000, 180
    FROM contractors c WHERE c.contractor_type = 'main' LIMIT 1;

    INSERT INTO contracts (id, project_id, contractor_id, contract_no, contract_type, title_en, title_ar, signing_date, start_date, end_date, contract_amount, variations_total, currency, status, description, performance_bond, retention_pct, advance_payment, contract_days)
    SELECT gen_random_uuid(), project_id, c.id, 'CON-2026-002', 'unit_price', 'Concrete Supply Contract', 'عقد توريد الخرسانة',
            '2026-01-15', '2026-02-01', '2026-12-30', 3200000, 0, 'SAR', 'active',
            'Supply of ready-mix concrete for all buildings in the project', 320000, 5, 320000, 365
    FROM contractors c WHERE c.contractor_type = 'sub' LIMIT 1;

    -- ======================================================================
    -- 6. WAREHOUSES
    -- ======================================================================
    INSERT INTO warehouses (id, code, name_en, name_ar, location, project_id, is_active)
    VALUES (gen_random_uuid(), 'WH-MAIN', 'Main Warehouse', 'المستودع الرئيسي', 'Project Site - Block A', project_id, true)
    RETURNING id INTO wh_main_id;

    INSERT INTO warehouses (id, code, name_en, name_ar, location, project_id, is_active)
    VALUES (gen_random_uuid(), 'WH-MAT', 'Materials Warehouse', 'مستودع المواد', 'Project Site - Block B', project_id, true)
    RETURNING id INTO wh_mat_id;

    -- ======================================================================
    -- 7. MATERIALS (for inventory tracking)
    -- ======================================================================
    INSERT INTO materials (id, code, name_en, name_ar, unit, default_price, is_active)
    VALUES (gen_random_uuid(), 'MAT-CEM-001', 'Portland Cement Type I 50kg', 'أسمنت بورتلاند نوع 1 - 50 كجم', 'bag', 18, true)
    RETURNING id INTO mat_cem_id;

    INSERT INTO materials (id, code, name_en, name_ar, unit, default_price, is_active)
    VALUES (gen_random_uuid(), 'MAT-STEEL-001', 'Steel Reinforcement Bars 16mm', 'حديد تسليح 16 مم', 'ton', 2800, true)
    RETURNING id INTO mat_steel_id;

    INSERT INTO materials (id, code, name_en, name_ar, unit, default_price, is_active)
    VALUES (gen_random_uuid(), 'MAT-BRK-001', 'Concrete Hollow Blocks 20cm', 'طوب أسمنتي مجوف 20 سم', 'unit', 2.5, true)
    RETURNING id INTO mat_brick_id;

    INSERT INTO materials (id, code, name_en, name_ar, unit, default_price, is_active)
    VALUES (gen_random_uuid(), 'MAT-TILE-001', 'Ceramic Floor Tiles 60x60cm', 'بلاط سيراميك أرضيات 60×60 سم', 'm²', 45, true)
    RETURNING id INTO mat_tile_id;

    INSERT INTO materials (id, code, name_en, name_ar, unit, default_price, is_active)
    VALUES (gen_random_uuid(), 'MAT-PNT-001', 'Interior Emulsion Paint - White 20L', 'دهان إيمولشن داخلي أبيض 20 لتر', 'gallon', 120, true)
    RETURNING id INTO mat_paint_id;

    INSERT INTO materials (id, code, name_en, name_ar, unit, default_price, is_active)
    VALUES (gen_random_uuid(), 'MAT-PPE-001', 'PVC Pipes 4-inch x 6m', 'مواسير بي في سي 4 بوصة × 6 م', 'piece', 85, true)
    RETURNING id INTO mat_pipe_id;

    -- ======================================================================
    -- 8. INVENTORY (stock entries)
    -- ======================================================================
    INSERT INTO inventory (id, warehouse_id, material_id, quantity, min_quantity, unit_price, batch_no)
    VALUES (gen_random_uuid(), wh_main_id, mat_cem_id, 500, 100, 18, 'CEM-JAN-2026');

    INSERT INTO inventory (id, warehouse_id, material_id, quantity, min_quantity, unit_price, batch_no)
    VALUES (gen_random_uuid(), wh_main_id, mat_steel_id, 50, 10, 2800, 'STL-FEB-2026');

    INSERT INTO inventory (id, warehouse_id, material_id, quantity, min_quantity, unit_price, batch_no)
    VALUES (gen_random_uuid(), wh_main_id, mat_brick_id, 10000, 2000, 2.5, 'BRK-MAR-2026');

    INSERT INTO inventory (id, warehouse_id, material_id, quantity, min_quantity, unit_price, batch_no)
    VALUES (gen_random_uuid(), wh_mat_id, mat_tile_id, 2000, 500, 45, 'TILE-JAN-2026');

    INSERT INTO inventory (id, warehouse_id, material_id, quantity, min_quantity, unit_price, batch_no)
    VALUES (gen_random_uuid(), wh_mat_id, mat_paint_id, 150, 30, 120, 'PNT-FEB-2026');

    INSERT INTO inventory (id, warehouse_id, material_id, quantity, min_quantity, unit_price, batch_no)
    VALUES (gen_random_uuid(), wh_mat_id, mat_pipe_id, 300, 50, 85, 'PPE-MAR-2026');

    -- ======================================================================
    -- 9. UNIT SALES
    -- ======================================================================
    INSERT INTO unit_sales (id, unit_id, customer_id, project_id, sale_date, sale_price, currency, payment_method, status, contract_no, handover_date, notes)
    VALUES (gen_random_uuid(), unit_2_id, cust1_id, project_id, '2026-06-15', 180000, 'SAR', 'cash', 'completed', 'SPA-2026-001', '2027-03-01', 'Full payment received. Studio unit A1-103.')
    RETURNING id INTO unit_1_id;

    INSERT INTO unit_sales (id, unit_id, customer_id, project_id, sale_date, sale_price, currency, payment_method, status, contract_no, handover_date, notes)
    VALUES (gen_random_uuid(), unit_3_id, cust4_id, project_id, '2026-07-01', 1200000, 'SAR', 'bank_transfer', 'completed', 'SPA-2026-002', '2027-06-01', 'Corporate sale - Al Rajhi Investment Co.')
    RETURNING id INTO unit_2_id;

    -- ======================================================================
    -- 10. QC INSPECTIONS
    -- ======================================================================
    INSERT INTO qc_inspections (id, inspection_no, project_id, title, inspection_date, inspector_id, status, score_percent, notes)
    VALUES (gen_random_uuid(), 'QC-2026-001', project_id, 'Concrete Sample Test - Building A1 Foundation', '2026-02-15', admin_id, 'passed', 95, 'All concrete samples passed compressive strength test. Grade C35 verified.');

    INSERT INTO qc_inspections (id, inspection_no, project_id, title, inspection_date, inspector_id, status, score_percent, notes)
    VALUES (gen_random_uuid(), 'QC-2026-002', project_id, 'Steel Reinforcement Inspection - Building A1 First Floor', '2026-03-10', admin_id, 'passed', 88, 'Minor spacing deviations corrected on site. Overall acceptable.');

    INSERT INTO qc_inspections (id, inspection_no, project_id, title, inspection_date, inspector_id, status, score_percent, notes)
    VALUES (gen_random_uuid(), 'QC-2026-003', project_id, 'Plumbing Pressure Test - Building A2', '2026-05-20', admin_id, 'conditional', 75, 'Two joints showing minor leakage. Rectification ordered.');

    -- ======================================================================
    -- 11. SAFETY INCIDENTS
    -- ======================================================================
    INSERT INTO safety_incidents (id, project_id, incident_no, incident_date, incident_time, incident_type, severity, location, description, immediate_action, root_cause, corrective_action, status, reported_by)
    VALUES (gen_random_uuid(), project_id, 'HSE-2026-001', '2026-03-05', '09:30', 'near_miss', 'low', 'Building A1 - Ground Floor', 'Worker almost tripped over exposed rebar on the ground floor slab', 'Exposed rebar covered with safety caps immediately', 'Lack of proper housekeeping after concrete pour', 'Daily housekeeping inspection implemented for all floors', 'closed', admin_id);

    INSERT INTO safety_incidents (id, project_id, incident_no, incident_date, incident_time, incident_type, severity, location, description, immediate_action, root_cause, corrective_action, status, reported_by)
    VALUES (gen_random_uuid(), project_id, 'HSE-2026-002', '2026-04-12', '14:15', 'first_aid', 'medium', 'Building A2 - Excavation Area', 'Worker sustained minor cut on hand while handling steel bars without gloves', 'First aid administered on site. Worker returned to duty.', 'Worker was not wearing proper PPE (gloves)', 'Mandatory PPE inspection at gate. Safety briefing repeated.', 'closed', admin_id);

    -- ======================================================================
    -- 12. NOTIFICATIONS
    -- ======================================================================
    INSERT INTO notifications (id, user_id, title, title_en, title_ar, body, body_en, body_ar, type, reference_type, reference_id, is_read)
    VALUES (gen_random_uuid(), admin_id, 'Project Update', 'Project Update', 'تحديث المشروع', 'Building A1 foundation work completed successfully.', 'Building A1 foundation work completed successfully.', 'تم بنجاح اكتمال أعمال أساسات المبنى أ1', 'success', 'project', project_id, false);

    INSERT INTO notifications (id, user_id, title, title_en, title_ar, body, body_en, body_ar, type, reference_type, reference_id, is_read)
    VALUES (gen_random_uuid(), admin_id, 'QC Approval Required', 'QC Approval Required', 'موافقة الجودة مطلوبة', 'QC inspection for Building A2 plumbing test is pending your review.', 'QC inspection for Building A2 plumbing test is pending your review.', 'فحص الجودة لاختبار السباكة في المبنى أ2 ينتظر مراجعتك.', 'warning', 'qc_inspection', NULL, false);

    INSERT INTO notifications (id, user_id, title, title_en, title_ar, body, body_en, body_ar, type, reference_type, reference_id, is_read)
    VALUES (gen_random_uuid(), admin_id, 'New Lead', 'New Lead', 'عميل محتمل جديد', 'A new lead has been assigned to you from the website.', 'A new lead has been assigned to you from the website.', 'تم تعيين عميل محتمل جديد لك من الموقع.', 'info', 'lead', NULL, false);

    -- ======================================================================
    -- 13. UPDATE UNIT STATUS to reflect sales
    -- ======================================================================
    UPDATE units SET status = 'sold' WHERE unit_code = 'A1-103';
    UPDATE units SET status = 'sold' WHERE unit_code = 'A2-101';
    UPDATE units SET status = 'reserved' WHERE unit_code = 'A1-202';
    UPDATE units SET status = 'reserved' WHERE unit_code = 'A2-201';

    RAISE NOTICE 'Additional seed completed successfully.';
END;
$$;
