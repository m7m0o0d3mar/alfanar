import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

test.describe('Roles & Permissions API', () => {
  let adminClient: ReturnType<typeof createClient>;
  let anonymousClient: ReturnType<typeof createClient>;

  test.beforeAll(async () => {
    anonymousClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
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

  test('roles table returns data', async () => {
    const { data, error } = await adminClient.from('roles').select('*');
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data!.length).toBeGreaterThanOrEqual(10);
    const codes = data!.map(r => r.code);
    expect(codes).toContain('admin');
    expect(codes).toContain('engineer');
    expect(codes).toContain('client');
  });

  test('role_permissions table returns permission records', async () => {
    const { data, error } = await adminClient.from('role_permissions').select('*');
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  test('specializations table returns seed data', async () => {
    const { data, error } = await adminClient.from('specializations').select('*');
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(10);
    const codes = data!.map(s => s.code);
    expect(codes).toContain('civil_eng');
    expect(codes).toContain('safety_officer');
  });

  test('job_roles table returns seed data', async () => {
    const { data, error } = await adminClient.from('job_roles').select('*');
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(5);
  });

  test('page_registry table returns pages', async () => {
    const { data, error } = await adminClient.from('page_registry').select('*').order('sort_order');
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(20);
    const codes = data!.map(p => p.code);
    expect(codes).toContain('dashboard');
    expect(codes).toContain('admin_users');
  });

  test('regions table returns seed data', async () => {
    const { data, error } = await adminClient.from('regions').select('*');
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(10);
  });

  test('blocks table is accessible', async () => {
    const { data, error } = await adminClient.from('blocks').select('*');
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBeTruthy();
  });
});
