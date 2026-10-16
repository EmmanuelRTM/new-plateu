import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/._*'], // exFAT AppleDouble files are not tests
  timeout: 60_000,
  retries: 0,
  workers: 1, // headless WebGL renders at a few fps; run specs one at a time
  // Headless Chromium rasterises in software, so a small viewport keeps the frame rate usable.
  use: { baseURL: 'http://127.0.0.1:5173', headless: true, viewport: { width: 800, height: 450 } },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
