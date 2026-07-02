import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('Quality & Field Service', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  test('quality page shows KPI stat cards', async ({ page }) => {
    await page.goto('/quality');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Inspections').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Open NCRs').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Open CAPAs').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Avg Score').first()).toBeVisible({ timeout: 5000 });
  });

  test('quality page loads with inspection tab', async ({ page }) => {
    await page.goto('/quality');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/inspections/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('quality page has templates tab', async ({ page }) => {
    await page.goto('/quality');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Templates/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/New Template/i)).toBeVisible({ timeout: 5000 });
  });

  test('quality page has NCR tab', async ({ page }) => {
    await page.goto('/quality');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /NCR/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/New NCR/i)).toBeVisible({ timeout: 5000 });
  });

  test('quality page has CAPA tab', async ({ page }) => {
    await page.goto('/quality');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /CAPA/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/New CAPA/i)).toBeVisible({ timeout: 5000 });
  });

  test('quality inspections tab shows empty state', async ({ page }) => {
    await page.goto('/quality');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.getByText(/No inspections yet/i)).toBeVisible({ timeout: 5000 });
  });

  test('quality NCR tab shows empty state', async ({ page }) => {
    await page.goto('/quality');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /NCR/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(/No NCRs found/i)).toBeVisible({ timeout: 5000 });
  });

  test('quality CAPA tab shows empty state', async ({ page }) => {
    await page.goto('/quality');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /CAPA/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(/No CAPAs found/i)).toBeVisible({ timeout: 5000 });
  });

  test('quality templates tab shows seeded templates', async ({ page }) => {
    await page.goto('/quality');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Templates/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(/Site Safety Inspection/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Construction Quality Inspection/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Supplier Quality Audit/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Incoming Material Inspection/i)).toBeVisible({ timeout: 5000 });
  });

  test('quality can create a new template alongside seeded ones', async ({ page }) => {
    await page.goto('/quality');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Templates/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /New Template/i }).click();
    await page.waitForTimeout(500);
    const modalInputs = page.locator('.fixed input');
    await modalInputs.nth(0).fill('TMP-002');
    await modalInputs.nth(1).fill('Test Template Custom');
    await page.getByRole('button', { name: /Save/i }).click();
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Test Template Custom/i)).toBeVisible({ timeout: 5000 });
  });

  test('field service page shows KPI stat cards', async ({ page }) => {
    await page.goto('/field-service');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Work Orders').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Open Orders').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Equipment').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Hours Logged').first()).toBeVisible({ timeout: 5000 });
  });

  test('field service page loads with work orders tab', async ({ page }) => {
    await page.goto('/field-service');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Work Orders/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('field service page has equipment tab', async ({ page }) => {
    await page.goto('/field-service');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Equipment/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/No equipment registered/i)).toBeVisible({ timeout: 5000 });
  });

  test('field service time tracking shows clock in button', async ({ page }) => {
    await page.goto('/field-service');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Time Tracking/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: /Clock In with GPS/i })).toBeVisible({ timeout: 5000 });
  });

  test('field service exports work orders table', async ({ page }) => {
    await page.goto('/field-service');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /Export/i })).toBeVisible({ timeout: 5000 });
  });

  test('quality exports inspections table', async ({ page }) => {
    await page.goto('/quality');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: /Export/i })).toBeVisible({ timeout: 5000 });
  });

  test('quality inspection has PDF report button if inspections exist', async ({ page }) => {
    await page.goto('/quality');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    if (count > 1) {
      await expect(page.getByTitle(/Download PDF Report/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});
