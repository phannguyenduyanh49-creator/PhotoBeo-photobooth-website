import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1, timeout: 90_000,
  use: {
    baseURL: 'http://localhost:5173', viewport: { width: 1440, height: 1080 },
    browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  webServer: { command: 'node scripts/dev.mjs', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI, env: { PHOTO_BEO_DATA_DIR: '.test-data/e2e-' + Date.now() } },
});
