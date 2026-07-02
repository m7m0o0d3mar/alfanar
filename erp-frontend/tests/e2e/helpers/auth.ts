import type { Page } from '@playwright/test';
import { LoginPage } from '../fixtures/page-objects/LoginPage';

export async function loginAs(page: Page, email: string, password: string) {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(email, password);
  await page.waitForURL('**/');
}

export async function logout(page: Page) {
  const sidebar = page.locator('[data-testid="sidebar"], aside');
  const logoutButton = sidebar.locator('button:has([data-lucide="log-out"]), button:has([data-lucide="LogOut"])');
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
  }
  await page.waitForURL('**/login');
}

export async function ensureLoggedOut(page: Page) {
  const currentUrl = page.url();
  if (!currentUrl.includes('/login')) {
    await page.goto('/login');
  }
  await page.waitForLoadState('networkidle');
}
