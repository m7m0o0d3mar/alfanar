import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('Analytics & Support Pages', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  // ── Analytics Page ──
  test('analytics page loads with KPIs', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Sales Analytics');
    const statCards = page.locator('.stat-glass');
    await expect(statCards.first()).toBeVisible({ timeout: 10000 });
    await expect(statCards).toHaveCount(6);
  });

  test('analytics page shows pipeline funnel', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h2:has-text("Pipeline Funnel")')).toBeVisible({ timeout: 10000 });
    const progressBars = page.locator('.progress-bar');
    await expect(progressBars.first()).toBeVisible();
  });

  test('analytics page shows revenue trend', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h2:has-text("Revenue Trend")')).toBeVisible({ timeout: 10000 });
  });

  test('analytics page shows recent deals table', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h2:has-text("Recent Deals")')).toBeVisible({ timeout: 10000 });
    // Table should exist with header columns
    await expect(page.locator('table th:has-text("Deal Name")')).toBeVisible();
    await expect(page.locator('table th:has-text("Amount")')).toBeVisible();
    await expect(page.locator('table th:has-text("Status")')).toBeVisible();
  });

  test('analytics quick actions navigate correctly', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    const supportCard = page.locator('.card:has-text("Support Tickets")');
    await expect(supportCard).toBeVisible({ timeout: 10000 });
    await supportCard.click();
    await page.waitForURL('**/support');
    expect(page.url()).toContain('/support');
  });

  // ── Support Page ──
  test('support page loads with stats', async ({ page }) => {
    await page.goto('/support');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Support Tickets');
    // Stat cards should be visible
    const statCards = page.locator('.stat-glass');
    await expect(statCards.first()).toBeVisible({ timeout: 10000 });
    expect(await statCards.count()).toBeGreaterThanOrEqual(3);
  });

  test('support page shows ticket table', async ({ page }) => {
    await page.goto('/support');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table th:has-text("Subject")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table th:has-text("Channel")')).toBeVisible();
    await expect(page.locator('table th:has-text("Priority")')).toBeVisible();
    await expect(page.locator('table th:has-text("Status")')).toBeVisible();
  });

  test('support page create ticket form opens', async ({ page }) => {
    await page.goto('/support');
    await page.waitForLoadState('networkidle');
    const newTicketBtn = page.locator('button:has-text("New Ticket")');
    await expect(newTicketBtn).toBeVisible({ timeout: 10000 });
    await newTicketBtn.click();
    // Modal form should appear
    await expect(page.locator('h2:has-text("Create New Ticket")')).toBeVisible();
    await expect(page.locator('label:has-text("Subject")')).toBeVisible();
    await expect(page.locator('label:has-text("Description")')).toBeVisible();
    // Cancel button should close modal
    await page.locator('button:has-text("Cancel")').click();
    await expect(page.locator('h2:has-text("Create New Ticket")')).not.toBeVisible();
  });

  test('support page creates a ticket', async ({ page }) => {
    await page.goto('/support');
    await page.waitForLoadState('networkidle');
    const newTicketBtn = page.locator('button:has-text("New Ticket")');
    await expect(newTicketBtn).toBeVisible({ timeout: 10000 });
    await newTicketBtn.click();
    await expect(page.locator('h2:has-text("Create New Ticket")')).toBeVisible({ timeout: 5000 });

    const ticketSubject = `TEST-Ticket-${Date.now()}`;
    await page.locator('input[placeholder*="Brief description"]').fill(ticketSubject);
    await page.locator('textarea').first().fill('Test description for the ticket');

    await page.locator('button[type="submit"]').click();

    // Wait for modal to close and data to reload
    await expect(page.locator('h2:has-text("Create New Ticket")')).not.toBeVisible({ timeout: 15000 });

    // Ticket should appear in table
    await expect(page.locator(`text=${ticketSubject}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('support page has search', async ({ page }) => {
    await page.goto('/support');
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('input[placeholder*="Search tickets"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });

  test('support page status badges render correctly', async ({ page }) => {
    await page.goto('/support');
    await page.waitForLoadState('networkidle');
    // Priority badges
    const priorityBadges = page.locator('table .badge');
    if (await priorityBadges.count() > 0) {
      await expect(priorityBadges.first()).toBeVisible();
    }
  });
});
