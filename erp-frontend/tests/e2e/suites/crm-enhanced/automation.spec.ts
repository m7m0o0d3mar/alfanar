import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('CRM Automation', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  test('deals kanban renders pipeline columns', async ({ page }) => {
    await page.goto('/crm');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /deals/i }).click();
    await page.waitForTimeout(1500);

    const stageHeaders = page.locator('.flex.gap-4.overflow-x-auto .font-semibold.text-sm');
    const count = await stageHeaders.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('deals list view renders table', async ({ page }) => {
    await page.goto('/crm');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /deals/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /List/i }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('.table-wrap table')).toBeVisible({ timeout: 5000 });
  });

  test('automation migration creates pipeline stages', async ({ page }) => {
    await page.goto('/crm');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /deals/i }).click();
    await page.waitForTimeout(1500);

    const columns = page.locator('.flex.gap-4.overflow-x-auto > div');
    const columnCount = await columns.count();
    expect(columnCount).toBeGreaterThanOrEqual(5);

    const firstHeader = await columns.first().locator('.font-semibold.text-sm').textContent();
    expect(firstHeader?.trim()).toBe('Lead');
  });
});
