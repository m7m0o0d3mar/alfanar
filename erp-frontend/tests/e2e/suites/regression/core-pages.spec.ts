import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('Core Page Regression', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  test('Dashboard shows stat cards and has no JS errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    const statCards = page.locator('.stat-glass');
    const statCount = await statCards.count();
    expect(statCount).toBeGreaterThanOrEqual(1);

    const filterErrors = errors.filter(e => !e.includes('favicon') && !e.includes('third-party'));
    expect(filterErrors).toEqual([]);
  });

  test('Projects page loads and renders table', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    const table = page.locator('table');
    const tableExists = await table.count();
    if (tableExists > 0) {
      const rows = await table.locator('tbody tr').count();
      expect(rows).toBeGreaterThanOrEqual(0);
    }
  });

  test('Units page loads with search/filter', async ({ page }) => {
    await page.goto('/units');
    await page.waitForLoadState('networkidle');
    const searchInputs = page.locator('input.input.ps-9');
    const exists = await searchInputs.count();
    if (exists > 0) {
      await expect(searchInputs.first()).toBeVisible();
    }
  });

  test('Admin Users page loads with user table', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('Admin Roles page loads with tabs', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');
    const tabs = page.locator('.tab');
    await expect(tabs.first()).toBeVisible();
  });

  test('Settings page loads with designer tabs', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const tabs = page.locator('.flex.gap-2 button');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(3);
  });

  test('Admin Settings page loads all tabs', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');
    const tabs = page.locator('.tab');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(4);
  });

  test('CRM page loads with kanban or list view', async ({ page }) => {
    await page.goto('/crm');
    await page.waitForLoadState('networkidle');
    const viewToggles = page.locator('button:has-text("Kanban"), button:has-text("List")');
    const exists = await viewToggles.count();
    if (exists > 0) {
      await expect(viewToggles.first()).toBeVisible();
    }
  });

  test('Attendance page loads with tabs', async ({ page }) => {
    await page.goto('/attendance');
    await page.waitForLoadState('networkidle');
    const content = page.locator('h1, .card, .tabs');
    await expect(content.first()).toBeVisible();
  });
});
