/* eslint-disable no-undef -- Browser globals (game) used inside page.waitForFunction */
/**
 * Shared Playwright fixtures for the DCC e2e suite.
 *
 * Every functional spec drives a live Foundry V14 instance. Playwright's
 * default is a fresh browser context per test; against Foundry that means a
 * full `/join` navigation + login + system boot every test (~6–13 s each).
 * `createSessionTest()` returns a `test` with a **worker-scoped** `sessionPage`
 * fixture: each worker logs in ONCE and reuses the page across every test it
 * runs. The `page` override forwards `sessionPage`, so existing
 * `async ({ page }) => …` test bodies are unchanged. Per-test cleanup belongs
 * in each spec's `beforeEach` (the page is NOT reset between tests).
 *
 * This pattern cut the suite from ~840 s to ~340 s. See
 * docs/dev/TESTING.md#session-reuse-fixture.
 */
const { test: base, expect } = require('@playwright/test')

const FOUNDRY_URL = 'http://localhost:30000'

/**
 * Confirm Foundry is reachable before any test runs. Throws a helpful message
 * (with the launch command) instead of letting every test time out on login.
 */
async function assertFoundryUp () {
  let serverUp
  try {
    const response = await fetch(`${FOUNDRY_URL}/`, { signal: AbortSignal.timeout(5000) })
    serverUp = response.ok
  } catch {
    serverUp = false
  }
  if (!serverUp) {
    throw new Error(
      `Could not connect to Foundry VTT at ${FOUNDRY_URL}.\n\n` +
      'Start Foundry before running tests (see docs/dev/TESTING.md):\n' +
      '  nvm use 24\n' +
      '  npx @foundryvtt/foundryvtt-cli launch --world=v14\n'
    )
  }
}

/** Log into the running world as Gamemaster and wait for the DCC system to be ready. */
async function login (page) {
  await page.goto(`${FOUNDRY_URL}/join`)
  await page.waitForTimeout(1000)

  const isInGame = await page.locator('.game.system-dcc').isVisible({ timeout: 1000 }).catch(() => false)
  if (!isInGame) {
    const userSelect = page.locator('select[name="userid"]')
    await userSelect.waitFor({ state: 'visible', timeout: 10000 })
    await page.selectOption('select[name="userid"]', { label: 'Gamemaster' })
    await page.click('button[name="join"]')
    await page.waitForSelector('.game.system-dcc', { timeout: 30000 })
  }

  await page.waitForSelector('#actors', { timeout: 10000, state: 'attached' })
  await page.waitForFunction(() => game?.dcc?.KeyState !== undefined && !!game?.user, { timeout: 30000 })

  for (const sel of ['#dcc-welcome-dialog', '#dcc-core-book-welcome-dialog']) {
    const dialog = page.locator(sel)
    if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press('Escape')
    }
  }
}

/**
 * Build a worker-scoped session-reuse `test`.
 *
 * @param {object}   [opts]
 * @param {(msg) => void} [opts.onConsole] Attached ONCE per worker to the page's
 *   `console` event. Use it to push into spec-owned module arrays (console
 *   errors, `[DCC adapter]` dispatch logs, …). Attaching a listener per test on
 *   the reused page would leak a listener every test, so it lives here.
 * @returns Playwright `test` with `sessionPage` (worker) + `page` (forwards it).
 */
function createSessionTest ({ onConsole } = {}) {
  return base.extend({
    sessionPage: [async ({ browser }, use) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
      const page = await context.newPage()
      if (onConsole) page.on('console', onConsole)
      await login(page)
      await use(page)
      await context.close()
    }, { scope: 'worker' }],

    page: async ({ sessionPage }, use) => {
      await use(sessionPage)
    }
  })
}

module.exports = { base, expect, createSessionTest, login, assertFoundryUp, FOUNDRY_URL }
