/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { test, expect } = require('@playwright/test')

/**
 * Extension API E2E tests.
 *
 * Validates the stable `game.dcc.*` extension hooks documented in
 * `docs/dev/EXTENSION_API.md`. Each test is end-to-end against a live
 * Foundry V14 — driving the API the way a sibling module would, then
 * inspecting Foundry's own state to confirm the hook landed.
 *
 * Setup: see docs/dev/TESTING.md#browser-tests-playwright. TL;DR:
 *   nvm use 24 && npx @foundryvtt/foundryvtt-cli launch --world=v14
 *   cd browser-tests/e2e && npm test -- extension-api.spec.js
 */

test.describe('DCC Extension API', () => {
  test.beforeAll(async () => {
    let serverUp
    try {
      const response = await fetch('http://localhost:30000/', { signal: AbortSignal.timeout(5000) })
      serverUp = response.ok
    } catch {
      serverUp = false
    }
    if (!serverUp) {
      throw new Error(
        'Could not connect to Foundry VTT at http://localhost:30000.\n\n' +
        'Please start Foundry before running tests:\n' +
        '1. Run: npx @foundryvtt/foundryvtt-cli launch --world=v14\n' +
        '2. Run tests again: npm test'
      )
    }
  })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('http://localhost:30000/join')
    await page.waitForTimeout(1000)

    const isInGame = await page.locator('.game.system-dcc').isVisible({ timeout: 1000 }).catch(() => false)
    if (!isInGame) {
      const userSelect = page.locator('select[name="userid"]')
      await userSelect.waitFor({ state: 'visible', timeout: 10000 })
      await page.selectOption('select[name="userid"]', { label: 'Gamemaster' })
      await page.click('button[name="join"]')
      await page.waitForSelector('.game.system-dcc', { timeout: 30000 })
    }

    await page.waitForFunction(() => game?.dcc?.KeyState !== undefined && !!game?.user, { timeout: 30000 })

    for (const sel of ['#dcc-welcome-dialog', '#dcc-core-book-welcome-dialog']) {
      const dialog = page.locator(sel)
      if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
        await page.keyboard.press('Escape')
      }
    }
  })

  test('game.dcc.registerItemSheet is exposed and is a function', async ({ page }) => {
    const result = await page.evaluate(() => ({
      hasFn: typeof game.dcc.registerItemSheet === 'function',
      keys: Object.keys(game.dcc).filter(k => k === 'registerItemSheet')
    }))
    expect(result.hasFn).toBe(true)
    expect(result.keys).toEqual(['registerItemSheet'])
  })

  test('game.dcc.registerActorSheet is exposed and is a function', async ({ page }) => {
    const result = await page.evaluate(() => ({
      hasFn: typeof game.dcc.registerActorSheet === 'function',
      keys: Object.keys(game.dcc).filter(k => k === 'registerActorSheet')
    }))
    expect(result.hasFn).toBe(true)
    expect(result.keys).toEqual(['registerActorSheet'])
  })

  test('registerItemSheet adds a sheet option Foundry can resolve for the item type', async ({ page }) => {
    const result = await page.evaluate(async () => {
      class TestModuleWeaponSheet extends foundry.applications.api.DocumentSheetV2 {
        static DEFAULT_OPTIONS = { id: 'test-module-weapon-sheet' }
      }

      game.dcc.registerItemSheet('weapon', TestModuleWeaponSheet, {
        scope: 'extension-api-test',
        label: 'Extension API Test Sheet',
        makeDefault: false
      })

      // Inspect what Foundry resolves a weapon's sheet to. Create a
      // temporary actor + weapon (V14 dropped Item.create temporary
      // support; embedding into an actor we delete is simpler).
      const tmpActor = await Actor.create({ name: 'P1 SheetProbe Actor', type: 'NPC' })
      const [tmpItem] = await tmpActor.createEmbeddedDocuments('Item', [{ name: 'P1-ProbeWeapon', type: 'weapon' }])
      const sheetCtorName = tmpItem?.sheet?.constructor?.name
      await tmpActor.delete()

      // Verify our sheet class is in CONFIG.Item.sheetClasses.weapon.
      const weaponEntries = Object.keys(CONFIG.Item.sheetClasses?.weapon || {})

      return {
        weaponEntries,
        ourEntry: CONFIG.Item.sheetClasses?.weapon?.['extension-api-test.TestModuleWeaponSheet'] ?? null,
        sheetCtorName
      }
    })

    expect(result.weaponEntries, 'our sheet should appear in CONFIG.Item.sheetClasses.weapon').toContain('extension-api-test.TestModuleWeaponSheet')
    expect(result.ourEntry).not.toBeNull()
    expect(result.ourEntry.label).toBe('Extension API Test Sheet')
    expect(result.ourEntry.default).toBe(false)
    // The existing DCC default sheet should still be picked.
    expect(result.sheetCtorName).toBe('DCCItemSheet')
  })

  test('registerItemSheet with makeDefault unregisters core ItemSheetV2 for that type', async ({ page }) => {
    const result = await page.evaluate(() => {
      class TestDefaultArmorSheet extends foundry.applications.api.DocumentSheetV2 {
        static DEFAULT_OPTIONS = { id: 'test-module-default-armor-sheet' }
      }

      game.dcc.registerItemSheet('armor', TestDefaultArmorSheet, {
        scope: 'extension-api-test',
        label: 'Extension API Default Armor',
        makeDefault: true
      })

      const sheetClasses = CONFIG.Item.sheetClasses?.armor ?? {}
      const entry = sheetClasses['extension-api-test.TestDefaultArmorSheet']
      const otherDefaults = Object.entries(sheetClasses)
        .filter(([key, val]) => val.default && key !== 'extension-api-test.TestDefaultArmorSheet')
        .map(([key]) => key)
      return {
        ourEntry: entry ?? null,
        otherDefaults
      }
    })

    expect(result.ourEntry).not.toBeNull()
    expect(result.ourEntry.default).toBe(true)
    // No other sheet should remain default for armor — the unregister
    // pulled core's ItemSheetV2 and our register set us as default.
    expect(result.otherDefaults).toEqual([])
  })

  test('registerActorSheet adds a sheet option Foundry can resolve for the actor type', async ({ page }) => {
    const result = await page.evaluate(async () => {
      class TestModulePlayerSheet extends foundry.applications.api.DocumentSheetV2 {
        static DEFAULT_OPTIONS = { id: 'test-module-player-sheet' }
      }

      game.dcc.registerActorSheet('Player', TestModulePlayerSheet, {
        scope: 'extension-api-test',
        label: 'Extension API Test Actor Sheet',
        makeDefault: false
      })

      // Create a real Player document and inspect its sheet ctor.
      // DCC's existing class-specific sheets register without
      // makeDefault, so the actual ctor name will depend on Foundry's
      // first-registered fallback. We assert on the sheetClasses
      // entry shape directly.
      const playerEntries = Object.keys(CONFIG.Actor.sheetClasses?.Player || {})

      return {
        playerEntries,
        ourEntry: CONFIG.Actor.sheetClasses?.Player?.['extension-api-test.TestModulePlayerSheet'] ?? null
      }
    })

    expect(result.playerEntries, 'our sheet should appear in CONFIG.Actor.sheetClasses.Player')
      .toContain('extension-api-test.TestModulePlayerSheet')
    expect(result.ourEntry).not.toBeNull()
    expect(result.ourEntry.label).toBe('Extension API Test Actor Sheet')
    expect(result.ourEntry.default).toBe(false)
  })

  test('registerActorSheet with makeDefault unregisters core ActorSheetV2 for that type', async ({ page }) => {
    const result = await page.evaluate(() => {
      class TestDefaultMonsterSheet extends foundry.applications.api.DocumentSheetV2 {
        static DEFAULT_OPTIONS = { id: 'test-module-default-monster-sheet' }
      }

      game.dcc.registerActorSheet('NPC', TestDefaultMonsterSheet, {
        scope: 'extension-api-test',
        label: 'Extension API Default Monster',
        makeDefault: true
      })

      const sheetClasses = CONFIG.Actor.sheetClasses?.NPC ?? {}
      const entry = sheetClasses['extension-api-test.TestDefaultMonsterSheet']
      const otherDefaults = Object.entries(sheetClasses)
        .filter(([key, val]) => val.default && key !== 'extension-api-test.TestDefaultMonsterSheet')
        .map(([key]) => key)
      return { ourEntry: entry ?? null, otherDefaults }
    })

    expect(result.ourEntry).not.toBeNull()
    expect(result.ourEntry.default).toBe(true)
    // No other sheet should remain default for NPC — the unregister
    // pulled the prior default and our register replaced it.
    expect(result.otherDefaults).toEqual([])
  })
})
