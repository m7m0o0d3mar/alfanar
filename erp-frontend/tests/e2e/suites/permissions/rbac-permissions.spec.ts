import { test, expect } from '@playwright/test';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('RBAC Permissions', () => {
  interface AccessTest {
    role: keyof typeof getTestUser;
    path: string;
    shouldAccess: boolean;
  }

  const ACCESS_MATRIX: AccessTest[] = [
    { role: 'admin', path: '/admin/users', shouldAccess: true },
    { role: 'admin', path: '/admin/roles', shouldAccess: true },
    { role: 'admin', path: '/admin/sql', shouldAccess: true },
    { role: 'admin', path: '/execution', shouldAccess: true },

    { role: 'projectManager', path: '/execution', shouldAccess: true },
    { role: 'projectManager', path: '/projects', shouldAccess: true },
    { role: 'projectManager', path: '/admin/users', shouldAccess: false },

    { role: 'engineer', path: '/execution', shouldAccess: true },
    { role: 'engineer', path: '/quality', shouldAccess: true },
    { role: 'engineer', path: '/admin/users', shouldAccess: false },
    { role: 'engineer', path: '/finance', shouldAccess: false },

    { role: 'hse', path: '/hse', shouldAccess: true },
    { role: 'hse', path: '/projects', shouldAccess: true },
    { role: 'hse', path: '/execution', shouldAccess: false },
    { role: 'hse', path: '/admin/roles', shouldAccess: false },

    { role: 'client', path: '/projects', shouldAccess: true },
    { role: 'client', path: '/units', shouldAccess: true },
    { role: 'client', path: '/execution', shouldAccess: false },
    { role: 'client', path: '/admin/users', shouldAccess: false },
    { role: 'client', path: '/hr', shouldAccess: false },

    { role: 'finance', path: '/finance', shouldAccess: true },
    { role: 'finance', path: '/procurement', shouldAccess: true },
    { role: 'finance', path: '/execution', shouldAccess: false },
    { role: 'finance', path: '/admin/roles', shouldAccess: false },
  ];

  for (const { role, path, shouldAccess } of ACCESS_MATRIX) {
    test(`${role} ${shouldAccess ? 'can' : 'cannot'} access ${path}`, async ({ page }) => {
      const user = getTestUser(role);
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.login(user.email, user.password);
      await page.waitForURL('**/');

      await page.goto(path);
      await page.waitForLoadState('networkidle');

      if (shouldAccess) {
        expect(page.url()).toContain(path);
      } else {
        const isLogin = page.url().includes('/login');
        expect(isLogin).toBeFalsy();
        const isAdminPath = path.startsWith('/admin/');
        if (isAdminPath) {
          expect(page.url()).toBe(new URL('/', page.url()).href);
        }
      }
    });
  }

  test('admin can see admin section in sidebar', async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');

    const sidebar = page.locator('aside');
    const adminLink = sidebar.locator('a[href="/admin/users"]');
    await expect(adminLink).toBeVisible();
  });

  test('non-admin roles do NOT see admin section in sidebar', async ({ page }) => {
    const engineer = getTestUser('engineer');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(engineer.email, engineer.password);
    await page.waitForURL('**/');

    const sidebar = page.locator('aside');
    const adminLinks = [
      sidebar.locator('a[href="/admin/users"]'),
      sidebar.locator('a[href="/admin/roles"]'),
    ];
    for (const link of adminLinks) {
      await expect(link).toHaveCount(0);
    }
  });
});
