import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('Meetings', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  test('meetings page loads with tabs and empty state', async ({ page }) => {
    await page.goto('/meetings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Meetings').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Upcoming/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Past/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /New Meeting/i })).toBeVisible();
  });

  test('meetings create modal opens', async ({ page }) => {
    await page.goto('/meetings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /New Meeting/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('New Meeting').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Title *')).toBeVisible();
    await expect(page.getByText('Start Time *')).toBeVisible();
    await expect(page.getByText('Provider')).toBeVisible();
  });

  test('meetings create form validates required fields', async ({ page }) => {
    await page.goto('/meetings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /New Meeting/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Create Meeting/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/Title is required/i)).toBeVisible({ timeout: 5000 });
  });

  test('meetings recordings tab shows empty state', async ({ page }) => {
    await page.goto('/meetings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Recordings/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(/No recordings yet/i).or(page.locator('.card'))).toBeVisible({ timeout: 5000 });
  });

  test('meetings search filters cards', async ({ page }) => {
    await page.goto('/meetings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const searchInput = page.getByPlaceholder('Search...');
    await searchInput.fill('zzz-nonexistent');
    await page.waitForTimeout(500);
    await expect(page.getByText('No meetings found').first()).toBeVisible({ timeout: 5000 });
  });
});
