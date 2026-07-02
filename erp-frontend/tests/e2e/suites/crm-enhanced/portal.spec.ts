import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('Customer Portal', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  test('portal page loads with stats and greeting', async ({ page }) => {
    await page.goto('/portal');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Customer Portal/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /My Tickets/i })).toBeVisible();
  });

  test('portal shows KPI stat cards', async ({ page }) => {
    await page.goto('/portal');
    await page.waitForLoadState('networkidle');
    const statCards = page.locator('.stat-glass');
    await expect(statCards.first()).toBeVisible({ timeout: 10000 });
    const count = await statCards.count();
    expect(count).toBe(4);
  });

  test('portal shows tickets table', async ({ page }) => {
    await page.goto('/portal');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /My Tickets/i })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.table-wrap table').first()).toBeVisible();
  });

  test('portal shows deals table', async ({ page }) => {
    await page.goto('/portal');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /Active Deals/i })).toBeVisible({ timeout: 10000 });
  });

  test('portal create ticket modal opens and submits', async ({ page }) => {
    await page.goto('/portal');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /new ticket/i }).first().click();
    await expect(page.getByText(/Create Support Ticket/i)).toBeVisible({ timeout: 5000 });
    await page.fill('input[placeholder*="Brief description"]', 'Portal test ticket');
    await page.click('button[type="submit"]');
    await expect(page.getByText(/Ticket created/i)).toBeVisible({ timeout: 10000 });
  });

  test('portal quick action cards are clickable', async ({ page }) => {
    await page.goto('/portal');
    await page.waitForLoadState('networkidle');
    const cards = page.locator('.card.cursor-pointer');
    const count = await cards.count();
    expect(count).toBe(3);
  });

  test('portal navigate to CRM via quick action', async ({ page }) => {
    await page.goto('/portal');
    await page.waitForLoadState('networkidle');
    await page.getByText(/View CRM/i).click();
    await page.waitForURL('**/crm');
    expect(page.url()).toContain('/crm');
  });
});
