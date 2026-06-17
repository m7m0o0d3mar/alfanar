-- =============================================================
-- Phase 2: Fixes & Migration
-- Migration: 030
-- Idempotent — safe to run multiple times
-- =============================================================

-- 1. Fix Contingency formula (Booked Budget - Open Budget)
ALTER TABLE item_definitions DROP COLUMN IF EXISTS contingency;
ALTER TABLE item_definitions ADD COLUMN contingency DECIMAL(14,2) GENERATED ALWAYS AS (COALESCE(booked_budget, 0) - COALESCE(open_budget, 0)) STORED;

-- 2. Fix WR auto-number trigger (format: WR-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION trg_auto_wr_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  today TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  seq_num INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(wir_no, '-', 3) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM work_requests
  WHERE wir_no LIKE 'WR-' || today || '-%';

  NEW.wir_no := 'WR-' || today || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_wr_number ON work_requests;
CREATE TRIGGER trg_auto_wr_number
  BEFORE INSERT ON work_requests
  FOR EACH ROW
  WHEN (NEW.wir_no IS NULL OR NEW.wir_no = '')
  EXECUTE FUNCTION trg_auto_wr_number();

-- 3. Auto task code trigger (format: TSK-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION trg_auto_task_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  today TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  seq_num INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(task_code, '-', 3) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM work_tasks
  WHERE task_code LIKE 'TSK-' || today || '-%';

  NEW.task_code := 'TSK-' || today || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_task_code ON work_tasks;
CREATE TRIGGER trg_auto_task_code
  BEFORE INSERT ON work_tasks
  FOR EACH ROW
  WHEN (NEW.task_code IS NULL OR NEW.task_code = '')
  EXECUTE FUNCTION trg_auto_task_code();
