import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest configuration.
 *
 * `AI_PROVIDER=mock` is forced here rather than left to the developer's shell.
 * why: the test suite must never be capable of spending Gemini tokens, even if
 * a `.env.local` on the machine sets AI_PROVIDER=gemini. See tests/provider-safety.test.ts.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      AI_PROVIDER: 'mock',
      // why: keeps the suite off the .data/store.json a developer is using.
      PROJECT_SIGNAL_DATA_DIR: path.resolve(__dirname, '.data-test'),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // why: `server-only` throws outside a Server Component, which would make
      // lib/ai/gemini.ts unimportable. The stub is inert.
      'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
    },
  },
});
