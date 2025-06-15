// @ts-check
const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:30000',
    trace: 'on-first-retry'
  },
  expect: {
    toHaveScreenshot: {
      mode: 'only-changed',
      threshold: 0.2
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testDir: './',
      snapshotDir: './baseline/screenshots'
    }
  ],
  webServer: {
    command: 'npm run start-foundry',
    port: 30000,
    reuseExistingServer: !process.env.CI
  }
})
