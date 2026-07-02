-- ZATCA E-Invoicing (Saudi Electronic Invoice)
-- Phase 1 & 2 compliant: stores invoice data, ZATCA status, QR code, cryptographic stamp

CREATE TABLE IF NOT EXISTS zatca_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no VARCHAR(50) UNIQUE NOT NULL,
  invoice_type VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (invoice_type IN ('standard', 'simplified', 'debit_note', 'credit_note', 'prepayment')),
  direction VARCHAR(10) NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reported', 'cancelled', 'rejected')),
  issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seller_name VARCHAR(255) NOT NULL,
  seller_vat VARCHAR(50) NOT NULL,
  seller_cr VARCHAR(100),
  seller_address TEXT,
  buyer_name VARCHAR(255),
  buyer_vat VARCHAR(50),
  buyer_address TEXT,
  currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
  total_excluding_vat DECIMAL(20,2) NOT NULL DEFAULT 0,
  total_vat DECIMAL(20,2) NOT NULL DEFAULT 0,
  total_including_vat DECIMAL(20,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(20,2) DEFAULT 0,
  vat_rate DECIMAL(5,2) DEFAULT 15.00,
  qr_code TEXT,
  qr_base64 TEXT,
  cryptographic_stamp TEXT,
  cryptographic_stamp_uuid UUID DEFAULT gen_random_uuid(),
  invoice_xml TEXT,
  invoice_json JSONB,
  zatca_pih TEXT,
  zatca_response_code VARCHAR(50),
  zatca_response_msg TEXT,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  reported_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS zatca_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES zatca_invoices(id) ON DELETE CASCADE,
  line_no INT DEFAULT 1,
  description TEXT NOT NULL,
  quantity DECIMAL(15,2) DEFAULT 1,
  unit_price DECIMAL(20,2) DEFAULT 0,
  total_excluding_vat DECIMAL(20,2) DEFAULT 0,
  vat_rate DECIMAL(5,2) DEFAULT 15.00,
  vat_amount DECIMAL(20,2) DEFAULT 0,
  total_including_vat DECIMAL(20,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE zatca_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE zatca_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read zatca_invoices" ON zatca_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert zatca_invoices" ON zatca_invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update zatca_invoices" ON zatca_invoices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete zatca_invoices" ON zatca_invoices FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can read zatca_invoice_lines" ON zatca_invoice_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert zatca_invoice_lines" ON zatca_invoice_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update zatca_invoice_lines" ON zatca_invoice_lines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete zatca_invoice_lines" ON zatca_invoice_lines FOR DELETE TO authenticated USING (true);
