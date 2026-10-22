/* eslint-disable no-undef -- Browser globals (game) used inside page.waitForFunction */
/**
 * Shared Playwright fixtures for the DCC e2e suite.
 *
 * Every functional spec drives a live Foundry V14 instance. Playwright's
 * default is a fresh browser context per test; against Foundry that means a
 * full `/join` navigation + login + system boot every test (~6–13 s each).
 * `createSessionTest()` returns one shared `test` with a **worker-scoped**
 * `sessionPage` fixture: the worker logs in ONCE and reuses the page across
 * every test it runs, in every spec file that uses it. The `page` override
 * forwards `sessionPage`, so existing `async ({ page }) => …` test bodies are
 * unchanged. Per-test cleanup belongs in each spec's `beforeEach` (the page is
 * NOT reset between tests or between files).
 *
 * This pattern cut the suite from ~840 s to ~340 s. See
 * docs/dev/TESTING.md#session-reuse-fixture.
 */
const { test: base, expect } = require('@playwright/test')

// Default is the live install; scripts/e2e-env.mjs points this at a
// worktree's isolated server via the FOUNDRY_URL env var (#893).
const FOUNDRY_URL = process.env.FOUNDRY_URL || 'http://localhost:30000'

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

/**
 * Prepare this browser's client-scoped settings (localStorage) before joining.
 * Runs on the /join page, which shares the game's origin.
 *
 * - Keep Foundry's welcome tour from starting. Core starts it on the first
 *   login to a world with no documents (a fresh `e2e:env` world), and its
 *   overlay then intercepts clicks in whichever spec runs first. Mark it
 *   completed unless this browser already has progress for it.
 * - On CI, render the canvas as cheaply as possible. The self-hosted runner
 *   (deploy/e2e-runner/) has no GPU, and at Foundry's defaults software
 *   WebGL ran at ~1 FPS, timing out canvas-bound specs.
 */
async function prepareClientSettings (page) {
  await page.evaluate(async (ci) => {
    if (ci) {
      const cheap = {
        'core.performanceMode': 0, // CONST.CANVAS_PERFORMANCE_MODES.LOW
        'core.maxFPS': 10,
        'core.pixelRatioResolutionScaling': false,
        'core.mipmap': false,
        'core.lightAnimation': false,
        'core.visionAnimation': false
      }
      for (const [key, value] of Object.entries(cheap)) localStorage.setItem(key, JSON.stringify(value))
    }
    const key = 'core.tourProgress'
    const progress = JSON.parse(localStorage.getItem(key) || '{}')
    if (progress.core?.welcome !== undefined) return
    const tour = await fetch('/tours/welcome.json').then(r => r.json()).catch(() => null)
    if (!tour?.steps?.length) return
    progress.core = { ...progress.core, welcome: tour.steps.length }
    localStorage.setItem(key, JSON.stringify(progress))
  }, !!process.env.CI).catch(() => {})
}

/** Log into the running world as Gamemaster and wait for the DCC system to be ready. */
async function login (page) {
  await page.goto(`${FOUNDRY_URL}/join`)

  // /join either redirects into a live session or renders the user picker
  await page.locator('.game.system-dcc, select[name="userId"]').first().waitFor({ timeout: 15000 }).catch(() => {})
  const isInGame = await page.locator('.game.system-dcc').isVisible().catch(() => false)
  if (!isInGame) {
    const userSelect = page.locator('select[name="userId"]')
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
    await prepareClientSettings(page)
    await page.selectOption('select[name="userId"]', { label: 'Gamemaster' })
    await page.click('button[name="join"]')
    await page.waitForSelector('.game.system-dcc', { timeout: 30000 })
  }

  await waitForGameReady(page)
}

/**
 * Reload the session page and wait for the system to boot again. For a spec
 * that changes in-memory registries (sheet classes, hooks, CONFIG) it can't
 * cleanly undo: the session is shared with every later spec file.
 */
async function reloadSession (page) {
  await page.reload()
  await page.waitForSelector('.game.system-dcc', { timeout: 30000 })
  await waitForGameReady(page)
  // The reload redraws the scene; don't hand the next test a canvas mid-draw.
  await page.waitForFunction(() => !game.canvas?.scene || (game.canvas.ready && !game.canvas.loading), null, { timeout: 30000 }).catch(() => {})
}

async function waitForCanvasIdle (page) {
  await page.waitForFunction(() => !game.canvas?.loading, null, { timeout: 30000 }).catch(() => {})
}

async function waitForGameReady (page) {
  await page.waitForSelector('#actors', { timeout: 10000, state: 'attached' })
  await page.waitForFunction(() => game?.dcc?.KeyState !== undefined && !!game?.user, null, { timeout: 30000 })
  // The ready hook renders the welcome dialog only after migrations finish,
  // so wait for it before closing it, or it opens over the first spec.
  await page.waitForFunction(() => !game.user.isGM || !game.settings.get('dcc', 'showWelcomeDialog') ||
    foundry.applications.instances.get('dcc-welcome-dialog')?.rendered, null, { timeout: 10000 }).catch(() => {})
  await closeWelcomeDialogs(page)
}

/**
 * Close the DCC welcome dialogs if they're open. In-page, not by pressing
 * Escape per visible dialog: a closed dialog stays visible while its close
 * animation runs, and an Escape with no window open shows the main menu,
 * which then swallowed every click in the first spec (#1081).
 */
async function closeWelcomeDialogs (page) {
  await page.evaluate(async () => {
    for (const id of ['dcc-welcome-dialog', 'dcc-core-book-welcome-dialog']) {
      const app = foundry.applications.instances.get(id)
      if (app?.rendered) await app.close()
    }
  })
}

/**
 * Page init script: defines `globalThis.dccSetUiConfig(value)`, which sets
 * `core.uiConfig` without the redraw, and `globalThis.dccChatSettled(ids)`,
 * which replaces the theme specs' fixed sleeps (below).
 *
 * `dccSetUiConfig` sets `core.uiConfig` without the redraw. The setting's onChange restyles the UI
 * and then starts an unawaited `canvas.draw()` of the viewed scene, which takes
 * 5-12 s under the runner's software WebGL and is the bulk of the theme specs'
 * time (#1081). They only need the restyle. A client setting's onChange runs
 * inside `set`, so stubbing `draw` for the call skips only the redraw, and the
 * stored value stays real for apps that read it when they render.
 */
function installUiConfigSetter () {
  globalThis.dccSetUiConfig = async value => {
    canvas.draw = async () => canvas
    try {
      return await game.settings.set('core', 'uiConfig', value)
    } finally {
      delete canvas.draw
    }
  }

  // Resolve once the stored color scheme is on the body and #interface and
  // each message id is rendered in the chat sidebar (ChatMessage.create
  // returns before the log renders it), then finish the theme's color
  // transitions so computed styles are final.
  globalThis.dccChatSettled = async (messageIds = [], timeout = 10000) => {
    const { applications, interface: iface } = game.settings.get('core', 'uiConfig').colorScheme ?? {}
    const ready = () =>
      (!applications || document.body.classList.contains(`theme-${applications}`)) &&
      (!iface || document.getElementById('interface')?.classList.contains(`theme-${iface}`)) &&
      messageIds.every(id => document.querySelector(`#chat .chat-log [data-message-id="${id}"]`))
    const deadline = Date.now() + timeout
    while (!ready()) {
      if (Date.now() > deadline) throw new Error(`chat never settled (theme ${applications}/${iface}, messages ${messageIds})`)
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    for (const animation of document.getAnimations()) {
      try { animation.finish() } catch { /* infinite animations can't finish */ }
    }
  }
}

/**
 * The one session-reuse `test` every spec shares. Playwright starts a new
 * worker for each distinct fixture set, so a `base.extend` per spec file meant
 * a fresh worker, browser and login for every file: 35 of them, ~25 s each on
 * the CPU-only runner (#1081). Built once here, every spec that uses it
 * shares one worker and one login.
 */
const sessionTest = base.extend({
  sessionPage: [async ({ browser }, use) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    await context.addInitScript(installUiConfigSetter)
    const page = await context.newPage()
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
    // Start from a settled page: no canvas draw in flight (Scene#view() bails
    // while one is, and a teardown mid-test destroys the test's tokens) and
    // no main menu over the UI.
    await waitForCanvasIdle(page)
    await removeClosedWindows(page)
    // Baseline first, on its own: a teardown without one would delete every
    // actor in the world.
    await page.evaluate(() => {
      globalThis.__dccBaseline = { actors: game.actors.contents.map(a => a.id) }
    })
    await page.evaluate(async () => {
      if (ui.menu?.rendered) await ui.menu.close({ animate: false })
    }).catch(() => {})

    await use()

    await page.evaluate(async () => {
      const baseline = globalThis.__dccBaseline
      if (!baseline) return
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

    // Let any canvas redraw the test started finish before the next test,
    // which may be in another spec file. A `core.uiConfig` change (the theme
    // specs) fires an unawaited `canvas.draw()`, and a redraw still in flight
    // drops the next test's controlled token and closes its context menu.
    await waitForCanvasIdle(page)
  }, { auto: true }]
})

/**
 * The shared session-reuse `test`, with an optional console listener scoped
 * to the calling spec file. Call it once, at the top level of the spec.
 *
 * @param {object}   [opts]
 * @param {(msg) => void} [opts.onConsole] Attached to the session page's
 *   `console` event for this file's tests only (file-level beforeAll /
 *   afterAll). Use it to push into spec-owned module arrays (console errors,
 *   `[DCC adapter]` dispatch logs, …). Attaching a listener per test on the
 *   reused page would leak a listener every test.
 * @returns Playwright `test` with `sessionPage` (worker) + `page` (forwards it).
 */
function createSessionTest ({ onConsole } = {}) {
  if (onConsole) {
    sessionTest.beforeAll(({ sessionPage }) => { sessionPage.on('console', onConsole) })
    sessionTest.afterAll(({ sessionPage }) => { sessionPage.off('console', onConsole) })
  }
  return sessionTest
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
 * Close every open window (sheets, dialogs) on the session page. `ui.windows`
 * is the AppV1 registry and is empty under V14, so walk the AppV2 registry.
 * Framed apps only: the core UI (sidebar, hotbar, chat) has no frame.
 */
async function closeWindows (page) {
  await page.evaluate(async () => {
    for (const app of [...foundry.applications.instances.values()]) {
      if (app.rendered && app.hasFrame) await app.close()
    }
  })
  await removeClosedWindows(page)
}

/**
 * Drop framed window elements whose app is gone or no longer open (ERROR,
 * CLOSING, CLOSED are all < NONE). A closed window can keep its element
 * attached (#958), and in the headless page its close animation can take
 * seconds, so a document-level query in the next test (`querySelector`
 * returns the first match) hits the old window. `cleanWorldState` runs this
 * before every test.
 */
async function removeClosedWindows (page) {
  await page.evaluate(() => {
    const { NONE } = foundry.applications.api.ApplicationV2.RENDER_STATES
    document.querySelectorAll('.application').forEach(el => {
      if (!el.querySelector(':scope > .window-header')) return
      const app = foundry.applications.instances.get(el.id)
      if (!app || app.state < NONE) el.remove()
    })
  }).catch(() => {})
}

/**
 * Wait until the app behind `selector` (the last match, the newest window) is
 * rendered and has gone `quietMs` without rendering again. A class sheet's
 * first `_prepareContext` stamps class defaults with `actor.update()`, which
 * renders it a second time, and a click that lands between the two renders
 * hits a detached part. This replaces the old fixed 0.75–2.5 s settles.
 */
async function waitForAppSettled (page, selector = '.dcc.actor.sheet', { quietMs = 250, timeout = 10000 } = {}) {
  await page.waitForSelector(selector, { timeout })
  await page.evaluate(async ({ selector, quietMs, timeout }) => {
    // Skip closed-window husks still in the DOM (stuck CLOSING, see closeWindows)
    const { RENDERING, RENDERED } = foundry.applications.api.ApplicationV2.RENDER_STATES
    const app = [...document.querySelectorAll(selector)]
      .map(el => foundry.applications.instances.get(el.closest('.application')?.id))
      .filter(a => a?.state >= RENDERING)
      .pop()
    if (!app) return
    let last = performance.now()
    const onRender = () => { last = performance.now() }
    app.addEventListener('render', onRender)
    try {
      const deadline = performance.now() + timeout
      while (performance.now() < deadline) {
        if (app.state !== RENDERED) last = performance.now()
        else if (performance.now() - last >= quietMs) return
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    } finally {
      app.removeEventListener('render', onRender)
    }
  }, { selector, quietMs, timeout })
}

/**
 * Open an actor's sheet by clicking its name in the Actors sidebar, then wait
 * for it to settle (see waitForAppSettled).
 */
async function openActorSheet (page, actorName) {
  await page.click('button[data-tab="actors"]')
  await page.waitForSelector('#actors.active', { timeout: 5000 })
  await page.click(`.entry-name:has-text("${actorName}")`)
  await waitForAppSettled(page)
}

module.exports = {
  base,
  expect,
  createSessionTest,
  login,
  reloadSession,
  prepareClientSettings,
  assertFoundryUp,
  closeWindows,
  closeWelcomeDialogs,
  openActorSheet,
  waitForAppSettled,
  significantConsoleErrors,
  TRANSIENT_NETWORK_ERRORS,
  FOUNDRY_URL
}
