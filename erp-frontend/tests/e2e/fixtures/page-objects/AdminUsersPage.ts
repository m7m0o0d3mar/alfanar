import type { Page, Locator } from '@playwright/test';

export class AdminUsersPage {
  readonly page: Page;
  readonly inviteButton: Locator;
  readonly userTable: Locator;
  readonly roleSelects: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.inviteButton = page.locator('button:has-text("Invite User")');
    this.userTable = page.locator('table');
    this.roleSelects = page.locator('table select');
    this.searchInput = page.locator('input[placeholder*="Search"]');
  }

  async goto() {
    await this.page.goto('/admin/users');
    await this.page.waitForLoadState('networkidle');
  }

  getUserRow(email: string): Locator {
    return this.page.locator(`tr:has-text("${email}")`);
  }

  async changeUserRole(email: string, newRole: string) {
    const row = this.getUserRow(email);
    const select = row.locator('select');
    await select.selectOption(newRole);
    await this.page.waitForTimeout(500);
  }
}
