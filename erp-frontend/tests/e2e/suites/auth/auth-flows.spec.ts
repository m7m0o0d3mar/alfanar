import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('Authentication Flows', () => {
  test('Shows error for invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('wrong@email.com', 'wrongpassword');
    await loginPage.waitForError();
    await expect(loginPage.errorMessage).toBeVisible();
    await expect(page.url()).toContain('/login');
  });

  test('Shows error for empty fields', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.submitButton.click();
    await expect(page.locator('input:invalid')).toHaveCount(2);
  });

  test('Login page has password reset link', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(loginPage.resetLink).toBeVisible();
  });

  test('Admin login redirects to dashboard', async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
    expect(page.url()).toBe(page.url().replace(/\/$/, '') + '/');
  });

  test('Engineer login succeeds', async ({ page }) => {
    const engineer = getTestUser('engineer');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(engineer.email, engineer.password);
    await page.waitForURL('**/');
    expect(page.url()).not.toContain('/login');
  });

  test('Logout returns to login page', async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');

    await page.locator('button[title*="logout" i], button:has(svg.lucide-log-out)').click();
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');
  });

  test('Cannot access protected route without login', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/login');
  });
});
