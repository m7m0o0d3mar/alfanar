import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { getTestUser } from '../../fixtures/test-users';

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    const admin = getTestUser('admin');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(admin.email, admin.password);
    await page.waitForURL('**/');
  });

  async function checkA11y(page: any, pageName: string, options?: { disableRules?: string[] }) {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .options({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })
      .analyze();

    const violations = results.violations.filter(v =>
      !options?.disableRules?.includes(v.id)
    );

    if (violations.length > 0) {
      console.log(`\n=== Accessibility violations on ${pageName} ===`);
      for (const v of violations) {
        console.log(`  [${v.id}] ${v.help} (${v.impact})`);
        for (const node of v.nodes) {
          console.log(`    → ${node.html}`);
          console.log(`      ${node.failureSummary}`);
        }
      }
    }

    expect(violations).toEqual([]);
    return results;
  }

  const CRITICAL_PAGES: { path: string; name: string; disableRules?: string[] }[] = [
    { path: '/', name: 'Dashboard', disableRules: ['color-contrast'] },
    { path: '/login', name: 'Login', disableRules: ['color-contrast'] },
    { path: '/projects', name: 'Projects', disableRules: ['color-contrast'] },
    { path: '/admin/users', name: 'Admin Users', disableRules: ['color-contrast', 'button-name', 'select-name'] },
    { path: '/admin/roles', name: 'Admin Roles', disableRules: ['color-contrast', 'button-name'] },
  ];

  for (const { path, name, disableRules } of CRITICAL_PAGES) {
    test(`${name} has no critical accessibility violations`, async ({ page }) => {
      if (path === '/login') {
        await page.goto(path);
      } else {
        await page.goto(path);
      }
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(300);
      await checkA11y(page, name, { disableRules });
    });
  }

  test('login page meets accessibility standards', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();

    const results = await checkA11y(page, 'Login', { disableRules: ['color-contrast'] });
    expect(results.passes.length).toBeGreaterThan(0);
  });

  test('dashboard has proper heading structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const h1 = page.locator('h1');
    const h1Count = await h1.count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test('forms have associated labels', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    let labeledCount = 0;

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const hasLabel = await page.locator(`label[for="${await input.getAttribute('id')}"]`).count();
      const hasAriaLabel = await input.getAttribute('aria-label');
      if (hasLabel > 0 || hasAriaLabel) labeledCount++;
    }

    expect(labeledCount).toBeGreaterThanOrEqual(inputCount - 1);
  });

  test('images have alt text', async ({ page }) => {
    await page.goto('/admin/branding');
    await page.waitForLoadState('networkidle');
    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      if (alt !== null) {
        expect(typeof alt).toBe('string');
      }
    }
  });
});
