import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('CRM Kanban & Related Records', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  test('deals kanban shows pipeline columns', async ({ page }) => {
    await page.goto('/crm');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /deals/i }).click();
    await page.waitForTimeout(1500);

    const columns = page.locator('.flex.gap-4.overflow-x-auto > div');
    const count = await columns.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('deals kanban has stage headers with colors', async ({ page }) => {
    await page.goto('/crm');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /deals/i }).click();
    await page.waitForTimeout(1000);

    const stageHeaders = page.locator('.flex.gap-4.overflow-x-auto .font-semibold.text-sm');
    const count = await stageHeaders.count();
    expect(count).toBeGreaterThanOrEqual(2);
    const first = await stageHeaders.first().textContent();
    expect(first?.trim()).toBeTruthy();
  });

  test('deals toggle between kanban and list view', async ({ page }) => {
    await page.goto('/crm');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /deals/i }).click();
    await page.waitForTimeout(1000);

    const listBtn = page.getByRole('button', { name: /List/i });
    await expect(listBtn).toBeVisible();

    await listBtn.click();
    await expect(page.locator('.table-wrap table')).toBeVisible({ timeout: 5000 });

    const kanbanBtn = page.getByRole('button', { name: /Kanban/i });
    await expect(kanbanBtn).toBeVisible();
    await kanbanBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator('.flex.gap-4.overflow-x-auto').first()).toBeVisible();
  });

  test('contacts tab shows empty state when no data', async ({ page }) => {
    await page.goto('/crm');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: /Contacts/i }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('button:has-text("Add Contact")').first()).toBeVisible({ timeout: 5000 });
  });
});
