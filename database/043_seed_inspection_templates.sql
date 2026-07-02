-- Seed default inspection templates with checklist items
-- Inspired by GoAudits checklists for common inspection types

DO $$
DECLARE
  v_safety_id UUID; v_quality_id UUID; v_supplier_id UUID; v_material_id UUID;
BEGIN
  -- Safety Inspection Template
  INSERT INTO qc_checklist_templates (code, name_en, category, description, is_active)
  VALUES ('SAFETY-001', 'Site Safety Inspection', 'safety',
    'Standard site safety walkthrough covering PPE, fire safety, electrical, and emergency preparedness.', true)
  ON CONFLICT (code) DO NOTHING RETURNING id INTO v_safety_id;

  IF v_safety_id IS NOT NULL THEN
    INSERT INTO qc_template_items (template_id, sort_order, description_en, is_critical, weight) VALUES
      (v_safety_id, 1, 'All personnel wearing appropriate PPE (helmet, vest, gloves, boots)', true, 5),
      (v_safety_id, 2, 'Fire extinguishers present, accessible, and within expiry date', true, 5),
      (v_safety_id, 3, 'Emergency exits clearly marked and unobstructed', true, 4),
      (v_safety_id, 4, 'First aid kit available and adequately stocked', false, 3),
      (v_safety_id, 5, 'Electrical cables and switches properly insulated and labeled', false, 3),
      (v_safety_id, 6, 'Warning signs and barricades in place around hazards', false, 2),
      (v_safety_id, 7, 'Scaffolding and ladders inspected and tagged', true, 4),
      (v_safety_id, 8, 'Gas cylinders secured upright with caps on', false, 3),
      (v_safety_id, 9, 'Housekeeping — walkways clear of debris and trip hazards', false, 2),
      (v_safety_id, 10, 'Emergency contact numbers posted prominently', false, 1);
  END IF;

  -- Quality Inspection Template
  INSERT INTO qc_checklist_templates (code, name_en, category, description, is_active)
  VALUES ('QUAL-001', 'Construction Quality Inspection', 'quality',
    'General quality inspection for construction work including materials, workmanship, and finishing.', true)
  ON CONFLICT (code) DO NOTHING RETURNING id INTO v_quality_id;

  IF v_quality_id IS NOT NULL THEN
    INSERT INTO qc_template_items (template_id, sort_order, description_en, is_critical, weight) VALUES
      (v_quality_id, 1, 'Materials conform to approved specifications and submittals', true, 5),
      (v_quality_id, 2, 'Workmanship meets industry standards and project specs', true, 5),
      (v_quality_id, 3, 'Dimensions and tolerances within approved drawings', true, 4),
      (v_quality_id, 4, 'Surface finish uniform — no cracks, spalls, or defects', false, 3),
      (v_quality_id, 5, 'Welding/joining visually inspected and compliant with WPS', false, 3),
      (v_quality_id, 6, 'Installation alignment checked with survey instruments', true, 4),
      (v_quality_id, 7, 'Concrete slump and compressive strength test results available', false, 2),
      (v_quality_id, 8, 'Rebar placement and cover verified per structural drawings', true, 4);
  END IF;

  -- Supplier Audit Template
  INSERT INTO qc_checklist_templates (code, name_en, category, description, is_active)
  VALUES ('SUPPLIER-AUDIT-001', 'Supplier Quality Audit', 'supplier_audit',
    'Supplier facility audit covering QMS, production capacity, HSE compliance, and delivery capability.', true)
  ON CONFLICT (code) DO NOTHING RETURNING id INTO v_supplier_id;

  IF v_supplier_id IS NOT NULL THEN
    INSERT INTO qc_template_items (template_id, sort_order, description_en, is_critical, weight) VALUES
      (v_supplier_id, 1, 'Quality Management System (ISO 9001 or equivalent) certified', true, 5),
      (v_supplier_id, 2, 'Production capacity meets project volume and timeline requirements', true, 4),
      (v_supplier_id, 3, 'Material test certificates and traceability records available', true, 4),
      (v_supplier_id, 4, 'Delivery track record — no significant delays in last 12 months', false, 3),
      (v_supplier_id, 5, 'Health & Safety policy and records in place', false, 2),
      (v_supplier_id, 6, 'Environmental compliance (ISO 14001 or equivalent)', false, 2),
      (v_supplier_id, 7, 'Pricing competitive and within budget benchmarks', false, 1),
      (v_supplier_id, 8, 'Financial stability — no outstanding legal or credit issues', true, 3);
  END IF;

  -- Material Inspection Template
  INSERT INTO qc_checklist_templates (code, name_en, category, description, is_active)
  VALUES ('MAT-INSP-001', 'Incoming Material Inspection', 'material_inspection',
    'Receiving inspection for materials delivered to site — checks grade, quantity, damage, and documentation.', true)
  ON CONFLICT (code) DO NOTHING RETURNING id INTO v_material_id;

  IF v_material_id IS NOT NULL THEN
    INSERT INTO qc_template_items (template_id, sort_order, description_en, is_critical, weight) VALUES
      (v_material_id, 1, 'Material grade and specification match purchase order', true, 5),
      (v_material_id, 2, 'Physical dimensions within acceptable tolerances', true, 4),
      (v_material_id, 3, 'Quantity received matches delivery note and PO', true, 4),
      (v_material_id, 4, 'No visible damage — dents, corrosion, cracks, or moisture', true, 5),
      (v_material_id, 5, 'Manufacturer test certificates and mill certificates attached', false, 3),
      (v_material_id, 6, 'Packaging and labeling compliant with project requirements', false, 2),
      (v_material_id, 7, 'Batch/lot numbers recorded and match documentation', false, 2),
      (v_material_id, 8, 'Expiry date (if applicable) checked and valid', true, 3);
  END IF;
END $$;
