import type { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly resetLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('form .rounded-lg.text-sm');
    this.resetLink = page.locator('button:has-text("نسيت كلمة المرور"), button:has-text("Forgot Password")');
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async waitForError() {
    await this.errorMessage.first().waitFor({ state: 'visible', timeout: 10000 });
  }

  isLoggedIn(): Promise<boolean> {
    return this.page.locator('[data-testid="sidebar"]').isVisible().catch(() => false);
  }
}
