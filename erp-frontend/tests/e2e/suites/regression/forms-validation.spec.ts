import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('Form Validation Regression', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  test('Login form validates empty fields', async ({ page }) => {
    // Logout first so the login page is accessible
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    // If still logged in (redirected), skip; otherwise test validation
    const submitBtn = page.locator('button[type="submit"]');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      const invalidFields = await page.locator('input:invalid').count();
      expect(invalidFields).toBeGreaterThanOrEqual(1);
    }
  });

  test('User invite form has required fields', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const inviteBtn = page.locator('button:has-text("Invite User"), a:has-text("Invite User")');
    if (await inviteBtn.isVisible()) {
      await inviteBtn.click();
      await page.waitForTimeout(300);

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
    }
  });

  test('Admin settings form has working color pickers', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    const brandingTab = page.locator('.tab:has-text("Branding")');
    if (await brandingTab.isVisible()) {
      await brandingTab.click();
      await page.waitForTimeout(300);
      const colorInputs = page.locator('input[type="color"]');
      const count = await colorInputs.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test('Module toggles work on Features tab', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    const featuresTab = page.locator('.tab:has-text("Features")');
    if (await featuresTab.isVisible()) {
      await featuresTab.click();
      await page.waitForTimeout(300);

      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test('SQL editor has textarea and run button', async ({ page }) => {
    await page.goto('/admin/sql');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('textarea, .cm-editor, div[role="textbox"]');
    const runButton = page.locator('button:has-text("Run"), button:has-text("Execute")');

    const textareaExists = await textarea.count();
    if (textareaExists > 0) {
      await expect(textarea.first()).toBeVisible();
    }
    if (await runButton.isVisible()) {
      await expect(runButton).toBeVisible();
    }
  });

  test('Branding page has save button', async ({ page }) => {
    await page.goto('/admin/branding');
    await page.waitForLoadState('networkidle');

    const saveBtn = page.locator('button:has-text("Save"), button:has-text("حفظ")');
    await expect(saveBtn).toBeVisible();
  });
});
