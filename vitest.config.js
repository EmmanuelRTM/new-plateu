import { defineConfig } from 'vitest/config';

// Unit tests default to the node environment. DOM-dependent tests opt in per file with
// a leading `// @vitest-environment jsdom` comment.
// The threads pool is used because fork workers time out starting on slow (exFAT) volumes.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    exclude: ['**/node_modules/**', '**/._*'],
    environment: 'node',
    pool: 'threads',
    coverage: { provider: 'v8', include: ['src/**/*.js'] },
  },
});
