# Test Architecture

Multi-layer test suite covering E2E, API, database, visual, accessibility, and performance testing.

## Prerequisites

| Tool | Install |
|------|---------|
| Playwright | `npm exec playwright install --with-deps chromium` |
| k6 | `scoop install k6` / `choco install k6` |
| pgTAP | `CREATE EXTENSION IF NOT EXISTS pgtap;` in Supabase DB |
| Supabase Admin key | Set `SUPABASE_SERVICE_KEY` env var for auth-dependent tests |

## Quick Start

```bash
cd erp-frontend
npm ci
npx playwright install --with-deps chromium
```

Set env vars (use `.env.test` or export):

```
SUPABASE_URL=https://epxxsgensnimdskcmvdj.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
BASE_URL=http://localhost:5173
```

## Test Layers

### 1. E2E (Playwright) — `tests/e2e/`

Suites run as Playwright projects:

| Project | Suite | Tests | Command |
|---------|-------|-------|---------|
| `smoke` | Login, dashboard, sidebar, 404 | 4 | `npx playwright test --project=smoke` |
| `auth` | Login/logout, redirects, validation | 7 | `npx playwright test --project=auth` |
| `navigation` | All admin pages load without errors | 27 | `npx playwright test --project=navigation` |
| `permissions` | RBAC matrix (6 roles × paths) | 23 | `npx playwright test --project=permissions` |
| `regression` | Core pages, form validation | 15 | `npx playwright test --project=regression` |
| `critical-workflows` | WIR lifecycle flows | 4 | `npx playwright test --project=critical-workflows` |
| `visual` | Screenshot comparison (desktop) | ~8 | `npx playwright test --project=visual` |
| `visual-mobile` | Screenshot comparison (tablet) | ~7 | `npx playwright test --project=visual-mobile` |
| `accessibility` | axe-core audits | 9 | `npx playwright test --project=accessibility` |
| `all` | Every project above | ~104 | `npx playwright test --project=all` |

Run specific project:

```bash
npx playwright test --project=smoke --reporter=list   # quick text output
npx playwright test --project=visual                  # visual only
```

Update snapshots after intentional UI changes:

```bash
npx playwright test --project=visual --update-snapshots
```

### 2. API Integration — `tests/api/`

| File | Tests | Command |
|------|-------|---------|
| `integration/auth-api.spec.ts` | SignIn, session, reset | `npx playwright test tests/api/integration/auth-api.spec.ts` |
| `integration/roles-api.spec.ts` | Roles, permissions tables | `npx playwright test tests/api/integration/roles-api.spec.ts` |
| `integration/rpc-exec.spec.ts` | RPC permissions | `npx playwright test tests/api/integration/rpc-exec.spec.ts` |
| `contracts/api-contracts.spec.ts` | Schema stability | `npx playwright test tests/api/contracts/` |

### 3. Database (pgTAP) — `database/tests/pgtap/`

| File | Assertions | What it tests |
|------|------------|---------------|
| `test_tables.sql` | 42 | Table existence, columns, PKs, unique constraints |
| `test_rls.sql` | 30 | RLS enabled, policies correct, seed data |
| `test_functions.sql` | 15 | Functions exist, signatures, triggers, FKs |

Run:

```bash
bash database/tests/run_pgtap.sh
```

Or manually:

```bash
pg_prove -d postgresql://user:pass@host:5432/db database/tests/pgtap/*.sql
```

### 4. Performance (k6) — `tests/performance/`

| Script | VUs | Duration | Thresholds |
|--------|-----|----------|------------|
| `smoke-load.js` | 1 VU, 1 iteration | Instant | p95<5s, 0 errors |
| `average-load.js` | 5→50 ramp | ~8 min | p95<8s, <5% errors |

Run:

```bash
k6 run tests/performance/smoke-load.js
k6 run tests/performance/average-load.js
```

### 5. Unit Tests (Vitest)

Existing 71 tests in 4 suites:

```bash
cd erp-frontend && npx vitest run
```

## Reports

| Report Type | Location | Viewer |
|-------------|----------|--------|
| Playwright HTML | `erp-frontend/tests/reports/playwright-html/` | `npx playwright show-report tests/reports/playwright-html/` |
| Playwright JSON | `erp-frontend/tests/reports/playwright-json/` | CI consumption |
| pgTAP TAP | `database/tests/reports/` | Raw text |
| pgTAP HTML | `database/tests/reports/` | Browser |
| k6 summary (JSON) | `erp-frontend/tests/reports/k6-*.json` | CI consumption |
| Visual diffs | `erp-frontend/tests/e2e/suites/visual/__screenshots__/` | Image browser |
| Accessibility | Embedded in Playwright HTML report | Via `--reporter=html` |

## CI Integration

| Workflow | Trigger | What runs |
|----------|---------|-----------|
| `.github/workflows/pr-checks.yml` | Every PR | Lint, typecheck, unit tests, smoke E2E, pgTAP |
| `.github/workflows/pre-merge.yml` | `ready-to-merge` label | Regression E2E, API contracts, pgTAP full |
| `.github/workflows/nightly.yml` | Daily 02:00 UTC | Full E2E, visual regression, accessibility, performance, nightly report |

## Test Data

- 6 test users created/cleaned up via Supabase Admin API in `global-setup.ts` / `global-teardown.ts`
- 1 test project seeded for navigation/permissions tests
- All test data uses `TEST_` prefixes (e.g., `test-unit-alpha`, `test-project`)
- Crucially isolated from production data — no crossover

## Writing Tests

- Follow existing patterns in each suite
- Page objects in `tests/e2e/pages/`
- Helpers in `tests/e2e/helpers/`
- Test user fixtures in `tests/e2e/fixtures/test-users.ts`
- Test data fixtures in `tests/e2e/fixtures/test-data.ts`
- Permissions tests use `ACCESS_MATRIX` — add new paths there
- Visual tests require baseline snapshot on first run (run `--update-snapshots`)
