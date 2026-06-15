/* eslint-disable no-undef -- `o` is a DOM <option> inside page.evaluate */
/**
 * Playwright global setup — a fast-fail smoke check that runs ONCE before the
 * entire e2e suite. Its job is to turn the two slow, opaque failure modes
 * (Foundry not running; a Gamemaster already logged in) into an immediate,
 * actionable abort instead of letting all ~160 tests each burn the 60 s
 * per-test setup timeout.
 *
 * Why this exists: when a GM is already logged into the world (e.g. you left a
 * Foundry browser tab open), the `/join` page renders the "Gamemaster" option
 * **disabled**. Playwright's `selectOption` then waits for that option to become
 * actionable until the 60 s fixture timeout fires — and because the session
 * fixture is worker-scoped, every test re-runs login and re-times-out. A full
 * suite that should take ~6 min instead grinds for ~25+ min and fails every
 * test. A globalSetup throw aborts the run before any test starts, in seconds.
 */
const { chromium } = require('@playwright/test')
const { FOUNDRY_URL } = require('./fixtures')

const LAUNCH_HINT =
  'Start Foundry before running tests (see docs/dev/TESTING.md):\n' +
  '  nvm use 24\n' +
  '  npx @foundryvtt/foundryvtt-cli launch --world=v14\n'

/**
 * A fresh Foundry boot can park on the license / EULA screen — `/join` then
 * redirects there and the user picker never renders (the "Software license
 * verification failed. Please confirm…" boot state). When it's just an
 * *unsigned EULA* (a valid license key is present, only the agreement needs
 * re-confirming) we can self-heal: tick the agree box (#eula-agree) and submit
 * (#sign) — the same "check the box and submit" a human would do — so the suite
 * doesn't abort on it. A missing license *key* genuinely can't be supplied here,
 * so surface that distinctly. Returns true if it accepted an EULA (the caller
 * should then re-navigate to /join). Selectors mirror Foundry v14's
 * templates/setup/parts/eula-form.hbs + templates/views/license.hbs.
 */
async function acceptEulaIfPresent (page) {
  const eulaAgree = page.locator('#eula-agree')
  if (await eulaAgree.isVisible({ timeout: 2000 }).catch(() => false)) {
    await eulaAgree.check()
    await page.locator('#sign').click()
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    return true
  }
  const keyField = page.locator('input[name="licenseKey"]')
  if (await keyField.isVisible({ timeout: 500 }).catch(() => false)) {
    throw new Error(
      `Foundry is on the license-key entry screen at ${FOUNDRY_URL}/license — no ` +
      'valid license key is configured, which the e2e suite cannot supply ' +
      'automatically. Enter your license key in Foundry once, then re-run.'
    )
  }
  return false
}

module.exports = async function globalSetup () {
  // 1. Is the Foundry server reachable at all?
  let serverUp = false
  try {
    serverUp = (await fetch(`${FOUNDRY_URL}/`, { signal: AbortSignal.timeout(5000) })).ok
  } catch {
    serverUp = false
  }
  if (!serverUp) {
    throw new Error(`Could not connect to Foundry VTT at ${FOUNDRY_URL}.\n\n${LAUNCH_HINT}`)
  }

  // 2. Can a fresh session claim the Gamemaster slot? Probe the /join page
  //    WITHOUT actually joining (we only inspect the option, never click), so
  //    we don't consume the GM slot the real test worker needs.
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(`${FOUNDRY_URL}/join`, { waitUntil: 'domcontentloaded', timeout: 15000 })

    // Foundry renders the /join user picker client-side after fetching world
    // data, so give it the same patience login() does (a short settle + a
    // generous visibility wait) to avoid a false fast-fail on a slow boot.
    await page.waitForTimeout(1000)

    // If we landed on the license/EULA screen instead, auto-accept an unsigned
    // EULA and return to /join so the run self-heals rather than aborting.
    if (await acceptEulaIfPresent(page)) {
      await page.goto(`${FOUNDRY_URL}/join`, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForTimeout(1000)
    }

    const userSelect = page.locator('select[name="userid"]')
    const selectVisible = await userSelect.isVisible({ timeout: 20000 }).catch(() => false)
    if (!selectVisible) {
      throw new Error(
        `Foundry is up at ${FOUNDRY_URL} but the /join user picker never appeared ` +
        'within 20s. Make sure the **v14** world is launched and has finished ' +
        'booting (not the setup/license screen, and not a different world).\n\n' + LAUNCH_HINT
      )
    }

    const gmOption = userSelect.locator('option', { hasText: 'Gamemaster' })
    if ((await gmOption.count()) === 0) {
      throw new Error(
        'The launched world has no "Gamemaster" user. The e2e suite logs in as ' +
        '"Gamemaster" (see fixtures.js login()). Launch the v14 test world: ' +
        `${FOUNDRY_URL}\n\n${LAUNCH_HINT}`
      )
    }

    const gmDisabled = await gmOption.first().evaluate(o => o.disabled).catch(() => false)
    if (gmDisabled) {
      throw new Error(
        'A Gamemaster is already logged into Foundry — the "Gamemaster" option on ' +
        `the ${FOUNDRY_URL}/join screen is disabled, so Playwright cannot establish ` +
        'its own GM session and every test would time out (60 s each).\n\n' +
        'Close the Foundry browser tab where you are logged in as Gamemaster, then ' +
        're-run the suite. (If you need to stay logged in there, log that tab out of ' +
        'the world first — only one GM session is allowed at a time.)'
      )
    }
  } finally {
    await browser.close()
  }
}
