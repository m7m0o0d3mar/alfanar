import type { Page, Locator } from '@playwright/test';

export interface NavAssertion {
  path: string;
  label: string;
  shouldExist: boolean;
}

export async function assertNavigation(page: Page, assertions: NavAssertion[]) {
  const sidebar = page.locator('aside');
  for (const { path, label, shouldExist } of assertions) {
    const link = sidebar.locator(`a[href="${path}"]`);
    if (shouldExist) {
      await link.waitFor({ state: 'visible', timeout: 5000 });
    } else {
      const count = await link.count();
      if (count > 0) {
        throw new Error(`Navigation item "${label}" (${path}) should NOT be visible but was found`);
      }
    }
  }
}

export async function verifyPageLoads(page: Page, path: string, expectedContent?: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  if (expectedContent) {
    await page.locator(`text=${expectedContent}`).first().waitFor({ state: 'visible', timeout: 10000 });
  }
}
