import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('Chat', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  test('chat page loads with sidebar and empty state', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Chat').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('Search conversations...')).toBeVisible();
    await expect(page.getByText('Select a conversation').first()).toBeVisible({ timeout: 5000 });
  });

  test('chat new conversation modal opens', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /New/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('New Conversation')).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder('Search users...')).toBeVisible();
  });

  test('chat user search works in new conversation modal', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /New/i }).click();
    await page.waitForTimeout(500);
    const searchInput = page.getByPlaceholder('Search users...');
    await searchInput.fill('a');
    await page.waitForTimeout(1000);
    await expect(page.getByText('No users found').or(page.locator('.rounded-lg button').first())).toBeVisible({ timeout: 5000 });
  });

  test('chat sidebar shows conversations list', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const sidebar = page.locator('.w-80');
    const convoList = sidebar.locator('button');
    const count = await convoList.count();
    if (count > 0) {
      await convoList.first().click();
      await page.waitForTimeout(500);
      await expect(page.getByText(/Type a message/i).first()).toBeVisible({ timeout: 5000 });
    } else {
      await expect(sidebar.getByText(/No conversations/i)).toBeVisible();
    }
  });
});
