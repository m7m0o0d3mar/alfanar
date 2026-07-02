import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: ['tests/e2e/**', 'tests/api/**', 'node_modules/**'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
