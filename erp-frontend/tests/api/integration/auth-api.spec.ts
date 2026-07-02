import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

test.describe('Auth API Integration', () => {
  let supabase: ReturnType<typeof createClient>;

  test.beforeAll(() => {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  });

  test('signIn returns session for valid admin credentials', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'test-admin@erp-test.local',
      password: 'TestAdmin@2024!',
    });
    expect(error).toBeNull();
    expect(data.session).toBeDefined();
    expect(data.session?.access_token).toBeDefined();
    expect(data.session?.user?.email).toBe('test-admin@erp-test.local');
    await supabase.auth.signOut();
  });

  test('signIn fails with wrong password', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'test-admin@erp-test.local',
      password: 'wrong-password!',
    });
    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
  });

  test('signIn fails for non-existent user', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'does-not-exist@test.com',
      password: 'some-password',
    });
    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
  });

  test('getSession returns null for logged-out user', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    expect(session).toBeNull();
  });

  test('resetPasswordForEmail does not error for valid email format', async () => {
    const { error } = await supabase.auth.resetPasswordForEmail('test-admin@erp-test.local', {
      redirectTo: 'http://localhost:5173/reset-password',
    });
    expect(error).toBeNull();
  });
});
