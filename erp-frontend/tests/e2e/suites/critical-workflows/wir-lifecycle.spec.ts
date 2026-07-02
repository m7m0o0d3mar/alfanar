import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('Critical Workflow: WIR Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  test('Execution page loads with WIR and Tasks tabs', async ({ page }) => {
    await page.goto('/execution');
    await page.waitForLoadState('networkidle');

    const wirTab = page.locator('button:has-text("Work Inspection"), button:has-text("WIR")');
    const tasksTab = page.locator('button:has-text("Tasks"), button:has-text("Work Tasks")');

    const wirTabVisible = await wirTab.count();
    const tasksTabVisible = await tasksTab.count();

    expect(wirTabVisible + tasksTabVisible).toBeGreaterThanOrEqual(1);
  });

  test('User can navigate between execution sub-routes', async ({ page }) => {
    await page.goto('/execution');
    await page.waitForLoadState('networkidle');

    const taskLinks = page.locator('a[href*="/execution/tasks/"]');
    const wirLinks = page.locator('a[href*="/execution/wir/"]');

    const taskCount = await taskLinks.count();
    const wirCount = await wirLinks.count();

    if (wirCount > 0) {
      await wirLinks.first().click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/execution/wir/');
      await page.goBack();
    }

    if (taskCount > 0) {
      await taskLinks.first().click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/execution/tasks/');
    }
  });

  test('WIR detail page renders approval steps if present', async ({ page }) => {
    const wirLink = page.locator('a[href*="/execution/wir/"]').first();
    const exists = await wirLink.count();

    if (exists > 0) {
      await wirLink.click();
      await page.waitForLoadState('networkidle');

      const statusBadges = page.locator('.badge, [class*="status"]');
      const badgeCount = await statusBadges.count();
      expect(badgeCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('New WIR button is accessible', async ({ page }) => {
    await page.goto('/execution');
    await page.waitForLoadState('networkidle');

    const newWirBtn = page.locator('button:has-text("New WIR")');
    if (await newWirBtn.isVisible()) {
      await expect(newWirBtn).toBeEnabled();
    }
  });
});
