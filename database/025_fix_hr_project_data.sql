-- ============================================================
-- Migration 025: Fix HR employee data and project date bugs
-- ============================================================

-- BUG-H6: HR Employees have NULL nationality and iqama_number
UPDATE employees
SET nationality = 'Saudi', iqama_number = 'IQ-' || employee_code
WHERE nationality IS NULL;

-- BUG-M2: Project "MISKAN ALASAYEL" has end_date before start_date
UPDATE projects
SET end_date = start_date + INTERVAL '2 years'
WHERE end_date < start_date OR end_date IS NULL;
