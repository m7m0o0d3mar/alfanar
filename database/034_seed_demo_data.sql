-- ============================================================================
-- 034: Demo/Trial Data Seed — Populates ALL empty tables with realistic data
-- ============================================================================
-- Run this AFTER all migrations (001–033 + 040) have been applied
-- Safe to re-run: uses WHERE NOT EXISTS / ON CONFLICT DO NOTHING
-- ============================================================================

DO $$
DECLARE
  v_company     UUID; v_contractor  UUID;
  v_p1 UUID; v_p2 UUID; v_p3 UUID;
  v_u1 UUID; v_u2 UUID; v_u3 UUID; v_u4 UUID;
  v_w1 UUID; v_w2 UUID; v_w3 UUID; v_w4 UUID;
  v_conv UUID;
  v_admin UUID; v_pm UUID; v_eng UUID; v_sales UUID;
  v_ctr RECORD; v_t RECORD; v_p RECORD; v_m RECORD; v_pp RECORD; v_mt RECORD; v_unit RECORD; v_act RECORD;
  v_count INT := 0;
BEGIN

  -- ==========================================================================
  -- RESOLVE existing references
  -- ==========================================================================
  SELECT id INTO v_company FROM companies WHERE is_active = true LIMIT 1;
  SELECT id INTO v_contractor FROM contractors LIMIT 1;
  SELECT id INTO v_p1 FROM projects WHERE is_active = true ORDER BY created_at LIMIT 1;
  SELECT id INTO v_p2 FROM projects WHERE is_active = true ORDER BY created_at OFFSET 1 LIMIT 1;
  SELECT id INTO v_p3 FROM projects WHERE is_active = true ORDER BY created_at OFFSET 2 LIMIT 1;
  SELECT id INTO v_u1 FROM units LIMIT 1;
  SELECT id INTO v_u2 FROM units OFFSET 1 LIMIT 1;
  SELECT id INTO v_u3 FROM units OFFSET 2 LIMIT 1;
  SELECT id INTO v_u4 FROM units OFFSET 3 LIMIT 1;
  SELECT id INTO v_w1 FROM work_breakdown_structure LIMIT 1;
  SELECT id INTO v_w2 FROM work_breakdown_structure OFFSET 1 LIMIT 1;
  SELECT id INTO v_w3 FROM work_breakdown_structure OFFSET 2 LIMIT 1;
  SELECT id INTO v_w4 FROM work_breakdown_structure OFFSET 3 LIMIT 1;
  SELECT id INTO v_conv FROM contracts LIMIT 1;
  SELECT id INTO v_admin FROM user_profiles WHERE role = 'admin' AND is_active = true LIMIT 1;
  SELECT id INTO v_pm FROM user_profiles WHERE role IN ('project_manager','admin') AND is_active = true LIMIT 1;
  SELECT id INTO v_eng FROM user_profiles WHERE role IN ('engineer','admin','project_manager') AND is_active = true LIMIT 1;
  SELECT id INTO v_sales FROM user_profiles WHERE role IN ('sales','admin') AND is_active = true LIMIT 1;

  -- ==========================================================================
  -- 1. PROJECT PHASES
  -- ==========================================================================
  FOR v_p IN SELECT id, project_code FROM projects WHERE is_active = true LOOP
    INSERT INTO project_phases (id, project_id, phase_code, name_en, name_ar, start_date, end_date, budget, status, "order")
    SELECT gen_random_uuid(), v_p.id, t.*
    FROM (VALUES
      ('DES-001', 'Design & Approvals', 'التصميم والموافقات', '2024-01-01'::DATE, '2024-06-30'::DATE, 500000, 'completed', 1),
      ('PRO-001', 'Procurement & Mobilization', 'المشتريات والتعبئة', '2024-05-01'::DATE, '2024-08-31'::DATE, 2000000, 'completed', 2),
      ('CON-001', 'Construction', 'الإنشاءات', '2024-08-01'::DATE, '2026-03-31'::DATE, 50000000, 'in_progress', 3),
      ('COM-001', 'Commissioning & Handover', 'التشغيل والتسليم', '2026-01-01'::DATE, '2026-06-30'::DATE, 2000000, 'pending', 4)
    ) AS t(phase_code, name_en, name_ar, start_date, end_date, budget, status, "order")
    WHERE NOT EXISTS (SELECT 1 FROM project_phases WHERE project_id = v_p.id AND phase_code = t.phase_code);
    v_count := v_count + 1;
  END LOOP;

  -- ==========================================================================
  -- 2. BLOCKS / BUILDINGS
  -- ==========================================================================
  FOR v_p IN SELECT id, project_code FROM projects WHERE is_active = true LOOP
    INSERT INTO blocks (id, project_id, block_code, name_en, name_ar, block_type, floor_count, total_units, status)
    SELECT gen_random_uuid(), v_p.id, t.*
    FROM (VALUES
      ('BLK-A', 'Block A - Main Building', 'المبنى الرئيسي أ', 'building', 15, 60, 'in_progress'),
      ('BLK-B', 'Block B - Annex', 'المبنى الملحق ب', 'building', 5, 20, 'planning'),
      ('BLK-C', 'Block C - Parking', 'موقف السيارات ج', 'wing', 2, 0, 'planning')
    ) AS t(block_code, name_en, name_ar, block_type, floor_count, total_units, status)
    WHERE NOT EXISTS (SELECT 1 FROM blocks WHERE project_id = v_p.id AND block_code = t.block_code);
  END LOOP;

  -- ==========================================================================
  -- 3. PROJECT STAKEHOLDERS
  -- ==========================================================================
  IF v_p1 IS NOT NULL AND v_company IS NOT NULL THEN
    INSERT INTO project_stakeholders (id, project_id, company_id, role, contract_value, is_active)
    SELECT gen_random_uuid(), v_p1, v_company, t.role, t.contract_value, true
    FROM (VALUES
      ('owner', 50000000), ('main_contractor', 35000000), ('consultant', 2500000), ('designer', 1800000), ('supplier', 5000000)
    ) AS t(role, contract_value)
    WHERE NOT EXISTS (SELECT 1 FROM project_stakeholders WHERE project_id = v_p1 AND company_id = v_company AND role = t.role);
    v_count := v_count + 1;
  END IF;

  -- ==========================================================================
  -- 4. UNIT PROGRESS (milestone tracking per unit)
  -- ==========================================================================
  FOR v_t IN SELECT id, unit_code FROM units LIMIT 20 LOOP
    INSERT INTO unit_progress (id, unit_id, milestone_code, milestone_name_en, milestone_name_ar, weight_percent, status, achieved_date)
    SELECT gen_random_uuid(), v_t.id, t.*
    FROM (VALUES
      ('FOUNDATION',  'Foundation Complete', 'اكتمال الأساسات', 15, 'completed', '2024-06-01'::DATE),
      ('STRUCTURE',   'Structure Complete', 'اكتمال الهيكل', 25, 'completed', '2024-12-15'::DATE),
      ('MASONRY',     'Masonry & Blockwork', 'البناء والطوب', 15, 'in_progress', NULL),
      ('PLASTER',     'Plastering Complete', 'اكتمال البياض', 10, 'pending', NULL),
      ('TILING',      'Tiling & Flooring', 'البلاط والأرضيات', 10, 'pending', NULL),
      ('MEP',         'MEP Rough-In', 'تمديدات الكهرباء والسباكة', 15, 'pending', NULL),
      ('FINISHING',   'Final Finishing', 'التشطيبات النهائية', 10, 'pending', NULL)
    ) AS t(milestone_code, milestone_name_en, milestone_name_ar, weight_percent, status, achieved_date)
    WHERE NOT EXISTS (SELECT 1 FROM unit_progress WHERE unit_id = v_t.id AND milestone_code = t.milestone_code);
  END LOOP;

  -- ==========================================================================
  -- 5. ITEM PROGRESS (items within unit milestones)
  -- ==========================================================================
  FOR v_t IN SELECT up.id, up.unit_id FROM unit_progress up LIMIT 30 LOOP
    INSERT INTO item_progress (id, unit_progress_id, item_name_en, item_name_ar, status, weight_percent)
    SELECT gen_random_uuid(), v_t.id, t.*
    FROM (VALUES
      ('Rebar Installation', 'تركيب حديد التسليح', 'completed', 30),
      ('Formwork Erection', 'تركيب القوالب', 'completed', 25),
      ('Concrete Pouring', 'صب الخرسانة', 'completed', 25),
      ('Curing & Stripping', 'المعالجة والفك', 'completed', 20)
    ) AS t(item_name_en, item_name_ar, status, weight_percent)
    WHERE NOT EXISTS (SELECT 1 FROM item_progress WHERE unit_progress_id = v_t.id AND item_name_en = t.item_name_en);
  END LOOP;

  -- ==========================================================================
  -- 6. DAILY REPORTS (last 30 days for active projects)
  -- ==========================================================================
  IF v_p1 IS NOT NULL AND v_admin IS NOT NULL THEN
    FOR i IN 0..14 LOOP
      DECLARE v_date DATE := CURRENT_DATE - i; v_dr_id UUID;
      BEGIN
        IF EXTRACT(DOW FROM v_date) NOT IN (5,6) THEN
          INSERT INTO daily_reports (id, project_id, report_date, title, weather, temperature, labor_count, equipment_count, summary, created_by)
          SELECT gen_random_uuid(), v_p1, v_date,
            CASE WHEN i=0 THEN 'Daily Report - Today' ELSE 'Daily Report - ' || TO_CHAR(v_date, 'DD Mon YYYY') END,
            CASE (i % 4) WHEN 0 THEN 'Sunny' WHEN 1 THEN 'Cloudy' WHEN 2 THEN 'Clear' ELSE 'Hot' END,
            (30 + i % 15)::TEXT || '°C',
            45 + i % 20, 8 + i % 5,
            CASE (i % 5)
              WHEN 0 THEN 'Normal progress on all fronts. Concrete pouring for slab completed.'
              WHEN 1 THEN 'Steel fixing ongoing on floor 3. Minor delay due to material delivery.'
              WHEN 2 THEN 'MEP rough-in works in progress. Coordination meeting held.'
              WHEN 3 THEN 'Plastering works ongoing in units A-101 to A-110. Quality check passed.'
              ELSE 'Blockwork on ground floor. Safety toolbox talk conducted in the morning.'
            END,
            v_admin
          WHERE NOT EXISTS (SELECT 1 FROM daily_reports WHERE project_id = v_p1 AND report_date = v_date)
          RETURNING id INTO v_dr_id;

          IF v_dr_id IS NOT NULL THEN
            INSERT INTO daily_report_items (id, daily_report_id, description, category, status, notes)
            SELECT gen_random_uuid(), v_dr_id, t.*
            FROM (VALUES
              ('Concrete pouring for floor slab - Zone A', 'work_done', 'Completed', '40 m³ poured'),
              ('Steel fixing - Columns B2-B6', 'work_done', 'In Progress', '80% complete'),
              ('Material delivery - Rebar 16mm', 'materials', 'Received', '5 tons delivered'),
              ('Safety inspection - Lifting equipment', 'safety', 'Passed', 'All equipment certified'),
              ('Plastering quality check - Units A-101 to A-105', 'quality', 'Approved', 'Meets specification')
            ) AS t(description, category, status, notes)
            WHERE NOT EXISTS (SELECT 1 FROM daily_report_items WHERE daily_report_id = v_dr_id AND description = t.description);
          END IF;
        END IF;
      END;
    END LOOP;
    v_count := v_count + 1;
  END IF;

  -- ==========================================================================
  -- 7. SUBCONTRACTS
  -- ==========================================================================
  IF v_conv IS NOT NULL THEN
    FOR v_t IN SELECT id FROM contractors WHERE contractor_type = 'sub' AND is_approved = true LIMIT 5 LOOP
      INSERT INTO subcontracts (id, parent_contract_id, subcontractor_id, subcontract_no, title_en, title_ar, amount, status, signing_date, start_date, end_date)
      SELECT gen_random_uuid(), v_conv, v_t.id, t.*
      FROM (VALUES
        ('SUB-MEP-001',  'MEP Works Subcontract',  'مقاولية الأعمال الميكانيكية والكهربائية',  8500000, 'active',  '2024-03-01'::DATE, '2024-04-01'::DATE, '2026-04-30'::DATE),
        ('SUB-FIN-001',  'Finishing Subcontract',   'مقاولية التشطيبات', 12000000, 'active',  '2024-06-01'::DATE, '2024-07-01'::DATE, '2026-03-31'::DATE),
        ('SUB-STR-001',  'Steel Structure Subcontract', 'مقاولية الهيكل الحديدي',  5500000, 'draft',   '2025-01-15'::DATE, '2025-02-01'::DATE, '2025-12-31'::DATE)
      ) AS t(subcontract_no, title_en, title_ar, amount, status, signing_date, start_date, end_date)
      WHERE NOT EXISTS (SELECT 1 FROM subcontracts WHERE parent_contract_id = v_conv AND subcontract_no = t.subcontract_no);
    END LOOP;
    v_count := v_count + 1;
  END IF;

  -- ==========================================================================
  -- 8. CONTRACT SCOPE ITEMS (BOQ)
  -- ==========================================================================
  IF v_conv IS NOT NULL THEN
    INSERT INTO contract_scope_items (id, contract_id, item_code, parent_item_id, description_en, description_ar, unit_of_measure, quantity, unit_price, status, "order")
    SELECT gen_random_uuid(), v_conv, t.item_code, t.parent_item_id::UUID, t.description_en, t.description_ar, t.unit_of_measure, t.quantity, t.unit_price, t.status, t."order"
    FROM (VALUES
      ('BOQ-001', NULL::UUID, 'Excavation & Earthwork', 'الحفر والأعمال الترابية', 'm³', 5000, 45.00, 'active', 1),
      ('BOQ-002', NULL::UUID, 'Concrete Works (Foundation)', 'أعمال الخرسانة (الأساسات)', 'm³', 2500, 550.00, 'active', 2),
      ('BOQ-003', NULL::UUID, 'Reinforcement Steel', 'حديد التسليح', 'ton', 500, 3200.00, 'active', 3),
      ('BOQ-004', NULL::UUID, 'Blockwork Masonry', 'أعمال البناء بالطوب', 'm²', 8000, 95.00, 'active', 4),
      ('BOQ-005', NULL::UUID, 'Plastering & Rendering', 'البياض والمحارة', 'm²', 12000, 55.00, 'active', 5),
      ('BOQ-006', NULL::UUID, 'Floor Tiling', 'بلاط الأرضيات', 'm²', 6000, 120.00, 'active', 6),
      ('BOQ-007', NULL::UUID, 'Electrical Works', 'الأعمال الكهربائية', 'lump_sum', 1, 3500000, 'active', 7),
      ('BOQ-008', NULL::UUID, 'Plumbing & Sanitary', 'أعمال السباكة والصرف', 'lump_sum', 1, 2800000, 'active', 8),
      ('BOQ-009', NULL::UUID, 'Painting & Decoration', 'الدهان والديكور', 'm²', 15000, 35.00, 'active', 9),
      ('BOQ-010', NULL::UUID, 'External Works & Landscaping', 'الأعمال الخارجية وتنسيق الحدائق', 'lump_sum', 1, 1500000, 'active', 10)
    ) AS t(item_code, parent_item_id, description_en, description_ar, unit_of_measure, quantity, unit_price, status, "order")
    WHERE NOT EXISTS (SELECT 1 FROM contract_scope_items WHERE contract_id = v_conv AND item_code = t.item_code);
    v_count := v_count + 1;
  END IF;

  -- ==========================================================================
  -- 9. CONTRACT VARIATIONS
  -- ==========================================================================
  IF v_conv IS NOT NULL AND v_admin IS NOT NULL THEN
    INSERT INTO contract_variations (id, contract_id, variation_no, title_en, title_ar, description, variation_type, amount, reason, status, approved_by, approved_at, created_by)
    SELECT gen_random_uuid(), v_conv, t.variation_no, t.title_en, t.title_ar, t.description, t.variation_type, t.amount, t.reason, t.status, t.approved_by, t.approved_at, t.created_by
    FROM (VALUES
      ('VAR-001', 'Additional Foundation Depth', 'زيادة عمق الأساسات', 'Additional depth required due to soil conditions', 'addition', 450000, 'Soil bearing capacity lower than expected', 'approved'::TEXT, v_admin, '2024-03-15'::DATE::TIMESTAMPTZ, v_admin),
      ('VAR-002', 'Material Specification Upgrade', 'ترقية مواصفات المواد', 'Client requested higher grade finishing materials', 'addition', 320000, 'Client request for premium finishes', 'approved'::TEXT, v_admin, '2024-05-20'::DATE::TIMESTAMPTZ, v_admin),
      ('VAR-003', 'Omit Basement Storage Rooms', 'إلغاء غرف التخزين في الطابق السفلي', 'Storage rooms removed from scope', 'omission', -180000, 'Scope reduction instruction from client', 'draft'::TEXT, NULL::UUID, NULL::TIMESTAMPTZ, v_admin)
    ) AS t(variation_no, title_en, title_ar, description, variation_type, amount, reason, status, approved_by, approved_at, created_by)
    WHERE NOT EXISTS (SELECT 1 FROM contract_variations WHERE contract_id = v_conv AND variation_no = t.variation_no);
  END IF;

  -- ==========================================================================
  -- 10. CONTRACT INVOICES
  -- ==========================================================================
  IF v_conv IS NOT NULL THEN
    INSERT INTO contract_invoices (id, contract_id, invoice_no, invoice_type, invoice_date, amount, retention_pct, retention_amount, status, due_date, paid_date, paid_amount, notes)
    SELECT gen_random_uuid(), v_conv, t.*
    FROM (VALUES
      ('INV-001', 'advance', '2024-02-01'::DATE, 7500000, 10, 750000, 'paid', '2024-02-15'::DATE, '2024-02-10'::DATE, 7500000, 'Advance payment - 10% of contract'),
      ('INV-002', 'progress', '2024-06-30'::DATE, 11250000, 10, 1125000, 'paid', '2024-07-15'::DATE, '2024-07-10'::DATE, 11250000, 'Progress payment #1 - Foundation complete'),
      ('INV-003', 'progress', '2024-12-31'::DATE, 15000000, 10, 1500000, 'paid', '2025-01-15'::DATE, '2025-01-12'::DATE, 15000000, 'Progress payment #2 - Structure at 60%'),
      ('INV-004', 'progress', '2025-03-31'::DATE, 7500000, 10, 750000, 'approved', '2025-04-15'::DATE, NULL, 0, 'Progress payment #3 - Masonry & plastering'),
      ('INV-005', 'progress', '2025-06-30'::DATE, 5000000, 10, 500000, 'draft', '2025-07-15'::DATE, NULL, 0, 'Progress payment #4 - Finishing works')
    ) AS t(invoice_no, invoice_type, invoice_date, amount, retention_pct, retention_amount, status, due_date, paid_date, paid_amount, notes)
    WHERE NOT EXISTS (SELECT 1 FROM contract_invoices WHERE contract_id = v_conv AND invoice_no = t.invoice_no);
    v_count := v_count + 1;
  END IF;

  -- ==========================================================================
  -- 11. WORK ITEMS (standard work definitions)
  -- ==========================================================================
  IF v_p1 IS NOT NULL THEN
    FOR v_p IN SELECT id FROM projects WHERE is_active = true LOOP
      INSERT INTO work_items (id, project_id, item_code, name_en, name_ar, category, unit_of_measure)
      SELECT gen_random_uuid(), v_p.id, t.*
      FROM (VALUES
        ('WI-EXC', 'Excavation', 'حفر', 'Civil', 'm³'),
        ('WI-CON', 'Concrete Works', 'أعمال خرسانة', 'Civil', 'm³'),
        ('WI-STL', 'Steel Reinforcement', 'حديد تسليح', 'Civil', 'ton'),
        ('WI-BLK', 'Blockwork', 'طوب', 'Architectural', 'm²'),
        ('WI-PLA', 'Plastering', 'بياض', 'Architectural', 'm²'),
        ('WI-TIL', 'Tiling', 'بلاط', 'Architectural', 'm²'),
        ('WI-PNT', 'Painting', 'دهان', 'Architectural', 'm²'),
        ('WI-ELC', 'Electrical', 'كهرباء', 'MEP', 'lump_sum'),
        ('WI-PLM', 'Plumbing', 'سباكة', 'MEP', 'lump_sum'),
        ('WI-HVAC', 'HVAC', 'تكييف', 'MEP', 'lump_sum')
      ) AS t(item_code, name_en, name_ar, category, unit_of_measure)
      WHERE NOT EXISTS (SELECT 1 FROM work_items WHERE project_id = v_p.id AND item_code = t.item_code);
    END LOOP;
  END IF;

  -- Seed work_tasks so WIRs can reference them
  INSERT INTO work_tasks (id, project_id, task_code, title_en, title_ar, description, start_date, end_date, status)
  SELECT gen_random_uuid(), v_p1, t.*
  FROM (VALUES
    ('TASK-FND', 'Foundation Works', 'أعمال الأساسات', 'Excavation, pouring, and curing of foundations', '2024-02-01'::DATE, '2024-04-30'::DATE, 'completed'),
    ('TASK-STR', 'Structural Frame', 'الهيكل الإنشائي', 'Columns, beams, and slabs construction', '2024-05-01'::DATE, '2024-12-31'::DATE, 'in_progress'),
    ('TASK-MEP', 'MEP Rough-In', 'تمديدات الكهرباء والميكانيكا', 'Electrical, plumbing, and HVAC rough-in works', '2024-08-01'::DATE, '2025-03-31'::DATE, 'in_progress'),
    ('TASK-FIN', 'Finishing Works', 'أعمال التشطيب', 'Plastering, tiling, painting, and fixtures', '2025-01-01'::DATE, '2025-09-30'::DATE, 'pending')
  ) AS t(task_code, title_en, title_ar, description, start_date, end_date, status)
  WHERE NOT EXISTS (SELECT 1 FROM work_tasks WHERE project_id = v_p1 AND task_code = t.task_code);

  -- ==========================================================================
  -- 12. WORK REQUESTS (WIR)
  -- ==========================================================================
  IF v_p1 IS NOT NULL AND v_admin IS NOT NULL AND v_eng IS NOT NULL THEN
    INSERT INTO work_requests (id, project_id, unit_id, task_id, wir_no, title_en, title_ar, description, request_date, requested_by, inspected_by, status, is_ncr, location, notes)
    SELECT gen_random_uuid(), v_p1, v_u1, wt.task_id, t.wir_no, t.title_en, t.title_ar, t.description, t.request_date, v_admin, t.inspected_by, t.status, false, t.location, t.notes
    FROM (SELECT id AS task_id FROM work_tasks WHERE project_id = v_p1 LIMIT 1) AS wt
    CROSS JOIN (VALUES
      ('WIR-2024-001', 'Foundation Concrete Inspection', 'فحص خرسانة الأساسات', 'Inspection of foundation concrete after pouring', '2024-04-15'::DATE, v_eng, 'approved', 'Zone A - Foundation', 'All tests passed'),
      ('WIR-2024-002', 'Column Reinforcement Check', 'فحص تسليح الأعمدة', 'Inspection of column reinforcement before concrete', '2024-06-20'::DATE, v_eng, 'approved', 'Ground Floor', 'Compliant with drawings'),
      ('WIR-2024-003', 'Slab Formwork Inspection', 'فحص قوالب السقف', 'Formwork alignment and stability check', '2024-08-10'::DATE, v_eng, 'approved', 'First Floor', 'Minor adjustments made'),
      ('WIR-2025-001', 'Plastering Quality Check', 'فحص جودة البياض', 'Quality check for internal plastering', '2025-02-15'::DATE, v_eng, 'in_progress', 'Units A-101 to A-110', 'Sampling in progress'),
      ('WIR-2025-002', 'Electrical Rough-In Inspection', 'فحص التمديدات الكهربائية', 'Inspection of conduit and wiring before closing', '2025-03-01'::DATE, v_eng, 'draft', 'Floor 1', 'Pending scheduling')
    ) AS t(wir_no, title_en, title_ar, description, request_date, inspected_by, status, location, notes)
    WHERE NOT EXISTS (SELECT 1 FROM work_requests WHERE project_id = v_p1 AND wir_no = t.wir_no);

    -- Work request lines for approved WIRs
    FOR v_t IN SELECT id FROM work_requests WHERE project_id = v_p1 AND status = 'approved' LIMIT 5 LOOP
      INSERT INTO work_request_lines (id, work_request_id, line_no, description_en, description_ar, specification, result, remarks)
      SELECT gen_random_uuid(), v_t.id, t.*
      FROM (VALUES
        (1, 'Concrete compressive strength check', 'فحص مقاومة الخرسانة', 'Minimum 28 MPa at 28 days', 'pass', '35 MPa achieved'),
        (2, 'Reinforcement cover check', 'فحص تغطية الحديد', 'Cover 50mm ± 5mm', 'pass', 'All within tolerance'),
        (3, 'Dimensional accuracy', 'التحقق من الأبعاد', 'Per approved drawings ±10mm', 'pass', 'Within limits'),
        (4, 'Surface finish quality', 'جودة التشطيب السطحي', 'No honeycombing or defects', 'pass', 'Acceptable finish')
      ) AS t(line_no, description_en, description_ar, specification, result, remarks)
      WHERE NOT EXISTS (SELECT 1 FROM work_request_lines WHERE work_request_id = v_t.id AND line_no = t.line_no);
    END LOOP;
    v_count := v_count + 1;
  END IF;

  -- ==========================================================================
  -- 13. SAFETY INCIDENTS
  -- ==========================================================================
  IF v_p1 IS NOT NULL AND v_admin IS NOT NULL THEN
    INSERT INTO safety_incidents (id, project_id, incident_no, incident_date, incident_time, incident_type, severity, location, description, immediate_action, root_cause, corrective_action, status, reported_by)
    SELECT gen_random_uuid(), v_p1, t.*
    FROM (VALUES
      ('INC-2024-001', '2024-09-15'::DATE, '10:30'::TIME, 'minor_injury', 'low', 'Ground Floor - Column B2', 'Worker suffered minor cut on hand while cutting rebar', 'First aid administered immediately', 'Improper use of cutting tool', 'Tool safety training conducted for all workers', 'closed', v_admin),
      ('INC-2024-002', '2024-11-20'::DATE, '14:00'::TIME, 'near_miss', 'medium', 'Scaffolding Area - Zone B', 'Falling object near-miss: wrench dropped from 3rd floor', 'Area evacuated and inspected', 'Inadequate tool lanyards', 'Mandatory tool lanyards for all elevated work', 'closed', v_admin),
      ('INC-2025-001', '2025-01-10'::DATE, '08:45'::TIME, 'first_aid', 'low', 'Storage Area', 'Worker hit toe against steel beam', 'First aid and ice pack applied', 'Cluttered walkway', 'Walkway cleared and marked', 'closed', v_admin),
      ('INC-2025-002', '2025-03-05'::DATE, '11:20'::TIME, 'property_damage', 'low', 'Equipment Yard', 'Minor damage to concrete pump hose', 'Pump shut down and inspected', 'Wear and tear', 'Hose replaced and preventive maintenance scheduled', 'reported', v_admin)
    ) AS t(incident_no, incident_date, incident_time, incident_type, severity, location, description, immediate_action, root_cause, corrective_action, status, reported_by)
    WHERE NOT EXISTS (SELECT 1 FROM safety_incidents WHERE project_id = v_p1 AND incident_no = t.incident_no);
    v_count := v_count + 1;
  END IF;

  -- ==========================================================================
  -- 14. SAFETY OBSERVATIONS
  -- ==========================================================================
  IF v_p1 IS NOT NULL AND v_admin IS NOT NULL THEN
    INSERT INTO safety_observations (id, project_id, observation_no, observation_date, observation_type, location, description, recommended_action, status, observed_by)
    SELECT gen_random_uuid(), v_p1, t.*
    FROM (VALUES
      ('OBS-2024-001', '2024-10-01'::DATE, 'safe_act', 'Scaffolding Area', 'Worker properly used fall arrest system while working at height', 'Commend and share as best practice', 'closed', v_admin),
      ('OBS-2024-002', '2024-12-05'::DATE, 'unsafe_act', 'Ground Floor', 'Worker not wearing safety goggles while cutting tiles', 'Immediate correction and retraining', 'closed', v_admin),
      ('OBS-2025-001', '2025-02-10'::DATE, 'unsafe_condition', 'Staircase B', 'Missing handrail on temporary staircase', 'Install handrail before next shift', 'open', v_admin),
      ('OBS-2025-002', '2025-03-12'::DATE, 'positive', 'Site Office', 'Team conducted thorough toolbox talk on lifting safety', 'Continue regular safety talks', 'open', v_admin)
    ) AS t(observation_no, observation_date, observation_type, location, description, recommended_action, status, observed_by)
    WHERE NOT EXISTS (SELECT 1 FROM safety_observations WHERE project_id = v_p1 AND observation_no = t.observation_no);
  END IF;

  -- ==========================================================================
  -- 15. TOOLBOX TALKS
  -- ==========================================================================
  IF v_p1 IS NOT NULL THEN
    FOR i IN 1..10 LOOP
      INSERT INTO toolbox_talks (id, project_id, talk_date, topic_en, topic_ar, conductor, duration_minutes, attendees_count, notes)
      SELECT gen_random_uuid(), v_p1, (CURRENT_DATE - (10 - i) * 7), t.*
      FROM (VALUES
        ('Working at Height Safety', 'السلامة في العمل على الارتفاعات', 'Ahmed Al-Qahtani', 30, 25, 'Focus on fall protection systems'),
        ('Lifting Operations', 'عمليات الرفع', 'Khalid Al-Omar', 25, 18, 'Crane signals and hand signals reviewed'),
        ('Fire Prevention', 'الوقاية من الحرائق', 'Safety Officer', 20, 30, 'Fire extinguisher locations and usage'),
        ('PPE Compliance', 'الامتثال لمعدات الوقاية', 'Safety Officer', 15, 35, 'Mandatory PPE zones reinforced'),
        ('Excavation Safety', 'سلامة الحفر', 'Ahmed Al-Qahtani', 25, 15, 'Shoring and trench safety'),
        ('Electrical Safety', 'السلامة الكهربائية', 'Faisal Al-Harbi', 30, 12, 'Lockout/tagout procedures'),
        ('Manual Handling', 'المناولة اليدوية', 'Safety Officer', 20, 28, 'Proper lifting techniques'),
        ('Chemical Safety', 'السلامة الكيميائية', 'Safety Officer', 25, 10, 'MSDS and chemical handling'),
        ('Emergency Evacuation', 'الإخلاء في الطوارئ', 'Safety Officer', 20, 40, 'Assembly points and routes'),
        ('Housekeeping', 'النظافة والترتيب', 'Khalid Al-Omar', 15, 32, 'Site cleanliness and organization')
      ) AS t(topic_en, topic_ar, conductor, duration_minutes, attendees_count, notes)
      WHERE NOT EXISTS (
        SELECT 1 FROM toolbox_talks WHERE project_id = v_p1 AND talk_date = (CURRENT_DATE - (10 - i) * 7) AND topic_en = t.topic_en
      );
    END LOOP;
  END IF;

  -- ==========================================================================
  -- 16. PPE ISSUANCE
  -- ==========================================================================
  IF v_p1 IS NOT NULL AND v_admin IS NOT NULL THEN
    FOR v_t IN SELECT id, full_name_en FROM employees WHERE status = 'active' LIMIT 15 LOOP
      INSERT INTO ppe_issuance (id, project_id, employee_id, ppe_type, brand, size, quantity, issue_date, expiry_date, issued_by)
      SELECT gen_random_uuid(), v_p1, v_t.id, t.ppe_type, t.brand, t.size, t.quantity, t.issue_date, t.expiry_date, v_admin
      FROM (VALUES
        ('Safety Helmet', '3M', 'Medium', 1, '2024-01-15'::DATE, '2025-01-15'::DATE),
        ('Safety Vest', 'Portwest', 'L', 2, '2024-01-15'::DATE, '2025-07-15'::DATE),
        ('Safety Gloves', 'Ansell', 'L', 5, '2024-01-15'::DATE, '2024-07-15'::DATE),
        ('Safety Glasses', '3M', 'Standard', 1, '2024-01-15'::DATE, '2025-01-15'::DATE),
        ('Safety Boots', 'Caterpillar', '42', 1, '2024-01-15'::DATE, '2025-07-15'::DATE)
      ) AS t(ppe_type, brand, size, quantity, issue_date, expiry_date)
      WHERE NOT EXISTS (
        SELECT 1 FROM ppe_issuance WHERE employee_id = v_t.id AND ppe_type = t.ppe_type
      );
    END LOOP;
  END IF;

  -- ==========================================================================
  -- 17. SAFETY AUDITS
  -- ==========================================================================
  IF v_p1 IS NOT NULL THEN
    INSERT INTO safety_audits (id, project_id, audit_no, audit_date, auditor, scope, score, findings, recommendations, status)
    SELECT gen_random_uuid(), v_p1, t.*
    FROM (VALUES
      ('AUD-2024-001', '2024-06-15'::DATE, 'External Auditor - Bureau Veritas', 'Full site safety audit', 87.50,
        'Minor non-conformances in scaffold tagging and emergency exit signage', 'Update scaffold tags weekly, improve exit signage', 'closed'),
      ('AUD-2024-002', '2024-12-10'::DATE, 'Safety Manager - Internal', 'Quarterly safety review', 92.00,
        'General compliance good. Some PPE gaps noted on night shift.', 'Enforce PPE policy on all shifts', 'closed'),
      ('AUD-2025-001', '2025-03-01'::DATE, 'Client Safety Team', 'Mid-project safety assessment', 78.50,
        'Several observations related to housekeeping and chemical storage', 'Improve chemical storage area and site cleanup', 'in_progress')
    ) AS t(audit_no, audit_date, auditor, scope, score, findings, recommendations, status)
    WHERE NOT EXISTS (SELECT 1 FROM safety_audits WHERE project_id = v_p1 AND audit_no = t.audit_no);
  END IF;

  -- ==========================================================================
  -- 18. SHIFTS
  -- ==========================================================================
  FOR v_p IN SELECT id FROM projects WHERE is_active = true LOOP
    INSERT INTO shifts (id, project_id, shift_code, name_en, name_ar, start_time, end_time, grace_minutes)
    SELECT gen_random_uuid(), v_p.id, t.*
    FROM (VALUES
      ('MORNING', 'Morning Shift', 'الفترة الصباحية', '07:00'::TIME, '16:00'::TIME, 15),
      ('EVENING', 'Evening Shift', 'الفترة المسائية', '16:00'::TIME, '00:00'::TIME, 10),
      ('NIGHT', 'Night Shift', 'الفترة الليلية', '00:00'::TIME, '07:00'::TIME, 10)
    ) AS t(shift_code, name_en, name_ar, start_time, end_time, grace_minutes)
    WHERE NOT EXISTS (SELECT 1 FROM shifts WHERE project_id = v_p.id AND shift_code = t.shift_code);
  END LOOP;

  -- ==========================================================================
  -- 19. PAYROLL SETTINGS
  -- ==========================================================================
  FOR v_p IN SELECT id FROM projects WHERE is_active = true LOOP
    INSERT INTO payroll_settings (id, project_id, key, value)
    SELECT gen_random_uuid(), v_p.id, t.key, t.value::JSONB
    FROM (VALUES
      ('overtime_rate', '"1.5"'),
      ('weekend_rate', '"2.0"'),
      ('holiday_rate', '"2.5"'),
      ('social_insurance_pct', '"0.09"'),
      ('vacation_days_per_year', '"30"'),
      ('sick_leave_days_per_year', '"15"'),
      ('payroll_currency', '"SAR"')
    ) AS t(key, value)
    WHERE NOT EXISTS (SELECT 1 FROM payroll_settings WHERE project_id = v_p.id AND key = t.key);
  END LOOP;

  -- ==========================================================================
  -- 20. MATERIALS CATALOG
  -- ==========================================================================
  INSERT INTO materials_catalog (id, material_code, name_en, name_ar, category, unit_of_measure, unit_price)
  SELECT gen_random_uuid(), t.*
  FROM (VALUES
    ('MAT-CEM-001', 'Portland Cement Type I', 'أسمنت بورتلاند نوع 1', 'Cement', 'ton', 350.00),
    ('MAT-STL-001', 'Rebar 12mm Grade 60', 'حديد تسليح 12 مم', 'Steel', 'ton', 3100.00),
    ('MAT-STL-002', 'Rebar 16mm Grade 60', 'حديد تسليح 16 مم', 'Steel', 'ton', 3050.00),
    ('MAT-STL-003', 'Rebar 20mm Grade 60', 'حديد تسليح 20 مم', 'Steel', 'ton', 3000.00),
    ('MAT-AGG-001', 'Coarse Aggregate 20mm', 'ركام خشن 20 مم', 'Aggregate', 'm³', 120.00),
    ('MAT-AGG-002', 'Fine Aggregate / Sand', 'ركام ناعم / رمل', 'Aggregate', 'm³', 85.00),
    ('MAT-BLK-001', 'Concrete Block 20cm', 'طوب خرساني 20 سم', 'Masonry', 'pcs', 3.50),
    ('MAT-BLK-002', 'Concrete Block 10cm', 'طوب خرساني 10 سم', 'Masonry', 'pcs', 2.50),
    ('MAT-TIL-001', 'Porcelain Tile 60x60', 'بلاط بورسلين 60×60', 'Tiles', 'm²', 85.00),
    ('MAT-TIL-002', 'Ceramic Tile 30x60', 'بلاط سيراميك 30×60', 'Tiles', 'm²', 45.00),
    ('MAT-PNT-001', 'Interior Emulsion Paint (White)', 'دهان داخلي مستحلب (أبيض)', 'Paint', 'liter', 25.00),
    ('MAT-PNT-002', 'Exterior Acrylic Paint', 'دهان خارجي أكريليك', 'Paint', 'liter', 35.00),
    ('MAT-WIR-001', 'PVC Cable 4mm² (Red)', 'كابل PVC 4 مم² (أحمر)', 'Electrical', 'meter', 3.50),
    ('MAT-WIR-002', 'PVC Cable 6mm² (Black)', 'كابل PVC 6 مم² (أسود)', 'Electrical', 'meter', 5.00),
    ('MAT-PIP-001', 'PVC Pipe 4-inch', 'مواسير PVC 4 بوصة', 'Plumbing', 'meter', 12.00),
    ('MAT-PIP-002', 'PVC Pipe 2-inch', 'مواسير PVC 2 بوصة', 'Plumbing', 'meter', 7.50)
  ) AS t(material_code, name_en, name_ar, category, unit_of_measure, unit_price)
  WHERE NOT EXISTS (SELECT 1 FROM materials_catalog WHERE material_code = t.material_code);

  -- ==========================================================================
  -- 21. PURCHASE REQUESTS
  -- ==========================================================================
  IF v_p1 IS NOT NULL AND v_admin IS NOT NULL THEN
    INSERT INTO purchase_requests (id, project_id, pr_no, title, requested_by, request_date, required_date, status, approved_by, approved_at, notes)
    SELECT gen_random_uuid(), v_p1, t.*
    FROM (VALUES
      ('PR-2024-001', 'Cement & Aggregate for Foundation', v_admin, '2024-02-01'::DATE, '2024-02-20'::DATE, 'approved', v_admin, '2024-02-05'::DATE, 'Urgent - Foundation works starting'),
      ('PR-2024-002', 'Rebar Order - Phase 1', v_admin, '2024-03-15'::DATE, '2024-04-01'::DATE, 'approved', v_admin, '2024-03-20'::DATE, 'For foundation and ground floor'),
      ('PR-2024-003', 'MEP Materials - Rough In', v_admin, '2024-08-01'::DATE, '2024-09-01'::DATE, 'approved', v_admin, '2024-08-10'::DATE, 'Electrical and plumbing materials'),
      ('PR-2025-001', 'Finishing Materials - Phase 1', v_admin, '2025-01-15'::DATE, '2025-03-01'::DATE, 'draft', NULL::UUID, NULL::TIMESTAMPTZ, 'Tiles, paint, sanitary ware'),
      ('PR-2025-002', 'HVAC Equipment', v_admin, '2025-03-01'::DATE, '2025-05-01'::DATE, 'draft', NULL::UUID, NULL::TIMESTAMPTZ, 'Pending budget approval')
    ) AS t(pr_no, title, requested_by, request_date, required_date, status, approved_by, approved_at, notes)
    WHERE NOT EXISTS (SELECT 1 FROM purchase_requests WHERE project_id = v_p1 AND pr_no = t.pr_no);

    -- Purchase request items
    FOR v_t IN SELECT id FROM purchase_requests WHERE project_id = v_p1 LIMIT 5 LOOP
      INSERT INTO purchase_request_items (id, purchase_request_id, item_description, quantity, unit_of_measure, estimated_price, notes)
      SELECT gen_random_uuid(), v_t.id, t.*
      FROM (VALUES
        ('Portland Cement Type I - 50kg bags', 500, 'bag', 35000, 'For concrete works'),
        ('Coarse Aggregate 20mm', 200, 'm³', 24000, 'For concrete batching'),
        ('Fine Aggregate / Sand', 100, 'm³', 8500, 'For plastering and concrete'),
        ('Rebar 12mm Grade 60', 50, 'ton', 155000, 'For structural reinforcement'),
        ('Rebar 16mm Grade 60', 30, 'ton', 91500, 'For main beams and columns')
      ) AS t(item_description, quantity, unit_of_measure, estimated_price, notes)
      WHERE NOT EXISTS (SELECT 1 FROM purchase_request_items WHERE purchase_request_id = v_t.id AND item_description = t.item_description);
    END LOOP;
  END IF;

  -- ==========================================================================
  -- 22. PURCHASE ORDERS
  -- ==========================================================================
  DECLARE v_sup_id UUID; v_m1 UUID; v_m2 UUID; v_m3 UUID; v_m4 UUID; v_m5 UUID;
  BEGIN
    SELECT id INTO v_sup_id FROM suppliers LIMIT 1;
    SELECT id INTO v_m1 FROM materials_catalog WHERE material_code = 'MAT-CEM-001' LIMIT 1;
    SELECT id INTO v_m2 FROM materials_catalog WHERE material_code = 'MAT-STL-001' LIMIT 1;
    SELECT id INTO v_m3 FROM materials_catalog WHERE material_code = 'MAT-STL-002' LIMIT 1;
    SELECT id INTO v_m4 FROM materials_catalog WHERE material_code = 'MAT-AGG-001' LIMIT 1;
    SELECT id INTO v_m5 FROM materials_catalog WHERE material_code = 'MAT-AGG-002' LIMIT 1;

    IF v_p1 IS NOT NULL AND v_sup_id IS NOT NULL AND v_admin IS NOT NULL THEN
      INSERT INTO purchase_orders (id, project_id, supplier_id, po_no, title, order_date, delivery_date, total_amount, tax_amount, grand_total, status, approved_by, approved_at, notes)
      SELECT gen_random_uuid(), v_p1, v_sup_id, t.*
      FROM (VALUES
        ('PO-2024-001', 'Cement Supply - Foundation Phase', '2024-02-10'::DATE, '2024-03-01'::DATE, 175000, 26250, 201250, 'closed', v_admin, '2024-02-12'::DATE, 'Delivered in full'),
        ('PO-2024-002', 'Rebar Supply - Phase 1', '2024-03-25'::DATE, '2024-04-15'::DATE, 246500, 36975, 283475, 'closed', v_admin, '2024-03-28'::DATE, 'Partial delivery accepted'),
        ('PO-2024-003', 'Aggregate Supply', '2024-04-01'::DATE, '2024-04-20'::DATE, 32500, 4875, 37375, 'closed', v_admin, '2024-04-05'::DATE, 'All delivered'),
        ('PO-2025-001', 'Tiles & Finishing Materials', '2025-02-01'::DATE, '2025-03-15'::DATE, 450000, 67500, 517500, 'approved', v_admin, '2025-02-05'::DATE, 'Awaiting delivery')
      ) AS t(po_no, title, order_date, delivery_date, total_amount, tax_amount, grand_total, status, approved_by, approved_at, notes)
      WHERE NOT EXISTS (SELECT 1 FROM purchase_orders WHERE project_id = v_p1 AND po_no = t.po_no);

      -- Purchase order items
      FOR v_t IN SELECT id FROM purchase_orders WHERE project_id = v_p1 LIMIT 4 LOOP
        INSERT INTO purchase_order_items (id, po_id, material_id, item_description, quantity, unit_price, received_qty, notes)
        SELECT gen_random_uuid(), v_t.id, CASE (ROW_NUMBER() OVER ()) % 5 WHEN 0 THEN v_m1 WHEN 1 THEN v_m1 WHEN 2 THEN v_m2 WHEN 3 THEN v_m3 ELSE v_m4 END,
          t.item_description, t.quantity, t.unit_price, t.received_qty, t.notes
        FROM (VALUES
          ('Portland Cement Type I 50kg', 200, 350.00, 200, 'Delivered'),
          ('Rebar 12mm Grade 60', 40, 3100.00, 40, 'Full delivery'),
          ('Rebar 16mm Grade 60', 25, 3050.00, 20, 'Partial - 5 tons pending'),
          ('Coarse Aggregate 20mm', 100, 120.00, 100, 'Delivered'),
          ('Fine Aggregate / Sand', 80, 85.00, 80, 'Delivered')
        ) AS t(item_description, quantity, unit_price, received_qty, notes)
        WHERE NOT EXISTS (SELECT 1 FROM purchase_order_items WHERE po_id = v_t.id AND item_description = t.item_description);
      END LOOP;
    END IF;
  END;

  -- ==========================================================================
  -- 23. GOODS RECEIPTS
  -- ==========================================================================
  DECLARE v_po_id UUID; v_poi_id UUID;
  BEGIN
    SELECT id INTO v_po_id FROM purchase_orders WHERE status = 'closed' LIMIT 1;
    IF v_po_id IS NOT NULL AND v_admin IS NOT NULL THEN
      INSERT INTO goods_receipts (id, project_id, po_id, grn_no, receipt_date, received_by, delivery_note, status, notes)
      SELECT gen_random_uuid(), v_p1, v_po_id, t.*
      FROM (VALUES
        ('GRN-2024-001', '2024-03-01'::DATE, v_admin, 'DN-2024-001', 'approved', 'Cement delivery - 200 bags'),
        ('GRN-2024-002', '2024-04-10'::DATE, v_admin, 'DN-2024-002', 'approved', 'Rebar delivery - 40 tons'),
        ('GRN-2024-003', '2024-04-18'::DATE, v_admin, 'DN-2024-003', 'approved', 'Aggregate delivery - 180 m³')
      ) AS t(grn_no, receipt_date, received_by, delivery_note, status, notes)
      WHERE NOT EXISTS (SELECT 1 FROM goods_receipts WHERE project_id = v_p1 AND grn_no = t.grn_no);

      FOR v_t IN SELECT id FROM goods_receipts WHERE project_id = v_p1 LIMIT 3 LOOP
        SELECT id INTO v_poi_id FROM purchase_order_items WHERE po_id = v_po_id LIMIT 1;
        IF v_poi_id IS NOT NULL THEN
          INSERT INTO goods_receipt_items (id, goods_receipt_id, po_item_id, quantity_received, quantity_accepted, quantity_rejected, batch_no)
          SELECT gen_random_uuid(), v_t.id, v_poi_id, t.*
          FROM (VALUES
            (200, 200, 0, 'BATCH-CEM-001'),
            (40, 38, 2, 'BATCH-STL-001'),
            (180, 175, 5, 'BATCH-AGG-001')
          ) AS t(quantity_received, quantity_accepted, quantity_rejected, batch_no)
          WHERE NOT EXISTS (SELECT 1 FROM goods_receipt_items WHERE goods_receipt_id = v_t.id AND batch_no = t.batch_no);
        END IF;
      END LOOP;
    END IF;
  END;

  -- ==========================================================================
  -- 24. INVENTORY STOCKS
  -- ==========================================================================
  IF v_p1 IS NOT NULL THEN
    FOR v_t IN SELECT id, material_code, name_en, unit_of_measure, unit_price FROM materials_catalog LIMIT 16 LOOP
      INSERT INTO inventory_stocks (id, project_id, material_id, warehouse, quantity, reserved_qty, min_stock_level, unit_of_measure)
      SELECT gen_random_uuid(), v_p1, v_t.id, 'Main Warehouse',
        CASE v_t.material_code
          WHEN 'MAT-CEM-001' THEN 350 WHEN 'MAT-STL-001' THEN 25 WHEN 'MAT-STL-002' THEN 15
          WHEN 'MAT-STL-003' THEN 10 WHEN 'MAT-AGG-001' THEN 200 WHEN 'MAT-AGG-002' THEN 150
          WHEN 'MAT-BLK-001' THEN 5000 WHEN 'MAT-BLK-002' THEN 3000 WHEN 'MAT-TIL-001' THEN 1200
          WHEN 'MAT-TIL-002' THEN 800 WHEN 'MAT-PNT-001' THEN 400 WHEN 'MAT-PNT-002' THEN 200
          WHEN 'MAT-WIR-001' THEN 3000 WHEN 'MAT-WIR-002' THEN 2000 WHEN 'MAT-PIP-001' THEN 500
          ELSE 100
        END,
        CASE v_t.material_code
          WHEN 'MAT-CEM-001' THEN 50 WHEN 'MAT-STL-001' THEN 10 WHEN 'MAT-AGG-001' THEN 50
          ELSE 0
        END,
        CASE v_t.material_code
          WHEN 'MAT-CEM-001' THEN 100 WHEN 'MAT-STL-001' THEN 20 WHEN 'MAT-AGG-001' THEN 80
          ELSE 50
        END,
        v_t.unit_of_measure
      WHERE NOT EXISTS (SELECT 1 FROM inventory_stocks WHERE project_id = v_p1 AND material_id = v_t.id AND warehouse = 'Main Warehouse');
    END LOOP;
  END IF;

  -- ==========================================================================
  -- 25. MATERIAL ISSUES
  -- ==========================================================================
  IF v_p1 IS NOT NULL AND v_admin IS NOT NULL THEN
    INSERT INTO material_issues (id, project_id, issue_no, issue_date, issued_to, unit_id, task_id, status, notes)
    SELECT gen_random_uuid(), v_p1, t.issue_no, t.issue_date, t.issued_to, t.unit_id, t.task_id, t.status, t.notes
    FROM (VALUES
      ('MI-2024-001', '2024-04-01'::DATE, v_admin, v_u1, NULL::UUID, 'approved', 'Cement issue for foundation work - Unit A-101'),
      ('MI-2024-002', '2024-06-15'::DATE, v_admin, v_u2, NULL::UUID, 'approved', 'Rebar issue for first floor columns'),
      ('MI-2025-001', '2025-01-20'::DATE, v_admin, v_u1, NULL::UUID, 'draft', 'Tiles issue for apartment finishing')
    ) AS t(issue_no, issue_date, issued_to, unit_id, task_id, status, notes)
    WHERE NOT EXISTS (SELECT 1 FROM material_issues WHERE project_id = v_p1 AND issue_no = t.issue_no);

    FOR v_t IN SELECT id FROM material_issues WHERE project_id = v_p1 LIMIT 3 LOOP
      FOR v_m IN SELECT id, material_code FROM materials_catalog WHERE material_code IN ('MAT-CEM-001','MAT-STL-001','MAT-TIL-001') LIMIT 3 LOOP
        INSERT INTO material_issue_items (id, material_issue_id, material_id, quantity, unit_of_measure, notes)
        SELECT gen_random_uuid(), v_t.id, v_m.id,
          CASE v_m.material_code WHEN 'MAT-CEM-001' THEN 50 WHEN 'MAT-STL-001' THEN 5 WHEN 'MAT-TIL-001' THEN 200 ELSE 10 END,
          'each', 'Issued as per site request'
        WHERE NOT EXISTS (SELECT 1 FROM material_issue_items WHERE material_issue_id = v_t.id AND material_id = v_m.id);
      END LOOP;
    END LOOP;
  END IF;

  -- ==========================================================================
  -- 26. CUSTOMERS
  -- ==========================================================================
  INSERT INTO customers (id, company_id, customer_code, full_name_en, full_name_ar, phone, email, national_id, customer_type)
  SELECT gen_random_uuid(), v_company, t.*
  FROM (VALUES
    ('CUST-001', 'Abdullah Al-Rashid', 'عبد الله الرشيد', '+966 55 123 4567', 'abdullah@email.com', '101-1234567', 'individual'),
    ('CUST-002', 'Faisal Al-Otaibi', 'فيصل العتيبي', '+966 50 234 5678', 'faisal@email.com', '102-2345678', 'individual'),
    ('CUST-003', 'Saudi Commercial Est.', 'المؤسسة التجارية السعودية', '+966 55 345 6789', 'info@scom.sa', '201-3456789', 'company'),
    ('CUST-004', 'Mohammed Al-Ghamdi', 'محمد الغامدي', '+966 56 456 7890', 'mohammed@email.com', '103-4567890', 'individual'),
    ('CUST-005', 'Al-Rajhi Investment Group', 'مجموعة الراجحي الاستثمارية', '+966 11 567 8901', 'invest@alrajhi.sa', '202-5678901', 'investor')
  ) AS t(customer_code, full_name_en, full_name_ar, phone, email, national_id, customer_type)
  WHERE NOT EXISTS (SELECT 1 FROM customers WHERE customer_code = t.customer_code);

  -- ==========================================================================
  -- 27. UNIT SALES
  -- ==========================================================================
  DECLARE v_c1 UUID; v_c2 UUID; v_c3 UUID;
  BEGIN
    SELECT id INTO v_c1 FROM customers ORDER BY created_at LIMIT 1;
    SELECT id INTO v_c2 FROM customers ORDER BY created_at OFFSET 1 LIMIT 1;
    SELECT id INTO v_c3 FROM customers ORDER BY created_at OFFSET 2 LIMIT 1;

    IF v_u1 IS NOT NULL AND v_p1 IS NOT NULL AND v_c1 IS NOT NULL THEN
      INSERT INTO unit_sales (id, unit_id, customer_id, project_id, sale_date, sale_price, payment_method, status, contract_no, handover_date, notes)
      SELECT gen_random_uuid(), t.unit_id, t.customer_id, t.project_id, t.sale_date, t.sale_price, t.payment_method, t.status, t.contract_no, t.handover_date, t.notes
      FROM (
        SELECT v_u1 AS unit_id, v_c1 AS customer_id, v_p1 AS project_id, '2024-05-01'::DATE AS sale_date, 750000 AS sale_price, 'cash' AS payment_method, 'completed' AS status, 'SALE-CONT-001' AS contract_no, '2026-06-30'::DATE AS handover_date, 'Full payment received' AS notes
        UNION ALL
        SELECT v_u2, v_c2, v_p1, '2024-07-15'::DATE, 520000, 'installments', 'under_contract', 'SALE-CONT-002', '2026-06-30'::DATE, 'Payment plan active'
        UNION ALL
        SELECT v_u3, v_c3, COALESCE(v_p2,v_p1), '2024-09-01'::DATE, 380000, 'cash', 'reserved', NULL, '2026-03-31'::DATE, 'Down payment received'
      ) AS t
      WHERE NOT EXISTS (SELECT 1 FROM unit_sales WHERE unit_id = t.unit_id);

      -- Payment plans for unit sales
      FOR v_t IN SELECT id FROM unit_sales LIMIT 3 LOOP
        INSERT INTO payment_plans (id, unit_sale_id, plan_name_en, plan_name_ar, down_payment_pct, down_payment_amount, installments_count, total_amount)
        SELECT gen_random_uuid(), v_t.id, t.*
        FROM (VALUES
          ('Standard Payment Plan', 'خطة الدفع القياسية', 20, 150000, 8, 750000),
          ('Installment Plan 12 Months', 'خطة التقسيط 12 شهر', 10, 52000, 12, 520000),
          ('Cash Discount Plan', 'خطة الخصم النقدي', 100, 380000, 0, 380000)
        ) AS t(plan_name_en, plan_name_ar, down_payment_pct, down_payment_amount, installments_count, total_amount)
        WHERE NOT EXISTS (SELECT 1 FROM payment_plans WHERE unit_sale_id = v_t.id AND plan_name_en = t.plan_name_en);

        -- Collections schedule
        DECLARE v_plan_id UUID;
        BEGIN
          FOR v_pp IN SELECT id, installments_count FROM payment_plans WHERE unit_sale_id = v_t.id AND installments_count > 0 LOOP
            FOR j IN 1..v_pp.installments_count LOOP
              INSERT INTO collections_schedule (id, unit_sale_id, payment_plan_id, installment_no, due_date, amount, status, payment_date, payment_method)
              SELECT gen_random_uuid(), v_t.id, v_pp.id, j,
                (CURRENT_DATE + (j * 30)::INT),
                (SELECT total_amount FROM payment_plans WHERE id = v_pp.id) / v_pp.installments_count,
                CASE WHEN j <= 3 THEN 'paid' ELSE 'pending' END,
                CASE WHEN j <= 3 THEN CURRENT_DATE + ((j-1) * 30)::INT ELSE NULL END,
                'bank_transfer'
              WHERE NOT EXISTS (SELECT 1 FROM collections_schedule WHERE unit_sale_id = v_t.id AND installment_no = j);
            END LOOP;
          END LOOP;
        END;
      END LOOP;
    END IF;
  END;

  -- ==========================================================================
  -- 28. HANDOVER RECORDS
  -- ==========================================================================
  DECLARE v_sale_id UUID;
  BEGIN
    SELECT id INTO v_sale_id FROM unit_sales WHERE status = 'completed' LIMIT 1;
    IF v_sale_id IS NOT NULL AND v_u1 IS NOT NULL AND v_admin IS NOT NULL THEN
      INSERT INTO handover_records (id, unit_sale_id, unit_id, handover_date, handover_type, status, defects_list, handover_by)
      SELECT gen_random_uuid(), v_sale_id, v_u1, '2026-06-30'::DATE, 'temporary', 'pending',
        '1. Minor paint touch-ups needed in bedroom 2\n2. Bathroom sealant to be reapplied\n3. One kitchen cabinet door needs alignment',
        v_admin
      WHERE NOT EXISTS (SELECT 1 FROM handover_records WHERE unit_sale_id = v_sale_id);
    END IF;
  END;

  -- ==========================================================================
  -- 29. TECHNICAL TICKETS (RFIs, etc.)
  -- ==========================================================================
  IF v_p1 IS NOT NULL AND v_admin IS NOT NULL AND v_eng IS NOT NULL THEN
    INSERT INTO technical_tickets (id, project_id, ticket_no, ticket_type, title_en, title_ar, description, priority, status, requested_by, assigned_to, due_date, response, created_at)
    SELECT gen_random_uuid(), v_p1, t.*
    FROM (VALUES
      ('RFI-001', 'rfi', 'Clarification on Column Reinforcement Detail', 'توضيح تفاصيل تسليح الأعمدة', 'Request for clarification on reinforcement detailing at column-beam joint as per drawing S-102', 'high', 'closed', v_admin, v_eng, '2024-03-15'::DATE, 'Use detail A as per standard connection detail. See attached sketch.', '2024-03-01'::DATE),
      ('RFI-002', 'rfi', 'Material Substitution - Floor Tiles', 'استبدال مواد - بلاط الأرضيات', 'Request to substitute specified tile brand with equivalent alternative due to supplier stock issues', 'medium', 'closed', v_admin, v_eng, '2024-09-20'::DATE, 'Approved alternative - Brand X, same specification', '2024-09-10'::DATE),
      ('DQ-001', 'design_query', 'Parking Ramp Slope Design', 'استفسار تصميم منحدر موقف السيارات', 'The designed ramp slope of 1:8 exceeds maximum recommended for accessibility. Request review.', 'high', 'open', v_admin, v_eng, '2025-02-01'::DATE, NULL, '2025-01-20'::DATE),
      ('SDR-001', 'shop_drawing_review', 'Structural Steel Connection Details', 'مراجعة تفاصيل الوصلات الهيكلية', 'Review and approval of shop drawings for steel connections at roof level', 'medium', 'in_progress', v_admin, v_eng, '2025-04-01'::DATE, 'Preliminary review comments issued', '2025-03-15'::DATE),
      ('MSR-001', 'method_statement_review', 'Waterproofing Method Statement', 'مراجعة منهجية العزل المائي', 'Review of proposed waterproofing method for basement walls and foundation', 'low', 'open', v_admin, v_eng, '2025-05-01'::DATE, NULL, '2025-03-20'::DATE)
    ) AS t(ticket_no, ticket_type, title_en, title_ar, description, priority, status, requested_by, assigned_to, due_date, response, created_at)
    WHERE NOT EXISTS (SELECT 1 FROM technical_tickets WHERE project_id = v_p1 AND ticket_no = t.ticket_no);

    -- Ticket comments
    FOR v_t IN SELECT id FROM technical_tickets WHERE project_id = v_p1 AND status != 'open' LIMIT 3 LOOP
      INSERT INTO ticket_comments (id, ticket_id, comment_text, created_by)
      SELECT gen_random_uuid(), v_t.id, t.*
      FROM (VALUES
        ('Reviewed the submitted documents. Additional information required for beam connections.', v_eng),
        ('Updated drawings submitted as requested. Please review.', v_admin),
        ('Approved with minor comments. See markups on drawings.', v_eng)
      ) AS t(comment_text, created_by)
      WHERE NOT EXISTS (SELECT 1 FROM ticket_comments WHERE ticket_id = v_t.id AND comment_text = t.comment_text);
    END LOOP;
  END IF;

  -- ==========================================================================
  -- 30. WAREHOUSES
  -- ==========================================================================
  INSERT INTO warehouses (id, code, name_en, name_ar, location, project_id, is_active)
  SELECT gen_random_uuid(), t.*
  FROM (VALUES
    ('WH-MAIN', 'Main Warehouse', 'المستودع الرئيسي', 'Site Compound, Zone A', v_p1, true),
    ('WH-STEEL', 'Steel Storage Yard', 'ساحة تخزين الحديد', 'North Side, Zone B', v_p1, true),
    ('WH-MAT', 'Material Storage', 'مخزن المواد', 'East Entrance', v_p1, true),
    ('WH-TOOL', 'Tool & Equipment Store', 'مستودع الأدوات والمعدات', 'Site Office Compound', v_p1, true)
  ) AS t(code, name_en, name_ar, location, project_id, is_active)
  WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE code = t.code);

  -- ==========================================================================
  -- 31. MATERIAL CATEGORIES
  -- ==========================================================================
  INSERT INTO material_categories (id, code, name_en, name_ar, parent_id, is_active)
  SELECT gen_random_uuid(), t.*
  FROM (VALUES
    ('CAT-STR', 'Structural Materials', 'المواد الإنشائية', NULL::UUID, true),
    ('CAT-ARC', 'Architectural Materials', 'المواد المعمارية', NULL::UUID, true),
    ('CAT-MEP', 'MEP Materials', 'مواد الكهرباء والميكانيكا', NULL::UUID, true)
  ) AS t(code, name_en, name_ar, parent_id, is_active)
  WHERE NOT EXISTS (SELECT 1 FROM material_categories WHERE code = t.code);

  -- Sub-categories (look up parent UUIDs from root categories by code)
  INSERT INTO material_categories (id, code, name_en, name_ar, parent_id, is_active)
  SELECT gen_random_uuid(), t.code, t.name_en, t.name_ar, (SELECT id FROM material_categories WHERE code = t.parent_code LIMIT 1), t.is_active
  FROM (VALUES
    ('CAT-CEM', 'Cement & Additives', 'الأسمنت والإضافات', 'CAT-STR', true),
    ('CAT-STL', 'Steel & Reinforcement', 'الحديد والتسليح', 'CAT-STR', true),
    ('CAT-AGG', 'Aggregates & Sand', 'الركام والرمل', 'CAT-STR', true),
    ('CAT-TIL', 'Tiles & Flooring', 'البلاط والأرضيات', 'CAT-ARC', true),
    ('CAT-PNT', 'Paints & Coatings', 'الدهانات والطلاءات', 'CAT-ARC', true),
    ('CAT-ELC', 'Electrical Materials', 'المواد الكهربائية', 'CAT-MEP', true),
    ('CAT-PLM', 'Plumbing Materials', 'مواد السباكة', 'CAT-MEP', true)
  ) AS t(code, name_en, name_ar, parent_code, is_active)
  WHERE NOT EXISTS (SELECT 1 FROM material_categories WHERE code = t.code);

  -- ==========================================================================
  -- 32. MATERIALS (inventory system)
  -- ==========================================================================
  DECLARE v_cat_cat UUID; v_cat_stl UUID; v_cat_agg UUID; v_cat_til UUID; v_cat_elc UUID;
  BEGIN
    SELECT id INTO v_cat_cat FROM material_categories WHERE code = 'CAT-CEM' LIMIT 1;
    SELECT id INTO v_cat_stl FROM material_categories WHERE code = 'CAT-STL' LIMIT 1;
    SELECT id INTO v_cat_agg FROM material_categories WHERE code = 'CAT-AGG' LIMIT 1;
    SELECT id INTO v_cat_til FROM material_categories WHERE code = 'CAT-TIL' LIMIT 1;
    SELECT id INTO v_cat_elc FROM material_categories WHERE code = 'CAT-ELC' LIMIT 1;

    INSERT INTO materials (id, code, name_en, name_ar, category_id, unit, default_price)
    SELECT gen_random_uuid(), t.*
    FROM (VALUES
      ('MT-CEM-001', 'Cement Type I 50kg', 'أسمنت نوع 1 50 كجم', v_cat_cat, 'bag', 18.00),
      ('MT-STL-012', 'Rebar 12mm', 'حديد تسليح 12 مم', v_cat_stl, 'ton', 3100.00),
      ('MT-STL-016', 'Rebar 16mm', 'حديد تسليح 16 مم', v_cat_stl, 'ton', 3050.00),
      ('MT-AGG-020', 'Aggregate 20mm', 'ركام 20 مم', v_cat_agg, 'm³', 120.00),
      ('MT-AGG-SND', 'Washed Sand', 'رمل مغسول', v_cat_agg, 'm³', 85.00),
      ('MT-TIL-601', 'Porcelain Tile 60x60', 'بلاط بورسلين 60×60', v_cat_til, 'm²', 85.00),
      ('MT-TIL-302', 'Ceramic Tile 30x60', 'بلاط سيراميك 30×60', v_cat_til, 'm²', 45.00),
      ('MT-ELC-CBL', 'PVC Cable 4mm²', 'كابل 4 مم²', v_cat_elc, 'm', 3.50)
    ) AS t(code, name_en, name_ar, category_id, unit, default_price)
    WHERE NOT EXISTS (SELECT 1 FROM materials WHERE code = t.code);
  END;

  -- ==========================================================================
  -- 33. INVENTORY (warehouse stock)
  -- ==========================================================================
  DECLARE v_wh_id UUID; v_mt RECORD;
  BEGIN
    SELECT id INTO v_wh_id FROM warehouses WHERE code = 'WH-MAIN' LIMIT 1;
    IF v_wh_id IS NOT NULL THEN
      FOR v_mt IN SELECT id, code, default_price FROM materials LIMIT 8 LOOP
        INSERT INTO inventory (id, warehouse_id, material_id, quantity, min_quantity, unit_price, batch_no)
        SELECT gen_random_uuid(), v_wh_id, v_mt.id,
          CASE v_mt.code WHEN 'MT-CEM-001' THEN 350 WHEN 'MT-STL-012' THEN 25 WHEN 'MT-STL-016' THEN 15
            WHEN 'MT-AGG-020' THEN 200 WHEN 'MT-AGG-SND' THEN 150 WHEN 'MT-TIL-601' THEN 1200
            WHEN 'MT-TIL-302' THEN 800 WHEN 'MT-ELC-CBL' THEN 3000 ELSE 100 END,
          50, v_mt.default_price, 'BATCH-001'
        WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE warehouse_id = v_wh_id AND material_id = v_mt.id AND batch_no = 'BATCH-001');
      END LOOP;
    END IF;
  END;

  -- ==========================================================================
  -- 34. STOCK MOVEMENTS
  -- ==========================================================================
  DECLARE v_mt_id UUID; v_wh_id UUID;
  BEGIN
    SELECT id INTO v_wh_id FROM warehouses WHERE code = 'WH-MAIN' LIMIT 1;
    SELECT id INTO v_mt_id FROM materials WHERE code = 'MT-CEM-001' LIMIT 1;
    IF v_wh_id IS NOT NULL AND v_mt_id IS NOT NULL THEN
      INSERT INTO stock_movements (id, movement_no, movement_type, warehouse_id, material_id, quantity, unit_price, batch_no, reference_type, notes, created_by)
      SELECT gen_random_uuid(), t.*
      FROM (VALUES
        ('MOV-2024-001', 'received', v_wh_id, v_mt_id, 500, 18.00, 'BATCH-001', 'PO-2024-001', 'Initial stock receipt', v_admin),
        ('MOV-2024-002', 'issued', v_wh_id, v_mt_id, -150, 18.00, 'BATCH-001', 'MI-2024-001', 'Issued for foundation works', v_admin),
        ('MOV-2024-003', 'adjustment', v_wh_id, v_mt_id, -5, 18.00, 'BATCH-001', NULL, 'Damaged bags written off', v_admin)
      ) AS t(movement_no, movement_type, warehouse_id, material_id, quantity, unit_price, batch_no, reference_type, notes, created_by)
      WHERE NOT EXISTS (SELECT 1 FROM stock_movements WHERE movement_no = t.movement_no);
    END IF;
  END;

  -- ==========================================================================
  -- 35. PURCHASE REQUISITIONS (warehouse system)
  -- ==========================================================================
  IF v_p1 IS NOT NULL AND v_admin IS NOT NULL THEN
    INSERT INTO purchase_requisitions (id, pr_no, project_id, requested_by, status, notes)
    SELECT gen_random_uuid(), t.*
    FROM (VALUES
      ('PREQ-2024-001', v_p1, v_admin, 'approved', 'Monthly cement replenishment'),
      ('PREQ-2024-002', v_p1, v_admin, 'approved', 'Rebar stock replenishment'),
      ('PREQ-2025-001', v_p1, v_admin, 'draft', 'Tiles for finishing phase')
    ) AS t(pr_no, project_id, requested_by, status, notes)
    WHERE NOT EXISTS (SELECT 1 FROM purchase_requisitions WHERE pr_no = t.pr_no);

    DECLARE v_preq_id UUID; v_mt_id UUID;
    BEGIN
      SELECT id INTO v_preq_id FROM purchase_requisitions WHERE pr_no = 'PREQ-2024-001' LIMIT 1;
      SELECT id INTO v_mt_id FROM materials WHERE code = 'MT-CEM-001' LIMIT 1;
      IF v_preq_id IS NOT NULL AND v_mt_id IS NOT NULL THEN
        INSERT INTO purchase_requisition_items (id, pr_id, material_id, description, quantity, estimated_price)
        SELECT gen_random_uuid(), v_preq_id, v_mt_id, 'Cement Type I 50kg', 500, 18.00
        WHERE NOT EXISTS (SELECT 1 FROM purchase_requisition_items WHERE pr_id = v_preq_id AND material_id = v_mt_id);
      END IF;
    END;
  END IF;

  -- ==========================================================================
  -- 36. ACTIVITY DEFINITIONS
  -- ==========================================================================
  IF v_p1 IS NOT NULL THEN
    INSERT INTO activity_definitions (id, code, name_en, name_ar, project_id, category, unit, weight_percent, target_quantity)
    SELECT gen_random_uuid(), t.*
    FROM (VALUES
      ('ACT-EXC', 'Excavation', 'حفر', v_p1, 'Earthworks', 'm³', 5.00, 5000),
      ('ACT-FND', 'Foundation Concrete', 'خرسانة الأساسات', v_p1, 'Concrete', 'm³', 10.00, 2500),
      ('ACT-COL', 'Column Construction', 'إنشاء الأعمدة', v_p1, 'Structure', 'each', 15.00, 120),
      ('ACT-SLB', 'Slab Construction', 'إنشاء البلاطات', v_p1, 'Structure', 'each', 15.00, 30),
      ('ACT-BLK', 'Blockwork Masonry', 'البناء بالطوب', v_p1, 'Masonry', 'm²', 10.00, 8000),
      ('ACT-PLA', 'Plastering', 'البياض', v_p1, 'Finishing', 'm²', 10.00, 12000),
      ('ACT-TIL', 'Tiling', 'البلاط', v_p1, 'Finishing', 'm²', 10.00, 6000),
      ('ACT-MEP', 'MEP Rough-In', 'التمديدات الأولية', v_p1, 'MEP', 'lump_sum', 15.00, 1),
      ('ACT-PNT', 'Painting', 'الدهان', v_p1, 'Finishing', 'm²', 5.00, 15000),
      ('ACT-LND', 'Landscaping', 'تنسيق الموقع', v_p1, 'External', 'lump_sum', 5.00, 1)
    ) AS t(code, name_en, name_ar, project_id, category, unit, weight_percent, target_quantity)
    WHERE NOT EXISTS (SELECT 1 FROM activity_definitions WHERE project_id = v_p1 AND code = t.code);
  END IF;

  -- ==========================================================================
  -- 37. UNIT ACTIVITIES
  -- ==========================================================================
  FOR v_unit IN SELECT id FROM units LIMIT 10 LOOP
    FOR v_act IN SELECT id, code, target_quantity FROM activity_definitions WHERE project_id = v_p1 LIMIT 6 LOOP
      INSERT INTO unit_activities (id, unit_id, activity_id, weight_percent, target_quantity, achieved_quantity, status)
      SELECT gen_random_uuid(), v_unit.id, v_act.id,
        CASE v_act.code
          WHEN 'ACT-EXC' THEN 10 WHEN 'ACT-FND' THEN 15 WHEN 'ACT-COL' THEN 15
          WHEN 'ACT-SLB' THEN 15 WHEN 'ACT-BLK' THEN 15 WHEN 'ACT-PLA' THEN 10
          WHEN 'ACT-TIL' THEN 10 ELSE 10
        END,
        v_act.target_quantity,
        CASE v_act.code
          WHEN 'ACT-EXC' THEN v_act.target_quantity * 0.9
          WHEN 'ACT-FND' THEN v_act.target_quantity * 0.6
          WHEN 'ACT-COL' THEN v_act.target_quantity * 0.3
          WHEN 'ACT-SLB' THEN v_act.target_quantity * 0.2
          ELSE 0
        END,
        CASE v_act.code
          WHEN 'ACT-EXC' THEN 'in_progress' WHEN 'ACT-FND' THEN 'in_progress'
          WHEN 'ACT-COL' THEN 'in_progress' WHEN 'ACT-SLB' THEN 'not_started'
          ELSE 'pending'
        END
      WHERE NOT EXISTS (SELECT 1 FROM unit_activities WHERE unit_id = v_unit.id AND activity_id = v_act.id);
    END LOOP;
  END LOOP;

  -- ==========================================================================
  -- 38. CRM COMPANIES
  -- ==========================================================================
  INSERT INTO crm_companies (id, company_name, trading_name, registration_number, vat_number, phone, email, industry, company_size, source, tags, notes, city, country, assigned_to, is_active)
  SELECT gen_random_uuid(), t.*
  FROM (VALUES
    ('Saudi Builders Co.', 'SBC', 'CR-100001', 'VAT-300001', '+966 11 200 1001', 'info@sbc.com.sa', 'Construction', '201-1000', 'referral', ARRAY['contractor','active'], 'Major construction firm in Riyadh', 'Riyadh', 'Saudi Arabia', v_sales, true),
    ('Al-Majd Real Estate', 'Al-Majd', 'CR-100002', 'VAT-300002', '+966 12 300 2002', 'info@almajd.sa', 'Real Estate', '51-200', 'website', ARRAY['developer','premium'], 'Real estate development company', 'Jeddah', 'Saudi Arabia', v_sales, true),
    ('Green Oasis Landscaping', 'Green Oasis', 'CR-100003', 'VAT-300003', '+966 13 400 3003', 'contact@greenoasis.sa', 'Services', '11-50', 'cold_call', ARRAY['landscaping','subcontractor'], 'Specialized landscaping services', 'Dammam', 'Saudi Arabia', v_sales, true),
    ('TechVision Consulting', 'TechVision', 'CR-100004', 'VAT-300004', '+966 11 500 4004', 'info@techvision.sa', 'Consulting', '1-10', 'referral', ARRAY['consultant','engineering'], 'Engineering and project management consultancy', 'Riyadh', 'Saudi Arabia', v_sales, true)
  ) AS t(company_name, trading_name, registration_number, vat_number, phone, email, industry, company_size, source, tags, notes, city, country, assigned_to, is_active)
  WHERE NOT EXISTS (SELECT 1 FROM crm_companies WHERE registration_number = t.registration_number);

  -- ==========================================================================
  -- 39. CRM CONTACTS
  -- ==========================================================================
  DECLARE v_crm_co1 UUID; v_crm_co2 UUID; v_crm_co3 UUID;
  BEGIN
    SELECT id INTO v_crm_co1 FROM crm_companies LIMIT 1;
    SELECT id INTO v_crm_co2 FROM crm_companies OFFSET 1 LIMIT 1;
    SELECT id INTO v_crm_co3 FROM crm_companies OFFSET 2 LIMIT 1;

    INSERT INTO crm_contacts (id, company_id, first_name, last_name, email, phone, position, department, source, tags, city, assigned_to)
    SELECT gen_random_uuid(), t.*
    FROM (VALUES
      (v_crm_co1, 'Khalid', 'Al-Omar', 'khalid@sbc.com.sa', '+966 55 111 1111', 'Procurement Manager', 'Procurement', 'referral', ARRAY['decision_maker'], 'Riyadh', v_sales),
      (v_crm_co1, 'Saeed', 'Al-Zahrani', 'saeed@sbc.com.sa', '+966 55 222 2222', 'Project Director', 'Operations', 'referral', ARRAY['director'], 'Riyadh', v_sales),
      (v_crm_co2, 'Faisal', 'Al-Harbi', 'faisal@almajd.sa', '+966 55 333 3333', 'CEO', 'Management', 'website', ARRAY['ceo','vip'], 'Jeddah', v_sales),
      (v_crm_co2, 'Nora', 'Al-Saud', 'nora@almajd.sa', '+966 55 444 4444', 'Sales Manager', 'Sales', 'website', ARRAY['manager'], 'Jeddah', v_sales),
      (v_crm_co3, 'Ahmed', 'Al-Qahtani', 'ahmed@greenoasis.sa', '+966 55 555 5555', 'Owner', 'Management', 'cold_call', ARRAY['owner'], 'Dammam', v_sales),
      (NULL::UUID, 'Mansour', 'Al-Ghamdi', 'mansour@example.com', '+966 55 666 6666', 'Independent Consultant', 'Engineering', 'other', ARRAY['consultant'], 'Riyadh', v_sales)
    ) AS t(company_id, first_name, last_name, email, phone, position, department, source, tags, city, assigned_to)
    WHERE NOT EXISTS (SELECT 1 FROM crm_contacts WHERE email = t.email);
  END;

  -- ==========================================================================
  -- 39b. CRM PIPELINE STAGES
  -- ==========================================================================
  INSERT INTO crm_pipeline_stages (id, name_en, sort_order, probability, color)
  SELECT gen_random_uuid(), t.*
  FROM (VALUES
    ('Lead', 1, 5.00, '#6B7280'),
    ('Qualified Lead', 2, 15.00, '#3B82F6'),
    ('Proposal Sent', 3, 30.00, '#F59E0B'),
    ('Negotiation', 4, 60.00, '#8B5CF6'),
    ('Contract Review', 5, 85.00, '#10B981'),
    ('Won', 6, 100.00, '#059669'),
    ('Lost', 7, 0.00, '#EF4444')
  ) AS t(name_en, sort_order, probability, color)
  WHERE NOT EXISTS (SELECT 1 FROM crm_pipeline_stages WHERE name_en = t.name_en);

  -- ==========================================================================
  -- 40. CRM DEALS
  -- ==========================================================================
  DECLARE v_stage1 UUID; v_stage4 UUID; v_stage5 UUID; v_stage6 UUID; v_stage7 UUID; v_crm_co1 UUID; v_crm_co2 UUID; v_crm_co3 UUID;
  BEGIN
    SELECT id INTO v_stage1 FROM crm_pipeline_stages WHERE sort_order = 1 LIMIT 1;
    SELECT id INTO v_stage4 FROM crm_pipeline_stages WHERE sort_order = 4 LIMIT 1;
    SELECT id INTO v_stage5 FROM crm_pipeline_stages WHERE sort_order = 5 LIMIT 1;
    SELECT id INTO v_stage6 FROM crm_pipeline_stages WHERE sort_order = 6 LIMIT 1;
    SELECT id INTO v_stage7 FROM crm_pipeline_stages WHERE sort_order = 7 LIMIT 1;
    SELECT id INTO v_crm_co1 FROM crm_companies LIMIT 1;
    SELECT id INTO v_crm_co2 FROM crm_companies OFFSET 1 LIMIT 1;
    SELECT id INTO v_crm_co3 FROM crm_companies OFFSET 2 LIMIT 1;

    INSERT INTO crm_deals (id, deal_name, company_id, pipeline_stage_id, amount, probability, expected_close_date, source, assigned_to, is_won, notes)
    SELECT gen_random_uuid(), t.*
    FROM (VALUES
      ('Residential Tower - MEP Contract', v_crm_co1, v_stage5, 8500000, 80.00, '2025-06-30'::DATE, 'referral', v_sales, false, 'Negotiating final terms'),
      ('Commercial Complex - Finishing Works', v_crm_co1, v_stage4, 12000000, 60.00, '2025-09-30'::DATE, 'referral', v_sales, false, 'Awaiting budget approval'),
      ('Villa Community - Landscaping', v_crm_co3, v_stage1, 3500000, 10.00, '2025-12-31'::DATE, 'cold_call', v_sales, false, 'Initial meeting scheduled'),
      ('HQ Building - Consultancy', NULL::UUID, v_stage6, 1500000, 100.00, '2025-03-15'::DATE, 'referral', v_sales, true, 'Contract signed - Project won'),
      ('Shopping Mall - Design Review', v_crm_co2, v_stage7, 2000000, 0.00, '2025-01-15'::DATE, 'website', v_sales, false, 'Lost to competitor')
    ) AS t(deal_name, company_id, pipeline_stage_id, amount, probability, expected_close_date, source, assigned_to, is_won, notes)
    WHERE NOT EXISTS (SELECT 1 FROM crm_deals WHERE deal_name = t.deal_name);
  END;

  -- ==========================================================================
  -- 41. CRM INTERACTIONS
  -- ==========================================================================
  DECLARE v_crm_cont1 UUID; v_crm_cont2 UUID; v_crm_deal1 UUID; v_crm_co1 UUID;
  BEGIN
    SELECT id INTO v_crm_cont1 FROM crm_contacts LIMIT 1;
    SELECT id INTO v_crm_cont2 FROM crm_contacts OFFSET 1 LIMIT 1;
    SELECT id INTO v_crm_deal1 FROM crm_deals LIMIT 1;
    SELECT id INTO v_crm_co1 FROM crm_companies LIMIT 1;

    INSERT INTO crm_interactions (id, interaction_type, subject, description, contact_id, company_id, deal_id, interaction_date, duration_minutes, direction, outcome, follow_up_date, follow_up_notes, created_by)
    SELECT gen_random_uuid(), t.*
    FROM (VALUES
      ('call', 'Initial Project Discussion', 'Discussed project requirements and scope for upcoming development', v_crm_cont1, v_crm_co1, v_crm_deal1, CURRENT_DATE - 7, 35, 'outbound', 'completed', CURRENT_DATE + 7, 'Send proposal next week', v_sales),
      ('email', 'Proposal Follow-up', 'Sent detailed proposal and pricing for MEP works', v_crm_cont2, v_crm_co1, v_crm_deal1, CURRENT_DATE - 5, NULL, 'outbound', 'completed', NULL, 'Waiting for client response', v_sales),
      ('meeting', 'Site Visit & Walkthrough', 'Site visit to discuss project specifics and answer client questions', v_crm_cont1, v_crm_co1, v_crm_deal1, CURRENT_DATE - 3, 90, 'outbound', 'completed', CURRENT_DATE + 14, 'Client very interested', v_sales),
      ('note', 'Internal Strategy Note', 'Competitive pricing strategy discussed. Consider offering 5% discount for long-term partnership.', v_crm_cont1, v_crm_co1, v_crm_deal1, CURRENT_DATE, NULL, 'outbound', 'completed', NULL, NULL, v_sales)
    ) AS t(interaction_type, subject, description, contact_id, company_id, deal_id, interaction_date, duration_minutes, direction, outcome, follow_up_date, follow_up_notes, created_by)
    WHERE NOT EXISTS (SELECT 1 FROM crm_interactions WHERE subject = t.subject AND contact_id = t.contact_id);
  END;

  -- ==========================================================================
  -- 42. CRM TASKS
  -- ==========================================================================
  DECLARE v_crm_co1 UUID;
  BEGIN
    SELECT id INTO v_crm_co1 FROM crm_companies LIMIT 1;
    INSERT INTO crm_tasks (id, task_type, subject, description, contact_id, company_id, deal_id, due_date, priority, status, assigned_to, created_by)
    SELECT gen_random_uuid(), t.*
    FROM (VALUES
      ('call', 'Follow-up call - Proposal Review', 'Call client to review proposal and answer questions', (SELECT id FROM crm_contacts LIMIT 1), v_crm_co1, (SELECT id FROM crm_deals LIMIT 1), CURRENT_DATE + 3, 'high', 'pending', v_sales, v_sales),
      ('email', 'Send Revised Contract', 'Send revised contract terms as discussed in last meeting', (SELECT id FROM crm_contacts OFFSET 1 LIMIT 1), v_crm_co1, (SELECT id FROM crm_deals OFFSET 1 LIMIT 1), CURRENT_DATE + 5, 'medium', 'pending', v_sales, v_sales),
      ('meeting', 'Schedule Kick-off Meeting', 'Arrange project kickoff meeting with all stakeholders', NULL::UUID, v_crm_co1, NULL::UUID, CURRENT_DATE + 14, 'high', 'pending', v_sales, v_sales),
      ('follow_up', 'Send Thank You Note', 'Send thank you note after site visit', (SELECT id FROM crm_contacts LIMIT 1), v_crm_co1, (SELECT id FROM crm_deals LIMIT 1), CURRENT_DATE + 1, 'low', 'pending', v_sales, v_sales),
      ('reminder', 'Weekly Deal Review', 'Review all active deals and update pipeline stages', NULL::UUID, NULL::UUID, NULL::UUID, CURRENT_DATE + 7, 'medium', 'pending', v_sales, v_sales)
    ) AS t(task_type, subject, description, contact_id, company_id, deal_id, due_date, priority, status, assigned_to, created_by)
    WHERE NOT EXISTS (SELECT 1 FROM crm_tasks WHERE subject = t.subject AND assigned_to = t.assigned_to);
  END;

  -- ==========================================================================
  -- 43. SCHEDULING: RESOURCES
  -- ==========================================================================
  IF v_p1 IS NOT NULL THEN
    INSERT INTO resources (id, project_id, resource_code, name_en, name_ar, resource_type, unit_of_measure, cost_per_unit, max_units)
    SELECT gen_random_uuid(), v_p1, t.*
    FROM (VALUES
      ('LAB-CONC', 'Concrete Worker', 'عامل خرسانة', 'labor', 'hour', 25.00, 20),
      ('LAB-STL', 'Steel Fixer', 'حداد تسليح', 'labor', 'hour', 30.00, 15),
      ('LAB-CARP', 'Carpenter', 'نجار', 'labor', 'hour', 28.00, 12),
      ('LAB-PLA', 'Plasterer', 'مبيض', 'labor', 'hour', 27.00, 15),
      ('LAB-TIL', 'Tile Layer', 'بلاط', 'labor', 'hour', 32.00, 10),
      ('LAB-ELC', 'Electrician', 'كهربائي', 'labor', 'hour', 35.00, 8),
      ('LAB-PLM', 'Plumber', 'سباك', 'labor', 'hour', 33.00, 6),
      ('EQ-EXC', 'Excavator (20 ton)', 'حفار 20 طن', 'equipment', 'hour', 250.00, 3),
      ('EQ-CRA', 'Tower Crane', 'رافعة برجية', 'equipment', 'hour', 400.00, 2),
      ('EQ-CONC', 'Concrete Pump', 'مضخة خرسانة', 'equipment', 'hour', 350.00, 2),
      ('MAT-CEM', 'Cement (Type I)', 'أسمنت نوع 1', 'material', 'ton', 350.00, NULL),
      ('MAT-STL', 'Rebar Grade 60', 'حديد تسليح', 'material', 'ton', 3100.00, NULL),
      ('MAT-AGG', 'Aggregate 20mm', 'ركام 20 مم', 'material', 'm³', 120.00, NULL),
      ('SUB-MEP', 'MEP Subcontractor', 'مقاول الكهرباء والميكانيكا', 'subcontractor', 'lump_sum', 1, 1)
    ) AS t(resource_code, name_en, name_ar, resource_type, unit_of_measure, cost_per_unit, max_units)
    WHERE NOT EXISTS (SELECT 1 FROM resources WHERE project_id = v_p1 AND resource_code = t.resource_code);
  END IF;

  -- ==========================================================================
  -- 44. SCHEDULING: TASK DEPENDENCIES
  -- ==========================================================================
  IF v_p1 IS NOT NULL THEN
    INSERT INTO task_dependencies (id, project_id, predecessor_id, successor_id, lag_days, dependency_type)
    SELECT gen_random_uuid(), v_p1, pred.id, succ.id, dep.lag_days, dep.dependency_type
    FROM work_tasks AS pred
    CROSS JOIN work_tasks AS succ
    CROSS JOIN (VALUES
      (0, 'FS'::TEXT), (0, 'FS'::TEXT), (5, 'FS'::TEXT), (0, 'FS'::TEXT), (0, 'FS'::TEXT)
    ) AS dep(lag_days, dependency_type)
    WHERE pred.project_id = v_p1 AND succ.project_id = v_p1
      AND pred.task_code = 'TASK-FND' AND succ.task_code = 'TASK-STR'
    LIMIT 1;

    INSERT INTO task_dependencies (id, project_id, predecessor_id, successor_id, lag_days, dependency_type)
    SELECT gen_random_uuid(), v_p1, pred.id, succ.id, 0, 'FS'
    FROM work_tasks pred, work_tasks succ
    WHERE pred.project_id = v_p1 AND succ.project_id = v_p1
      AND pred.task_code = 'TASK-STR' AND succ.task_code = 'TASK-MEP'
      AND NOT EXISTS (SELECT 1 FROM task_dependencies WHERE project_id = v_p1 AND predecessor_id = pred.id AND successor_id = succ.id);
  END IF;

  -- ==========================================================================
  -- 45. SCHEDULING: TASK RESOURCES
  -- ==========================================================================
  DECLARE v_res_lab UUID; v_res_eq UUID; v_res_mat UUID;
  BEGIN
    SELECT id INTO v_res_lab FROM resources WHERE resource_code = 'LAB-CONC' AND project_id = v_p1 LIMIT 1;
    SELECT id INTO v_res_eq FROM resources WHERE resource_code = 'EQ-EXC' AND project_id = v_p1 LIMIT 1;
    SELECT id INTO v_res_mat FROM resources WHERE resource_code = 'MAT-CEM' AND project_id = v_p1 LIMIT 1;

    FOR v_t IN SELECT id, task_code FROM work_tasks WHERE project_id = v_p1 LIMIT 4 LOOP
      INSERT INTO task_resources (id, task_id, resource_id, allocated_units, unit_price)
      SELECT gen_random_uuid(), v_t.id, r.id, r.allocated_units, r.unit_price
      FROM (
        SELECT v_res_lab AS id, 8 AS allocated_units, 25.00 AS unit_price
        UNION ALL SELECT v_res_eq, 4, 250.00
        UNION ALL SELECT v_res_mat, 10, 350.00
      ) r
      WHERE NOT EXISTS (SELECT 1 FROM task_resources WHERE task_id = v_t.id AND resource_id = r.id);
    END LOOP;
  END;

  -- ==========================================================================
  -- 46. SCHEDULING: CALENDARS
  -- ==========================================================================
  INSERT INTO calendars (id, project_id, name, is_base, work_week, work_hours_start, work_hours_end)
  SELECT gen_random_uuid(), t.project_id, t.name, t.is_base, t.work_week::JSONB, t.work_hours_start, t.work_hours_end
  FROM (VALUES
    (v_p1, 'Standard 6-Day Week', true, '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":false,"saturday":true,"sunday":true}', '07:00'::TIME, '17:00'::TIME),
    (v_p1, 'Night Shift Calendar', false, '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":false,"saturday":true,"sunday":true}', '19:00'::TIME, '03:00'::TIME),
      (NULL::UUID, 'Company Holidays', true, '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":false,"saturday":false,"sunday":true}', '08:00'::TIME, '17:00'::TIME)
  ) AS t(project_id, name, is_base, work_week, work_hours_start, work_hours_end)
  WHERE NOT EXISTS (SELECT 1 FROM calendars WHERE name = t.name AND COALESCE(project_id, '00000000-0000-0000-0000-000000000000') = COALESCE(t.project_id, '00000000-0000-0000-0000-000000000000'));

  -- Calendar exceptions (holidays)
  DECLARE v_cal_id UUID;
  BEGIN
    SELECT id INTO v_cal_id FROM calendars WHERE name = 'Standard 6-Day Week' AND project_id = v_p1 LIMIT 1;
    IF v_cal_id IS NOT NULL THEN
      INSERT INTO calendar_exceptions (id, calendar_id, exception_date, is_working, reason)
      SELECT gen_random_uuid(), v_cal_id, t.*
      FROM (VALUES
        ('2025-01-01'::DATE, false, 'New Year Day - رأس السنة الميلادية'),
        ('2025-02-22'::DATE, false, 'Saudi Founding Day - يوم التأسيس السعودي'),
        ('2025-04-10'::DATE, false, 'Eid al-Fitr - عيد الفطر'),
        ('2025-04-11'::DATE, false, 'Eid al-Fitr - عيد الفطر'),
        ('2025-06-16'::DATE, false, 'Eid al-Adha - عيد الأضحى'),
        ('2025-06-17'::DATE, false, 'Eid al-Adha - عيد الأضحى'),
        ('2025-09-23'::DATE, false, 'Saudi National Day - اليوم الوطني السعودي')
      ) AS t(exception_date, is_working, reason)
      WHERE NOT EXISTS (SELECT 1 FROM calendar_exceptions WHERE calendar_id = v_cal_id AND exception_date = t.exception_date);
    END IF;
  END;

  -- ==========================================================================
  -- 47. WORKFLOW DEFINITIONS (approval templates)
  -- ==========================================================================
  DECLARE v_wf_id UUID;
  BEGIN
    INSERT INTO workflow_definitions (id, module_code, name_en, name_ar, is_default)
    SELECT gen_random_uuid(), t.*
    FROM (VALUES
      ('procurement', 'Purchase Order Approval', 'اعتماد أمر الشراء', false),
      ('execution', 'WIR Approval', 'اعتماد طلب العمل', true),
      ('approvals', 'Contract Approval', 'اعتماد العقد', false)
    ) AS t(module_code, name_en, name_ar, is_default)
    WHERE NOT EXISTS (SELECT 1 FROM workflow_definitions WHERE module_code = t.module_code);
    SELECT id INTO v_wf_id FROM workflow_definitions WHERE module_code = 'procurement' LIMIT 1;

    IF v_wf_id IS NOT NULL THEN
      INSERT INTO workflow_steps (id, workflow_id, step_order, from_status_code, to_status_code, allowed_roles, action_label_en, action_label_ar)
      SELECT gen_random_uuid(), t.*
      FROM (VALUES
        (v_wf_id, 1, 'draft', 'submitted', ARRAY['project_manager','engineer'], 'Review & Submit', 'مراجعة وتقديم'),
        (v_wf_id, 2, 'submitted', 'approved', ARRAY['admin'], 'Approve', 'اعتماد'),
        (v_wf_id, 3, 'submitted', 'rejected', ARRAY['admin'], 'Reject', 'رفض'),
        (v_wf_id, 4, 'approved', 'closed', ARRAY['admin'], 'Close', 'إغلاق')
      ) AS t(workflow_id, step_order, from_status_code, to_status_code, allowed_roles, action_label_en, action_label_ar)
      WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE workflow_id = v_wf_id AND step_order = t.step_order);
    END IF;
  END;

  -- ==========================================================================
  -- 48. KPI DEFINITIONS
  -- ==========================================================================
  INSERT INTO kpi_definitions (id, module_code, code, name_en, name_ar, formula_type, config_json, unit, target_value)
  SELECT gen_random_uuid(), t.*
  FROM (VALUES
    ('execution', 'KPI-SCH', 'Schedule Performance Index (SPI)', 'مؤشر أداء الجدول', 'ratio', '{"formula":"EV / PV","frequency":"weekly"}'::JSONB, 'ratio', 1.0),
    ('execution', 'KPI-COST', 'Cost Performance Index (CPI)', 'مؤشر أداء التكلفة', 'ratio', '{"formula":"EV / AC","frequency":"weekly"}'::JSONB, 'ratio', 1.0),
    ('execution', 'KPI-QUALITY', 'Quality Pass Rate', 'معدل اجتياز الجودة', 'ratio', '{"formula":"(Passed / Total) × 100","frequency":"monthly"}'::JSONB, '%', 95.0),
    ('hse', 'KPI-SAFETY', 'Safety Incident Rate', 'معدل حوادث السلامة', 'ratio', '{"formula":"(Incidents × 200000) / Hours","frequency":"monthly"}'::JSONB, 'count', 0.5),
    ('hr', 'KPI-ATTEND', 'Attendance Rate', 'معدل الحضور', 'ratio', '{"formula":"(Present / Expected) × 100","frequency":"weekly"}'::JSONB, '%', 95.0),
    ('sales', 'KPI-CONV', 'Lead Conversion Rate', 'معدل تحويل العملاء', 'ratio', '{"formula":"(Converted / Total) × 100","frequency":"monthly"}'::JSONB, '%', 25.0)
  ) AS t(module_code, code, name_en, name_ar, formula_type, config_json, unit, target_value)
  WHERE NOT EXISTS (SELECT 1 FROM kpi_definitions WHERE code = t.code);

  -- ==========================================================================
  -- 49. COMMISSIONS
  -- ==========================================================================
  INSERT INTO commissions (id, commission_code, commission_name_en, commission_name_ar, commission_type, commission_value, salesperson_id, is_active)
  SELECT gen_random_uuid(), t.*
  FROM (VALUES
    ('COMM-01', 'Sales Commission - Residential', 'عمولة مبيعات سكني', 'percentage', 2.50, NULL::UUID, true),
    ('COMM-02', 'Sales Commission - Commercial', 'عمولة مبيعات تجاري', 'percentage', 3.00, NULL::UUID, true),
    ('COMM-03', 'Referral Bonus', 'مكافأة إحالة', 'fixed', 5000.00, NULL::UUID, true),
    ('COMM-04', 'Team Lead Override', 'عمولة قائد الفريق', 'percentage', 0.50, NULL::UUID, true)
  ) AS t(commission_code, commission_name_en, commission_name_ar, commission_type, commission_value, salesperson_id, is_active)
  WHERE NOT EXISTS (SELECT 1 FROM commissions WHERE commission_code = t.commission_code);

  -- ==========================================================================
  -- 50. AUDIT TRAIL (sample entries)
  -- ==========================================================================
  IF v_admin IS NOT NULL AND v_p1 IS NOT NULL THEN
    INSERT INTO audit_trail (id, module_code, record_id, action, old_status, new_status, changes, performed_by, comment)
    SELECT gen_random_uuid(), t.*
    FROM (VALUES
      ('project', v_p1, 'updated', 'planning', 'in_progress', '{"status":"Changed from planning to in_progress"}'::JSONB, v_admin, 'Project kicked off'),
      ('work_request', (SELECT id FROM work_requests WHERE project_id = v_p1 LIMIT 1), 'created', NULL, 'draft', '{"wir_no":"WIR-2024-001"}'::JSONB, v_admin, 'WIR created for foundation inspection'),
      ('work_request', (SELECT id FROM work_requests WHERE project_id = v_p1 LIMIT 1), 'approved', 'draft', 'approved', '{"status":"approved"}'::JSONB, v_admin, 'Inspection approved'),
      ('contract_scope', (SELECT id FROM contract_scope_items LIMIT 1), 'updated', 'active', 'active', '{"quantity":"Updated from 4500 to 5000"}'::JSONB, v_admin, 'Quantity adjustment per site instruction')
    ) AS t(module_code, record_id, action, old_status, new_status, changes, performed_by, comment)
    WHERE t.record_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM audit_trail WHERE module_code = t.module_code AND record_id = t.record_id AND action = t.action);
  END IF;

  -- ==========================================================================
  -- 51. ACTIVITY LOG (sample entries)
  -- ==========================================================================
  IF v_admin IS NOT NULL THEN
    INSERT INTO activity_log (id, user_id, action, module_code, record_id, metadata)
    SELECT gen_random_uuid(), v_admin, t.*
    FROM (VALUES
      ('login', 'auth', NULL::UUID, '{"ip":"192.168.1.100"}'::JSONB),
      ('view_project', 'projects', v_p1, '{"project_code":"PRJ-2024-001"}'::JSONB),
      ('create_wir', 'work_requests', (SELECT id FROM work_requests LIMIT 1), '{"wir_no":"WIR-2024-001"}'::JSONB),
      ('approve_invoice', 'contract_invoices', (SELECT id FROM contract_invoices LIMIT 1), '{"invoice_no":"INV-001"}'::JSONB),
      ('export_report', 'projects', v_p1, '{"report_type":"progress"}'::JSONB)
    ) AS t(action, module_code, record_id, metadata)
    WHERE NOT EXISTS (SELECT 1 FROM activity_log WHERE user_id = v_admin AND action = t.action AND module_code = t.module_code AND record_id IS NOT DISTINCT FROM t.record_id);
  END IF;

  -- ==========================================================================
  -- SUMMARY
  -- ==========================================================================
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '034 Demo Data Seed Complete!';
  RAISE NOTICE 'Seeded data for:';
  RAISE NOTICE '  Project Execution: phases, blocks, stakeholders, unit/item progress, daily reports';
  RAISE NOTICE '  Contracts: subcontracts, scope items, variations, invoices';
  RAISE NOTICE '  Work Execution: work items, WIRs, inspection lines';
  RAISE NOTICE '  HSE: incidents, observations, toolbox talks, PPE, audits';
  RAISE NOTICE '  HR: shifts, payroll settings';
  RAISE NOTICE '  Procurement: materials catalog, PRs, POs, GRNs, stocks, issues';
  RAISE NOTICE '  Sales: customers, unit sales, payment plans, collections, handovers';
  RAISE NOTICE '  Technical: RFIs, tickets, comments';
  RAISE NOTICE '  Warehouse: warehouses, categories, materials, inventory, movements';
  RAISE NOTICE '  Activities: definitions, unit activities';
  RAISE NOTICE '  CRM: companies, contacts, deals, interactions, tasks';
  RAISE NOTICE '  Scheduling: resources, dependencies, task resources, calendars';
  RAISE NOTICE '  Other: workflows, KPI definitions, commissions, audit trail, activity log';
  RAISE NOTICE '============================================================================';

END $$;
