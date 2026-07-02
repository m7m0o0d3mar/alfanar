-- pgTAP: RLS Policy tests
BEGIN;

SELECT plan(30);

-- Helper: check RLS is enabled
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'roles'),
  true,
  'roles has RLS enabled'
);

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'specializations'),
  true,
  'specializations has RLS enabled'
);

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'job_roles'),
  true,
  'job_roles has RLS enabled'
);

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'regions'),
  true,
  'regions has RLS enabled'
);

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'blocks'),
  true,
  'blocks has RLS enabled'
);

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'page_registry'),
  true,
  'page_registry has RLS enabled'
);

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'role_permissions'),
  true,
  'role_permissions has RLS enabled'
);

-- Check policies exist on each table
SELECT policies_are(
  'public', 'roles',
  ARRAY['roles_select_all', 'roles_insert_admin', 'roles_update_admin', 'roles_delete_admin'],
  'roles has correct policies'
);

SELECT policies_are(
  'public', 'specializations',
  ARRAY['spec_select_all', 'spec_insert_admin', 'spec_update_admin', 'spec_delete_admin'],
  'specializations has correct policies'
);

SELECT policies_are(
  'public', 'page_registry',
  ARRAY['pr_select_all', 'pr_insert_admin', 'pr_update_admin', 'pr_delete_admin'],
  'page_registry has correct policies'
);

-- Verify seed data
SELECT ok(
  (SELECT COUNT(*) > 0 FROM roles),
  'roles table has seed data'
);

SELECT ok(
  (SELECT COUNT(*) >= 13 FROM roles),
  'roles has at least 13 default roles'
);

SELECT ok(
  (SELECT COUNT(*) > 0 FROM specializations),
  'specializations table has seed data'
);

SELECT ok(
  (SELECT COUNT(*) > 0 FROM job_roles),
  'job_roles table has seed data'
);

SELECT ok(
  (SELECT COUNT(*) > 0 FROM regions),
  'regions table has seed data'
);

SELECT ok(
  (SELECT COUNT(*) > 0 FROM page_registry),
  'page_registry table has seed data'
);

-- Check admin role exists
SELECT ok(
  (SELECT EXISTS (SELECT 1 FROM roles WHERE code = 'admin' AND is_system = true)),
  'admin role exists and is system role'
);

-- Check engineeer role exists
SELECT ok(
  (SELECT EXISTS (SELECT 1 FROM roles WHERE code = 'engineer')),
  'engineer role exists'
);

-- Check no duplicate codes
SELECT ok(
  (SELECT COUNT(*) = COUNT(DISTINCT code) FROM roles),
  'no duplicate role codes'
);

SELECT ok(
  (SELECT COUNT(*) = COUNT(DISTINCT code) FROM specializations),
  'no duplicate specialization codes'
);

SELECT ok(
  (SELECT COUNT(*) = COUNT(DISTINCT code) FROM job_roles),
  'no duplicate job_role codes'
);

SELECT ok(
  (SELECT COUNT(*) = COUNT(DISTINCT code) FROM page_registry),
  'no duplicate page_registry codes'
);

-- Verify role_permissions has records
SELECT ok(
  (SELECT COUNT(*) > 0 FROM role_permissions WHERE is_active = true),
  'role_permissions has active records'
);

-- Check hierarchy_level is positive
SELECT ok(
  (SELECT MIN(hierarchy_level) >= 0 FROM roles),
  'all roles have non-negative hierarchy_level'
);

-- Check page_registry sort_order is positive
SELECT ok(
  (SELECT MIN(sort_order) >= 0 FROM page_registry),
  'all page_registry entries have non-negative sort_order'
);

-- Check has_permission function exists
SELECT has_function('has_permission', ARRAY['text', 'text', 'uuid']);
SELECT has_function('exec_sql', ARRAY['text']);

-- Verify admin page count
SELECT ok(
  (SELECT COUNT(*) > 0 FROM page_registry WHERE is_admin = true),
  'page_registry has admin pages'
);

SELECT ok(
  (SELECT COUNT(*) > 0 FROM page_registry WHERE is_admin = false),
  'page_registry has non-admin pages'
);

SELECT * FROM finish();
ROLLBACK;
