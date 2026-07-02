// k6 Average Load Test - simulates typical daily traffic
// Run: k6 run average-load.js
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

export const options = {
  stages: [
    { duration: '1m', target: 5 },
    { duration: '3m', target: 20 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 10 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.05'],
    http_req_duration: ['p(95)<8000', 'p(99)<15000'],
    page_load_time: ['p(95)<8000'],
  },
};

const PUBLIC_PAGES = ['/', '/login'];
const AUTH_PAGES = ['/projects', '/units', '/execution', '/quality', '/hr', '/procurement', '/finance', '/sales', '/documents', '/crm'];

export default function () {
  const isAuthenticated = __VU > 1;

  group('Page Loads', () => {
    const pages = isAuthenticated ? AUTH_PAGES : PUBLIC_PAGES;
    const page = pages[Math.floor(Math.random() * pages.length)];
    const start = Date.now();

    const res = http.get(`${BASE_URL}${page}`, {
      headers: { 'Accept': 'text/html' },
      timeout: '15s',
    });

    const duration = Date.now() - start;
    pageLoadTrend.add(duration);
    errorRate.add(res.status !== 200 && res.status !== 301 && res.status !== 302);

    check(res, {
      'page responds': (r) => r.status === 200 || r.status === 301 || r.status === 302,
      'loads under 8s': () => duration < 8000,
    });
  });

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    group('API Reads', () => {
      const res = http.get(`${SUPABASE_URL}/rest/v1/modules?select=code,name_en,is_enabled&is_enabled=eq.true&order=order`, {
        headers: {
          'Accept': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        timeout: '10s',
      });

      errorRate.add(res.status !== 200);
      check(res, {
        'modules API returns 200': (r) => r.status === 200,
        'modules API responds under 5s': (r) => r.timings.duration < 5000,
      });
    });
  }

  sleep(Math.random() * 3 + 1);
}
