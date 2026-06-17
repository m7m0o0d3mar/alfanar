-- ============================================================================
-- 023: Fix HR seed data — populate missing job_title, department, phone, email
--       for employees EMP-001 through EMP-005
-- ============================================================================

UPDATE employees
SET job_title = 'Project Manager',
    department = 'Operations',
    phone = '+966 50 123 4567',
    email = 'ahmad@alfanar.com'
WHERE employee_code = 'EMP-001';

UPDATE employees
SET job_title = 'Site Engineer',
    department = 'Engineering',
    phone = '+966 55 234 5678',
    email = 'khalid@alfanar.com'
WHERE employee_code = 'EMP-002';

UPDATE employees
SET job_title = 'Safety Officer',
    department = 'HSE',
    phone = '+966 53 345 6789',
    email = 'nasser@alfanar.com'
WHERE employee_code = 'EMP-003';

UPDATE employees
SET job_title = 'Accountant',
    department = 'Finance',
    phone = '+966 56 456 7890',
    email = 'faisal@alfanar.com'
WHERE employee_code = 'EMP-004';

UPDATE employees
SET job_title = 'HR Coordinator',
    department = 'Human Resources',
    phone = '+966 54 567 8901',
    email = 'mohammed@alfanar.com'
WHERE employee_code = 'EMP-005';
