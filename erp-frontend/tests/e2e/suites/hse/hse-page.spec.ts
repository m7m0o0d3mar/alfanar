import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('HSE Page', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  test('page loads with all tabs and stat cards', async ({ page }) => {
    await page.goto('/hse');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('HSE');

    const tabs = page.locator('button.tab');
    await expect(tabs).toHaveCount(6);
    await expect(tabs.nth(0)).toHaveText('Overview');
    await expect(tabs.nth(1)).toHaveText('Incidents');
    await expect(tabs.nth(2)).toHaveText('Observations');
    await expect(tabs.nth(3)).toHaveText('Audits');
    await expect(tabs.nth(4)).toHaveText('Toolbox Talks');
    await expect(tabs.nth(5)).toHaveText('PPE');

    const statCards = page.locator('.stat-glass');
    await expect(statCards).toHaveCount(6);
    await expect(statCards.first().locator('.stat-card-value')).toBeVisible();
  });

  test('quick actions are visible on overview', async ({ page }) => {
    await page.goto('/hse');
    await page.waitForLoadState('networkidle');

    const quickActions = page.locator('button.w-full.text-start.p-3.rounded-lg');
    await expect(quickActions).toHaveCount(5);
    await expect(quickActions.nth(0)).toContainText('Report Incident');
    await expect(quickActions.nth(1)).toContainText('Record Observation');
    await expect(quickActions.nth(2)).toContainText('Schedule Audit');
    await expect(quickActions.nth(3)).toContainText('Conduct Toolbox Talk');
    await expect(quickActions.nth(4)).toContainText('Issue PPE');
  });

  test('each tab switches content correctly', async ({ page }) => {
    await page.goto('/hse');
    await page.waitForLoadState('networkidle');

    for (let idx = 1; idx <= 5; idx++) {
      await page.locator('button.tab').nth(idx).click();
      await page.waitForTimeout(300);
      await expect(page.locator('button.tab').nth(idx)).toHaveClass(/tab-active/);
      await expect(page.locator('button.btn-primary.btn-sm', { hasText: 'New' }).first()).toBeVisible();
    }

    await page.locator('button.tab').nth(0).click();
    await page.waitForTimeout(300);
    await expect(page.locator('.stat-glass').first()).toBeVisible();
  });

  async function openNewForm(page: any, tabIndex: number) {
    await page.goto('/hse');
    await page.waitForLoadState('networkidle');
    await page.locator('button.tab').nth(tabIndex).click();
    await page.waitForTimeout(200);
    await page.locator('button.btn-primary.btn-sm', { hasText: 'New' }).first().click();
    await page.waitForTimeout(300);
  }

  async function selectProject(page: any) {
    const modalSelect = page.locator('.fixed.inset-0 select.input').first();
    await expect(modalSelect).toBeVisible();
    await modalSelect.locator('option').nth(1).waitFor({ state: 'attached', timeout: 5000 });
    await modalSelect.selectOption({ index: 1 });
  }

  async function clickSave(page: any) {
    await page.locator('.fixed.inset-0 button.btn-primary.btn-sm', { hasText: 'Save' }).click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.fixed.inset-0')).not.toBeVisible({ timeout: 10000 });
  }

  test('creates an incident record', async ({ page }) => {
    const suffix = Date.now();
    await openNewForm(page, 1);
    await selectProject(page);
    await page.locator('.fixed.inset-0 input.input').first().fill(`INC-E2E-${suffix}`);
    await page.locator('.fixed.inset-0 textarea.input').first().fill('E2E test incident');
    await clickSave(page);
    await expect(page.locator('table tbody')).toContainText(`INC-E2E-${suffix}`);
  });

  test('creates an observation record', async ({ page }) => {
    const suffix = Date.now();
    await openNewForm(page, 2);
    await selectProject(page);
    await page.locator('.fixed.inset-0 input.input').first().fill(`OBS-E2E-${suffix}`);
    await page.locator('.fixed.inset-0 textarea.input').first().fill('E2E test observation');
    await clickSave(page);
    await expect(page.locator('table tbody')).toContainText(`OBS-E2E-${suffix}`);
  });

  test('creates an audit record', async ({ page }) => {
    const suffix = Date.now();
    await openNewForm(page, 3);
    await selectProject(page);
    await page.locator('.fixed.inset-0 input.input').first().fill(`AUD-E2E-${suffix}`);
    await page.locator('.fixed.inset-0 label.label', { hasText: 'Auditor' }).locator('xpath=following-sibling::input').fill('E2E Auditor');
    await clickSave(page);
    await expect(page.locator('table tbody')).toContainText(`AUD-E2E-${suffix}`);
  });

  test('creates a toolbox talk record', async ({ page }) => {
    const suffix = Date.now();
    await openNewForm(page, 4);
    await selectProject(page);
    await page.locator('.fixed.inset-0 label.label', { hasText: 'Topic (English)' }).locator('xpath=following-sibling::input').fill(`E2E Safety Topic ${suffix}`);
    await clickSave(page);
    await expect(page.locator('table tbody')).toContainText(`E2E Safety Topic ${suffix}`);
  });

  test('creates a PPE record', async ({ page }) => {
    await openNewForm(page, 5);
    await selectProject(page);
    await page.locator('.fixed.inset-0 select.input').nth(1).selectOption({ label: 'hard hat' });
    await clickSave(page);
    await expect(page.locator('table tbody')).toContainText('hard hat');
  });
});
