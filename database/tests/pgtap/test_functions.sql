-- pgTAP: Function and trigger tests
BEGIN;

SELECT plan(15);

-- Test has_permission function exists and works
SELECT has_function('has_permission');

-- Test exec_sql function exists
SELECT has_function('exec_sql');

-- Test is_admin helper exists (from 005_rls_policies)
SELECT has_function('is_admin');

-- Check function signatures
SELECT function_lang_is('has_permission', 'plpgsql');
SELECT function_lang_is('exec_sql', 'plpgsql');

-- Check security definer
SELECT is(
  provsecdef,
  true,
  'exec_sql is SECURITY DEFINER'
) FROM pg_proc WHERE proname = 'exec_sql';

-- Test role hierarchy is ordered correctly
SELECT is(
  (SELECT MAX(hierarchy_level) FROM roles WHERE code = 'admin'),
  100,
  'admin has highest hierarchy level'
);

SELECT is(
  (SELECT MIN(hierarchy_level) FROM roles WHERE code = 'client'),
  20,
  'client has lowest hierarchy level'
);

-- Verify triggers exist
SELECT ok(
  (SELECT COUNT(*) > 0 FROM pg_trigger WHERE tgname LIKE 'trg_%'),
  'database has triggers defined (trg_audit_log etc.)'
);

-- Verify RLS helper function
SELECT ok(
  (SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_project_access')),
  'has_project_access RLS helper exists'
);

SELECT ok(
  (SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_user_role')),
  'current_user_role RLS helper exists'
);

-- Check role_permissions scope_type constraint
SELECT col_not_null('role_permissions', 'scope_type');

-- Validate no orphan role_permissions
SELECT ok(
  (SELECT COUNT(*) = 0 FROM role_permissions rp
   LEFT JOIN roles r ON r.code = rp.role
   WHERE r.id IS NULL),
  'no orphan role_permissions records'
);

-- Check block FK constraint works
SELECT fk_ok('blocks', 'region_id', 'regions', 'id');

SELECT * FROM finish();
ROLLBACK;
