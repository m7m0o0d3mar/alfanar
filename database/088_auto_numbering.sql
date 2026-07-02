-- Auto-numbering via DB triggers for all document entities
-- Pattern: PREFIX-YYYYMMDD-NNNN (daily reset) except approvals (yearly)

-- 1. NCR: NCR-YYYYMMDD-NNNN
CREATE OR REPLACE FUNCTION trg_auto_ncr_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  today TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  seq_num INT;
BEGIN
  IF NEW.ncr_no IS NULL OR NEW.ncr_no = '' THEN
    SELECT COALESCE(MAX(CAST(SPLIT_PART(ncr_no, '-', 3) AS INTEGER)), 0) + 1
    INTO seq_num FROM qc_ncr WHERE ncr_no LIKE 'NCR-' || today || '-%';
    NEW.ncr_no := 'NCR-' || today || '-' || LPAD(seq_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_ncr_no ON qc_ncr;
CREATE TRIGGER trg_auto_ncr_no BEFORE INSERT ON qc_ncr
  FOR EACH ROW EXECUTE FUNCTION trg_auto_ncr_no();

-- 2. CAPA: CAPA-YYYYMMDD-NNNN
CREATE OR REPLACE FUNCTION trg_auto_capa_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  today TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  seq_num INT;
BEGIN
  IF NEW.capa_no IS NULL OR NEW.capa_no = '' THEN
    SELECT COALESCE(MAX(CAST(SPLIT_PART(capa_no, '-', 3) AS INTEGER)), 0) + 1
    INTO seq_num FROM qc_capa WHERE capa_no LIKE 'CAPA-' || today || '-%';
    NEW.capa_no := 'CAPA-' || today || '-' || LPAD(seq_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_capa_no ON qc_capa;
CREATE TRIGGER trg_auto_capa_no BEFORE INSERT ON qc_capa
  FOR EACH ROW EXECUTE FUNCTION trg_auto_capa_no();

-- 3. Inspection: INS-YYYYMMDD-NNNN
CREATE OR REPLACE FUNCTION trg_auto_inspection_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  today TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  seq_num INT;
BEGIN
  IF NEW.inspection_no IS NULL OR NEW.inspection_no = '' THEN
    SELECT COALESCE(MAX(CAST(SPLIT_PART(inspection_no, '-', 3) AS INTEGER)), 0) + 1
    INTO seq_num FROM qc_inspections WHERE inspection_no LIKE 'INS-' || today || '-%';
    NEW.inspection_no := 'INS-' || today || '-' || LPAD(seq_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_inspection_no ON qc_inspections;
CREATE TRIGGER trg_auto_inspection_no BEFORE INSERT ON qc_inspections
  FOR EACH ROW EXECUTE FUNCTION trg_auto_inspection_no();

-- 4. Defect: DFT-YYYYMMDD-NNNN
CREATE OR REPLACE FUNCTION trg_auto_defect_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  today TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  seq_num INT;
BEGIN
  IF NEW.defect_no IS NULL OR NEW.defect_no = '' THEN
    SELECT COALESCE(MAX(CAST(SPLIT_PART(defect_no, '-', 3) AS INTEGER)), 0) + 1
    INTO seq_num FROM qc_defects WHERE defect_no LIKE 'DFT-' || today || '-%';
    NEW.defect_no := 'DFT-' || today || '-' || LPAD(seq_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_defect_no ON qc_defects;
CREATE TRIGGER trg_auto_defect_no BEFORE INSERT ON qc_defects
  FOR EACH ROW EXECUTE FUNCTION trg_auto_defect_no();

-- 5. Work Order: WO-YYYYMMDD-NNNN
CREATE OR REPLACE FUNCTION trg_auto_wo_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  today TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  seq_num INT;
BEGIN
  IF NEW.wo_no IS NULL OR NEW.wo_no = '' THEN
    SELECT COALESCE(MAX(CAST(SPLIT_PART(wo_no, '-', 3) AS INTEGER)), 0) + 1
    INTO seq_num FROM fs_work_orders WHERE wo_no LIKE 'WO-' || today || '-%';
    NEW.wo_no := 'WO-' || today || '-' || LPAD(seq_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_wo_no ON fs_work_orders;
CREATE TRIGGER trg_auto_wo_no BEFORE INSERT ON fs_work_orders
  FOR EACH ROW EXECUTE FUNCTION trg_auto_wo_no();

-- 6. Approval Request: APR-YYYY-NNNN (yearly reset)
CREATE OR REPLACE FUNCTION trg_auto_request_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  year TEXT := TO_CHAR(NOW(), 'YYYY');
  seq_num INT;
BEGIN
  IF NEW.request_no IS NULL OR NEW.request_no = '' THEN
    SELECT COALESCE(MAX(CAST(SPLIT_PART(request_no, '-', 3) AS INTEGER)), 0) + 1
    INTO seq_num FROM approval_requests WHERE request_no LIKE 'APR-' || year || '-%';
    NEW.request_no := 'APR-' || year || '-' || LPAD(seq_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_request_no ON approval_requests;
CREATE TRIGGER trg_auto_request_no BEFORE INSERT ON approval_requests
  FOR EACH ROW EXECUTE FUNCTION trg_auto_request_no();
