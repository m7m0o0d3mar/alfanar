# ERP Project Guide

## Project Structure
- `D:\OpenCode\ERP\erp-frontend\` — React + Vite + TypeScript + Tailwind frontend
- `D:\OpenCode\ERP\database\` — SQL migration files (001–057)
- `D:\OpenCode\ERP\scripts\` — Node.js utility scripts

## Commands (run from `erp-frontend/`)
- `npm run dev` — Vite dev server
- `npm run build` — TypeScript check + Vite production build
- `npm run test` — Vitest unit tests (90 tests, 5 test files)
- `npm run lint` — ESLint check (0 errors, 0 warnings)
- `npm run typecheck` — `tsc --noEmit`
- `npm run preview` — Serve built app on `http://0.0.0.0:3000`
- `npm run serve` — Same as preview (alias)
- `npx vite build` — Direct Vite build
- E2E tests: `npx playwright test --project=<name>` (config at root `playwright.config.ts`, 376 tests in 18 files)

## Supabase
- Project: `epxxsgensnimdskcmvdj`
- URL: `https://epxxsgensnimdskcmvdj.supabase.co`
- Service key in `erp-frontend/.env` (NOT hardcoded in source)
- Migrations: `supabase db push --linked` or execute SQL via dashboard
- `supabase db query --linked` — escape hatch for raw SQL when REST blocks `exec_sql`
- `auth.uid()` returns null with service key → `is_admin()` unusable in SECURITY DEFINER functions via REST

## Deployment
- **Cloudflare Pages**: `https://alfanar-erp.pages.dev` and `https://alfanar-c0q.pages.dev`
- **Vercel** (alternative): `vercel.json` at project root (`rootDirectory: erp-frontend`). To deploy:
  1. Push repo to GitHub
  2. Connect repo in Vercel dashboard (import project, framework=Vite, output=dist)
  3. Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  4. Auto-deploys on push to main
- GitHub Actions: `.github/workflows/deploy-vercel.yml` for CI/CD to Vercel (needs `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets)
- Local preview: `npm run serve` serves production build on `http://192.168.8.129:3000` (accessible on LAN)
- `wrangler` 4.104.0 logged in with OAuth
- Deploy to CF: `npm run build && npx wrangler pages deploy dist --project-name=alfanar-erp`
- **Vite on Windows**: default binding is IPv6-only (`[::1]`). Use `--host 0.0.0.0` to bind IPv4: `npm run dev -- --host 0.0.0.0`

## Key Conventions
- `useT()` hook for i18n (Arabic/English bilingual)
- `useToast()` for user notifications
- Tailwind CSS with CSS variables for theming (`var(--color-*)`)
- `stat-glass`, `glass-card`, `card`, `btn-primary`, `btn-secondary`, `btn-sm` utility classes
- Inline styles for dynamic theme colors (not Tailwind classes)
- `import type { LucideIcon } from 'lucide-react'` for icon types
- TypeScript `strict: true` in tsconfig
- ESLint: `prefer-const: error`, `react-hooks/exhaustive-deps: warn`
- Action buttons gated with `{hasPermission('module_key') && ...}` — 23 pages wired

## Common Patterns
- async data loading: `useEffect` → `load()` function with try/catch/finally
- CRUD tables: filter with `useDebounce`, paginate with `<Pagination>`, export with `exportCSV`
- Auth: `useAuth()` provides `{ user, signOut, effectiveRole, canAccessModule }`
- Theme: `useTheme()` provides `{ theme, toggleTheme, language, setLanguage }`
- Settings: `useSettings()` provides `{ settings }` from DB

## Known Issues
- `localStorage.getItem()` must always be wrapped in try/catch (private browsing blocks it)
- Empty `catch { }` blocks should at minimum have `console.error`
- Tab key `setTab(key as any)` should use `as const` on the array instead
- Supabase types from `.select()` use `as Type[]` casts — no runtime validation
- `exec_sql` RPC unavailable via service key (auth.uid() returns null); use dashboard or `supabase db query`
- **Circular chunk deps**: splitting `react`/`react-dom`/`react-*` into separate chunks causes deadlock on load (white page). Keep all `react` packages in the same chunk.
- **leaflet-draw**: Must `import 'leaflet-draw'` (the JS) in addition to the CSS import, otherwise `(L as any).Draw` is undefined at runtime.
