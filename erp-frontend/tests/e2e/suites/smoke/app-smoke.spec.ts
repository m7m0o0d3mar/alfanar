import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { DashboardPage } from '../../fixtures/page-objects/DashboardPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('Smoke Tests', () => {
  test('Login page loads and renders correctly', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('Admin can log in and see dashboard', async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    const dashboard = new DashboardPage(page);

    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);

    const loaded = await dashboard.isLoaded();
    expect(loaded).toBeTruthy();
    expect(page.url()).not.toContain('/login');
  });

  test('Sidebar loads with nav items for admin', async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    const expectedLinks = ['/projects', '/units', '/execution', '/admin/users', '/admin/roles'];
    for (const link of expectedLinks) {
      await expect(sidebar.locator(`a[href="${link}"]`).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('404 page or unknown route redirects properly', async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');

    await page.goto('/nonexistent-route-xyz');
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/nonexistent-route-xyz');
  });
});
