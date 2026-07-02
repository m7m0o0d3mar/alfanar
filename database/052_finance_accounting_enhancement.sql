-- ============================================================
-- Phase 2: Finance & Accounting Enhancement
-- Inspired by Wafeq + Coupa (multi-currency, VAT, expense claims)
-- ============================================================

-- 1. Chart of Accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code VARCHAR(20) NOT NULL UNIQUE,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  type VARCHAR(30) NOT NULL CHECK (type IN ('asset','liability','equity','income','expense','contra_asset','contra_liability')),
  parent_id UUID REFERENCES chart_of_accounts(id),
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Journal Entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_no VARCHAR(50) NOT NULL UNIQUE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_type VARCHAR(50),
  reference_id UUID,
  description TEXT,
  currency VARCHAR(3) DEFAULT 'SAR',
  exchange_rate NUMERIC(10,4) DEFAULT 1,
  total_debit NUMERIC(15,2) DEFAULT 0,
  total_credit NUMERIC(15,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
  posted_by UUID REFERENCES user_profiles(id),
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  line_no INT DEFAULT 1,
  description TEXT,
  debit NUMERIC(15,2) DEFAULT 0,
  credit NUMERIC(15,2) DEFAULT 0,
  cost_center VARCHAR(100),
  project_id UUID REFERENCES projects(id)
);

-- 3. Expense Claims
CREATE TABLE IF NOT EXISTS expense_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_no VARCHAR(50) NOT NULL UNIQUE,
  employee_id UUID NOT NULL REFERENCES user_profiles(id),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  total_amount NUMERIC(15,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'SAR',
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','rejected','paid')),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expense_claim_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES expense_claims(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'SAR',
  receipt_url TEXT,
  notes TEXT
);

-- 4. Multi-Currency Settings
CREATE TABLE IF NOT EXISTS currency_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
  rate NUMERIC(15,6) NOT NULL,
  rate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source VARCHAR(50) DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(from_currency, to_currency, rate_date)
);

-- 5. VAT / Tax Management
CREATE TABLE IF NOT EXISTS tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_code VARCHAR(20) NOT NULL UNIQUE,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Enhanced Purchase Order (add tax, discount fields)
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tax_rate_id UUID REFERENCES tax_rates(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS shipping_address TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES user_profiles(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 7. Financial Reports (saved report configurations)
CREATE TABLE IF NOT EXISTS saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type VARCHAR(50) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  config_json JSONB DEFAULT '{}',
  created_by UUID REFERENCES user_profiles(id),
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_claim_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coa_read" ON chart_of_accounts;
CREATE POLICY "coa_read" ON chart_of_accounts FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "coa_insert" ON chart_of_accounts;
CREATE POLICY "coa_insert" ON chart_of_accounts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "coa_update" ON chart_of_accounts;
CREATE POLICY "coa_update" ON chart_of_accounts FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "je_read" ON journal_entries;
CREATE POLICY "je_read" ON journal_entries FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "je_insert" ON journal_entries;
CREATE POLICY "je_insert" ON journal_entries FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "je_update" ON journal_entries;
CREATE POLICY "je_update" ON journal_entries FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "jel_read" ON journal_entry_lines;
CREATE POLICY "jel_read" ON journal_entry_lines FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "jel_insert" ON journal_entry_lines;
CREATE POLICY "jel_insert" ON journal_entry_lines FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "jel_update" ON journal_entry_lines;
CREATE POLICY "jel_update" ON journal_entry_lines FOR UPDATE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "jel_delete" ON journal_entry_lines;
CREATE POLICY "jel_delete" ON journal_entry_lines FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ec_read" ON expense_claims;
CREATE POLICY "ec_read" ON expense_claims FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ec_insert" ON expense_claims;
CREATE POLICY "ec_insert" ON expense_claims FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ec_update" ON expense_claims;
CREATE POLICY "ec_update" ON expense_claims FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "eci_read" ON expense_claim_items;
CREATE POLICY "eci_read" ON expense_claim_items FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "eci_insert" ON expense_claim_items;
CREATE POLICY "eci_insert" ON expense_claim_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "eci_update" ON expense_claim_items;
CREATE POLICY "eci_update" ON expense_claim_items FOR UPDATE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "eci_delete" ON expense_claim_items;
CREATE POLICY "eci_delete" ON expense_claim_items FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "cr_read" ON currency_rates;
CREATE POLICY "cr_read" ON currency_rates FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "cr_insert" ON currency_rates;
CREATE POLICY "cr_insert" ON currency_rates FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "tr_read" ON tax_rates;
CREATE POLICY "tr_read" ON tax_rates FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "tr_insert" ON tax_rates;
CREATE POLICY "tr_insert" ON tax_rates FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "sr_read" ON saved_reports;
CREATE POLICY "sr_read" ON saved_reports FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "sr_insert" ON saved_reports;
CREATE POLICY "sr_insert" ON saved_reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Seed tax rates
INSERT INTO tax_rates (tax_code, name_en, name_ar, rate, is_default) VALUES
  ('VAT-15', 'VAT 15%', 'ضريبة القيمة المضافة 15%', 15, true),
  ('VAT-0', 'Zero Rated', 'صفر بالمائة', 0, false),
  ('EXEMPT', 'VAT Exempt', 'معفى من الضريبة', 0, false),
  ('WITHHOLDING-5', 'Withholding Tax 5%', 'ضريبة الخصم 5%', 5, false)
ON CONFLICT (tax_code) DO NOTHING;

-- Seed chart of accounts (basic)
INSERT INTO chart_of_accounts (account_code, name_en, name_ar, type) VALUES
  ('1000', 'Cash', 'النقدية', 'asset'),
  ('1100', 'Accounts Receivable', 'حسابات مدينة', 'asset'),
  ('1200', 'Inventory', 'المخزون', 'asset'),
  ('1300', 'Fixed Assets', 'الأصول الثابتة', 'asset'),
  ('2000', 'Accounts Payable', 'حسابات دائنة', 'liability'),
  ('2100', 'VAT Payable', 'ضريبة القيمة المضافة المستحقة', 'liability'),
  ('2200', 'Accrued Expenses', 'مصروفات مستحقة', 'liability'),
  ('3000', 'Owner Equity', 'حقوق الملكية', 'equity'),
  ('3100', 'Retained Earnings', 'الأرباح المحتجزة', 'equity'),
  ('4000', 'Revenue', 'الإيرادات', 'income'),
  ('4100', 'Sales Revenue', 'إيرادات المبيعات', 'income'),
  ('5000', 'Cost of Goods Sold', 'تكلفة البضاعة المباعة', 'expense'),
  ('5100', 'Salaries & Wages', 'الرواتب والأجور', 'expense'),
  ('5200', 'Rent Expense', 'مصروف الإيجار', 'expense'),
  ('5300', 'Utilities', 'المرافق', 'expense'),
  ('5400', 'Office Supplies', 'اللوازم المكتبية', 'expense'),
  ('5500', 'Travel & Transport', 'السفر والمواصلات', 'expense'),
  ('5600', 'Professional Fees', 'الرسوم المهنية', 'expense'),
  ('5700', 'Maintenance', 'الصيانة', 'expense'),
  ('5800', 'Depreciation', 'الإهلاك', 'expense')
ON CONFLICT (account_code) DO NOTHING;
