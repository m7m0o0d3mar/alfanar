import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

test.describe('API Contract Tests', () => {
  let adminClient: ReturnType<typeof createClient>;

  test.beforeAll(async () => {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data, error } = await adminClient.auth.signInWithPassword({
      email: 'test-admin@erp-test.local',
      password: 'TestAdmin@2024!',
    });
    if (error) throw error;
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: `Bearer ${data.session?.access_token}` } },
    });
  });

  const CONTRACT_CHECKS = [
    {
      table: 'projects',
      requiredFields: ['id', 'project_code', 'name_en', 'status'],
      expectedType: 'array',
    },
    {
      table: 'role_permissions',
      requiredFields: ['id', 'role', 'permissions', 'scope_type', 'is_active'],
      expectedType: 'array',
    },
    {
      table: 'roles',
      requiredFields: ['id', 'code', 'name_en', 'is_system', 'hierarchy_level', 'is_active'],
      expectedType: 'array',
    },
    {
      table: 'specializations',
      requiredFields: ['id', 'code', 'name_en', 'is_active'],
      expectedType: 'array',
    },
    {
      table: 'job_roles',
      requiredFields: ['id', 'code', 'name_en', 'hierarchy_level', 'is_active'],
      expectedType: 'array',
    },
    {
      table: 'page_registry',
      requiredFields: ['id', 'code', 'path', 'name_en', 'sort_order', 'is_enabled', 'is_admin'],
      expectedType: 'array',
    },
    {
      table: 'user_profiles',
      requiredFields: ['id', 'email', 'full_name_en', 'role', 'is_active', 'default_language'],
      expectedType: 'array',
    },
    {
      table: 'system_settings',
      requiredFields: ['key', 'value'],
      expectedType: 'array',
    },
  ];

  for (const { table, requiredFields } of CONTRACT_CHECKS) {
    test(`${table} API contract is stable`, async () => {
      const { data, error } = await adminClient.from(table).select('*').limit(1);
      expect(error).toBeNull();
      expect(data).toBeDefined();

      if (data && data.length > 0) {
        const record = data[0];
        for (const field of requiredFields) {
          expect(record).toHaveProperty(field);
        }
      }
    });
  }

  test('user_profiles role references a valid role code', async () => {
    const { data: roles } = await adminClient.from('roles').select('code');
    const validRoles = new Set(roles?.map(r => r.code) || []);

    const { data: profiles } = await adminClient.from('user_profiles').select('role').limit(10);
    if (profiles && profiles.length > 0) {
      for (const p of profiles) {
        expect(validRoles.has(p.role)).toBeTruthy();
      }
    }
  });

  test('page_registry paths are unique', async () => {
    const { data } = await adminClient.from('page_registry').select('path');
    const paths = data?.map(p => p.path) || [];
    const uniquePaths = new Set(paths);
    expect(uniquePaths.size).toBe(paths.length);
  });
});
