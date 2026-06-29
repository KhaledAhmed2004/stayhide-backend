import { defineConfig } from 'vitest/config';
import PremiumReporter from './vitest-custom-reporter';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,js}', 'load-tests/__tests__/**/*.test.{ts,js}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 30000,
    passWithNoTests: true,
    reporters: ['default', new PremiumReporter()],
  },
});

