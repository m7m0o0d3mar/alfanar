-- Seed data for interconnected testing of all modules
-- Uses existing user_profiles and projects UUIDs

-- ============================================================
-- 1. REPORT TEMPLATES (for Daily Reports + Reports pages)
-- ============================================================
INSERT INTO report_templates (id, code, name_en, name_ar, category, description) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'DAILY-SITE-REPORT', 'Daily Site Report', 'تقرير الموقع اليومي', 'daily', 'Standard daily site report template with labor, equipment, and weather fields'),
  ('a0000001-0000-0000-0000-000000000002', 'QC-INSPECTION', 'Quality Inspection Report', 'تقرير فحص الجودة', 'quality', 'Quality control inspection checklist'),
  ('a0000001-0000-0000-0000-000000000003', 'HSE-INSPECTION', 'Safety Inspection Report', 'تقرير فحص السلامة', 'safety', 'HSE daily safety inspection form')
ON CONFLICT (id) DO NOTHING;

-- Template sections
INSERT INTO report_template_sections (template_id, section_key, title_en, title_ar, section_type, sort_order, is_required, config) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'work_description', 'Work Description', 'وصف العمل', 'text', 1, true, '{"placeholder": "Describe work performed today..."}'),
  ('a0000001-0000-0000-0000-000000000001', 'materials_used', 'Materials Used', 'المواد المستخدمة', 'table', 2, false, '{"columns": [{"key": "material", "label": "Material", "type": "text"}, {"key": "quantity", "label": "Qty", "type": "number"}, {"key": "unit", "label": "Unit", "type": "text"}]}'),
  ('a0000001-0000-0000-0000-000000000001', 'issues', 'Issues / Notes', 'ملاحظات / مشاكل', 'text', 3, false, '{"placeholder": "Any issues encountered..."}'),
  ('a0000001-0000-0000-0000-000000000002', 'inspection_type', 'Inspection Type', 'نوع الفحص', 'select', 1, true, '{"options": ["Visual", "Dimensional", "Material Test", "Functional Test", "Pressure Test"]}'),
  ('a0000001-0000-0000-0000-000000000002', 'result', 'Result', 'النتيجة', 'select', 2, true, '{"options": ["Pass", "Fail", "Conditional Pass"]}'),
  ('a0000001-0000-0000-0000-000000000002', 'findings', 'Findings', 'النتائج', 'text', 3, false, '{}'),
  ('a0000001-0000-0000-0000-000000000002', 'photos', 'Photos', 'صور', 'image', 4, false, '{}'),
  ('a0000001-0000-0000-0000-000000000003', 'area_inspected', 'Area Inspected', 'المنطقة المفحوصة', 'text', 1, true, '{}'),
  ('a0000001-0000-0000-0000-000000000003', 'hazards', 'Hazards Identified', 'المخاطر المحددة', 'checkbox', 2, false, '{}'),
  ('a0000001-0000-0000-0000-000000000003', 'corrective_actions', 'Corrective Actions', 'الإجراءات التصحيحية', 'text', 3, true, '{}')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. REPORTS
-- ============================================================
INSERT INTO reports (id, template_id, project_id, title_en, report_date, report_data, status, created_by, created_at) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Daily Report - Foundation Work', CURRENT_DATE - 5, '{"work_description": "Completed excavation for section A, poured concrete for footings", "materials_used": [{"material": "Concrete Grade 40", "quantity": 120, "unit": "m³"}, {"material": "Rebar 16mm", "quantity": 4500, "unit": "kg"}], "issues": "Minor delay due to rebar delivery"}'::jsonb, 'submitted', '995156b6-0c91-4307-a4e7-117901f76661', CURRENT_DATE - 5),
  ('b0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'QC Inspection - Column Reinforcement', CURRENT_DATE - 3, '{"inspection_type": "Dimensional", "result": "Pass", "findings": "All columns within tolerance ±5mm"}'::jsonb, 'submitted', 'd6ea23ec-259d-46ee-9cbc-b665d9c6e588', CURRENT_DATE - 3),
  ('b0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000003', 'e7b36d5d-7cf2-4e3b-bebd-8b1d95ec5ca4', 'HSE Weekly Inspection - West Tower', CURRENT_DATE - 1, '{"area_inspected": "Floor 5-8, scaffolding area", "hazards": true, "corrective_actions": "Repair damaged guardrail on floor 6, replace worn safety harness"}'::jsonb, 'under_review', '668adee7-943e-4917-a0ee-25bacbf45b24', CURRENT_DATE - 1)
ON CONFLICT (id) DO NOTHING;

-- Report tracking entries
INSERT INTO report_tracking (report_id, event_type, event_data, created_by) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'submitted', '{"comments": "Submitted for review"}'::jsonb, '995156b6-0c91-4307-a4e7-117901f76661'),
  ('b0000001-0000-0000-0000-000000000002', 'submitted', '{"comments": "QC inspection completed"}'::jsonb, 'd6ea23ec-259d-46ee-9cbc-b665d9c6e588'),
  ('b0000001-0000-0000-0000-000000000003', 'submitted', '{"comments": "HSE weekly inspection"}'::jsonb, '668adee7-943e-4917-a0ee-25bacbf45b24')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. DAILY REPORTS (with template integration)
-- ============================================================
INSERT INTO daily_reports (project_id, report_date, title, weather, temperature, labor_count, equipment_count, summary, created_by, template_id, extra_data) VALUES
  ('11111111-0000-0000-0000-000000000001', CURRENT_DATE - 2, 'Foundation Pour Day 4', 'Sunny', '38', 45, 12, 'Completed concrete pour for section B. Ready for curing.', '2166c66a-5483-4446-b3c3-c9d3687f5229', 'a0000001-0000-0000-0000-000000000001', '{"materials_used": [{"material": "Cement", "quantity": 200, "unit": "bags"}, {"material": "Aggregate", "quantity": 50, "unit": "m³"}], "issues": "None"}'),
  ('11111111-0000-0000-0000-000000000002', CURRENT_DATE - 1, 'Villa Roof Tiling', 'Clear', '36', 22, 5, 'Continued roof tile installation for villas 3-5.', 'ec204882-e65a-406b-a0ea-a636a4f65d91', 'a0000001-0000-0000-0000-000000000001', '{"materials_used": [{"material": "Roof Tiles", "quantity": 800, "unit": "pcs"}], "issues": "Minor material shortage - ordered more"}'),
  ('11111111-0000-0000-0000-000000000003', CURRENT_DATE, 'Steel Structure Assembly', 'Windy', '34', 30, 8, 'Assembled steel frames for the eastern wing.', '995156b6-0c91-4307-a4e7-117901f76661', NULL, '{}')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. TECHNICAL TICKETS (with comments and references)
-- ============================================================
INSERT INTO technical_tickets (id, project_id, ticket_no, ticket_type, title_en, title_ar, description, priority, status, requested_by, assigned_to, due_date, created_at) VALUES
  ('c0000001-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'RFI-001', 'rfi', 'Request for Information - Foundation Depth', 'طلب معلومات - عمق الأساسات', 'Need clarification on foundation depth for section B as per drawing revision 3.', 'high', 'in_progress', 'ec204882-e65a-406b-a0ea-a636a4f65d91', '1121003f-c051-42bf-b19b-868c761f5b32', CURRENT_DATE + 7, CURRENT_DATE - 10),
  ('c0000001-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'SD-001', 'shop_drawing_review', 'Shop Drawing Review - Structural Steel', 'مراجعة المخططات التنفيذية - الهيكل الحديدي', 'Please review the attached shop drawings for structural steel connections.', 'medium', 'under_review', '995156b6-0c91-4307-a4e7-117901f76661', '1121003f-c051-42bf-b19b-868c761f5b32', CURRENT_DATE + 14, CURRENT_DATE - 7),
  ('c0000001-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', 'SI-001', 'site_instruction', 'Site Instruction - Access Road Modification', 'تعليمات موقع - تعديل طريق الوصول', 'Modify access road alignment as per attached sketch to avoid underground utilities.', 'urgent', 'open', '2166c66a-5483-4446-b3c3-c9d3687f5229', 'ec204882-e65a-406b-a0ea-a636a4f65d91', CURRENT_DATE + 3, CURRENT_DATE - 2),
  ('c0000001-0000-0000-0000-000000000004', 'e7b36d5d-7cf2-4e3b-bebd-8b1d95ec5ca4', 'MS-001', 'method_statement_review', 'Method Statement - High Rise Glazing', 'بيان الطريقة - تركيب الزجاج للأبراج العالية', 'Submit method statement for curtain wall installation on floors 10-20.', 'medium', 'open', 'd6ea23ec-259d-46ee-9cbc-b665d9c6e588', NULL, CURRENT_DATE + 21, CURRENT_DATE - 1),
  ('c0000001-0000-0000-0000-000000000005', '90973686-3891-4bf3-9111-d4b47acd832c', 'TQ-001', 'technical_query', 'Technical Query - HVAC Duct Layout', 'استفسار فني - تخطيط مجاري الهواء', 'HVAC duct layout conflicts with structural beams on floor 3. Request alternative routing.', 'high', 'resolved', 'ec204882-e65a-406b-a0ea-a636a4f65d91', '995156b6-0c91-4307-a4e7-117901f76661', CURRENT_DATE - 2, CURRENT_DATE - 15)
ON CONFLICT (project_id, ticket_no) DO NOTHING;

-- Ticket comments


-- ============================================================
-- 5. USER ACTIVITY LOG
-- ============================================================
INSERT INTO user_activity_log (user_id, action_type, entity_type, entity_id, metadata, created_at) VALUES
  ('2166c66a-5483-4446-b3c3-c9d3687f5229', 'login', 'session', NULL, '{}'::jsonb, CURRENT_DATE - 30),
  ('2166c66a-5483-4446-b3c3-c9d3687f5229', 'create_report', 'daily_reports', NULL, '{"project": "Al Noor Tower"}'::jsonb, CURRENT_DATE - 2),
  ('2166c66a-5483-4446-b3c3-c9d3687f5229', 'create_ticket', 'technical_tickets', 'c0000001-0000-0000-0000-000000000003', '{"ticket_no": "SI-001"}'::jsonb, CURRENT_DATE - 2),
  ('995156b6-0c91-4307-a4e7-117901f76661', 'login', 'session', NULL, '{}'::jsonb, CURRENT_DATE - 1),
  ('995156b6-0c91-4307-a4e7-117901f76661', 'submit_report', 'reports', 'b0000001-0000-0000-0000-000000000001', '{"title": "Daily Report - Foundation Work"}'::jsonb, CURRENT_DATE - 5),
  ('995156b6-0c91-4307-a4e7-117901f76661', 'create_ticket', 'technical_tickets', 'c0000001-0000-0000-0000-000000000002', '{"ticket_no": "SD-001"}'::jsonb, CURRENT_DATE - 7),
  ('ec204882-e65a-406b-a0ea-a636a4f65d91', 'login', 'session', NULL, '{}'::jsonb, CURRENT_DATE),
  ('ec204882-e65a-406b-a0ea-a636a4f65d91', 'create_daily_report', 'daily_reports', NULL, '{"project": "Green Valley"}'::jsonb, CURRENT_DATE - 1),
  ('d6ea23ec-259d-46ee-9cbc-b665d9c6e588', 'login', 'session', NULL, '{}'::jsonb, CURRENT_DATE - 3),
  ('d6ea23ec-259d-46ee-9cbc-b665d9c6e588', 'submit_report', 'reports', 'b0000001-0000-0000-0000-000000000002', '{"title": "QC Inspection"}'::jsonb, CURRENT_DATE - 3)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. USER SESSIONS
-- ============================================================
INSERT INTO user_sessions (user_id, ip_address, user_agent, device_info, location, is_active, last_active_at, started_at) VALUES
  ('2166c66a-5483-4446-b3c3-c9d3687f5229', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0', 'Windows PC - Chrome', 'Riyadh, Saudi Arabia', true, CURRENT_TIMESTAMP, CURRENT_DATE - 30),
  ('2166c66a-5483-4446-b3c3-c9d3687f5229', '10.0.0.50', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148', 'iPhone 15 - Safari', 'Riyadh, Saudi Arabia', false, CURRENT_DATE - 2, CURRENT_DATE - 15),
  ('995156b6-0c91-4307-a4e7-117901f76661', '192.168.1.102', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/120.0', 'Windows PC - Edge', 'Jeddah, Saudi Arabia', true, CURRENT_TIMESTAMP, CURRENT_DATE - 1),
  ('ec204882-e65a-406b-a0ea-a636a4f65d91', '192.168.1.105', 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0', 'Linux - Chrome', 'Dammam, Saudi Arabia', true, CURRENT_TIMESTAMP, CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. USER INVITATIONS
-- ============================================================
INSERT INTO user_invitations (email, token, full_name_en, full_name_ar, phone, role, invited_by, status, expires_at, created_at) VALUES
  ('new.engineer@alfanar.com', gen_random_uuid()::text, 'Omar Al-Harbi', 'عمر الحربي', '+966501234567', 'engineer', '2166c66a-5483-4446-b3c3-c9d3687f5229', 'pending', CURRENT_DATE + 20, CURRENT_DATE - 10),
  ('surveyor@alfanar.com', gen_random_uuid()::text, 'Hassan Al-Anzi', 'حسن العنزي', '+966507654321', 'engineer', '2166c66a-5483-4446-b3c3-c9d3687f5229', 'accepted', CURRENT_DATE - 5, CURRENT_DATE - 25),
  ('rejected.invite@test.com', gen_random_uuid()::text, 'Test Rejected', 'مرفوض', '+966500000000', 'client', '995156b6-0c91-4307-a4e7-117901f76661', 'expired', CURRENT_DATE - 10, CURRENT_DATE - 40)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. REPORT APPROVAL STAGES
-- ============================================================
INSERT INTO report_approval_stages (template_id, stage_order, stage_name_en, stage_name_ar, approver_user_id, approver_role, required_signatures) VALUES
  ('a0000001-0000-0000-0000-000000000001', 1, 'Project Manager Review', 'مراجعة مدير المشروع', '995156b6-0c91-4307-a4e7-117901f76661', 'project_manager', 1),
  ('a0000001-0000-0000-0000-000000000001', 2, 'Admin Approval', 'موافقة الإدارة', '2166c66a-5483-4446-b3c3-c9d3687f5229', 'admin', 1),
  ('a0000001-0000-0000-0000-000000000002', 1, 'QC Lead Review', 'مراجعة رئيس مراقبة الجودة', 'd6ea23ec-259d-46ee-9cbc-b665d9c6e588', 'quality', 1),
  ('a0000001-0000-0000-0000-000000000003', 1, 'HSE Manager Review', 'مراجعة مدير السلامة', '668adee7-943e-4917-a0ee-25bacbf45b24', 'hse', 1)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. REPORT APPROVALS
-- ============================================================
INSERT INTO report_approvals (report_id, stage_id, approver_id, status, comments, signed_at)
SELECT 'b0000001-0000-0000-0000-000000000001', id, '995156b6-0c91-4307-a4e7-117901f76661', 'approved', 'Report looks good. Proceed.', CURRENT_DATE - 4
FROM report_approval_stages
WHERE template_id = 'a0000001-0000-0000-0000-000000000001' AND stage_order = 1
ON CONFLICT DO NOTHING;
