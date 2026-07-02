const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

export const API_CONFIG = {
  baseUrl: SUPABASE_URL.replace('/rest/v1', '').replace(/\/$/, ''),
  anonKey: SUPABASE_ANON_KEY,
  serviceKey: SUPABASE_SERVICE_KEY,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  endpoints: {
    auth: '/auth/v1',
    rest: '/rest/v1',
    rpc: '/rest/v1/rpc',
  },
  testUsers: {
    admin: { email: 'test-admin@erp-test.local', password: 'TestAdmin@2024!' },
    engineer: { email: 'test-eng@erp-test.local', password: 'TestEng@2024!' },
    client: { email: 'test-client@erp-test.local', password: 'TestClient@2024!' },
  },
} as const;
