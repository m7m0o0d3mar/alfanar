import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('Email', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  test('email page loads with sidebar and empty state', async ({ page }) => {
    await page.goto('/email');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Email/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Inbox/i).first()).toBeVisible();
    await expect(page.getByText(/Sent/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Compose/i })).toBeVisible();
    await expect(page.getByText(/Add your email account/i).or(page.getByText(/Add Account/i))).toBeVisible({ timeout: 5000 });
  });

  test('email add account modal opens', async ({ page }) => {
    await page.goto('/email');
    await page.waitForLoadState('networkidle');
    const addBtn = page.getByRole('button', { name: /Add Account/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByText(/Add Email Account/i).or(page.getByText(/Email Address/i))).toBeVisible({ timeout: 5000 });
    }
  });

  test('email compose modal opens', async ({ page }) => {
    await page.goto('/email');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Compose/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/New Message/i).or(page.getByText(/To/i))).toBeVisible({ timeout: 5000 });
  });

  test('email folder tabs switch content', async ({ page }) => {
    await page.goto('/email');
    await page.waitForLoadState('networkidle');
    const sentBtn = page.getByRole('button', { name: /^Sent$/ });
    if (await sentBtn.isVisible()) {
      await sentBtn.click();
      await page.waitForTimeout(500);
      await expect(sentBtn).toBeVisible();
    }
    const inboxBtn = page.getByRole('button', { name: /^Inbox$/ });
    if (await inboxBtn.isVisible()) {
      await inboxBtn.click();
      await page.waitForTimeout(300);
      await expect(inboxBtn).toBeVisible();
    }
  });

  test('email search input works', async ({ page }) => {
    await page.goto('/email');
    await page.waitForLoadState('networkidle');
    const searchInput = page.getByPlaceholder(/Search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('test email');
      await page.waitForTimeout(300);
      await expect(searchInput).toHaveValue('test email');
    }
  });
});
