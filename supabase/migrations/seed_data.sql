-- Seed Data: Core Modules & Default Statuses
-- Run after schema migration

-- 1. System Settings
INSERT INTO system_settings (key, value) VALUES
  ('company_name', '"شركة البناء للتطوير العقاري"'),
  ('app_name', '"ERP Construction"'),
  ('default_language', '"en"'),
  ('primary_color', '"#2563eb"'),
  ('secondary_color', '"#f59e0b"'),
  ('theme', '"light"')
ON CONFLICT (key) DO NOTHING;

-- 2. Modules
INSERT INTO modules (code, name_en, name_ar, icon, "order", is_enabled) VALUES
  ('projects', 'Projects', 'المشاريع', 'Building2', 1, true),
  ('units', 'Units', 'الوحدات', 'Grid3X3', 2, true),
  ('execution', 'Work Execution', 'التنفيذ', 'HardHat', 3, true),
  ('quality', 'Quality & NCR', 'الجودة', 'ShieldCheck', 4, true),
  ('hse', 'HSE', 'السلامة', 'ShieldCheck', 5, true),
  ('hr', 'HR & Payroll', 'الموارد البشرية', 'Users', 6, true),
  ('procurement', 'Procurement', 'المشتريات', 'ShoppingCart', 7, true),
  ('finance', 'Finance', 'المالية', 'DollarSign', 8, true),
  ('sales', 'Sales', 'المبيعات', 'DollarSign', 9, true),
  ('technical', 'Technical Office', 'المكتب الفني', 'Wrench', 10, true),
  ('documents', 'Documents', 'الوثائق', 'FolderOpen', 11, true),
  ('approvals', 'Approvals', 'الموافقات', 'CheckSquare', 12, true),
  ('settings', 'System Settings', 'الإعدادات', 'Settings', 13, true)
ON CONFLICT (code) DO NOTHING;

-- 3. Default Statuses per module

-- Projects Statuses
INSERT INTO status_definitions (module_code, status_code, label_en, label_ar, color, "order", is_default, is_final) VALUES
  ('projects', 'planning', 'Planning', 'تخطيط', '#3b82f6', 1, true, false),
  ('projects', 'active', 'Active', 'نشط', '#16a34a', 2, false, false),
  ('projects', 'on_hold', 'On Hold', 'معلق', '#f59e0b', 3, false, false),
  ('projects', 'completed', 'Completed', 'مكتمل', '#6b7280', 4, false, true),
  ('projects', 'cancelled', 'Cancelled', 'ملغي', '#dc2626', 5, false, true);

-- Execution / WIR Statuses
INSERT INTO status_definitions (module_code, status_code, label_en, label_ar, color, "order", is_default, is_final) VALUES
  ('execution', 'draft', 'Draft', 'مسودة', '#9ca3af', 1, true, false),
  ('execution', 'submitted', 'Submitted', 'مقدم', '#3b82f6', 2, false, false),
  ('execution', 'approved', 'Approved', 'معتمد', '#16a34a', 3, false, true),
  ('execution', 'rejected', 'Rejected', 'مرفوض', '#dc2626', 4, false, true),
  ('execution', 'ncr', 'Non-Conformance', 'عدم مطابقة', '#f59e0b', 5, false, false),
  ('execution', 'closed', 'Closed', 'مغلق', '#6b7280', 6, false, true);

-- Quality Statuses (same as execution for simplicity)
INSERT INTO status_definitions (module_code, status_code, label_en, label_ar, color, "order", is_default, is_final)
SELECT 'quality', status_code, label_en, label_ar, color, "order", is_default, is_final
FROM status_definitions WHERE module_code = 'execution';

-- HSE Statuses
INSERT INTO status_definitions (module_code, status_code, label_en, label_ar, color, "order", is_default, is_final) VALUES
  ('hse', 'reported', 'Reported', 'مبلغ', '#f59e0b', 1, true, false),
  ('hse', 'investigating', 'Investigating', 'قيد التحقيق', '#3b82f6', 2, false, false),
  ('hse', 'action_taken', 'Action Taken', 'تم الإجراء', '#8b5cf6', 3, false, false),
  ('hse', 'closed', 'Closed', 'مغلق', '#16a34a', 4, false, true);

-- HR Statuses
INSERT INTO status_definitions (module_code, status_code, label_en, label_ar, color, "order", is_default, is_final) VALUES
  ('hr', 'active', 'Active', 'نشط', '#16a34a', 1, true, false),
  ('hr', 'suspended', 'Suspended', 'موقوف', '#f59e0b', 2, false, false),
  ('hr', 'terminated', 'Terminated', 'منتهي', '#dc2626', 3, false, true),
  ('hr', 'on_leave', 'On Leave', 'في إجازة', '#3b82f6', 4, false, false);

-- Procurement Statuses
INSERT INTO status_definitions (module_code, status_code, label_en, label_ar, color, "order", is_default, is_final) VALUES
  ('procurement', 'draft', 'Draft', 'مسودة', '#9ca3af', 1, true, false),
  ('procurement', 'pending_approval', 'Pending Approval', 'بإنتظار الإعتماد', '#f59e0b', 2, false, false),
  ('procurement', 'approved', 'Approved', 'معتمد', '#16a34a', 3, false, false),
  ('procurement', 'ordered', 'Ordered', 'تم الطلب', '#3b82f6', 4, false, false),
  ('procurement', 'received', 'Received', 'مستلم', '#8b5cf6', 5, false, true),
  ('procurement', 'cancelled', 'Cancelled', 'ملغي', '#dc2626', 6, false, true);

-- Technical / RFI Statuses
INSERT INTO status_definitions (module_code, status_code, label_en, label_ar, color, "order", is_default, is_final) VALUES
  ('technical', 'open', 'Open', 'مفتوح', '#f59e0b', 1, true, false),
  ('technical', 'in_progress', 'In Progress', 'قيد التنفيذ', '#3b82f6', 2, false, false),
  ('technical', 'answered', 'Answered', 'تمت الإجابة', '#16a34a', 3, false, true),
  ('technical', 'closed', 'Closed', 'مغلق', '#6b7280', 4, false, true);

-- Sales Statuses
INSERT INTO status_definitions (module_code, status_code, label_en, label_ar, color, "order", is_default, is_final) VALUES
  ('sales', 'new', 'New', 'جديد', '#3b82f6', 1, true, false),
  ('sales', 'contacted', 'Contacted', 'تم التواصل', '#f59e0b', 2, false, false),
  ('sales', 'negotiating', 'Negotiating', 'قيد التفاوض', '#8b5cf6', 3, false, false),
  ('sales', 'reserved', 'Reserved', 'محجوز', '#16a34a', 4, false, false),
  ('sales', 'sold', 'Sold', 'مباع', '#059669', 5, false, true),
  ('sales', 'lost', 'Lost', 'ضائع', '#dc2626', 6, false, true);

-- Unit Statuses (separate module)
INSERT INTO status_definitions (module_code, status_code, label_en, label_ar, color, "order", is_default, is_final) VALUES
  ('units', 'available', 'Available', 'متاح', '#16a34a', 1, true, false),
  ('units', 'reserved', 'Reserved', 'محجوز', '#f59e0b', 2, false, false),
  ('units', 'sold', 'Sold', 'مباع', '#059669', 3, false, true),
  ('units', 'handed_over', 'Handed Over', 'تم التسليم', '#6b7280', 4, false, true);

-- 4. Default Workflow: Execution
DO $$
DECLARE
  wf_id UUID;
BEGIN
  INSERT INTO workflow_definitions (module_code, name_en, name_ar, is_default)
  VALUES ('execution', 'Standard WIR Workflow', 'سير عمل التفتيش القياسي', true)
  RETURNING id INTO wf_id;

  INSERT INTO workflow_steps (workflow_id, step_order, from_status_code, to_status_code, allowed_roles, action_label_en, action_label_ar) VALUES
    (wf_id, 1, 'draft', 'submitted', '{engineer,quality,main_contractor}', 'Submit for Inspection', 'تقديم للتفتيش'),
    (wf_id, 2, 'submitted', 'approved', '{quality,engineer,consultant}', 'Approve', 'اعتماد'),
    (wf_id, 3, 'submitted', 'rejected', '{quality,engineer,consultant}', 'Reject', 'رفض'),
    (wf_id, 4, 'submitted', 'ncr', '{quality,engineer,consultant}', 'Raise NCR', 'رفع عدم مطابقة'),
    (wf_id, 5, 'ncr', 'closed', '{engineer,quality}', 'Close NCR (Rework Done)', 'إغلاق عدم المطابقة');
END $$;

-- 5. Default KPI Definitions
INSERT INTO kpi_definitions (module_code, code, name_en, name_ar, formula_type, config_json, unit) VALUES
  ('execution', 'wir_total', 'Total WIRs', 'إجمالي طلبات التفتيش', 'count', '{"table": "work_requests"}', 'count'),
  ('execution', 'wir_acceptance_rate', 'WIR Acceptance Rate', 'نسبة قبول طلبات التفتيش', 'ratio', '{"table": "work_requests", "numerator_field": "status", "denominator_field": "id"}', '%'),
  ('execution', 'ncr_rate', 'NCR Rate', 'نسبة عدم المطابقة', 'ratio', '{"table": "work_requests", "numerator_field": "is_ncr", "denominator_field": "id"}', '%'),
  ('hse', 'incident_count', 'Total Incidents', 'إجمالي الحوادث', 'count', '{"table": "safety_incidents"}', 'count'),
  ('hse', 'safety_score', 'Safety Score', 'معدل السلامة', 'custom', '{"static_value": 85}', 'score'),
  ('projects', 'project_completion', 'Project Completion Rate', 'نسبة إنجاز المشاريع', 'ratio', '{"table": "projects", "numerator_field": "progress_percent", "denominator_field": "id"}', '%'),
  ('sales', 'units_sold', 'Units Sold', 'الوحدات المباعة', 'count', '{"table": "unit_sales", "filter": {"status": "completed"}}', 'count'),
  ('sales', 'collection_rate', 'Collection Rate', 'نسبة التحصيل', 'ratio', '{"table": "collections_schedule", "numerator_field": "paid_amount", "denominator_field": "amount"}', '%');

-- 6. Demo Project & Units
INSERT INTO projects (project_code, name_en, name_ar, project_type, status, is_active)
VALUES ('DEMO-001', 'Demo Residential Tower', 'برج سكني تجريبي', 'residential', 'active', true);

INSERT INTO units (project_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, currency)
SELECT
  p.id, 'A-101', 'apartment', 1, 120.50, 2, 2, 'available', 850000, 'SAR'
FROM projects p WHERE p.project_code = 'DEMO-001';

INSERT INTO units (project_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, currency)
SELECT
  p.id, 'A-102', 'apartment', 1, 95.00, 1, 1, 'available', 620000, 'SAR'
FROM projects p WHERE p.project_code = 'DEMO-001';

INSERT INTO units (project_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, currency)
SELECT
  p.id, 'B-201', 'villa', 2, 250.00, 3, 3, 'available', 1500000, 'SAR'
FROM projects p WHERE p.project_code = 'DEMO-001';

INSERT INTO units (project_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, currency)
SELECT
  p.id, 'B-202', 'villa', 2, 180.00, 3, 2, 'reserved', 1200000, 'SAR'
FROM projects p WHERE p.project_code = 'DEMO-001';

INSERT INTO units (project_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, currency)
SELECT
  p.id, 'C-301', 'penthouse', 3, 300.00, 4, 4, 'sold', 2500000, 'SAR'
FROM projects p WHERE p.project_code = 'DEMO-001';
