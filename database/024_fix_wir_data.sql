-- ============================================================================
-- 024: Fix WIR data — populate empty inspector & inspection_date fields
-- ============================================================================
-- Run after 023_fix_hr_seed.sql
-- ============================================================================

UPDATE work_requests
SET
  inspection_date = CURRENT_DATE - INTERVAL '7 days',
  inspected_by = (SELECT id FROM user_profiles LIMIT 1)
WHERE inspection_date IS NULL;
