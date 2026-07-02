import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('ZATCA E-Invoicing', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  test('zatca page loads with KPI stat cards', async ({ page }) => {
    await page.goto('/zatca');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Total Invoices').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Draft').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Reported').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Cancelled').first()).toBeVisible({ timeout: 5000 });
  });

  test('zatca page shows data or empty state', async ({ page }) => {
    await page.goto('/zatca');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const body = page.locator('table tbody');
    const text = await body.textContent();
    if (text?.includes('No e-invoices yet')) {
      await expect(body).toContainText(/No e-invoices yet/i);
    } else {
      await expect(body.locator('tr').first()).toBeVisible();
    }
  });

  test('zatca create invoice form opens', async ({ page }) => {
    await page.goto('/zatca');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /New Invoice/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/Buyer Name/i)).toBeVisible({ timeout: 5000 });
  });

  test('zatca can create a new invoice', async ({ page }) => {
    await page.goto('/zatca');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /New Invoice/i }).click();
    await page.waitForTimeout(500);
    const inputs = page.locator('.fixed input');
    await inputs.nth(0).fill('Test Buyer Company');
    await inputs.nth(1).fill('300123456700003');
    await inputs.nth(2).fill('Consulting Services');
    await inputs.nth(3).fill('1');
    await inputs.nth(4).fill('5000');
    await page.getByRole('button', { name: /Create Invoice/i }).click();
    await page.waitForTimeout(2000);
    await expect(page.getByText(/ZATCA-/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('zatca export button is visible', async ({ page }) => {
    await page.goto('/zatca');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /Export/i })).toBeVisible({ timeout: 5000 });
  });
});
