import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  const VIEWPORTS = [
    { width: 1280, height: 720, name: 'desktop' },
    { width: 768, height: 1024, name: 'tablet' },
  ];

  const SNAPSHOT_PAGES = [
    { path: '/', name: 'dashboard' },
    { path: '/projects', name: 'projects' },
    { path: '/admin/users', name: 'admin-users' },
    { path: '/admin/roles', name: 'admin-roles' },
    { path: '/settings', name: 'settings-system-designer' },
    { path: '/admin/settings', name: 'admin-settings' },
  ];

  for (const { path, name } of SNAPSHOT_PAGES) {
    for (const viewport of VIEWPORTS) {
      test(`${name} at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot(`${name}-${viewport.name}.png`, {
          fullPage: true,
          animations: 'disabled',
          threshold: 0.02,
        });
      });
    }
  }

  test('login page visual at desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('login-desktop.png', {
      fullPage: true,
      animations: 'disabled',
      threshold: 0.02,
    });
  });

  test('mobile collapsed sidebar view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForURL('**/');
    await page.waitForTimeout(500);

    const menuButton = page.locator('button:has([data-lucide="Menu"]), button[aria-label="Menu"]');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(300);
    }
    await expect(page).toHaveScreenshot('mobile-sidebar-open.png', {
      animations: 'disabled',
      threshold: 0.02,
    });
  });
});
