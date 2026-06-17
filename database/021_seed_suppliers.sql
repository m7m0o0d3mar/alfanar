-- ============================================================================
-- SEED: Insert sample suppliers so POs can be created (BUG M-6)
-- ============================================================================
INSERT INTO suppliers (id, supplier_code, name_en, name_ar, contact_person, phone, email, address, cr_number, vat_number, payment_terms, is_approved, rating) VALUES
  (uuid_generate_v4(), 'SUP-001', 'Al-Rajhi Steel Co.', 'شركة الراجحي للصلب', 'Ahmed Al-Rajhi', '+966 55 123 4567', 'info@alrajhisteel.com', 'P.O. Box 12345, Riyadh 11555', 'CR-100001', 'VAT-300000001', 'net_30', true, 4.5),
  (uuid_generate_v4(), 'SUP-002', 'Saudi Cement Co.', 'شركة الأسمنت السعودية', 'Khalid Al-Otaibi', '+966 50 987 6543', 'sales@sacem.com', 'P.O. Box 54321, Dammam 31422', 'CR-100002', 'VAT-300000002', 'net_45', true, 4.2),
  (uuid_generate_v4(), 'SUP-003', 'Al-Faisal Electrical Supply', 'الفيصل للتجهيزات الكهربائية', 'Faisal Al-Harbi', '+966 54 321 7890', 'info@alfaisal-electric.com', 'King Fahd Road, Jeddah 21589', 'CR-100003', 'VAT-300000003', 'net_30', true, 4.0),
  (uuid_generate_v4(), 'SUP-004', 'National Plumbing Materials', 'المواد السباكة الوطنية', 'Mansour Al-Ghamdi', '+966 56 789 0123', 'info@natplumb.com', 'Industrial Area, Khobar 31952', 'CR-100004', 'VAT-300000004', 'net_15', false, 3.5),
  (uuid_generate_v4(), 'SUP-005', 'Green Landscaping Services', 'خدمات تنسيق الحدائق الخضراء', 'Saeed Al-Zahrani', '+966 53 456 7890', 'contact@greenlandscape.com', 'P.O. Box 98765, Riyadh 11677', 'CR-100005', 'VAT-300000005', 'net_30', true, 4.8),
  (uuid_generate_v4(), 'SUP-006', 'Arabian Building Materials', 'مواد البناء العربية', 'Nasser Al-Qahtani', '+966 57 111 2222', 'info@arabuild.com', 'Prince Sultan Road, Makkah 24231', 'CR-100006', 'VAT-300000006', 'net_60', true, 4.1),
  (uuid_generate_v4(), 'SUP-007', 'Al-Hasa IT Solutions', 'الأحساء لحلول تقنية المعلومات', 'Hussain Al-Mutairi', '+966 55 333 4444', 'sales@ahasait.com', 'Al-Madinah Road, Jeddah 21472', 'CR-100007', 'VAT-300000007', 'net_15', true, 4.6)
ON CONFLICT (supplier_code) DO NOTHING;
