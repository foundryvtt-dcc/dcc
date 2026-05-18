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

  test('dcc.afterComputeSpellCheck hook fires with the actor after computeSpellCheck runs', async ({ page }) => {
    // Closes ARCHITECTURE_REIMAGINED.md §2.5 "Actor document class
    // customization" — XCC's xcc-actor.js exists solely to override
    // computeSpellCheck. Post-hook lets sibling modules adjust
    // `system.class.spellCheck` without subclassing DCCActor +
    // replacing CONFIG.Actor.documentClass globally.
    const result = await page.evaluate(async () => {
      const calls = []
      const handlerId = Hooks.on('dcc.afterComputeSpellCheck', (actor) => {
        calls.push({
          actorName: actor?.name,
          spellCheck: actor?.system?.class?.spellCheck
        })
      })

      try {
        const wizard = await Actor.create({
          name: 'P1 SpellCheckHookProbe',
          type: 'Player',
          system: { class: { className: 'Wizard', spellCheckAbility: 'int' } }
        })
        // Force a recompute. Foundry already called computeSpellCheck
        // during prepareData on create, so we should already see one
        // call; running it again confirms the hook is reusable.
        wizard.computeSpellCheck()

        // Demonstrate the override use-case (what XCC does today via
        // its subclass): a listener can safely overwrite the result.
        const overrideHandlerId = Hooks.on('dcc.afterComputeSpellCheck', (actor) => {
          if (actor.name === 'P1 SpellCheckHookProbe') {
            actor.system.class.spellCheck = '+99'
          }
        })
        wizard.computeSpellCheck()
        const overriddenSpellCheck = wizard.system.class.spellCheck

        Hooks.off('dcc.afterComputeSpellCheck', overrideHandlerId)
        await wizard.delete()

        return {
          callCount: calls.length,
          firstCallShape: calls[0] ?? null,
          overriddenSpellCheck
        }
      } finally {
        Hooks.off('dcc.afterComputeSpellCheck', handlerId)
      }
    })

    expect(result.callCount, 'hook should fire on every computeSpellCheck').toBeGreaterThanOrEqual(2)
    expect(result.firstCallShape).not.toBeNull()
    expect(result.firstCallShape.actorName).toBe('P1 SpellCheckHookProbe')
    expect(typeof result.firstCallShape.spellCheck).toBe('string')
    // Listener should be able to overwrite — proves the post-hook
    // semantics, which is XCC's actual need.
    expect(result.overriddenSpellCheck).toBe('+99')
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

  // -------------------------------------------------------------------
  // registerClassMixin (Phase 4 session 1)
  // -------------------------------------------------------------------

  test('game.dcc.registerClassMixin is exposed and is a function', async ({ page }) => {
    const result = await page.evaluate(() => ({
      hasFn: typeof game.dcc.registerClassMixin === 'function',
      keys: Object.keys(game.dcc).filter(k => k === 'registerClassMixin')
    }))
    expect(result.hasFn).toBe(true)
    expect(result.keys).toEqual(['registerClassMixin'])
  })

  test('built-in halfling mixin contributes sneakAndHide to a Player actor schema', async ({ page }) => {
    // Proves the registry is actually plumbed into PlayerData.defineSchema()
    // end-to-end against live Foundry — not just stored in CONFIG.DCC.classMixins.
    // The built-in halfling mixin registers in module/dcc.js's init hook before
    // any document is constructed, so every Player in the world resolves the field.
    const result = await page.evaluate(async () => {
      const halflingMixin = CONFIG.DCC?.classMixins?.halfling
      const player = await Actor.create({ name: 'P4S1 Halfling Probe', type: 'Player' })
      const skillsField = player.system.schema.fields.skills
      const sneakAndHideField = skillsField?.fields?.sneakAndHide ?? null
      const sneakAndHideValue = player.system.skills?.sneakAndHide?.value ?? null
      const sneakAndHideLabel = player.system.skills?.sneakAndHide?.label ?? null
      await player.delete()
      return {
        mixinIsFunction: typeof halflingMixin === 'function',
        hasSchemaField: sneakAndHideField !== null,
        sneakAndHideValue,
        sneakAndHideLabel
      }
    })
    expect(result.mixinIsFunction).toBe(true)
    expect(result.hasSchemaField).toBe(true)
    expect(result.sneakAndHideValue).toBe('+3')
    expect(result.sneakAndHideLabel).toBe('DCC.SneakAndHide')
  })

  test('built-in dwarf mixin contributes shieldBash with mixed field types to a Player actor schema', async ({ page }) => {
    // Phase 4 session 2 — exercises the registry across mixed field
    // types (StringField label/ability/value + DiceField die +
    // BooleanField useDeed). Halfling's session 1 mixin was
    // StringField-only; session 2 confirms `DiceField` and
    // `BooleanField` survive the mixin path identically to how they
    // landed when defined statically in `player-data.mjs`.
    const result = await page.evaluate(async () => {
      const dwarfMixin = CONFIG.DCC?.classMixins?.dwarf
      const player = await Actor.create({ name: 'P4S2 Dwarf Probe', type: 'Player' })
      const skillsField = player.system.schema.fields.skills
      const shieldBashField = skillsField?.fields?.shieldBash ?? null
      const sb = player.system.skills?.shieldBash ?? null
      const dieFieldType = shieldBashField?.fields?.die?.constructor?.name ?? null
      const useDeedFieldType = shieldBashField?.fields?.useDeed?.constructor?.name ?? null
      await player.delete()
      return {
        mixinIsFunction: typeof dwarfMixin === 'function',
        hasSchemaField: shieldBashField !== null,
        label: sb?.label ?? null,
        ability: sb?.ability ?? null,
        die: sb?.die ?? null,
        value: sb?.value ?? null,
        useDeed: sb?.useDeed ?? null,
        dieFieldType,
        useDeedFieldType
      }
    })
    expect(result.mixinIsFunction).toBe(true)
    expect(result.hasSchemaField).toBe(true)
    expect(result.label).toBe('DCC.ShieldBash')
    expect(result.ability).toBe('str')
    expect(result.die).toBe('1d14')
    expect(result.value).toBe('+0')
    expect(result.useDeed).toBe(true)
    expect(result.dieFieldType).toBe('DiceField')
    expect(result.useDeedFieldType).toBe('BooleanField')
  })

  test('registerClassMixin survives last-write-wins on the same classId', async ({ page }) => {
    // The mercurial-magic registry's last-write-wins semantic
    // matters for sibling modules that want to fully replace a
    // DCC built-in (e.g. an XCC halfling variant). Restore the
    // original after — the live world relies on it for every
    // subsequent Player document.
    const result = await page.evaluate(() => {
      const original = CONFIG.DCC.classMixins.halfling
      const replacement = (schema) => { schema.__probe = 'replaced' }
      game.dcc.registerClassMixin('halfling', replacement)
      const after = CONFIG.DCC.classMixins.halfling
      // Restore so subsequent tests / world state stay correct.
      game.dcc.registerClassMixin('halfling', original)
      return {
        replaced: after === replacement,
        restored: CONFIG.DCC.classMixins.halfling === original
      }
    })
    expect(result.replaced).toBe(true)
    expect(result.restored).toBe(true)
  })
})
