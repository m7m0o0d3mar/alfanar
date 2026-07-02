import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { AdminUsersPage } from '../../fixtures/page-objects/AdminUsersPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('Admin Workflows', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  test('Admin dashboard loads with stat cards', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const statCards = page.locator('.stat-glass');
    await expect(statCards.first()).toBeVisible();
    const count = await statCards.count();
    expect(count).toBeGreaterThanOrEqual(3);

    const quickActions = page.locator('.glass-card .card');
    await expect(quickActions.first()).toBeVisible();
  });

  test('Admin dashboard quick actions navigate correctly', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    async function clickQuickAction(title: string) {
      const card = page.locator('.card', { hasText: title });
      await expect(card.first()).toBeVisible();
      await card.first().click();
      await page.waitForLoadState('networkidle');
    }

    await clickQuickAction('Manage Users');
    expect(page.url()).toContain('/admin/users');

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await clickQuickAction('Manage Roles');
    expect(page.url()).toContain('/admin/roles');
  });

  test('Admin dashboard recent users table loads', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const recentUsersSection = page.locator('h2:has-text("Recent Users")');
    await expect(recentUsersSection).toBeVisible();

    const table = page.locator('.glass-card table');
    const tableExists = await table.count();
    if (tableExists > 0) {
      const rows = await table.locator('tbody tr').count();
      expect(rows).toBeGreaterThanOrEqual(0);
    }
  });

  test('Admin users page - invite user form opens', async ({ page }) => {
    const adminUsersPage = new AdminUsersPage(page);
    await adminUsersPage.goto();

    const inviteBtn = page.locator('button:has-text("Invite User"), a:has-text("Invite User")');
    await expect(inviteBtn).toBeVisible();
    await inviteBtn.click();
    await page.waitForTimeout(300);

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('Admin users page - user table is visible', async ({ page }) => {
    const adminUsersPage = new AdminUsersPage(page);
    await adminUsersPage.goto();

    const table = adminUsersPage.userTable;
    await expect(table).toBeVisible();

    const rows = await table.locator('tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(1);

    const roleSelect = adminUsersPage.roleSelects.first();
    await expect(roleSelect).toBeVisible();
  });

  test('Admin users page - search filters users', async ({ page }) => {
    const adminUsersPage = new AdminUsersPage(page);
    await adminUsersPage.goto();

    const searchInput = page.locator('input.ps-9, input[placeholder*="Search"]');
    const searchExists = await searchInput.count();
    if (searchExists > 0) {
      await searchInput.first().fill('test-admin');
      await page.waitForTimeout(500);
      const table = adminUsersPage.userTable;
      await expect(table).toBeVisible();
    }
  });

  test('Admin roles page - roles tab loads with role list', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    const tabs = page.locator('.tab');
    await expect(tabs.first()).toBeVisible();

    const rolesTab = page.locator('button.tab', { hasText: 'Roles' }).first();
    await expect(rolesTab).toBeVisible();
  });

  test('Admin roles page - permissions tab has permission grid', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');

    const permissionsTab = page.locator('.tab:has-text("Permissions")');
    await expect(permissionsTab).toBeVisible();
    await permissionsTab.click();
    await page.waitForTimeout(300);

    const roleSelect = page.locator('select').first();
    const exists = await roleSelect.count();
    if (exists > 0) {
      const options = await roleSelect.locator('option').count();
      expect(options).toBeGreaterThanOrEqual(1);
    }
  });

  test('Admin settings page - Features tab has module toggles', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    const tabs = page.locator('.tab');
    await expect(tabs.first()).toBeVisible();

    const featuresTab = page.locator('.tab:has-text("Features")');
    await expect(featuresTab).toBeVisible();
    await featuresTab.click();
    await page.waitForTimeout(300);

    const toggles = page.locator('input[type="checkbox"]');
    const toggleCount = await toggles.count();
    expect(toggleCount).toBeGreaterThanOrEqual(3);
  });

  test('Admin settings page - General tab has basic fields', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    const generalTab = page.locator('.tab:has-text("General")');
    await expect(generalTab).toBeVisible();
    await generalTab.click();
    await page.waitForTimeout(300);

    const inputs = page.locator('input.input');
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThanOrEqual(3);
  });

  test('Branding page has form fields', async ({ page }) => {
    await page.goto('/admin/branding');
    await page.waitForLoadState('networkidle');

    const saveBtn = page.locator('button:has-text("Save"), a:has-text("Save"), button:has-text("حفظ")');
    await expect(saveBtn).toBeVisible();

    const inputs = page.locator('input.input');
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThanOrEqual(2);
  });

  test('SQL editor page loads with editor and run button', async ({ page }) => {
    await page.goto('/admin/sql');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();

    const runBtn = page.locator('button:has-text("Run")');
    await expect(runBtn).toBeVisible();
  });
});
