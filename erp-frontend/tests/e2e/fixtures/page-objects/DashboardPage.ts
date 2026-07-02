import type { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly statCards: Locator;
  readonly welcomeMessage: Locator;
  readonly recentActivity: Locator;

  constructor(page: Page) {
    this.page = page;
    this.statCards = page.locator('.stat-glass');
    this.welcomeMessage = page.locator('h1, h2').first();
    this.recentActivity = page.locator('[data-testid="recent-activity"], .glass-card');
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  getStatCardCount() {
    return this.statCards.count();
  }

  async isLoaded(): Promise<boolean> {
    try {
      await this.page.waitForSelector('.welcome-gradient', { timeout: 10000 });
      await this.page.waitForLoadState('networkidle');
      return true;
    } catch {
      return false;
    }
  }
}
