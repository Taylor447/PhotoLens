import { defineConfig } from '@playwright/test';
import process from 'node:process';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  outputDir: 'tests/results',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    browserName: 'chromium',
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: process.platform === 'win32' ? 'npm.cmd run dev -- --host 127.0.0.1 --port 4174' : 'npm run dev -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
