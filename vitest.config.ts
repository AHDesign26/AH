import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    exclude: ['tests/visual/**', 'node_modules/**', 'dist/**', '.astro/**'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['tests/visual/**', '**/*.config.*', '**/*.d.ts'],
    },
  },
});
