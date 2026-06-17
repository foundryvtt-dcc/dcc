// @ts-check
const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './',
  // Fast-fail smoke check (Foundry up? GM slot free?) before any test runs, so
  // a stale GM login doesn't make all ~160 tests time out one-by-one. See
  // global-setup.js + docs/dev/TESTING.md#browser-tests-playwright.
  globalSetup: require.resolve('./global-setup.js'),
  fullyParallel: false, // Run tests sequentially for Foundry stability
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for Foundry
  reporter: process.env.CI ? 'html' : [['list', { printSteps: true }]],
  timeout: 60000, // 60 seconds per test
  use: {
    baseURL: 'http://localhost:30000',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
  // No webServer config - user must start Foundry manually
  // Launch Foundry with: npx @foundryvtt/foundryvtt-cli launch --world=automated_testing
  // Tests will automatically log in as Gamemaster
})
