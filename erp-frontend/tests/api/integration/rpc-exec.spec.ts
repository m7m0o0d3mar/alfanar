import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

test.describe('RPC Integration', () => {
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

  test('has_permission returns true for admin', async () => {
    const { data, error } = await adminClient.rpc('has_permission', {
      perm_key: 'all_modules',
      scope_type: 'global',
      scope_id: null,
    });
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  test('exec_sql returns rows as plain array for SELECT', async () => {
    const { data, error } = await adminClient.rpc('exec_sql', {
      query: "SELECT * FROM (VALUES (1, 'hello'), (2, 'world')) AS t(num, txt) ORDER BY num",
    });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    expect(data[0]).toEqual({ num: 1, txt: 'hello' });
    expect(data[1]).toEqual({ num: 2, txt: 'world' });
  });

  test('exec_sql handles DDL without error', async () => {
    const { data, error } = await adminClient.rpc('exec_sql', {
      query: "CREATE TEMP TABLE IF NOT EXISTS _test_ddl (id int)",
    });
    expect(error).toBeNull();
  });

  test('list_tables returns typed rows with row_count and has_fks', async () => {
    const { data, error } = await adminClient.rpc('list_tables');
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('table_name');
    expect(data[0]).toHaveProperty('table_schema');
    expect(data[0]).toHaveProperty('row_count');
    expect(data[0]).toHaveProperty('has_fks');
    expect(typeof data[0].row_count).toBe('number');
    expect(typeof data[0].has_fks).toBe('boolean');
  });

  test('list_columns returns column details for a table', async () => {
    const { data, error } = await adminClient.rpc('list_columns', { table_name: 'user_profiles' });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('column_name');
    expect(data[0]).toHaveProperty('data_type');
    expect(data[0]).toHaveProperty('is_nullable');
    expect(data[0]).toHaveProperty('is_pk');
  });
});
