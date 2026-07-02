-- ============================================================
-- Seed demo data for new tables (Phase 1-6: 051-056)
-- Safe to re-run: uses ON CONFLICT / WHERE NOT EXISTS
-- ============================================================

-- 1. Procurement Categories (already seeded in 051, ensure present)
INSERT INTO procurement_categories (code, name_en, name_ar) VALUES
  ('RAW_MAT', 'Raw Materials', 'المواد الخام'),
  ('EQUIP', 'Equipment & Machinery', 'المعدات والآلات'),
  ('SERVICES', 'Services', 'الخدمات'),
  ('IT', 'IT & Software', 'تقنية المعلومات والبرمجيات'),
  ('OFFICE', 'Office Supplies', 'اللوازم المكتبية'),
  ('SUBCONTRACT', 'Subcontracting', 'المقاولات الباطنة'),
  ('SAFETY', 'Safety & PPE', 'السلامة والمعدات الوقائية'),
  ('LOGISTICS', 'Logistics & Transport', 'الخدمات اللوجستية والنقل'),
  ('CONSULTING', 'Consulting', 'الاستشارات'),
  ('MAINTENANCE', 'Maintenance & Repairs', 'الصيانة والإصلاح')
ON CONFLICT (code) DO NOTHING;

-- 2. Purchase Requisitions (requires a project and user)
DO $$
DECLARE
  v_project_id UUID;
  v_user_id UUID;
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_project_id FROM projects LIMIT 1;
  SELECT id INTO v_user_id FROM user_profiles WHERE role = 'procurement' LIMIT 1;
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM user_profiles LIMIT 1;
  END IF;
  SELECT id INTO v_cat_id FROM procurement_categories WHERE code = 'RAW_MAT' LIMIT 1;

  IF v_project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM purchase_requisitions LIMIT 1) THEN
    INSERT INTO purchase_requisitions (pr_no, title_en, title_ar, project_id, department, requester_id, urgency, category_id, total_estimated, currency, status)
    VALUES
      ('PR-2026-001', 'Concrete Order - Foundation Phase', 'طلب خرسانة - مرحلة الأساسات', v_project_id, 'Engineering', v_user_id, 'high', v_cat_id, 150000, 'SAR', 'approved'),
      ('PR-2026-002', 'Steel Reinforcement Bars', 'قضبان تسليح فولاذية', v_project_id, 'Procurement', v_user_id, 'critical', v_cat_id, 320000, 'SAR', 'pending_approval'),
      ('PR-2026-003', 'Office Supplies - Q2', 'لوازم مكتبية - الربع الثاني', v_project_id, 'Administration', v_user_id, 'low', (SELECT id FROM procurement_categories WHERE code = 'OFFICE' LIMIT 1), 8500, 'SAR', 'draft');

    INSERT INTO pr_line_items (pr_id, description_en, quantity, unit, estimated_unit_price)
    SELECT id, 'Ready-mix concrete C30', 500, 'm³', 300
    FROM purchase_requisitions WHERE pr_no = 'PR-2026-001';
    INSERT INTO pr_line_items (pr_id, description_en, quantity, unit, estimated_unit_price)
    SELECT id, 'Rebar 16mm', 50, 'tons', 6400
    FROM purchase_requisitions WHERE pr_no = 'PR-2026-002';
  END IF;
END $$;

-- 3. Sourcing Events
DO $$
DECLARE
  v_project_id UUID;
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_project_id FROM projects LIMIT 1;
  SELECT id INTO v_cat_id FROM procurement_categories WHERE code = 'RAW_MAT' LIMIT 1;

  IF v_project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sourcing_events LIMIT 1) THEN
    INSERT INTO sourcing_events (event_no, title_en, title_ar, type, status, category_id, project_id, close_date, budget_range_min, currency)
    VALUES
      ('SRC-2026-001', 'Concrete Supply Tender', 'مناقصة توريد الخرسانة', 'rfq', 'open', v_cat_id, v_project_id, CURRENT_DATE + INTERVAL '30 days', 500000, 'SAR'),
      ('SRC-2026-002', 'Steel Rebars RFQ', 'طلب عرض أسعار حديد التسليح', 'rfi', 'open', v_cat_id, v_project_id, CURRENT_DATE + INTERVAL '45 days', 800000, 'SAR'),
      ('SRC-2026-003', 'General Construction Services', 'خدمات البناء العامة', 'auction', 'closed', (SELECT id FROM procurement_categories WHERE code = 'SUBCONTRACT' LIMIT 1), v_project_id, CURRENT_DATE - INTERVAL '5 days', 2000000, 'SAR');
  END IF;
END $$;

-- 4. Procurement Contracts
DO $$
DECLARE
  v_supplier_id UUID;
  v_project_id UUID;
BEGIN
  SELECT id INTO v_supplier_id FROM suppliers LIMIT 1;
  SELECT id INTO v_project_id FROM projects LIMIT 1;

  IF v_supplier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM procurement_contracts LIMIT 1) THEN
    INSERT INTO procurement_contracts (contract_no, title_en, title_ar, supplier_id, project_id, type, status, total_value, currency, start_date, end_date, payment_terms)
    VALUES
      ('PC-2026-001', 'Concrete Supply Contract', 'عقد توريد الخرسانة', v_supplier_id, v_project_id, 'purchase', 'active', 450000, 'SAR', CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 'Net 60'),
      ('PC-2026-002', 'Steel Materials Framework', 'إطار عمل المواد الفولاذية', v_supplier_id, v_project_id, 'framework', 'draft', 1200000, 'SAR', CURRENT_DATE + INTERVAL '15 days', CURRENT_DATE + INTERVAL '1 year', 'Net 90');
  END IF;
END $$;

-- 5. Supplier Evaluations
DO $$
DECLARE
  v_supplier_id UUID;
  v_user_id UUID;
BEGIN
  SELECT id INTO v_supplier_id FROM suppliers LIMIT 1;
  SELECT id INTO v_user_id FROM user_profiles WHERE role = 'procurement' LIMIT 1;
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM user_profiles LIMIT 1;
  END IF;

  IF v_supplier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM supplier_evaluations LIMIT 1) THEN
    INSERT INTO supplier_evaluations (supplier_id, evaluated_by, evaluation_date, period, quality_score, delivery_score, price_score, responsiveness_score, compliance_score, comments)
    VALUES
      (v_supplier_id, v_user_id, CURRENT_DATE - INTERVAL '15 days', 'quarterly', 4.5, 4.0, 3.5, 4.5, 5.0, 'Good performance overall. Delivery times could improve.'),
      (v_supplier_id, v_user_id, CURRENT_DATE - INTERVAL '3 months', 'quarterly', 3.5, 3.0, 4.0, 3.5, 4.0, 'Average quarter. Quality was consistent but delivery delays noted.');
  END IF;
END $$;

-- 6. Procurement Budgets
DO $$
DECLARE
  v_cat_id UUID;
  v_project_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM procurement_categories WHERE code = 'RAW_MAT' LIMIT 1;
  SELECT id INTO v_project_id FROM projects LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM procurement_budgets LIMIT 1) THEN
    INSERT INTO procurement_budgets (fiscal_year, category_id, project_id, allocated_amount, spent_amount, currency)
    VALUES
      (2026, v_cat_id, v_project_id, 5000000, 1250000, 'SAR'),
      (2026, (SELECT id FROM procurement_categories WHERE code = 'EQUIP' LIMIT 1), v_project_id, 3000000, 800000, 'SAR'),
      (2026, (SELECT id FROM procurement_categories WHERE code = 'SERVICES' LIMIT 1), v_project_id, 1000000, 200000, 'SAR');
  END IF;
END $$;

-- 7. Catalog Items
DO $$
DECLARE
  v_supplier_id UUID;
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_supplier_id FROM suppliers LIMIT 1;
  SELECT id INTO v_cat_id FROM procurement_categories WHERE code = 'RAW_MAT' LIMIT 1;

  IF v_supplier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM catalog_items LIMIT 1) THEN
    INSERT INTO catalog_items (supplier_id, category_id, item_code, name_en, name_ar, unit, unit_price, currency, lead_time_days) VALUES
      (v_supplier_id, v_cat_id, 'CONC-C30', 'Ready-mix Concrete C30', 'خرسانة جاهزة C30', 'm³', 285, 'SAR', 2),
      (v_supplier_id, v_cat_id, 'REBAR-16', 'Steel Rebar 16mm', 'حديد تسليح 16 مم', 'ton', 6200, 'SAR', 5),
      (v_supplier_id, v_cat_id, 'CEMENT-OPC', 'Ordinary Portland Cement', 'أسمنت بورتلاند عادي', 'ton', 380, 'SAR', 3),
      (v_supplier_id, (SELECT id FROM procurement_categories WHERE code = 'SAFETY' LIMIT 1), 'PPE-HELMET', 'Safety Helmet', 'خوذة سلامة', 'pc', 45, 'SAR', 7),
      (v_supplier_id, (SELECT id FROM procurement_categories WHERE code = 'OFFICE' LIMIT 1), 'OFF-PAPER-A4', 'A4 Copy Paper (box)', 'ورق تصوير A4 (كرتونة)', 'box', 85, 'SAR', 2);
  END IF;
END $$;

-- 8. Chart of Accounts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM chart_of_accounts LIMIT 1) THEN
    INSERT INTO chart_of_accounts (account_code, name_en, name_ar, type, is_active) VALUES
      ('1000', 'Cash & Cash Equivalents', 'النقدية وما يعادلها', 'asset', true),
      ('1100', 'Accounts Receivable', 'الحسابات المدينة', 'asset', true),
      ('1200', 'Inventory', 'المخزون', 'asset', true),
      ('1300', 'Fixed Assets', 'الأصول الثابتة', 'asset', true),
      ('2000', 'Accounts Payable', 'الحسابات الدائنة', 'liability', true),
      ('2100', 'Accrued Expenses', 'المصروفات المستحقة', 'liability', true),
      ('3000', 'Shareholder Equity', 'حقوق المساهمين', 'equity', true),
      ('4000', 'Income - Construction', 'الإيرادات - المقاولات', 'income', true),
      ('4100', 'Income - Consulting', 'الإيرادات - الاستشارات', 'income', true),
      ('5000', 'Cost of Materials', 'تكلفة المواد', 'expense', true),
      ('5100', 'Labor Costs', 'تكاليف العمالة', 'expense', true),
      ('5200', 'Equipment Costs', 'تكاليف المعدات', 'expense', true),
      ('5300', 'Subcontractor Costs', 'تكاليف المقاولين الباطن', 'expense', true),
      ('5400', 'Admin Expenses', 'المصروفات الإدارية', 'expense', true),
      ('6000', 'Other Income', 'إيرادات أخرى', 'income', true),
      ('7000', 'Tax Expenses', 'مصروفات ضريبية', 'expense', true);
  END IF;
END $$;

-- 9. Journal Entries
DO $$
DECLARE
  v_coa_asset UUID;
  v_coa_revenue UUID;
  v_coa_expense UUID;
BEGIN
  SELECT id INTO v_coa_asset FROM chart_of_accounts WHERE account_code = '1100' LIMIT 1;
  SELECT id INTO v_coa_revenue FROM chart_of_accounts WHERE account_code = '4000' LIMIT 1;
  SELECT id INTO v_coa_expense FROM chart_of_accounts WHERE account_code = '5000' LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM journal_entries LIMIT 1) THEN
    INSERT INTO journal_entries (entry_no, entry_date, description, status, reference_type, reference_id)
    VALUES
      ('JE-2026-001', CURRENT_DATE - INTERVAL '30 days', 'Monthly revenue recognition - Project Alpha / إثبات الإيرادات الشهرية - المشروع ألف', 'posted', NULL, NULL),
      ('JE-2026-002', CURRENT_DATE - INTERVAL '15 days', 'Material purchase - Concrete order / شراء مواد - طلب الخرسانة', 'draft', NULL, NULL);

    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    SELECT je.id, v_coa_revenue, 500000, 0, 'Revenue recognition'
    FROM journal_entries je WHERE je.entry_no = 'JE-2026-001';
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    SELECT je.id, v_coa_asset, 0, 500000, 'Accounts receivable'
    FROM journal_entries je WHERE je.entry_no = 'JE-2026-001';
  END IF;
END $$;

-- 10. Currency Rates
INSERT INTO currency_rates (from_currency, to_currency, rate, rate_date) VALUES
  ('USD', 'SAR', 3.75, CURRENT_DATE),
  ('EUR', 'SAR', 4.10, CURRENT_DATE),
  ('GBP', 'SAR', 4.78, CURRENT_DATE),
  ('AED', 'SAR', 1.02, CURRENT_DATE),
  ('EGP', 'SAR', 0.12, CURRENT_DATE)
ON CONFLICT (from_currency, to_currency, rate_date) DO NOTHING;

-- 11. Tax Rates
INSERT INTO tax_rates (tax_code, name_en, name_ar, rate, is_default) VALUES
  ('VAT-15', 'VAT 15%', 'ضريبة القيمة المضافة 15%', 15.00, true),
  ('VAT-05', 'VAT 5%', 'ضريبة القيمة المضافة 5%', 5.00, false),
  ('WITHHOLD-5', 'Withholding Tax 5%', 'ضريبة الخصم 5%', 5.00, false),
  ('ZERO', 'Zero Rated', 'نسبة صفرية', 0.00, false)
ON CONFLICT DO NOTHING;

-- 12. Expense Claims
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM user_profiles WHERE role = 'procurement' LIMIT 1;
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM user_profiles LIMIT 1;
  END IF;

  IF v_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM expense_claims LIMIT 1) THEN
    INSERT INTO expense_claims (claim_no, employee_id, title, total_amount, currency, status)
    VALUES
      ('EC-2026-001', v_user_id, 'Site visit travel expenses / مصاريف سفر زيارة الموقع', 2850.50, 'SAR', 'approved'),
      ('EC-2026-002', v_user_id, 'Office supply purchase / شراء لوازم مكتبية', 450.00, 'SAR', 'pending_approval');

    INSERT INTO expense_claim_items (claim_id, expense_date, description, amount, category)
    SELECT ec.id, CURRENT_DATE - INTERVAL '22 days', 'Flight ticket - Riyadh to Dubai', 1850.00, 'travel'
    FROM expense_claims ec WHERE ec.claim_no = 'EC-2026-001';
    INSERT INTO expense_claim_items (claim_id, expense_date, description, amount, category)
    SELECT ec.id, CURRENT_DATE - INTERVAL '22 days', 'Hotel - 2 nights', 850.00, 'accommodation'
    FROM expense_claims ec WHERE ec.claim_no = 'EC-2026-001';
    INSERT INTO expense_claim_items (claim_id, expense_date, description, amount, category)
    SELECT ec.id, CURRENT_DATE - INTERVAL '22 days', 'Transportation', 150.50, 'transport'
    FROM expense_claims ec WHERE ec.claim_no = 'EC-2026-001';
  END IF;
END $$;

-- 13. Saved Reports
INSERT INTO saved_reports (name_en, name_ar, report_type, config_json, is_shared) VALUES
  ('Monthly Financial Summary', 'الملخص المالي الشهري', 'financial_summary', '{"period": "monthly", "include_charts": true}', true),
  ('Procurement Spend Analysis', 'تحليل الإنفاق المشتريات', 'procurement_spend', '{"group_by": "category", "date_range": "quarter"}', true),
  ('Supplier Performance', 'أداء الموردين', 'supplier_performance', '{"rating_threshold": 3.5}', false)
ON CONFLICT DO NOTHING;

-- 14. Departments
INSERT INTO departments (code, name_en, name_ar) VALUES
  ('ENG', 'Engineering', 'الهندسة'),
  ('PROC', 'Procurement', 'المشتريات'),
  ('FIN', 'Finance', 'المالية'),
  ('HR', 'Human Resources', 'الموارد البشرية'),
  ('HSE', 'Health, Safety & Environment', 'الصحة والسلامة والبيئة'),
  ('QA', 'Quality Assurance', 'ضمان الجودة'),
  ('SALES', 'Sales & Marketing', 'المبيعات والتسويق'),
  ('ADMIN', 'Administration', 'الإدارة'),
  ('IT', 'Information Technology', 'تقنية المعلومات'),
  ('LEGAL', 'Legal Affairs', 'الشؤون القانونية')
ON CONFLICT DO NOTHING;

-- 15. Employee Contracts
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM user_profiles LIMIT 1;

  IF v_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM employee_contracts LIMIT 1) THEN
    INSERT INTO employee_contracts (employee_id, contract_no, contract_type, start_date, end_date, basic_salary, housing_allowance, transport_allowance, status)
    VALUES
      (v_user_id, 'CTR-2025-001', 'full_time', '2025-01-01', '2027-12-31', 15000, 5000, 2000, 'active'),
      (v_user_id, 'CTR-2025-002', 'full_time', '2025-03-01', '2026-12-31', 10000, 3500, 1500, 'active'),
      (v_user_id, 'CTR-2025-003', 'fixed_term', '2025-06-01', '2026-05-31', 8000, 2500, 1000, 'active');
  END IF;
END $$;

-- 16. Shift Definitions
INSERT INTO shift_definitions (code, name_en, name_ar, start_time, end_time, grace_minutes) VALUES
  ('MORNING', 'Morning Shift', 'الفترة الصباحية', '08:00', '17:00', 15),
  ('EVENING', 'Evening Shift', 'الفترة المسائية', '14:00', '22:00', 10),
  ('NIGHT', 'Night Shift', 'الفترة الليلية', '22:00', '06:00', 10),
  ('ADMIN', 'Admin Hours', 'ساعات العمل الإدارية', '09:00', '18:00', 15)
ON CONFLICT DO NOTHING;

-- 17. Employee Shifts (assign all active contract employees to morning shift)
DO $$
BEGIN
  INSERT INTO employee_shifts (employee_id, shift_id, effective_from)
  SELECT ec.employee_id, sd.id, CURRENT_DATE
  FROM employee_contracts ec
  CROSS JOIN shift_definitions sd
  WHERE sd.code = 'MORNING' AND ec.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM employee_shifts es WHERE es.employee_id = ec.employee_id)
  LIMIT 5;
END $$;

-- 18. Employee Advances
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM user_profiles LIMIT 1;

  IF v_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM employee_advances LIMIT 1) THEN
    INSERT INTO employee_advances (employee_id, advance_no, amount, reason, status, approved_at)
    VALUES
      (v_user_id, 'ADV-2026-001', 5000, 'Emergency family expenses', 'approved', CURRENT_DATE - INTERVAL '55 days'),
      (v_user_id, 'ADV-2026-002', 3000, 'School fees advance', 'pending_approval', NULL);

    INSERT INTO advance_installments (advance_id, installment_no, amount, due_date, status)
    SELECT a.id, 1, 2500, CURRENT_DATE - INTERVAL '30 days', 'paid'
    FROM employee_advances a WHERE a.advance_no = 'ADV-2026-001';
    INSERT INTO advance_installments (advance_id, installment_no, amount, due_date, status)
    SELECT a.id, 2, 2500, CURRENT_DATE + INTERVAL '30 days', 'pending'
    FROM employee_advances a WHERE a.advance_no = 'ADV-2026-001';
  END IF;
END $$;

-- 19. Employee Documents
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM user_profiles LIMIT 1;

  IF v_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM employee_documents LIMIT 1) THEN
    INSERT INTO employee_documents (employee_id, document_type, document_name, file_url, expiry_date, is_verified)
    VALUES
      (v_user_id, 'passport', 'Passport Copy / صورة جواز السفر', '/docs/passport.pdf', '2028-06-15', true),
      (v_user_id, 'national_id', 'National ID / الهوية الوطنية', '/docs/national_id.pdf', '2030-01-01', true),
      (v_user_id, 'certification', 'Professional Engineer Certificate / شهادة مهندس محترف', '/docs/cert.pdf', '2027-03-20', true),
      (v_user_id, 'medical', 'Medical Insurance Card / بطاقة التأمين الصحي', '/docs/medical.pdf', '2026-12-31', true),
      (v_user_id, 'contract', 'Signed Employment Contract / عقد العمل الموقع', '/docs/contract.pdf', NULL, true);
  END IF;
END $$;

-- 20. Notification Preferences (for first few users)
DO $$
BEGIN
  INSERT INTO notification_preferences (user_id, email_notifications, in_app_notifications)
  SELECT id, true, true FROM user_profiles
  WHERE NOT EXISTS (SELECT 1 FROM notification_preferences np WHERE np.user_id = user_profiles.id)
  LIMIT 10;
END $$;

-- 21. Default System Settings (safe to re-run: single-row upsert)
INSERT INTO system_settings (key, value) VALUES
  ('app_name', '"ERP"'),
  ('company_name', '"شركة الإنشاءات الحديثة"'),
  ('primary_color', '"#a855f7"'),
  ('secondary_color', '"#06b6d4"'),
  ('default_language', '"ar"'),
  ('theme', '"dark"'),
  ('font_family', '"Inter"'),
  ('logo_url', '""'),
  ('login_logo_url', '""'),
  ('login_message', '"نظام تخطيط موارد المؤسسات"'),
  ('favicon_url', '""'),
  ('custom_css', '""'),
  ('dashboard_widgets', '["recent_activity","budget_status","procurement_spend","quick_actions","ai_insights"]')
ON CONFLICT (key) DO NOTHING;
