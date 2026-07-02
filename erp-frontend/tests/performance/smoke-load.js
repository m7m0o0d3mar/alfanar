// k6 Smoke Test - validates basic functionality with minimal load
// Run: k6 run smoke-load.js
//
// Environment variables:
//   BASE_URL - app URL (default: http://localhost:5173)
//   SUPABASE_URL - Supabase REST API URL
//   SUPABASE_ANON_KEY - Supabase anon key

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173';
const SUPABASE_URL = __ENV.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';

const errorRate = new Rate('errors');
const pageLoadTrend = new Trend('page_load_time');
const apiTrend = new Trend('api_response_time');

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    errors: ['rate==0'],
    http_req_duration: ['p(95)<5000'],
  },
};

export default function () {
  group('Frontend Pages', () => {
    const pages = ['/', '/login', '/projects', '/units', '/execution', '/quality', '/hr'];

    for (const path of pages) {
      const start = Date.now();
      const res = http.get(`${BASE_URL}${path}`, {
        headers: { 'Accept': 'text/html' },
        timeout: '10s',
      });
      const duration = Date.now() - start;

      pageLoadTrend.add(duration);
      errorRate.add(res.status !== 200);

      check(res, {
        [`${path} returns 200`]: (r) => r.status === 200,
        [`${path} loads under 5s`]: () => duration < 5000,
      });

      sleep(0.5);
    }
  });

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    group('API Endpoints', () => {
      const endpoints = [
        `${SUPABASE_URL}/rest/v1/roles?select=count`,
        `${SUPABASE_URL}/rest/v1/modules?select=count&is_enabled=eq.true`,
        `${SUPABASE_URL}/rest/v1/page_registry?select=count`,
      ];

      for (const endpoint of endpoints) {
        const start = Date.now();
        const res = http.get(endpoint, {
          headers: {
            'Accept': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
          },
          timeout: '10s',
        });
        const duration = Date.now() - start;

        apiTrend.add(duration);
        errorRate.add(res.status !== 200);

        check(res, {
          [`API endpoint returns 200`]: (r) => r.status === 200,
          [`API responds under 3s`]: () => duration < 3000,
        });

        sleep(0.2);
      }
    });
  }
}
