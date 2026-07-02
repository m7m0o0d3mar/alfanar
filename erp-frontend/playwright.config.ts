import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e/suites',
  globalSetup: './tests/e2e/global-setup',
  globalTeardown: './tests/e2e/global-teardown',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ['html', { outputFolder: 'tests/reports/playwright-html', open: 'never' }],
    ['json', { outputFile: 'tests/reports/playwright-results.json' }],
    ['list'],
    ['junit', { outputFile: 'tests/reports/playwright-junit.xml' }],
  ],
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: BASE_URL,
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'smoke',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      testMatch: /suites\/smoke\/.*\.spec\.ts/,
    },
    {
      name: 'auth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /suites\/auth\/.*\.spec\.ts/,
    },
    {
      name: 'navigation',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /suites\/navigation\/.*\.spec\.ts/,
    },
    {
      name: 'permissions',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /suites\/permissions\/.*\.spec\.ts/,
    },
    {
      name: 'regression',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /suites\/regression\/.*\.spec\.ts/,
    },
    {
      name: 'critical-workflows',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /suites\/critical-workflows\/.*\.spec\.ts/,
    },
    {
      name: 'visual',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      testMatch: /suites\/visual\/.*\.spec\.ts/,
    },
    {
      name: 'visual-mobile',
      use: {
        ...devices['iPhone 13'],
      },
      testMatch: /suites\/visual\/.*\.spec\.ts/,
    },
    {
      name: 'hse',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /suites\/hse\/.*\.spec\.ts/,
    },
    {
      name: 'admin',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /suites\/admin\/.*\.spec\.ts/,
    },
    {
      name: 'crm-enhanced',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /suites\/crm-enhanced\/.*\.spec\.ts/,
    },
    {
      name: 'communication',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /suites\/communication\/.*\.spec\.ts/,
    },
    {
      name: 'accessibility',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /suites\/accessibility\/.*\.spec\.ts/,
    },
    {
      name: 'all',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /suites\/.*\.spec\.ts/,
    },
  ],
});
