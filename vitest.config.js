import { defineConfig } from 'vitest/config';

// Unit tests default to the node environment. DOM-dependent tests opt in per file with
// a leading `// @vitest-environment jsdom` comment.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    exclude: ['**/node_modules/**', '**/._*'],
    environment: 'node',
    coverage: { provider: 'v8', include: ['src/**/*.js'] },
  },
});
