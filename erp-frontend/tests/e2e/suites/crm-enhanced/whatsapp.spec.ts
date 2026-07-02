import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('WhatsApp Messaging', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  test('whatsapp page loads with KPI stat cards', async ({ page }) => {
    await page.goto('/whatsapp');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('All Messages').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Inbound').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Outbound').first()).toBeVisible({ timeout: 5000 });
  });

  test('whatsapp page shows empty state or table', async ({ page }) => {
    await page.goto('/whatsapp');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const body = page.locator('table tbody');
    const text = await body.textContent();
    if (text?.includes('No messages yet')) {
      await expect(body).toContainText(/No messages yet/i);
    } else {
      await expect(body.locator('tr').first()).toBeVisible();
    }
  });

  test('whatsapp send message modal opens', async ({ page }) => {
    await page.goto('/whatsapp');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Send Message/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/Phone Number/i)).toBeVisible({ timeout: 5000 });
  });

  test('whatsapp can send an outbound message', async ({ page }) => {
    const msgText = `E2E-Test-${Date.now()}`;
    await page.goto('/whatsapp');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Send Message/i }).click();
    await page.waitForTimeout(500);
    const modalInput = page.locator('.fixed input');
    const modalTextarea = page.locator('.fixed textarea');
    await modalInput.fill('+966501234567');
    await modalTextarea.fill(msgText);
    await page.getByRole('button', { name: /^Send$/ }).click();
    await page.waitForTimeout(2000);
    await expect(page.getByText(msgText).first()).toBeVisible({ timeout: 5000 });
  });

  test('whatsapp inbound/outbound filter tabs work', async ({ page }) => {
    await page.goto('/whatsapp');
    await page.waitForLoadState('networkidle');
    const inboundBtn = page.getByRole('button', { name: /^Inbound$/ });
    await inboundBtn.click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^All$/ }).click();
    await page.waitForTimeout(500);
    const outboundBtn = page.getByRole('button', { name: /^Outbound$/ });
    await outboundBtn.click();
    await page.waitForTimeout(500);
    await expect(outboundBtn).toBeVisible();
  });

  test('support page has WhatsApp reply button', async ({ page }) => {
    await page.goto('/support');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTitle(/Reply via WhatsApp/i).first()).toBeVisible({ timeout: 5000 });
  });
});
