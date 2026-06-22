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
    // Defense-in-depth vs. globalSetup: if a GM logs in AFTER the smoke check
    // (or someone bypasses globalSetup), the "Gamemaster" option is disabled
    // and `selectOption` would hang for the full 60 s fixture timeout. Detect
    // it and throw the same actionable message immediately.
    const gmDisabled = await userSelect
      .locator('option', { hasText: 'Gamemaster' })
      .first()
      .evaluate(o => o.disabled)
      .catch(() => false)
    if (gmDisabled) {
      throw new Error(
        'A Gamemaster is already logged into Foundry (the "Gamemaster" join option ' +
        'is disabled). Close the Foundry browser tab logged in as GM and re-run — ' +
        'only one GM session is allowed at a time.'
      )
    }
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
    },

    // Auto-fixture: keep the reused session from bleeding state between tests.
    // The page is NOT reset between tests, so a spec that creates actors /
    // tokens — and skips its own cleanup because it threw first — would leave
    // them on the shared canvas for later tests (stray tokens perturb
    // token-distance rules; leftover targets/selection perturb target-driven
    // rolls). After each test we clear targets + selection and delete the
    // actors it created plus those actors' tokens on every scene. We do NOT
    // delete scenes: the canvas-probe specs create one only when none exists
    // and then reuse it, so leaving it persistent keeps the canvas settled —
    // deleting it would re-init the canvas mid-run and `game.canvas.dimensions`
    // would briefly go stale, flaking the live-token distance tests. Stray
    // tokens are cleaned by actor (deleting an actor removes its tokens), which
    // is lightweight and does not churn the canvas. Best-effort: failures here
    // never fail the test.
    cleanWorldState: [async ({ page }, use) => {
      await page.evaluate(() => {
        globalThis.__dccBaseline = { actors: game.actors.contents.map(a => a.id) }
      }).catch(() => {})

      await use()

      await page.evaluate(async () => {
        const baseline = globalThis.__dccBaseline || { actors: [] }
        try { await game.user?.updateTokenTargets?.([]) } catch { /* best effort */ }
        try { game.canvas?.tokens?.releaseAll?.() } catch { /* best effort */ }
        try {
          const baseActors = new Set(baseline.actors)
          const newActorIds = game.actors.contents.map(a => a.id).filter(id => !baseActors.has(id))
          if (newActorIds.length) {
            const newSet = new Set(newActorIds)
            for (const scene of game.scenes.contents) {
              const strayIds = scene.tokens.filter(t => newSet.has(t.actorId)).map(t => t.id)
              if (strayIds.length) await scene.deleteEmbeddedDocuments('Token', strayIds)
            }
            await Actor.deleteDocuments(newActorIds)
          }
        } catch { /* best effort */ }
      }).catch(() => {})
    }, { auto: true }]
  })
}

// OS-level network blips (macOS App Nap throttling the Chromium tab, Wi-Fi
// power-management cycles, lid-sleep windows) surface as these Chromium error
// codes plus Foundry's Socket.IO reconnect notice. They are environmental, not
// system bugs — filter them out of any zero-console-error gate.
const TRANSIENT_NETWORK_ERRORS = [
  'ERR_NETWORK_IO_SUSPENDED',
  'ERR_SOCKET_NOT_CONNECTED',
  'lost connection to the server, attempting to re-establish'
]

/** Reduce a captured console-error array to the entries that should fail a test. */
function significantConsoleErrors (consoleErrors) {
  return consoleErrors.filter(err =>
    !err.includes('favicon.ico') &&
    !TRANSIENT_NETWORK_ERRORS.some(t => err.includes(t))
  )
}

/**
 * Open an actor's sheet by clicking its name in the Actors sidebar, then wait
 * for the body to render. `_prepareContext` does async class setup + a
 * re-render; wait for the nav tabs (structural signal the body rendered) then
 * settle 1.5 s for the re-render — a tighter 750 ms occasionally flaked, and
 * this still beats a blind 2 s sleep.
 */
async function openActorSheet (page, actorName) {
  await page.click('button[data-tab="actors"]')
  await page.waitForSelector('#actors.active', { timeout: 5000 })
  await page.click(`.entry-name:has-text("${actorName}")`)
  await page.waitForSelector('.dcc.actor.sheet', { timeout: 10000 })
  await page.waitForSelector('.dcc.actor.sheet nav [data-tab]', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1500)
}

module.exports = {
  base,
  expect,
  createSessionTest,
  login,
  assertFoundryUp,
  openActorSheet,
  significantConsoleErrors,
  TRANSIENT_NETWORK_ERRORS,
  FOUNDRY_URL
}
