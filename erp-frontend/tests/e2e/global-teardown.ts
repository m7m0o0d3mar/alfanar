import type { FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { cleanupTestData } from './helpers/db';

function loadDotenv() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) return;
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (key === 'VITE_SUPABASE_URL' && !process.env.SUPABASE_URL) {
        process.env.SUPABASE_URL = val;
      }
      if (key === 'SUPABASE_SERVICE_KEY' && !process.env.SUPABASE_SERVICE_KEY) {
        process.env.SUPABASE_SERVICE_KEY = val;
      }
    }
  }
}

async function globalTeardown(config: FullConfig) {
  loadDotenv();

  const SUPABASE_URL = process.env.SUPABASE_URL || '';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

  if (SUPABASE_URL && SUPABASE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[global-teardown] Cleaning up test data...');
    await cleanupTestData(supabase);
    console.log('[global-teardown] Done.');
  }
}

export default globalTeardown;
