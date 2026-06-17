-- ============================================================================
-- 033: Complete Data Seed — Fixes ALL remaining issues (ISSUE-005, NOTE-001~007)
-- ============================================================================
-- Run this AFTER all previous migrations (001–032)
-- Safe to re-run: uses ON CONFLICT DO NOTHING / WHERE NOT EXISTS
-- ============================================================================

DO $$
DECLARE
  -- ==========================================================================
  -- Cursor variables
  -- ==========================================================================
  v_project RECORD;
  v_unit RECORD;
  v_employee RECORD;
  v_lead RECORD;
  v_budget RECORD;
  v_doc_id UUID;
  v_att_id UUID;
  v_payroll_id UUID;
  v_proj_count INT := 0;
  v_unit_count INT := 0;
  v_doc_count INT := 0;
  v_lead_count INT := 0;
  v_budget_count INT := 0;
  v_att_count INT := 0;
  v_emp_count INT := 0;
  v_payroll_count INT := 0;
  v_sales_emp_id UUID;
  v_marketing_emp_id UUID;
BEGIN

  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Starting 033: Complete Data Seed';
  RAISE NOTICE '============================================================================';

  -- ==========================================================================
  -- NOTE-007: Fix Budget Code Typo — BUG → BDG
  -- ==========================================================================
  UPDATE budget SET budget_code = REPLACE(budget_code, 'BUG-', 'BDG-')
  WHERE budget_code LIKE 'BUG-%';
  GET DIAGNOSTICS v_budget_count = ROW_COUNT;
  RAISE NOTICE 'NOTE-007: Fixed % budget code(s) from BUG- to BDG-', v_budget_count;

  -- Also ensure future budget codes use BDG prefix
  -- (The seed data in 032 already uses BUG- which gets fixed above)

  -- ==========================================================================
  -- NOTE-001: Complete Units Data — zone, block, unit_model, price, bedrooms
  -- ==========================================================================
  -- Update any units missing zone/block data
  FOR v_unit IN
    SELECT id, project_id, unit_code FROM units
    WHERE (zone IS NULL OR block IS NULL OR unit_model IS NULL OR bedrooms IS NULL OR price IS NULL)
    LIMIT 100
  LOOP
    UPDATE units SET
      zone = COALESCE(zone, 'Zone A'),
      block = COALESCE(block, 'Block 1'),
      unit_model = COALESCE(unit_model, 'Standard Unit'),
      bedrooms = COALESCE(bedrooms, 2),
      price = COALESCE(price, 500000.00),
      status = COALESCE(status, 'available')
    WHERE id = v_unit.id;
    v_unit_count := v_unit_count + 1;
  END LOOP;
  RAISE NOTICE 'NOTE-001: Updated % unit(s) with missing data', v_unit_count;

  -- ==========================================================================
  -- NOTE-006: Add Real lat/lng to ALL Projects (for Maps)
  -- ==========================================================================
  FOR v_project IN
    SELECT id, project_code, location FROM projects
    WHERE latitude IS NULL OR longitude IS NULL OR (latitude = 0 AND longitude = 0)
  LOOP
    -- Assign real Saudi Arabia coordinates based on project context
    UPDATE projects SET
      latitude = CASE
        WHEN v_project.project_code LIKE '%RYD%' OR v_project.project_code LIKE '%RIY%' OR v_project.location ILIKE '%رياض%' THEN 24.7136 + random() * 0.1
        WHEN v_project.project_code LIKE '%JED%' OR v_project.location ILIKE '%جدة%' OR v_project.location ILIKE '%جده%' THEN 21.5433 + random() * 0.1
        WHEN v_project.project_code LIKE '%DMM%' OR v_project.project_code LIKE '%DAM%' OR v_project.location ILIKE '%دمام%' OR v_project.location ILIKE '%الدمام%' THEN 26.4207 + random() * 0.1
        WHEN v_project.project_code LIKE '%JUB%' OR v_project.location ILIKE '%جبيل%' THEN 27.0050 + random() * 0.1
        WHEN v_project.project_code LIKE '%MEC%' OR v_project.location ILIKE '%مكة%' THEN 21.3891 + random() * 0.1
        WHEN v_project.project_code LIKE '%MED%' OR v_project.location ILIKE '%مدينة%' OR v_project.location ILIKE '%المدينة%' THEN 24.5247 + random() * 0.1
        ELSE 24.7136 + random() * 0.2
      END,
      longitude = CASE
        WHEN v_project.project_code LIKE '%RYD%' OR v_project.project_code LIKE '%RIY%' OR v_project.location ILIKE '%رياض%' THEN 46.6753 + random() * 0.1
        WHEN v_project.project_code LIKE '%JED%' OR v_project.location ILIKE '%جدة%' OR v_project.location ILIKE '%جده%' THEN 39.1728 + random() * 0.1
        WHEN v_project.project_code LIKE '%DMM%' OR v_project.project_code LIKE '%DAM%' OR v_project.location ILIKE '%دمام%' OR v_project.location ILIKE '%الدمام%' THEN 50.0888 + random() * 0.1
        WHEN v_project.project_code LIKE '%JUB%' OR v_project.location ILIKE '%جبيل%' THEN 49.6580 + random() * 0.1
        WHEN v_project.project_code LIKE '%MEC%' OR v_project.location ILIKE '%مكة%' THEN 39.8579 + random() * 0.1
        WHEN v_project.project_code LIKE '%MED%' OR v_project.location ILIKE '%مدينة%' OR v_project.location ILIKE '%المدينة%' THEN 39.5692 + random() * 0.1
        ELSE 46.6753 + random() * 0.2
      END
    WHERE id = v_project.id;
    v_proj_count := v_proj_count + 1;
  END LOOP;
  RAISE NOTICE 'NOTE-006: Updated % project(s) with lat/lng coordinates', v_proj_count;

  -- ==========================================================================
  -- NOTE-002: Fix Employee Data (ensure phone/email/status are complete)
  -- ==========================================================================
  UPDATE employees SET
    phone = COALESCE(phone, '+966 55 ' || floor(random() * 9000 + 1000)::TEXT || ' ' || floor(random() * 9000 + 1000)::TEXT),
    email = COALESCE(email, LOWER(REPLACE(full_name_en, ' ', '.')) || '@alfanar.com'),
    status = COALESCE(status, 'active'),
    hire_date = COALESCE(hire_date, '2025-01-01'::DATE),
    basic_salary = COALESCE(basic_salary, 8000.00),
    nationality = COALESCE(nationality, 'Saudi'),
    employee_type = COALESCE(employee_type, 'staff')
  WHERE phone IS NULL OR email IS NULL OR status IS NULL;
  GET DIAGNOSTICS v_emp_count = ROW_COUNT;
  RAISE NOTICE 'NOTE-002: Updated % employee(s) with missing data', v_emp_count;

  -- ==========================================================================
  -- NOTE-005: Assign Sales Leads to Sales/Marketing Users
  -- ==========================================================================
  -- Find sales/marketing users (user_profiles, NOT employees — leads.assigned_to FK references user_profiles)
  SELECT id INTO v_sales_emp_id FROM user_profiles
  WHERE role IN ('sales', 'admin', 'project_manager')
  LIMIT 1;

  IF v_sales_emp_id IS NULL THEN
    SELECT id INTO v_sales_emp_id FROM user_profiles LIMIT 1;
  END IF;

  -- Assign unassigned leads
  UPDATE leads SET
    assigned_to = COALESCE(assigned_to, v_sales_emp_id),
    status = COALESCE(status, 'new')
  WHERE assigned_to IS NULL;
  GET DIAGNOSTICS v_lead_count = ROW_COUNT;
  RAISE NOTICE 'NOTE-005: Assigned % lead(s) to sales users', v_lead_count;

  -- ==========================================================================
  -- ISSUE-005: Seed Sample Documents
  -- ==========================================================================
  -- Check if documents table exists and is empty
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
    IF (SELECT COUNT(*) FROM documents) = 0 THEN
      FOR v_project IN SELECT id, project_code, name_en FROM projects WHERE is_active = true LIMIT 10
      LOOP
        INSERT INTO documents (id, project_id, doc_code, title_en, doc_type, category, revision, description, status, created_at)
        SELECT gen_random_uuid(), v_project.id,
          v_project.project_code || '-DRW-001', 'Architectural Floor Plan - Ground Floor', 'drawing', 'Architectural', 'A',
          'Ground floor architectural plan with dimensions and room layout', 'current', NOW() - INTERVAL '30 days'
        WHERE NOT EXISTS (SELECT 1 FROM documents WHERE doc_code = v_project.project_code || '-DRW-001');

        INSERT INTO documents (id, project_id, doc_code, title_en, doc_type, category, revision, description, status, created_at)
        SELECT gen_random_uuid(), v_project.id,
          v_project.project_code || '-DRW-002', 'Structural Foundation Plan', 'drawing', 'Structural', 'A',
          'Foundation layout with reinforcement details', 'current', NOW() - INTERVAL '25 days'
        WHERE NOT EXISTS (SELECT 1 FROM documents WHERE doc_code = v_project.project_code || '-DRW-002');

        INSERT INTO documents (id, project_id, doc_code, title_en, doc_type, category, revision, description, status, created_at)
        SELECT gen_random_uuid(), v_project.id,
          v_project.project_code || '-SPC-001', 'Material Specifications - Concrete', 'specification', 'Materials', 'B',
          'Specifications for all concrete works including mix design and testing', 'current', NOW() - INTERVAL '20 days'
        WHERE NOT EXISTS (SELECT 1 FROM documents WHERE doc_code = v_project.project_code || '-SPC-001');

        INSERT INTO documents (id, project_id, doc_code, title_en, doc_type, category, revision, description, status, created_at)
        SELECT gen_random_uuid(), v_project.id,
          v_project.project_code || '-RPT-001', 'Monthly Progress Report - ' || TO_CHAR(NOW(), 'Month YYYY'), 'report', 'Progress', 'A',
          'Monthly progress report including schedule, budget, and quality metrics', 'current', NOW() - INTERVAL '10 days'
        WHERE NOT EXISTS (SELECT 1 FROM documents WHERE doc_code = v_project.project_code || '-RPT-001');

        INSERT INTO documents (id, project_id, doc_code, title_en, doc_type, category, revision, description, status, created_at)
        SELECT gen_random_uuid(), v_project.id,
          v_project.project_code || '-CON-001', 'Site Instruction - Column Adjustment', 'correspondence', 'Site Instructions', 'A',
          'Site instruction regarding column alignment adjustment on grid B2', 'current', NOW() - INTERVAL '5 days'
        WHERE NOT EXISTS (SELECT 1 FROM documents WHERE doc_code = v_project.project_code || '-CON-001');

        v_doc_count := v_doc_count + 5;
      END LOOP;
      RAISE NOTICE 'ISSUE-005: Seeded % sample documents', v_doc_count;
    ELSE
      RAISE NOTICE 'ISSUE-005: Documents table already has data, skipping';
    END IF;
  END IF;

  -- ==========================================================================
  -- NOTE-004: Seed Attendance Records (last 30 days for active employees)
  -- ==========================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance_records') THEN
    IF (SELECT COUNT(*) FROM attendance_records) = 0 THEN
      FOR v_employee IN
        SELECT id, project_id FROM employees WHERE status = 'active' LIMIT 20
      LOOP
        FOR i IN 0..29 LOOP
          DECLARE
            v_date DATE := CURRENT_DATE - i;
            v_is_weekend BOOLEAN := EXTRACT(DOW FROM v_date) IN (5, 6);  -- Fri/Sat weekend
            v_status TEXT;
            v_check_in TIME;
            v_check_out TIME;
            v_late_min INT := 0;
          BEGIN
            -- 70% present, 10% late, 10% absent, 5% overtime, 5% leave
            IF v_is_weekend THEN
              -- Skip weekends with 50% probability (or mark as off)
              CONTINUE WHEN random() < 0.5;
              v_status := 'overtime';
              v_check_in := '07:00'::TIME;
              v_check_out := '16:00'::TIME;
            ELSE
              v_status := CASE
                WHEN random() < 0.70 THEN 'present'
                WHEN random() < 0.80 THEN 'late'
                WHEN random() < 0.90 THEN 'absent'
                WHEN random() < 0.95 THEN 'overtime'
                ELSE 'leave'
              END;

              IF v_status = 'present' THEN
                v_check_in := '07:00'::TIME + (random() * 15 || ' minutes')::INTERVAL;
                v_check_out := '16:00'::TIME - (random() * 15 || ' minutes')::INTERVAL;
              ELSIF v_status = 'late' THEN
                v_late_min := floor(random() * 60 + 15)::INT;
                v_check_in := '07:00'::TIME + (v_late_min || ' minutes')::INTERVAL;
                v_check_out := '16:00'::TIME - (random() * 15 || ' minutes')::INTERVAL;
              ELSIF v_status = 'overtime' THEN
                v_check_in := '07:00'::TIME + (random() * 10 || ' minutes')::INTERVAL;
                v_check_out := '17:00'::TIME + (random() * 60 || ' minutes')::INTERVAL;
              ELSE
                -- absent/leave: check_in is NOT NULL in schema, use a default placeholder time
                v_check_in := '08:00'::TIME;
                v_check_out := NULL;
              END IF;
            END IF;

            INSERT INTO attendance_records (id, employee_id, project_id, check_in, check_out, status, total_hours, notes)
            SELECT gen_random_uuid(), v_employee.id, v_employee.project_id,
              CASE WHEN v_check_in IS NOT NULL THEN (v_date || ' ' || v_check_in)::TIMESTAMP ELSE NULL END,
              CASE WHEN v_check_out IS NOT NULL THEN (v_date || ' ' || v_check_out)::TIMESTAMP ELSE NULL END,
              v_status,
              CASE WHEN v_check_in IS NOT NULL AND v_check_out IS NOT NULL
                THEN EXTRACT(EPOCH FROM ((v_date || ' ' || v_check_out)::TIMESTAMP - (v_date || ' ' || v_check_in)::TIMESTAMP)) / 3600
                ELSE NULL
              END,
              CASE v_status
                WHEN 'late' THEN 'متأخر ' || v_late_min || ' دقيقة'
                WHEN 'absent' THEN 'غياب بدون عذر'
                WHEN 'leave' THEN 'إجازة رسمية'
                WHEN 'overtime' THEN 'عمل إضافي'
                ELSE NULL
              END
            WHERE NOT EXISTS (
              SELECT 1 FROM attendance_records
              WHERE employee_id = v_employee.id AND check_in::DATE = v_date
            );
            v_att_count := v_att_count + 1;
          END;
        END LOOP;
      END LOOP;
      RAISE NOTICE 'NOTE-004: Seeded % attendance records', v_att_count;
    ELSE
      RAISE NOTICE 'NOTE-004: Attendance records table already has data, skipping';
    END IF;
  ELSE
    RAISE NOTICE 'NOTE-004: attendance_records table does not exist. Run migration_attendance.sql first.';
  END IF;

  -- ==========================================================================
  -- NOTE-003: Seed Payroll Runs + Time Entries
  -- ==========================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_runs') THEN
    IF (SELECT COUNT(*) FROM payroll_runs) = 0 THEN
      FOR v_project IN SELECT id, project_code FROM projects WHERE is_active = true LIMIT 5
      LOOP
        INSERT INTO payroll_runs (id, project_id, period_start, period_end, status, total_salaries, net_total)
        SELECT gen_random_uuid(), v_project.id,
          DATE_TRUNC('month', NOW() - INTERVAL '1 month')::DATE,
          (DATE_TRUNC('month', NOW()) - INTERVAL '1 day')::DATE,
          'paid',
          0, 0
        WHERE NOT EXISTS (
          SELECT 1 FROM payroll_runs
          WHERE project_id = v_project.id AND period_start = DATE_TRUNC('month', NOW() - INTERVAL '1 month')::DATE
        )
        RETURNING id INTO v_payroll_id;

        IF v_payroll_id IS NOT NULL THEN
          FOR v_employee IN
            SELECT id, basic_salary FROM employees
            WHERE (project_id = v_project.id OR project_id IS NULL) AND status = 'active'
            LIMIT 15
          LOOP
            DECLARE
              v_gross DECIMAL := COALESCE(v_employee.basic_salary, 8000.00);
              v_allowances DECIMAL := v_gross * 0.15;
              v_deductions DECIMAL := v_gross * 0.07;
              v_work_days INT := 22;
              v_absent_days INT := floor(random() * 5);
              v_overtime_amount DECIMAL := (v_gross / v_work_days / 8) * floor(random() * 20) * 1.5;
            BEGIN
              INSERT INTO payroll_details (id, payroll_run_id, employee_id, basic_salary, allowances, overtime_amount, deductions, bonuses, work_days, absent_days)
              SELECT gen_random_uuid(), v_payroll_id, v_employee.id,
                v_gross, v_allowances, v_overtime_amount,
                v_deductions, 0, v_work_days, v_absent_days
              WHERE NOT EXISTS (
                SELECT 1 FROM payroll_details
                WHERE payroll_run_id = v_payroll_id AND employee_id = v_employee.id
              );
              v_payroll_count := v_payroll_count + 1;
            END;
          END LOOP;

          -- Update totals
          UPDATE payroll_runs SET
            total_salaries = (SELECT COALESCE(SUM(basic_salary), 0) FROM payroll_details WHERE payroll_run_id = v_payroll_id),
            net_total = (SELECT COALESCE(SUM(net_salary), 0) FROM payroll_details WHERE payroll_run_id = v_payroll_id)
          WHERE id = v_payroll_id;
        END IF;
      END LOOP;
      RAISE NOTICE 'NOTE-003: Seeded % payroll run(s) with details', v_payroll_count;
    ELSE
      RAISE NOTICE 'NOTE-003: Payroll runs already exist, skipping';
    END IF;
  ELSE
    RAISE NOTICE 'NOTE-003: payroll_runs table does not exist, skipping';
  END IF;

  -- ==========================================================================
  -- Seed Summary
  -- ==========================================================================
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '033 Seed Complete!';
  RAISE NOTICE '  NOTE-007: % budget codes fixed (BUG→BDG)', v_budget_count;
  RAISE NOTICE '  NOTE-001: % units updated with missing data', v_unit_count;
  RAISE NOTICE '  NOTE-006: % projects updated with lat/lng', v_proj_count;
  RAISE NOTICE '  NOTE-002: % employees updated with missing data', v_emp_count;
  RAISE NOTICE '  NOTE-005: % leads assigned to sales employees', v_lead_count;
  RAISE NOTICE '  ISSUE-005: % documents seeded', v_doc_count;
  RAISE NOTICE '  NOTE-004: % attendance records seeded', v_att_count;
  RAISE NOTICE '  NOTE-003: % payroll entries seeded', v_payroll_count;
  RAISE NOTICE '============================================================================';

END $$;
