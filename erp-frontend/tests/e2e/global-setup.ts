import { chromium, type FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { seedTestData, cleanupTestData, MISSING_TABLES_DDL } from './helpers/db';
import { TEST_USERS } from './fixtures/test-users';

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

async function globalSetup(config: FullConfig) {
  loadDotenv();

  const SUPABASE_URL = process.env.SUPABASE_URL || '';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

  const baseURL = config.projects[0].use.baseURL!;
  console.log(`[global-setup] Base URL: ${baseURL}`);

  if (SUPABASE_URL && SUPABASE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    await ensureMissingTables(supabase);
    console.log('[global-setup] Cleaning test data...');
    await cleanupTestData(supabase);
    console.log('[global-setup] Seeding test data...');
    await seedTestData(supabase);
    console.log('[global-setup] Test data ready.');
  } else {
    console.warn('[global-setup] No Supabase credentials — skipping seed. Ensure test data exists.');
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    await page.goto('/login', { waitUntil: 'networkidle' });
    console.log('[global-setup] App is reachable at', baseURL);
  } catch (err) {
    console.error('[global-setup] App is NOT reachable at', baseURL, err);
    throw new Error(`App at ${baseURL}/login is not responding`);
  } finally {
    await browser.close();
  }

  process.env.BASE_URL = baseURL;
}

async function ensureMissingTables(supabase: ReturnType<typeof createClient>) {
  try {
    await supabase.rpc('exec_sql', { query: 'SELECT 1' });
  } catch {
    console.warn('[global-setup] exec_sql RPC not available — skipping table creation.');
    return;
  }
  for (const ddl of MISSING_TABLES_DDL) {
    await supabase.rpc('exec_sql', { query: ddl });
  }
}

export default globalSetup;
