// k6 Shared Thresholds Configuration
// Import this in other k6 scripts to maintain consistent thresholds

export const SHARED_THRESHOLDS = {
  // Error rate should be at or near 0%
  errors: ['rate<0.01'],

  // Core web vitals proxy: response times
  http_req_duration: [
    'p(90)<4000',  // 90% of requests under 4s
    'p(95)<8000',  // 95% under 8s
  ],

  // No failed requests
  http_req_failed: ['rate<0.01'],
};

export const STRICT_THRESHOLDS = {
  errors: ['rate==0'],
  http_req_duration: [
    'p(90)<2000',
    'p(95)<4000',
  ],
  http_req_failed: ['rate==0'],
};

export const RELAXED_THRESHOLDS = {
  errors: ['rate<0.05'],
  http_req_duration: [
    'p(90)<8000',
    'p(95)<15000',
  ],
  http_req_failed: ['rate<0.05'],
};

export function validateThresholds(results) {
  const failures = [];
  for (const [name, value] of Object.entries(results)) {
    if (value.fails > 0) {
      failures.push({ metric: name, fails: value.fails, passes: value.passes });
    }
  }
  return {
    passed: failures.length === 0,
    failures,
  };
}
