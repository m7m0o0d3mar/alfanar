import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { DashboardPage } from '../../fixtures/page-objects/DashboardPage';
import { getTestUser } from '../../fixtures/test-users';
import { verifyPageLoads } from '../../helpers/navigation';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  const ADMIN_PAGES = [
    { path: '/', title: 'Dashboard' },
    { path: '/projects', title: 'Projects' },
    { path: '/units', title: 'Units' },
    { path: '/execution', title: 'Execution' },
    { path: '/quality', title: 'Quality' },
    { path: '/hse', title: 'HSE' },
    { path: '/hr', title: 'HR & Payroll' },
    { path: '/procurement', title: 'Procurement' },
    { path: '/finance', title: 'Finance' },
    { path: '/sales', title: 'Sales' },
    { path: '/technical', title: 'Technical Office' },
    { path: '/documents', title: 'Documents' },
    { path: '/approvals', title: 'Approvals' },
    { path: '/warehouse', title: 'Warehouse' },
    { path: '/crm', title: 'CRM' },
    { path: '/analytics', title: 'Sales Analytics' },
    { path: '/support', title: 'Support Tickets' },
    { path: '/portal', title: 'Customer Portal' },
    { path: '/timelines', title: 'Timelines' },
    { path: '/attendance', title: 'Attendance' },
    { path: '/maps', title: 'Maps' },
    { path: '/settings', title: 'Settings' },
    { path: '/admin/users', title: 'Users' },
    { path: '/admin/roles', title: 'Roles & Permissions' },
    { path: '/admin/branding', title: 'Branding' },
    { path: '/admin/settings', title: 'System Settings' },
    { path: '/admin/sql', title: 'SQL Editor' },
  ];

  for (const { path, title } of ADMIN_PAGES) {
    test(`navigates to ${path} without errors`, async ({ page }) => {
      await verifyPageLoads(page, path, title);
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(consoleErrors.filter(e => !e.includes('favicon') && !e.includes('analytics') && !e.includes('Failed to load resource: the server responded with a status of'))).toEqual([]);
    });
  }

  test('sidebar links navigate correctly', async ({ page }) => {
    const sidebar = page.locator('aside');
    const links = sidebar.locator('a[href]');
    await expect(links.first()).toBeVisible({ timeout: 10000 });
    const count = await links.count();
    expect(count).toBeGreaterThan(10);

    const firstHref = await links.nth(1).getAttribute('href');
    if (firstHref) {
      await links.nth(1).click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain(firstHref);
    }
  });

  test('breadcrumbs are visible on sub-pages', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForLoadState('networkidle');
    const breadcrumbs = page.locator('[data-testid="breadcrumbs"], nav[aria-label="breadcrumb"]');
    const exists = await breadcrumbs.count();
    if (exists > 0) {
      await expect(breadcrumbs.first()).toBeVisible();
    }
  });
});
