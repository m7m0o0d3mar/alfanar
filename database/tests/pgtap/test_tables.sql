-- pgTAP: Table structure tests
BEGIN;

SELECT plan(42);

-- roles table
SELECT has_table('roles');
SELECT has_pk('roles');
SELECT has_column('roles', 'id');
SELECT has_column('roles', 'code');
SELECT has_column('roles', 'name_en');
SELECT has_column('roles', 'name_ar');
SELECT has_column('roles', 'is_system');
SELECT has_column('roles', 'hierarchy_level');
SELECT has_column('roles', 'is_active');
SELECT col_is_unique('roles', 'code');
SELECT col_not_null('roles', 'code');
SELECT col_not_null('roles', 'name_en');

-- specializations table
SELECT has_table('specializations');
SELECT has_pk('specializations');
SELECT has_column('specializations', 'code');
SELECT col_is_unique('specializations', 'code');
SELECT col_not_null('specializations', 'name_en');

-- job_roles table
SELECT has_table('job_roles');
SELECT has_pk('job_roles');
SELECT has_column('job_roles', 'code');
SELECT col_is_unique('job_roles', 'code');
SELECT has_column('job_roles', 'hierarchy_level');

-- regions table
SELECT has_table('regions');
SELECT has_pk('regions');
SELECT has_column('regions', 'code');
SELECT col_is_unique('regions', 'code');

-- blocks table
SELECT has_table('blocks');
SELECT has_pk('blocks');
SELECT has_column('blocks', 'region_id');
SELECT fk_ok('blocks', 'region_id', 'regions', 'id');

-- page_registry table
SELECT has_table('page_registry');
SELECT has_pk('page_registry');
SELECT has_column('page_registry', 'code');
SELECT has_column('page_registry', 'path');
SELECT has_column('page_registry', 'icon');
SELECT has_column('page_registry', 'name_en');
SELECT has_column('page_registry', 'section_key');
SELECT has_column('page_registry', 'sort_order');
SELECT has_column('page_registry', 'is_enabled');
SELECT has_column('page_registry', 'is_admin');
SELECT col_is_unique('page_registry', 'code');
SELECT col_not_null('page_registry', 'path');
SELECT col_not_null('page_registry', 'name_en');

-- role_permissions (extended)
SELECT has_table('role_permissions');
SELECT has_column('role_permissions', 'id');
SELECT has_column('role_permissions', 'scope_type');
SELECT has_column('role_permissions', 'scope_id');
SELECT has_column('role_permissions', 'role_id');
SELECT has_column('role_permissions', 'is_active');

-- user_profiles (extended)
SELECT has_column('user_profiles', 'specialization_id');
SELECT has_column('user_profiles', 'job_role_id');
SELECT has_column('user_profiles', 'region_id');

SELECT * FROM finish();
ROLLBACK;
