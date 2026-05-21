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

    // World-state hygiene. Mirrors `data-models.spec.js` / `phase1-adapter-dispatch.spec.js`
    // / `v14-features.spec.js` beforeEach handlers:
    //   - Close any open ApplicationV2 windows from prior tests (sheets,
    //     dialogs) that would otherwise intercept clicks in this test.
    //   - Remove notification banners (e.g. the hardware-acceleration
    //     warning) that float at high z-index and intercept pointer
    //     events. v14-features.spec.js:540 caught this exact failure mode
    //     in the Phase 6 session 4 run — the banner reappeared mid-test
    //     and blocked a tab click.
    //   - Purge stale `P*` actor probes left behind by failed prior runs.
    //     Every test in this file names its probe actor `P<digit>...`
    //     (P1 SheetProbe, P4S1 Halfling Probe, P5S1 ClassDefaults Probe,
    //     P6S1 round-trip, etc.) and deletes it inline; a crash mid-test
    //     leaves the probe behind and the next run's `Actor.create` with
    //     the same name produces ambiguous `game.actors.getName(...)`
    //     lookups.
    await page.evaluate(async () => {
      for (const app of Object.values(ui.windows)) {
        try { await app.close() } catch {}
      }
      document.querySelectorAll('#notifications .notification').forEach(n => n.remove())
      const stale = game.actors.filter(a => /^P\d/i.test(a.name))
      for (const actor of stale) {
        try { await actor.delete() } catch {}
      }
    }).catch(() => {})
  })

  test('beforeEach hygiene purges stale state before the test body runs', async ({ page }) => {
    // Phase 6 session 4: this spec previously lacked the per-test
    // cleanup other e2e specs have, so a notification banner or an
    // open app window from a prior test could intercept clicks in the
    // current one. The Phase 6 session 4 run-2 surfaced two failure
    // modes attributable to that gap: extension-api.spec.js:267 + 302
    // timed out in beforeEach (deeper world-load race, not directly
    // blocked here but symptomatic), and v14-features.spec.js:540
    // timed out clicking a tab the hardware-acceleration banner was
    // covering. The enhanced beforeEach mirrors data-models /
    // phase1-adapter-dispatch / v14-features hygiene; this test
    // asserts the invariants every downstream test depends on.
    const state = await page.evaluate(() => ({
      openWindowCount: Object.keys(ui.windows ?? {}).length,
      notificationCount: document.querySelectorAll('#notifications .notification').length,
      stalePProbeCount: game.actors.filter(a => /^P\d/i.test(a.name)).length
    }))
    expect(state.openWindowCount).toBe(0)
    expect(state.notificationCount).toBe(0)
    expect(state.stalePProbeCount).toBe(0)
  })

  test('DCC Handlebars helpers (add / stringify / distanceFormat / dccPackExists) survive registerDCCHandlebarsHelpers extraction', async ({ page }) => {
    // Phase 7 session 1: the four helpers were moved out of dcc.js into
    // module/handlebars-helpers.mjs. This test guards that the init-time
    // registration still wires them onto the global Handlebars instance
    // — anything templated against them would render blank otherwise.
    const result = await page.evaluate(() => {
      const dccPack = game.packs.contents[0]?.collection ?? null
      return {
        addType: typeof Handlebars.helpers.add,
        stringifyType: typeof Handlebars.helpers.stringify,
        distanceFormatType: typeof Handlebars.helpers.distanceFormat,
        dccPackExistsType: typeof Handlebars.helpers.dccPackExists,
        addResult: Handlebars.helpers.add(7, 4),
        stringifyResult: Handlebars.helpers.stringify({ a: 1 }),
        distanceFormatResult: Handlebars.helpers.distanceFormat("30'"),
        dccPackExistsTrue: dccPack
          ? Handlebars.helpers.dccPackExists(dccPack, { fn: () => 'YES', inverse: () => 'NO' }).toString()
          : 'YES',
        dccPackExistsFalse: Handlebars.helpers.dccPackExists('dcc.definitelyNotARealPack', {
          fn: () => 'YES',
          inverse: () => 'NO'
        }).toString()
      }
    })
    expect(result.addType).toBe('function')
    expect(result.stringifyType).toBe('function')
    expect(result.distanceFormatType).toBe('function')
    expect(result.dccPackExistsType).toBe('function')
    expect(result.addResult).toBe(11)
    expect(result.stringifyResult).toBe('{"a":1}')
    expect(result.distanceFormatResult).toBe("30'")
    expect(result.dccPackExistsTrue).toBe('YES')
    expect(result.dccPackExistsFalse).toBe('NO')
  })

  test('DCC macro factories (createDCCMacro / rollDCCWeaponMacro / getMacroActor / getMacroOptions) survive macros.mjs extraction', async ({ page }) => {
    // Phase 7 session 2: the 13 _createDCCXxxMacro factories, the
    // createDCCMacro dispatcher, and the three runtime macro-surface
    // functions (rollDCCWeaponMacro, getMacroActor, getMacroOptions)
    // were moved out of dcc.js into module/macros.mjs. The Foundry-
    // facing surface stays the three game.dcc.* entries (de-facto-
    // stable per EXTENSION_API.md) plus the hotbarDrop hook wiring.
    const result = await page.evaluate(async () => {
      // Stub a fake actor so getMacroActor + rollDCCWeaponMacro have
      // something to look up without dragging in a real Player document.
      const fakeActor = { id: 'macroProbe', rollWeaponAttack (itemId, opts) { return { itemId, opts, called: true } } }
      const realGet = game.actors.get.bind(game.actors)
      const realGetSpeaker = ChatMessage.getSpeaker
      let weaponRollResult
      try {
        game.actors.get = (id) => (id === 'macroProbe' ? fakeActor : realGet(id))
        ChatMessage.getSpeaker = () => ({ token: null, actor: 'macroProbe' })

        weaponRollResult = game.dcc.rollDCCWeaponMacro('W1', 'macroProbe', { backstab: true })
      } finally {
        game.actors.get = realGet
        ChatMessage.getSpeaker = realGetSpeaker
      }

      // getMacroOptions: smoke-check the returned shape; XOR behavior
      // depends on system settings + KeyState which we don't touch here.
      const opts = game.dcc.getMacroOptions()
      return {
        // game.dcc.* exposure
        rollDCCWeaponMacroType: typeof game.dcc.rollDCCWeaponMacro,
        getMacroActorType: typeof game.dcc.getMacroActor,
        getMacroOptionsType: typeof game.dcc.getMacroOptions,
        // rollDCCWeaponMacro delegates to actor.rollWeaponAttack
        weaponItemId: weaponRollResult.itemId,
        weaponOptsBackstab: weaponRollResult.opts.backstab,
        weaponCalled: weaponRollResult.called,
        // getMacroOptions returns a plain object with showModifierDialog
        optsKeys: Object.keys(opts).sort(),
        optsHasShowDialog: 'showModifierDialog' in opts
      }
    })
    expect(result.rollDCCWeaponMacroType).toBe('function')
    expect(result.getMacroActorType).toBe('function')
    expect(result.getMacroOptionsType).toBe('function')
    expect(result.weaponItemId).toBe('W1')
    expect(result.weaponOptsBackstab).toBe(true)
    expect(result.weaponCalled).toBe(true)
    expect(result.optsKeys).toEqual(['showModifierDialog'])
    expect(result.optsHasShowDialog).toBe(true)
  })

  test('DCC settings-table hooks (disapproval / critical hits / level data packs + 4 set-table hooks + mercurial registry) survive settings-table-hooks.mjs extraction', async ({ page }) => {
    // Phase 7 session 3: the nine `Hooks.on('dcc.{register,set}Xxx', …)`
    // handlers that used to live at the top of `module/dcc.js` were
    // moved into `module/settings-table-hooks.mjs`. The Foundry-facing
    // contract is the hook names themselves — sibling modules
    // (dcc-core-book, xcc-core-book, etc.) emit them via
    // `Hooks.callAll('dcc.{register,set}Xxx', …)`. This test fires
    // each hook with a probe value, asserts the matching CONFIG.DCC
    // mutation landed, and restores the prior state so downstream
    // tests aren't affected.
    const result = await page.evaluate(async () => {
      // Snapshot of mutable CONFIG slots we'll touch; restored at the end.
      const snapshot = {
        divineAidTable: CONFIG.DCC.divineAidTable,
        fumbleTable: CONFIG.DCC.fumbleTable,
        layOnHandsTable: CONFIG.DCC.layOnHandsTable,
        turnUnholyTable: CONFIG.DCC.turnUnholyTable,
        mercurialMagicTable: CONFIG.DCC.mercurialMagicTable,
        mercurialDefaultSlot: CONFIG.DCC.mercurialMagicTables?.default,
        levelDataPacks: CONFIG.DCC.levelDataPacks
      }

      const observed = {}
      try {
        // 1. Disapproval pack — fires addPack on CONFIG.DCC.disapprovalPacks.
        const probeDisapprovalPack = 'dcc.__probe_disapproval__'
        Hooks.callAll('dcc.registerDisapprovalPack', probeDisapprovalPack, false)
        observed.disapprovalPackLanded = !!CONFIG.DCC.disapprovalPacks?._packs?.[probeDisapprovalPack]
        delete CONFIG.DCC.disapprovalPacks?._packs?.[probeDisapprovalPack]

        // 2. Critical hits pack — same shape.
        const probeCritPack = 'dcc.__probe_crit__'
        Hooks.callAll('dcc.registerCriticalHitsPack', probeCritPack, false)
        observed.critPackLanded = !!CONFIG.DCC.criticalHitPacks?._packs?.[probeCritPack]
        delete CONFIG.DCC.criticalHitPacks?._packs?.[probeCritPack]

        // 3-5, 9. set-table hooks — fire with fromSystemSetting=true so the
        // probe overrides any existing value; assert; restore from snapshot.
        Hooks.callAll('dcc.setDivineAidTable', 'dcc.__probe_divineAid__', true)
        observed.divineAidSet = CONFIG.DCC.divineAidTable === 'dcc.__probe_divineAid__'
        Hooks.callAll('dcc.setFumbleTable', 'dcc.__probe_fumble__', true)
        observed.fumbleSet = CONFIG.DCC.fumbleTable === 'dcc.__probe_fumble__'
        Hooks.callAll('dcc.setLayOnHandsTable', 'dcc.__probe_layOnHands__', true)
        observed.layOnHandsSet = CONFIG.DCC.layOnHandsTable === 'dcc.__probe_layOnHands__'
        Hooks.callAll('dcc.setTurnUnholyTable', 'dcc.__probe_turnUnholy__', true)
        observed.turnUnholySet = CONFIG.DCC.turnUnholyTable === 'dcc.__probe_turnUnholy__'

        // 6. Level data pack — lazy-init TablePackManager on first call.
        // If a manager is already in place we just add to it and clean up
        // the probe key; otherwise we add, observe, and reset to undefined.
        const probeLevelDataPack = 'dcc.__probe_levelData__'
        const hadManager = !!CONFIG.DCC.levelDataPacks
        Hooks.callAll('dcc.registerLevelDataPack', probeLevelDataPack, false)
        observed.levelDataManagerExists = !!CONFIG.DCC.levelDataPacks
        observed.levelDataPackLanded = !!CONFIG.DCC.levelDataPacks?._packs?.[probeLevelDataPack]
        if (hadManager) {
          delete CONFIG.DCC.levelDataPacks._packs[probeLevelDataPack]
        } else {
          CONFIG.DCC.levelDataPacks = undefined
        }

        // 7. Per-class mercurial-magic registry — keyed write, does NOT
        // touch the legacy default field.
        const beforeLegacyMercurial = CONFIG.DCC.mercurialMagicTable
        Hooks.callAll('dcc.registerMercurialMagicTable', '__probeClass__', 'module.__probe_mercurial__')
        observed.mercurialPerClassLanded = CONFIG.DCC.mercurialMagicTables?.__probeClass__ === 'module.__probe_mercurial__'
        observed.mercurialLegacyUntouchedByPerClassWrite = CONFIG.DCC.mercurialMagicTable === beforeLegacyMercurial
        delete CONFIG.DCC.mercurialMagicTables.__probeClass__

        // 8. Legacy mercurial setter — system-setting override writes both
        // the legacy field and the default-slot of the registry.
        Hooks.callAll('dcc.setMercurialMagicTable', 'module.__probe_mercurialDefault__', true)
        observed.mercurialLegacySet = CONFIG.DCC.mercurialMagicTable === 'module.__probe_mercurialDefault__'
        observed.mercurialDefaultSlotMirrored = CONFIG.DCC.mercurialMagicTables?.default === 'module.__probe_mercurialDefault__'
      } finally {
        // Restore snapshot so later tests in this spec see the same state.
        CONFIG.DCC.divineAidTable = snapshot.divineAidTable
        CONFIG.DCC.fumbleTable = snapshot.fumbleTable
        CONFIG.DCC.layOnHandsTable = snapshot.layOnHandsTable
        CONFIG.DCC.turnUnholyTable = snapshot.turnUnholyTable
        CONFIG.DCC.mercurialMagicTable = snapshot.mercurialMagicTable
        if (CONFIG.DCC.mercurialMagicTables) {
          if (snapshot.mercurialDefaultSlot === undefined) {
            delete CONFIG.DCC.mercurialMagicTables.default
          } else {
            CONFIG.DCC.mercurialMagicTables.default = snapshot.mercurialDefaultSlot
          }
        }
        CONFIG.DCC.levelDataPacks = snapshot.levelDataPacks
      }
      return observed
    })

    expect(result.disapprovalPackLanded).toBe(true)
    expect(result.critPackLanded).toBe(true)
    expect(result.divineAidSet).toBe(true)
    expect(result.fumbleSet).toBe(true)
    expect(result.layOnHandsSet).toBe(true)
    expect(result.turnUnholySet).toBe(true)
    expect(result.levelDataManagerExists).toBe(true)
    expect(result.levelDataPackLanded).toBe(true)
    expect(result.mercurialPerClassLanded).toBe(true)
    expect(result.mercurialLegacyUntouchedByPerClassWrite).toBe(true)
    expect(result.mercurialLegacySet).toBe(true)
    expect(result.mercurialDefaultSlotMirrored).toBe(true)
  })

  test('DCC processSpellCheck survives spell-check-processor.mjs extraction', async ({ page }) => {
    // Phase 7 session 4: the ~200-line processSpellCheck function was
    // moved out of `module/dcc.js` into `module/spell-check-processor.mjs`.
    // It remains published on `game.dcc.processSpellCheck` (Stable
    // extension surface per `docs/dev/EXTENSION_API.md`) and is consumed
    // by `DCCItem.rollSpellCheck` + the adapter-declined paths in
    // `DCCActor.rollSpellCheck`.
    //
    // End-to-end probe: stand up a temporary Player, fire a deterministic
    // d20 roll through `processSpellCheck` (no item, no rollTable so we
    // exercise the no-table flag/HTML branch), confirm a chat message
    // lands carrying the expected dcc.* flags, then clean up.
    const result = await page.evaluate(async () => {
      const tmpActor = await Actor.create({ name: 'P_SpellProc Probe', type: 'Player' })
      try {
        // Mint a deterministic roll: 1d20 + 5 = N + 5.
        const roll = new Roll('1d20+5')
        await roll.evaluate()
        const naturalRoll = roll.dice[0].total

        // Snapshot existing dcc-flagged chat messages so the new one can be
        // identified post-call without depending on message ordering.
        const beforeIds = new Set(game.messages.contents.map(m => m.id))

        await game.dcc.processSpellCheck(tmpActor, {
          roll,
          flavor: 'P_SpellProc probe',
          forceCrit: false
        })

        const created = game.messages.contents.filter(m => !beforeIds.has(m.id))
        const createdMatch = created.find(m => m.getFlag('dcc', 'RollType') === 'SpellCheck')

        const observed = {
          processSpellCheckType: typeof game.dcc.processSpellCheck,
          createdCount: created.length,
          rollType: createdMatch?.getFlag('dcc', 'RollType') ?? null,
          isSpellCheck: createdMatch?.getFlag('dcc', 'isSpellCheck') ?? null,
          isSkillCheck: createdMatch?.getFlag('dcc', 'isSkillCheck') ?? null,
          spellResultHtml: createdMatch?.getFlag('dcc', 'spellResult') ?? null,
          naturalRoll
        }

        // Clean up the chat messages we generated so downstream tests
        // start from the same snapshot.
        if (created.length) {
          await ChatMessage.deleteDocuments(created.map(m => m.id))
        }
        return observed
      } finally {
        await tmpActor.delete()
      }
    })
    expect(result.processSpellCheckType).toBe('function')
    expect(result.createdCount).toBeGreaterThanOrEqual(1)
    expect(result.rollType).toBe('SpellCheck')
    expect(result.isSpellCheck).toBe(true)
    expect(result.isSkillCheck).toBe(true)
    // The no-table HTML branch matches one of the four indicator messages.
    // Specific branch depends on naturalRoll; envelope (`emote-alert
    // fumble|critical` wrapper) is fixed and the localized text is
    // non-empty.
    expect(result.spellResultHtml).toMatch(/^<p class="emote-alert (fumble|critical)">[^<]+<\/p>$/)
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

  test('built-in thief mixin contributes the 12-skill block + class.luckDie / class.backstab to a Player actor schema', async ({ page }) => {
    // Phase 4 session 3 — largest single-class relocation so far.
    // Exercises the registry across (a) a SchemaField fan-out (12
    // thief skills built via a shared helper inside the mixin), (b)
    // skipping the `ability` field on `handlePoison` (intentional —
    // matches the legacy static body which has no ability), (c) the
    // DiceField on `castSpellFromScroll.die`, and (d) class-field
    // (`schema.class.fields`) mutations (`luckDie` / `backstab`) on
    // the same mixin alongside skill-field mutations.
    const result = await page.evaluate(async () => {
      const thiefMixin = CONFIG.DCC?.classMixins?.thief
      const player = await Actor.create({ name: 'P4S3 Thief Probe', type: 'Player' })
      const skillsField = player.system.schema.fields.skills
      const classField = player.system.schema.fields.class
      const has = (name) => skillsField?.fields?.[name] != null
      const skills = player.system.skills ?? {}
      const cls = player.system.class ?? {}
      const cssField = skillsField?.fields?.castSpellFromScroll ?? null
      const luckDieFieldType = classField?.fields?.luckDie?.constructor?.name ?? null
      const cssDieFieldType = cssField?.fields?.die?.constructor?.name ?? null
      const handlePoisonHasAbility = skillsField?.fields?.handlePoison?.fields?.ability != null
      await player.delete()
      return {
        mixinIsFunction: typeof thiefMixin === 'function',
        allSkillsPresent: [
          'sneakSilently', 'hideInShadows', 'pickPockets', 'climbSheerSurfaces',
          'pickLock', 'findTrap', 'disableTrap', 'forgeDocument',
          'disguiseSelf', 'readLanguages', 'handlePoison', 'castSpellFromScroll'
        ].every(has),
        sneakAblility: skills.sneakSilently?.ability ?? null,
        findTrapAbility: skills.findTrap?.ability ?? null,
        disguiseSelfAbility: skills.disguiseSelf?.ability ?? null,
        handlePoisonHasAbility,
        handlePoisonValue: skills.handlePoison?.value ?? null,
        castSpellDieValue: skills.castSpellFromScroll?.die ?? null,
        cssDieFieldType,
        luckDie: cls.luckDie ?? null,
        backstab: cls.backstab ?? null,
        luckDieFieldType
      }
    })
    expect(result.mixinIsFunction).toBe(true)
    expect(result.allSkillsPresent).toBe(true)
    expect(result.sneakAblility).toBe('agl')
    expect(result.findTrapAbility).toBe('int')
    expect(result.disguiseSelfAbility).toBe('per')
    expect(result.handlePoisonHasAbility).toBe(false)
    expect(result.handlePoisonValue).toBe('0')
    expect(result.castSpellDieValue).toBe('1d10')
    expect(result.cssDieFieldType).toBe('DiceField')
    expect(result.luckDie).toBe('1d3')
    expect(result.backstab).toBe('0')
    expect(result.luckDieFieldType).toBe('DiceField')
  })

  test('built-in cleric mixin contributes the disapproval/spells/skills block to a Player actor schema', async ({ page }) => {
    // Phase 4 session 4 — cleric block: 8 class fields (spellCheck +
    // spellCheckAbility + spellsLevel1–5 + deity + disapproval +
    // disapprovalTable) + 3 disapproval-range skills (divineAid /
    // turnUnholy / layOnHands). Exercises (a) NumberField with min/max
    // (`disapproval` clamps 1–20), (b) nullable StringField (`deity`),
    // (c) per-skill BooleanField (`useDisapprovalRange`), (d) a
    // skill-specific NumberField extension (`divineAid.drainDisapproval`),
    // and (e) the timing assumption that adapter spell-check code
    // reading `spellCheckAbility` / `disapproval` / `disapprovalTable`
    // sees these fields as soon as the cleric mixin runs in
    // `module/dcc.js:init`.
    const result = await page.evaluate(async () => {
      const clericMixin = CONFIG.DCC?.classMixins?.cleric
      const player = await Actor.create({ name: 'P4S4 Cleric Probe', type: 'Player' })
      // Read from `_source` because `prepareDerivedData` overwrites some
      // class fields (`spellCheck`, the `divineAid`/`turnUnholy`/`layOnHands`
      // `.value` slots) with computed strings — schema defaults are
      // assertable on the source, but the derived values are not.
      const src = player.system._source ?? {}
      const cls = src.class ?? {}
      const skills = src.skills ?? {}
      const classFields = player.system.schema.fields.class
      const skillsFields = player.system.schema.fields.skills
      const disapprovalFieldType = classFields?.fields?.disapproval?.constructor?.name ?? null
      const deityFieldType = classFields?.fields?.deity?.constructor?.name ?? null
      const divineAidUseDisapprovalRangeFieldType =
        skillsFields?.fields?.divineAid?.fields?.useDisapprovalRange?.constructor?.name ?? null
      const divineAidDrainFieldType =
        skillsFields?.fields?.divineAid?.fields?.drainDisapproval?.constructor?.name ?? null
      const turnUnholyHasDrain = skillsFields?.fields?.turnUnholy?.fields?.drainDisapproval != null
      await player.delete()
      return {
        mixinIsFunction: typeof clericMixin === 'function',
        spellCheck: cls.spellCheck ?? null,
        spellCheckAbility: cls.spellCheckAbility ?? null,
        spellsLevels: [cls.spellsLevel1, cls.spellsLevel2, cls.spellsLevel3, cls.spellsLevel4, cls.spellsLevel5],
        deity: cls.deity,
        disapproval: cls.disapproval,
        disapprovalTable: cls.disapprovalTable,
        divineAidLabel: skills.divineAid?.label ?? null,
        divineAidUseDisapprovalRange: skills.divineAid?.useDisapprovalRange ?? null,
        divineAidDrain: skills.divineAid?.drainDisapproval ?? null,
        turnUnholyValue: skills.turnUnholy?.value ?? null,
        layOnHandsLabel: skills.layOnHands?.label ?? null,
        disapprovalFieldType,
        deityFieldType,
        divineAidUseDisapprovalRangeFieldType,
        divineAidDrainFieldType,
        turnUnholyHasDrain
      }
    })
    expect(result.mixinIsFunction).toBe(true)
    expect(result.spellCheck).toBe(1)
    expect(result.spellCheckAbility).toBe('per')
    expect(result.spellsLevels).toEqual([0, 0, 0, 0, 0])
    expect(result.deity).toBeNull()
    expect(result.disapproval).toBe(1)
    expect(result.disapprovalTable).toBe('Disapproval')
    expect(result.divineAidLabel).toBe('DCC.DivineAid')
    expect(result.divineAidUseDisapprovalRange).toBe(true)
    expect(result.divineAidDrain).toBe(10)
    expect(result.turnUnholyValue).toBe(0)
    expect(result.layOnHandsLabel).toBe('DCC.LayOnHands')
    expect(result.disapprovalFieldType).toBe('NumberField')
    expect(result.deityFieldType).toBe('StringField')
    expect(result.divineAidUseDisapprovalRangeFieldType).toBe('BooleanField')
    expect(result.divineAidDrainFieldType).toBe('NumberField')
    // `turnUnholy` and `layOnHands` share the disapprovalSkill helper
    // but only `divineAid` extends it with `drainDisapproval`.
    expect(result.turnUnholyHasDrain).toBe(false)
  })

  test('built-in warrior mixin contributes class.luckyWeapon + class.luckyWeaponMod to a Player actor schema', async ({ page }) => {
    // Phase 4 session 5 — smallest remaining class block. Verifies the
    // nullable StringField initial (`luckyWeapon = null`) and the
    // signed-string default (`luckyWeaponMod = '+0'`) survive the
    // mixin path against a live Player document.
    const result = await page.evaluate(async () => {
      const warriorMixin = CONFIG.DCC?.classMixins?.warrior
      const player = await Actor.create({ name: 'P4S5 Warrior Probe', type: 'Player' })
      const src = player.system._source ?? {}
      const cls = src.class ?? {}
      const classFields = player.system.schema.fields.class
      const luckyWeaponField = classFields?.fields?.luckyWeapon ?? null
      const luckyWeaponFieldType = luckyWeaponField?.constructor?.name ?? null
      const luckyWeaponIsNullable = luckyWeaponField?.options?.nullable === true
      const luckyWeaponModFieldType = classFields?.fields?.luckyWeaponMod?.constructor?.name ?? null
      await player.delete()
      return {
        mixinIsFunction: typeof warriorMixin === 'function',
        hasLuckyWeapon: luckyWeaponField !== null,
        luckyWeapon: cls.luckyWeapon,
        luckyWeaponMod: cls.luckyWeaponMod ?? null,
        luckyWeaponFieldType,
        luckyWeaponIsNullable,
        luckyWeaponModFieldType
      }
    })
    expect(result.mixinIsFunction).toBe(true)
    expect(result.hasLuckyWeapon).toBe(true)
    expect(result.luckyWeapon).toBeNull()
    expect(result.luckyWeaponMod).toBe('+0')
    expect(result.luckyWeaponFieldType).toBe('StringField')
    expect(result.luckyWeaponIsNullable).toBe(true)
    expect(result.luckyWeaponModFieldType).toBe('StringField')
  })

  test('built-in wizard mixin contributes the spell-flavor class-field block to a Player actor schema', async ({ page }) => {
    // Phase 4 session 6 — closes the per-class extraction arc. Wizards
    // and elves share the same 9-field shape (elves cast as wizards in
    // DCC); the wizard and elf mixins both call `attachWizardFields`
    // so the declarations live in one place. This case verifies the
    // wizard side; the next case verifies the elf side plus the
    // detectSecretDoors override.
    const result = await page.evaluate(async () => {
      const wizardMixin = CONFIG.DCC?.classMixins?.wizard
      const player = await Actor.create({ name: 'P4S6 Wizard Probe', type: 'Player' })
      const src = player.system._source ?? {}
      const cls = src.class ?? {}
      const classFields = player.system.schema.fields.class
      const ft = (name) => classFields?.fields?.[name]?.constructor?.name ?? null
      const isNullable = (name) => classFields?.fields?.[name]?.options?.nullable === true
      await player.delete()
      return {
        mixinIsFunction: typeof wizardMixin === 'function',
        knownSpells: cls.knownSpells,
        maxSpellLevel: cls.maxSpellLevel,
        spellCheckOtherMod: cls.spellCheckOtherMod,
        spellCheckDieOverride: cls.spellCheckDieOverride,
        spellCheckOverride: cls.spellCheckOverride,
        patron: cls.patron,
        patronTaintChance: cls.patronTaintChance ?? null,
        familiar: cls.familiar,
        corruption: cls.corruption ?? null,
        knownSpellsFieldType: ft('knownSpells'),
        patronFieldType: ft('patron'),
        patronIsNullable: isNullable('patron'),
        corruptionFieldType: ft('corruption')
      }
    })
    expect(result.mixinIsFunction).toBe(true)
    expect(result.knownSpells).toBe(0)
    expect(result.maxSpellLevel).toBe(0)
    expect(result.spellCheckOtherMod).toBeNull()
    expect(result.spellCheckDieOverride).toBeNull()
    expect(result.spellCheckOverride).toBeNull()
    expect(result.patron).toBeNull()
    expect(result.patronTaintChance).toBe('1%')
    expect(result.familiar).toBeNull()
    expect(result.corruption).toBe('')
    expect(result.knownSpellsFieldType).toBe('NumberField')
    expect(result.patronFieldType).toBe('StringField')
    expect(result.patronIsNullable).toBe(true)
    expect(result.corruptionFieldType).toBe('HTMLField')
  })

  test('built-in elf mixin attaches wizard fields AND overrides detectSecretDoors with HeightenedSenses defaults', async ({ page }) => {
    // Phase 4 session 6 — elf side of the per-class extraction arc.
    // The elf mixin (a) re-attaches the shared wizard fields via
    // `attachWizardFields` (last-write-wins on duplicate registrations
    // — second pass is a no-op shape-wise because both mixins build
    // identical instances), and (b) overrides
    // `skills.detectSecretDoors` with the elf-specific defaults
    // (label='DCC.HeightenedSenses', ability='int', value='+4'). The
    // base body declares `detectSecretDoors` as the non-Elf default;
    // because the elf mixin runs **after** the base body, the
    // override wins on the schema actually constructed for every
    // Player document — Foundry-smelling shape per §2.12 still
    // resolves the path `system.skills.detectSecretDoors` identically.
    const result = await page.evaluate(async () => {
      const elfMixin = CONFIG.DCC?.classMixins?.elf
      const player = await Actor.create({ name: 'P4S6 Elf Probe', type: 'Player' })
      const src = player.system._source ?? {}
      const skills = src.skills ?? {}
      const cls = src.class ?? {}
      const skillsFields = player.system.schema.fields.skills
      const detect = skillsFields?.fields?.detectSecretDoors ?? null
      await player.delete()
      return {
        mixinIsFunction: typeof elfMixin === 'function',
        // Wizard fields attached via the shared helper:
        knownSpells: cls.knownSpells,
        patron: cls.patron,
        patronTaintChance: cls.patronTaintChance ?? null,
        // detectSecretDoors override:
        hasDetect: detect !== null,
        detectLabel: skills.detectSecretDoors?.label ?? null,
        detectAbility: skills.detectSecretDoors?.ability ?? null,
        detectValue: skills.detectSecretDoors?.value ?? null
      }
    })
    expect(result.mixinIsFunction).toBe(true)
    // Wizard fields landed on Player via either the 'wizard' or 'elf'
    // registration (deterministic-sorted order applies both):
    expect(result.knownSpells).toBe(0)
    expect(result.patron).toBeNull()
    expect(result.patronTaintChance).toBe('1%')
    // detectSecretDoors carries the elf override defaults:
    expect(result.hasDetect).toBe(true)
    expect(result.detectLabel).toBe('DCC.HeightenedSenses')
    expect(result.detectAbility).toBe('int')
    expect(result.detectValue).toBe('+4')
  })

  // -------------------------------------------------------------------
  // Lib re-exports — registerClassProgression / registerClassProgressions
  // (Phase 6 session 1)
  // -------------------------------------------------------------------

  test('game.dcc.registerClassProgression + registerClassProgressions are exposed as functions', async ({ page }) => {
    // The DCC system re-exports the lib's registration helpers via
    // `game.dcc.*`. Content modules (a future `dcc-core-book` update
    // and similar) load their class progression payload through
    // these helpers. The progression data itself stays in the
    // private `dcc-official-data` repo; the open-source system
    // ships only the registration surface.
    const result = await page.evaluate(() => ({
      registerSingle: typeof game.dcc.registerClassProgression === 'function',
      registerMany: typeof game.dcc.registerClassProgressions === 'function',
      registerSingleKey: Object.keys(game.dcc).includes('registerClassProgression'),
      registerManyKey: Object.keys(game.dcc).includes('registerClassProgressions')
    }))
    expect(result.registerSingle).toBe(true)
    expect(result.registerMany).toBe(true)
    expect(result.registerSingleKey).toBe(true)
    expect(result.registerManyKey).toBe(true)
  })

  test('registerClassProgression round-trips against the live lib registry (fictional class)', async ({ page }) => {
    // End-to-end smoke: register a tiny fictional class (NOT from any
    // official source) and verify the lib's `getSavingThrows`
    // consumer returns the registered values.
    //
    // Save+restore the prior registry state around the test so a
    // sibling-loaded real progression (registered at `dcc.ready` by
    // `foundry-data-loader.mjs` when a level pack is installed)
    // isn't wiped. A naive `clearClassProgressions()` cleanup would
    // empty the entire registry, including the production entries —
    // breaking downstream tests that expect the post-init state.
    const result = await page.evaluate(async () => {
      const lib = await import('../../../../../../../../systems/dcc/module/vendor/dcc-core-lib/index.js')
      const utils = await import('../../../../../../../../systems/dcc/module/vendor/dcc-core-lib/data/classes/progression-utils.js')

      // Snapshot prior registry so we can restore it post-test.
      const priorIds = utils.getRegisteredClassIds()
      const priorEntries = priorIds.map(id => utils.getClassProgression(id))

      const probe = {
        classId: 'p6s1-live-tinker',
        name: 'Live Tinker',
        skills: [],
        levels: {
          3: {
            attackBonus: 2,
            criticalDie: 'd6',
            criticalTable: 'II',
            actionDice: ['1d20'],
            hitDie: 'd6',
            saves: { ref: 2, frt: 1, wil: 3 }
          }
        }
      }
      game.dcc.registerClassProgression(probe)

      // Read back via the lib's consumer APIs.
      const fetched = utils.getClassProgression('p6s1-live-tinker')
      const savesAt3 = lib.getSavingThrows ? lib.getSavingThrows('p6s1-live-tinker', 3) : null
      const willAt3 = utils.getSaveBonus('p6s1-live-tinker', 3, 'wil')

      // Restore: clear, then re-register each prior entry. The
      // fictional probe is dropped, prior production entries return.
      utils.clearClassProgressions()
      for (const entry of priorEntries) {
        if (entry) utils.registerClassProgression(entry)
      }
      const afterCleanup = utils.getClassProgression('p6s1-live-tinker')
      const restoredCount = utils.getRegisteredClassIds().length

      return {
        registeredName: fetched?.name ?? null,
        registeredRefSave: fetched?.levels[3]?.saves?.ref ?? null,
        willAt3,
        savesAt3Type: savesAt3 ? typeof savesAt3 : null,
        probeRemoved: afterCleanup === undefined,
        priorCount: priorIds.length,
        restoredCount
      }
    })

    expect(result.registeredName).toBe('Live Tinker')
    expect(result.registeredRefSave).toBe(2)
    expect(result.willAt3).toBe(3)
    expect(result.probeRemoved).toBe(true)
    // The restored registry should match the prior count (production
    // progressions are back, fictional probe is gone).
    expect(result.restoredCount).toBe(result.priorCount)
  })

  // -------------------------------------------------------------------
  // foundry-data-loader (Phase 6 session 2)
  // -------------------------------------------------------------------

  test('foundry-data-loader walks level packs and registers progressions for each discovered class', async ({ page }) => {
    // Validates `module/adapter/foundry-data-loader.mjs`'s
    // `registerClassProgressionsFromPacks` end-to-end against a
    // live Foundry world. Invokes the loader directly (rather than
    // asserting on the init-hook side-effect) so the test is robust
    // against Foundry-server restarts: the production init runs the
    // loader at `dcc.ready`, but the running test world may have
    // started before that wiring landed. A direct invocation
    // confirms the loader logic itself works against real
    // compendium packs.
    //
    // Save+restore the registry state around the test so any
    // sibling-loaded prior progressions aren't disturbed (matches
    // the session-1 round-trip test's pattern).
    //
    // Content-pack-dependent: when no level pack is installed, the
    // loader is a no-op and the test asserts the empty-array
    // return shape. When dcc-core-book (or similar) is installed,
    // the loader registers at least one of the seven canonical
    // class IDs and the registered entries each have a populated
    // `levels` map. Specific progression values are NOT asserted —
    // those are pack-content-dependent.
    const result = await page.evaluate(async () => {
      const utils = await import('../../../../../../../../systems/dcc/module/vendor/dcc-core-lib/data/classes/progression-utils.js')
      const loader = await import('../../../../../../../../systems/dcc/module/adapter/foundry-data-loader.mjs')

      // Save prior state so we can restore.
      const priorIds = utils.getRegisteredClassIds()
      const priorEntries = priorIds.map(id => utils.getClassProgression(id))

      // Clear and re-run the loader so we know its output isn't
      // mixed with whatever was already in the registry.
      utils.clearClassProgressions()
      const registered = await loader.registerClassProgressionsFromPacks()
      const postIds = utils.getRegisteredClassIds().sort()
      const knownClassIds = ['cleric', 'dwarf', 'elf', 'halfling', 'thief', 'warrior', 'wizard']
      const intersection = postIds.filter(id => knownClassIds.includes(id))
      const sample = intersection.length > 0
        ? utils.getClassProgression(intersection[0])
        : null

      // Restore prior registry state.
      utils.clearClassProgressions()
      for (const entry of priorEntries) {
        if (entry) utils.registerClassProgression(entry)
      }

      return {
        levelPacksConfigured: Array.isArray(CONFIG.DCC?.levelDataPacks?.packs) &&
          CONFIG.DCC.levelDataPacks.packs.length > 0,
        registered,
        postIds,
        intersection,
        sampleHasLevels: sample ? Object.keys(sample.levels ?? {}).length > 0 : null,
        sampleClassId: sample?.classId ?? null,
        sampleName: sample?.name ?? null
      }
    })

    if (!result.levelPacksConfigured) {
      // No level pack installed in this world — loader is a no-op.
      expect(result.registered).toEqual([])
      return
    }

    // Level pack is installed → loader registered at least one of
    // the seven canonical PC classes.
    expect(result.intersection.length).toBeGreaterThan(0)
    expect(result.sampleHasLevels).toBe(true)
    expect(typeof result.sampleClassId).toBe('string')
    expect(typeof result.sampleName).toBe('string')
  })

  // -------------------------------------------------------------------
  // registerHomebrewClassForProgressionLoad (Phase 6 session 3)
  // -------------------------------------------------------------------

  test('game.dcc.registerHomebrewClassForProgressionLoad is exposed and CONFIG.DCC.classLevelNames is seeded with the 7 built-ins', async ({ page }) => {
    // Phase 6 session 3 lifted the previously hardcoded
    // BUILT_IN_CLASS_LEVEL_NAMES table out of the loader and onto
    // CONFIG.DCC.classLevelNames, contributed via the new homebrew
    // registration helper. The DCC system dogfoods its own helper
    // at init time by seeding the 7 canonical PC classes.
    const result = await page.evaluate(() => {
      const reg = game.dcc.registerHomebrewClassForProgressionLoad
      const names = CONFIG.DCC?.classLevelNames ?? {}
      return {
        isFunction: typeof reg === 'function',
        exposedKey: Object.keys(game.dcc).includes('registerHomebrewClassForProgressionLoad'),
        registeredIds: Object.keys(names).sort(),
        clericPrefix: names.cleric,
        warriorPrefix: names.warrior
      }
    })

    expect(result.isFunction).toBe(true)
    expect(result.exposedKey).toBe(true)
    expect(result.registeredIds).toEqual([
      'cleric', 'dwarf', 'elf', 'halfling', 'thief', 'warrior', 'wizard'
    ])
    expect(result.clericPrefix).toBe('cleric')
    expect(result.warriorPrefix).toBe('warrior')
  })

  test('registerHomebrewClassForProgressionLoad enables the loader to pick up a homebrew classId', async ({ page }) => {
    // End-to-end: register a fictional homebrew classId mapping its
    // itemPrefix onto the 'cleric' items the production pack already
    // ships (so we can verify the loader picked up the new
    // registration without depending on a homebrew pack actually
    // being installed). Save+restore the lib registry AND the
    // classLevelNames registry around the test.
    const result = await page.evaluate(async () => {
      const utils = await import('../../../../../../../../systems/dcc/module/vendor/dcc-core-lib/data/classes/progression-utils.js')
      const loader = await import('../../../../../../../../systems/dcc/module/adapter/foundry-data-loader.mjs')

      // Save state.
      const priorIds = utils.getRegisteredClassIds()
      const priorEntries = priorIds.map(id => utils.getClassProgression(id))
      const priorNames = { ...(CONFIG.DCC.classLevelNames ?? {}) }
      const levelPacksConfigured = Array.isArray(CONFIG.DCC?.levelDataPacks?.packs) &&
        CONFIG.DCC.levelDataPacks.packs.length > 0

      // Register a fictional homebrew classId that maps to the existing
      // cleric item-prefix so the loader can find live level data.
      game.dcc.registerHomebrewClassForProgressionLoad('p6s3-fake-homebrew', 'cleric')

      // Reset the lib registry so we know the loader's output is fresh.
      utils.clearClassProgressions()
      const registered = await loader.registerClassProgressionsFromPacks()
      const homebrewProgression = utils.getClassProgression('p6s3-fake-homebrew')

      // Restore both registries.
      utils.clearClassProgressions()
      for (const entry of priorEntries) {
        if (entry) utils.registerClassProgression(entry)
      }
      delete CONFIG.DCC.classLevelNames['p6s3-fake-homebrew']
      // Defensive: re-seed any built-ins that somehow got dropped.
      CONFIG.DCC.classLevelNames = { ...priorNames }

      return {
        levelPacksConfigured,
        registeredIncludesHomebrew: registered.includes('p6s3-fake-homebrew'),
        homebrewName: homebrewProgression?.name ?? null,
        homebrewHasLevels: homebrewProgression
          ? Object.keys(homebrewProgression.levels ?? {}).length > 0
          : false
      }
    })

    if (!result.levelPacksConfigured) {
      // No level pack installed in this world — loader is a no-op.
      expect(result.registeredIncludesHomebrew).toBe(false)
      return
    }

    // The loader picked up the homebrew classId via the registry and
    // assembled a progression from the cleric-prefixed items.
    expect(result.registeredIncludesHomebrew).toBe(true)
    expect(result.homebrewName).toBe('P6s3-fake-homebrew')
    expect(result.homebrewHasLevels).toBe(true)
  })

  // -------------------------------------------------------------------
  // registerVariant + getActiveVariant + activeVariant world setting
  // (Phase 6 session 5)
  // -------------------------------------------------------------------

  test('game.dcc.registerVariant + getActiveVariant are exposed and the built-in DCC variant is seeded', async ({ page }) => {
    // Phase 6 session 5 added the variant-registry extension surface.
    // The DCC system dogfoods its own helper at init time by seeding
    // the canonical 'dcc' variant with the 7 PC classes; the
    // `dcc.activeVariant` world setting selects which variant is live.
    const result = await page.evaluate(() => {
      const reg = game.dcc.registerVariant
      const getter = game.dcc.getActiveVariant
      const variants = CONFIG.DCC?.variants ?? {}
      const dcc = variants.dcc
      let activeSettingValue = null
      try {
        activeSettingValue = game.settings.get('dcc', 'activeVariant')
      } catch {
        activeSettingValue = null
      }
      const active = typeof getter === 'function' ? getter() : null
      return {
        registerIsFunction: typeof reg === 'function',
        getterIsFunction: typeof getter === 'function',
        exposedKeys: [
          Object.keys(game.dcc).includes('registerVariant'),
          Object.keys(game.dcc).includes('getActiveVariant')
        ],
        dccVariantShape: dcc
          ? {
              id: dcc.id,
              label: dcc.label,
              classes: [...dcc.classes].sort(),
              hasSheetTheme: 'sheetTheme' in dcc
            }
          : null,
        activeSettingValue,
        activeResolvesToDcc: active?.id === 'dcc'
      }
    })

    expect(result.registerIsFunction).toBe(true)
    expect(result.getterIsFunction).toBe(true)
    expect(result.exposedKeys).toEqual([true, true])
    expect(result.dccVariantShape).toEqual({
      id: 'dcc',
      label: 'DCC.VariantDCC',
      classes: ['cleric', 'dwarf', 'elf', 'halfling', 'thief', 'warrior', 'wizard'],
      hasSheetTheme: false
    })
    expect(result.activeSettingValue).toBe('dcc')
    expect(result.activeResolvesToDcc).toBe(true)
  })

  test('registerVariant round-trips a fictional XCC-like variant against the live registry', async ({ page }) => {
    // End-to-end: register a fictional variant via game.dcc.*, verify
    // it lands in CONFIG.DCC.variants and getActiveVariant returns it
    // when the world-setting points at the fictional id. Save+restore
    // both the registry entry and the setting around the test so the
    // shared world state stays clean.
    const result = await page.evaluate(async () => {
      const variantId = 'p6s5-fake-xcc'

      const priorSetting = game.settings.get('dcc', 'activeVariant')

      game.dcc.registerVariant({
        id: variantId,
        label: 'TEST.FakeVariant',
        classes: ['blaster', 'brawler'],
        sheetTheme: 'theme-p6s5-fake'
      })

      const registered = CONFIG.DCC.variants[variantId]

      // Resolve via setting too (uses world-setting value).
      await game.settings.set('dcc', 'activeVariant', variantId)
      const active = game.dcc.getActiveVariant()

      // Apply theme to a probe element and verify it gets the class.
      const probe = document.createElement('div')
      const helperModule = await import('../../../../../../../../systems/dcc/module/extension-api.mjs')
      helperModule.applyActiveVariantSheetTheme(probe)
      const themeApplied = probe.classList.contains('theme-p6s5-fake')

      // Restore.
      await game.settings.set('dcc', 'activeVariant', priorSetting)
      delete CONFIG.DCC.variants[variantId]

      return {
        registered: registered
          ? {
              id: registered.id,
              label: registered.label,
              classes: [...registered.classes],
              sheetTheme: registered.sheetTheme
            }
          : null,
        activeId: active?.id,
        themeApplied
      }
    })

    expect(result.registered).toEqual({
      id: 'p6s5-fake-xcc',
      label: 'TEST.FakeVariant',
      classes: ['blaster', 'brawler'],
      sheetTheme: 'theme-p6s5-fake'
    })
    expect(result.activeId).toBe('p6s5-fake-xcc')
    expect(result.themeApplied).toBe(true)
  })

  // -------------------------------------------------------------------
  // DCCActor.classId accessor (Phase 4 closer — class-id dispatch helper)
  // -------------------------------------------------------------------

  test('DCCActor.classId returns lowercase canonical class identifier', async ({ page }) => {
    // Phase 4 closer — `actor.classId` is the canonical accessor for
    // class dispatch. Backing store is `system.details.sheetClass`,
    // which currently holds the capitalized sheet label. The getter
    // normalizes to the lowercase canonical ID the lib uses for
    // `character.classInfo.classId` and that the registry helpers
    // (`registerClassMixin`, `registerMercurialMagicTable`) document
    // as the dispatch key.
    const result = await page.evaluate(async () => {
      const player = await Actor.create({ name: 'P4-Closer classId Probe', type: 'Player' })

      const initial = player.classId

      await player.update({ 'system.details.sheetClass': 'Halfling' })
      const asHalfling = player.classId

      await player.update({ 'system.details.sheetClass': 'Warrior' })
      const asWarrior = player.classId

      await player.update({ 'system.details.sheetClass': '' })
      const cleared = player.classId

      await player.delete()
      return { initial, asHalfling, asWarrior, cleared }
    })
    expect(result.initial).toBeNull()
    expect(result.asHalfling).toBe('halfling')
    expect(result.asWarrior).toBe('warrior')
    expect(result.cleared).toBeNull()
  })

  // -------------------------------------------------------------------
  // registerClassDefaults / applyClassDefaults (Phase 5 session 1)
  // -------------------------------------------------------------------

  test('game.dcc.registerClassDefaults is exposed and is a function', async ({ page }) => {
    const result = await page.evaluate(() => ({
      hasFn: typeof game.dcc.registerClassDefaults === 'function',
      keys: Object.keys(game.dcc).filter(k => k === 'registerClassDefaults')
    }))
    expect(result.hasFn).toBe(true)
    expect(result.keys).toEqual(['registerClassDefaults'])
  })

  test('all 7 built-in PC classes have a CONFIG.DCC.classDefaults entry with the expected shape', async ({ page }) => {
    // Validates that the seed table in module/built-in-class-defaults.mjs
    // registered each PC class at init. Asserts on the structural
    // invariants — capitalized sheetClass sentinel, an enrichHtml
    // classLink path, and a literal critRange=20. Other per-class
    // details are exercised by the end-to-end test below.
    const result = await page.evaluate(() => {
      const expected = ['halfling', 'dwarf', 'thief', 'cleric', 'warrior', 'wizard', 'elf']
      const registry = CONFIG.DCC?.classDefaults ?? {}
      const shape = {}
      for (const classId of expected) {
        const entry = registry[classId]
        shape[classId] = {
          present: !!entry,
          sheetClass: entry?.sheetClass ?? null,
          hasClassLinkKey: !!entry?.enrichHtml?.['class.classLink'],
          critRange: entry?.literal?.['details.critRange'] ?? null,
          attackBonusMode: entry?.literal?.['config.attackBonusMode'] ?? null
        }
      }
      return shape
    })
    expect(result.halfling).toEqual({ present: true, sheetClass: 'Halfling', hasClassLinkKey: true, critRange: 20, attackBonusMode: 'flat' })
    expect(result.dwarf).toEqual({ present: true, sheetClass: 'Dwarf', hasClassLinkKey: true, critRange: 20, attackBonusMode: 'autoPerAttack' })
    expect(result.thief).toEqual({ present: true, sheetClass: 'Thief', hasClassLinkKey: true, critRange: 20, attackBonusMode: 'flat' })
    expect(result.cleric).toEqual({ present: true, sheetClass: 'Cleric', hasClassLinkKey: true, critRange: 20, attackBonusMode: 'flat' })
    expect(result.warrior).toEqual({ present: true, sheetClass: 'Warrior', hasClassLinkKey: true, critRange: 20, attackBonusMode: 'autoPerAttack' })
    expect(result.wizard).toEqual({ present: true, sheetClass: 'Wizard', hasClassLinkKey: true, critRange: 20, attackBonusMode: 'flat' })
    expect(result.elf).toEqual({ present: true, sheetClass: 'Elf', hasClassLinkKey: true, critRange: 20, attackBonusMode: 'flat' })
  })

  test('warrior + dwarf class-defaults entries carry the mightyDeedsLink enriched-HTML slot', async ({ page }) => {
    // Mighty Deeds is a warrior/dwarf-specific concept; the legacy
    // sheet subclasses wrote `class.mightyDeedsLink` only for these
    // two. Sanity-check the seed table reflects that.
    const result = await page.evaluate(() => {
      const registry = CONFIG.DCC?.classDefaults ?? {}
      return {
        warrior: registry.warrior?.enrichHtml?.['class.mightyDeedsLink'] ?? null,
        dwarf: registry.dwarf?.enrichHtml?.['class.mightyDeedsLink'] ?? null,
        halfling: registry.halfling?.enrichHtml?.['class.mightyDeedsLink'] ?? null,
        wizard: registry.wizard?.enrichHtml?.['class.spellcastingLink'] ?? null,
        wizardSpellburn: registry.wizard?.enrichHtml?.['class.spellburnLink'] ?? null
      }
    })
    expect(result.warrior).toBe('DCC.MightyDeedsLink')
    expect(result.dwarf).toBe('DCC.MightyDeedsLink')
    expect(result.halfling).toBeNull()
    expect(result.wizard).toBe('DCC.SpellcastingLink')
    expect(result.wizardSpellburn).toBe('DCC.SpellburnLink')
  })

  test('applyClassDefaults transitions a fresh Player actor onto a registered class end-to-end', async ({ page }) => {
    // Mirrors what the migrated halfling sheet now does on first open.
    // Drives the helper directly so the test doesn't need the
    // ApplicationV2 render lifecycle — but exercises the lib registry
    // + Foundry's TextEditor + i18n end-to-end against live state.
    const result = await page.evaluate(async () => {
      const { applyClassDefaults } = await import('../../../../../../../../systems/dcc/module/extension-api.mjs')
      const player = await Actor.create({ name: 'P5S1 ClassDefaults Probe', type: 'Player' })

      const before = {
        sheetClass: player.system.details.sheetClass,
        critRange: player.system.details.critRange
      }

      const firstResult = await applyClassDefaults(player, 'halfling')
      const after = {
        sheetClass: player.system.details.sheetClass,
        className: player.system.class.className,
        classLinkPresent: !!player.system.class.classLink,
        critRange: player.system.details.critRange,
        attackBonusMode: player.system.config.attackBonusMode,
        addClassLevelToInitiative: player.system.config.addClassLevelToInitiative,
        showBackstab: player.system.config.showBackstab
      }

      // Second call: sheetClass matches AND classLink is present → unchanged.
      const secondResult = await applyClassDefaults(player, 'halfling')

      // Wipe classLink to force the maintenance branch.
      await player.update({ 'system.class.classLink': '' })
      const thirdResult = await applyClassDefaults(player, 'halfling')
      const afterRegenerate = {
        classLinkPresent: !!player.system.class.classLink,
        // sheetClass shouldn't change on the maintenance branch.
        sheetClass: player.system.details.sheetClass
      }

      await player.delete()
      return { before, firstResult, after, secondResult, thirdResult, afterRegenerate }
    })

    expect(result.before.sheetClass).toBeFalsy()
    expect(result.firstResult).toBe('initialized')
    expect(result.after.sheetClass).toBe('Halfling')
    expect(typeof result.after.className).toBe('string')
    expect(result.after.className.length).toBeGreaterThan(0)
    expect(result.after.classLinkPresent).toBe(true)
    expect(result.after.critRange).toBe(20)
    expect(result.after.attackBonusMode).toBe('flat')
    expect(result.after.addClassLevelToInitiative).toBe(false)
    expect(result.after.showBackstab).toBe(false)

    expect(result.secondResult).toBe('unchanged')

    expect(result.thirdResult).toBe('regenerated')
    expect(result.afterRegenerate.classLinkPresent).toBe(true)
    expect(result.afterRegenerate.sheetClass).toBe('Halfling')
  })

  test('applyClassDefaults transitions a warrior with its mechanical defaults end-to-end', async ({ page }) => {
    // Warrior is the canonical example of a class whose `literal`
    // bag includes config-mode values that differ from base defaults
    // (`attackBonusMode='autoPerAttack'`, `addClassLevelToInitiative=true`).
    // Validates that the registry-driven write lands those onto a
    // live Player document — the cleanup of the per-class
    // `_prepareContext` blocks must preserve mechanical behavior.
    //
    // The mightyDeedsLink-surfaces-on-system check is in a sibling
    // test below — Phase 5 session 3 registered the four link fields
    // on the base Player schema so writes from `applyClassDefaults`
    // actually persist, closing the latent gap surfaced by session 1.
    const result = await page.evaluate(async () => {
      const { applyClassDefaults } = await import('../../../../../../../../systems/dcc/module/extension-api.mjs')
      const player = await Actor.create({ name: 'P5S1 Warrior Defaults Probe', type: 'Player' })

      const status = await applyClassDefaults(player, 'warrior')
      const after = {
        sheetClass: player.system.details.sheetClass,
        classLinkPresent: !!player.system.class.classLink,
        attackBonusMode: player.system.config.attackBonusMode,
        addClassLevelToInitiative: player.system.config.addClassLevelToInitiative,
        critRange: player.system.details.critRange,
        showBackstab: player.system.config.showBackstab
      }

      await player.delete()
      return { status, after }
    })

    expect(result.status).toBe('initialized')
    expect(result.after.sheetClass).toBe('Warrior')
    expect(result.after.classLinkPresent).toBe(true)
    expect(result.after.attackBonusMode).toBe('autoPerAttack')
    expect(result.after.addClassLevelToInitiative).toBe(true)
    expect(result.after.critRange).toBe(20)
    expect(result.after.showBackstab).toBe(false)
  })

  test('Phase 5 session 3 link fields surface on system.class.* (latent gap closed)', async ({ page }) => {
    // Pre-P5S3, only `class.classLink` survived on the constructed
    // Player schema (a sibling `dcc.definePlayerSchema` hook added it).
    // Warrior + dwarf `mightyDeedsLink` writes were silently stripped;
    // wizard `spellcastingLink` + `spellburnLink` writes too. Now those
    // four fields live on the base `class` SchemaField as `HTMLField`s
    // with `initial: ''`, so the `applyClassDefaults` enrichHtml writes
    // persist and `{{{system.class.<field>}}}` template references
    // render the actual link HTML.
    //
    // Validates by transitioning a warrior + wizard end-to-end and
    // asserting every registered enrichHtml path surfaces as a non-empty
    // string on `system.class.*`. A regression that re-strips the
    // fields would flip these to empty strings.
    const result = await page.evaluate(async () => {
      const { applyClassDefaults } = await import('../../../../../../../../systems/dcc/module/extension-api.mjs')

      const warrior = await Actor.create({ name: 'P5S3 Warrior LinkField Probe', type: 'Player' })
      await applyClassDefaults(warrior, 'warrior')
      const warriorState = {
        classLink: warrior.system.class.classLink,
        mightyDeedsLink: warrior.system.class.mightyDeedsLink
      }
      await warrior.delete()

      const wizard = await Actor.create({ name: 'P5S3 Wizard LinkField Probe', type: 'Player' })
      await applyClassDefaults(wizard, 'wizard')
      const wizardState = {
        classLink: wizard.system.class.classLink,
        spellcastingLink: wizard.system.class.spellcastingLink,
        spellburnLink: wizard.system.class.spellburnLink
      }
      await wizard.delete()

      const dwarf = await Actor.create({ name: 'P5S3 Dwarf LinkField Probe', type: 'Player' })
      await applyClassDefaults(dwarf, 'dwarf')
      const dwarfState = {
        classLink: dwarf.system.class.classLink,
        mightyDeedsLink: dwarf.system.class.mightyDeedsLink
      }
      await dwarf.delete()

      return { warriorState, wizardState, dwarfState }
    })

    // Warrior — classLink + mightyDeedsLink both write through
    expect(typeof result.warriorState.classLink).toBe('string')
    expect(result.warriorState.classLink.length).toBeGreaterThan(0)
    expect(typeof result.warriorState.mightyDeedsLink).toBe('string')
    expect(result.warriorState.mightyDeedsLink.length).toBeGreaterThan(0)

    // Wizard — three enrichHtml slots (no mightyDeeds)
    expect(result.wizardState.classLink.length).toBeGreaterThan(0)
    expect(result.wizardState.spellcastingLink.length).toBeGreaterThan(0)
    expect(result.wizardState.spellburnLink.length).toBeGreaterThan(0)

    // Dwarf — mirrors warrior's pair shape
    expect(result.dwarfState.classLink.length).toBeGreaterThan(0)
    expect(result.dwarfState.mightyDeedsLink.length).toBeGreaterThan(0)
  })

  test('fresh Player schema initializes the four link fields to empty strings', async ({ page }) => {
    // Pure schema-shape assertion: a brand-new Player document
    // (no class assigned yet) should carry `classLink`,
    // `mightyDeedsLink`, `spellcastingLink`, `spellburnLink` as
    // present-but-empty HTMLField values. This catches schema
    // regressions where the field declarations get dropped from
    // `player-data.mjs`'s static body.
    const result = await page.evaluate(async () => {
      const player = await Actor.create({ name: 'P5S3 LinkField Schema Probe', type: 'Player' })
      const shape = {
        classLink: player.system.class.classLink,
        mightyDeedsLink: player.system.class.mightyDeedsLink,
        spellcastingLink: player.system.class.spellcastingLink,
        spellburnLink: player.system.class.spellburnLink
      }
      await player.delete()
      return shape
    })
    // All four fields should exist on a brand-new Player with
    // empty-string defaults. The HTMLField type allows non-string
    // values via raw assignment, so be explicit: assert exactly ''.
    expect(result.classLink).toBe('')
    expect(result.mightyDeedsLink).toBe('')
    expect(result.spellcastingLink).toBe('')
    expect(result.spellburnLink).toBe('')
  })

  // -------------------------------------------------------------------
  // registerSheetPart (Phase 5 session 4)
  // -------------------------------------------------------------------

  test('game.dcc.registerSheetPart is exposed and is a function', async ({ page }) => {
    const result = await page.evaluate(() => ({
      hasFn: typeof game.dcc.registerSheetPart === 'function',
      keys: Object.keys(game.dcc).filter(k => k === 'registerSheetPart')
    }))
    expect(result.hasFn).toBe(true)
    expect(result.keys).toEqual(['registerSheetPart'])
  })

  test('all 7 built-in PC classes have a CONFIG.DCC.sheetParts entry with the expected shape', async ({ page }) => {
    // Validates that the seed table in
    // module/built-in-sheet-parts.mjs registered each PC class at
    // init. Asserts on structural invariants — the class-specific
    // part key (e.g. `cleric` for cleric, `wizard` for wizard) is
    // present in `parts`, and the matching tab id appears in
    // `tabs.sheet.tabs`. Catches a regression that drops a class
    // entry from the seed.
    const result = await page.evaluate(() => {
      const expected = {
        cleric: 'cleric',
        dwarf: 'dwarf',
        elf: 'elf',
        halfling: 'halfling',
        thief: 'thief',
        warrior: 'warrior',
        wizard: 'wizard'
      }
      const registry = CONFIG.DCC?.sheetParts ?? {}
      const shape = {}
      for (const [classId, partKey] of Object.entries(expected)) {
        const entry = registry[classId]
        const tabIds = (entry?.tabs?.sheet?.tabs ?? []).map(t => t.id)
        shape[classId] = {
          present: !!entry,
          hasClassPart: !!entry?.parts?.[partKey],
          classPartTemplate: entry?.parts?.[partKey]?.template ?? null,
          tabIncludesClassTab: tabIds.includes(partKey)
        }
      }
      return shape
    })

    expect(result.cleric).toEqual({
      present: true,
      hasClassPart: true,
      classPartTemplate: 'systems/dcc/templates/actor-partial-cleric.html',
      tabIncludesClassTab: true
    })
    expect(result.dwarf.hasClassPart).toBe(true)
    expect(result.elf.hasClassPart).toBe(true)
    expect(result.halfling.hasClassPart).toBe(true)
    expect(result.thief.hasClassPart).toBe(true)
    expect(result.warrior.hasClassPart).toBe(true)
    expect(result.wizard.hasClassPart).toBe(true)
  })

  test('cleric + wizard + elf entries carry their extra spell-related parts (clericSpells / wizardSpells)', async ({ page }) => {
    // Three of the seven classes ship extra parts on top of the
    // class-specific one:
    // - cleric: clericSpells
    // - wizard: wizardSpells
    // - elf: wizardSpells (elves cast as wizards)
    // The other four (halfling, thief, warrior, dwarf) don't. Catches
    // a regression that confuses which class gets the spell parts.
    const result = await page.evaluate(() => {
      const registry = CONFIG.DCC?.sheetParts ?? {}
      return {
        cleric: {
          clericSpells: !!registry.cleric?.parts?.clericSpells,
          wizardSpells: !!registry.cleric?.parts?.wizardSpells
        },
        wizard: {
          clericSpells: !!registry.wizard?.parts?.clericSpells,
          wizardSpells: !!registry.wizard?.parts?.wizardSpells
        },
        elf: {
          clericSpells: !!registry.elf?.parts?.clericSpells,
          wizardSpells: !!registry.elf?.parts?.wizardSpells
        },
        halfling: {
          clericSpells: !!registry.halfling?.parts?.clericSpells,
          wizardSpells: !!registry.halfling?.parts?.wizardSpells
        }
      }
    })
    expect(result.cleric).toEqual({ clericSpells: true, wizardSpells: false })
    expect(result.wizard).toEqual({ clericSpells: false, wizardSpells: true })
    expect(result.elf).toEqual({ clericSpells: false, wizardSpells: true })
    expect(result.halfling).toEqual({ clericSpells: false, wizardSpells: false })
  })

  test('DCCSheet base inherited static getters resolve CLASS_PARTS + CLASS_TABS by CLASS_ID', async ({ page }) => {
    // Validates the inherited-static-getter mechanism: each per-class
    // PC sheet subclass pins `static CLASS_ID = '<id>'` and inherits
    // the getter from DCCSheet, which reads from
    // `CONFIG.DCC.sheetParts[this.CLASS_ID]`. Asserts that each of the
    // 7 PC sheet classes resolves to the same shape its predecessor
    // hardcoded as a `static CLASS_PARTS = { … }` block.
    const result = await page.evaluate(() => {
      // Find sheets via the CONFIG.Actor.sheetClasses entries we
      // registered in `module/dcc.js`. Each entry's `.cls` is the
      // sheet class constructor.
      const playerSheets = CONFIG.Actor.sheetClasses?.Player ?? {}
      const sheetClassByName = {}
      for (const entry of Object.values(playerSheets)) {
        sheetClassByName[entry.cls.name] = entry.cls
      }
      const probe = (name, classId, expectedPartKey, expectedTabId) => {
        const cls = sheetClassByName[name]
        if (!cls) return { name, missing: true }
        return {
          name,
          missing: false,
          classId: cls.CLASS_ID,
          partsHasClassKey: !!cls.CLASS_PARTS?.[expectedPartKey],
          partsTemplate: cls.CLASS_PARTS?.[expectedPartKey]?.template ?? null,
          tabsHaveClassTab: (cls.CLASS_TABS?.sheet?.tabs ?? []).some(t => t.id === expectedTabId)
        }
      }
      return {
        cleric: probe('DCCActorSheetCleric', 'cleric', 'cleric', 'cleric'),
        thief: probe('DCCActorSheetThief', 'thief', 'thief', 'thief'),
        halfling: probe('DCCActorSheetHalfling', 'halfling', 'halfling', 'halfling'),
        warrior: probe('DCCActorSheetWarrior', 'warrior', 'warrior', 'warrior'),
        wizard: probe('DCCActorSheetWizard', 'wizard', 'wizard', 'wizard'),
        dwarf: probe('DCCActorSheetDwarf', 'dwarf', 'dwarf', 'dwarf'),
        elf: probe('DCCActorSheetElf', 'elf', 'elf', 'elf')
      }
    })

    for (const [classId, probe] of Object.entries(result)) {
      expect(probe.missing, `${probe.name} should be registered`).toBe(false)
      expect(probe.classId, `${probe.name}.CLASS_ID`).toBe(classId)
      expect(probe.partsHasClassKey, `${probe.name}.CLASS_PARTS.${classId}`).toBe(true)
      expect(typeof probe.partsTemplate).toBe('string')
      expect(probe.tabsHaveClassTab, `${probe.name}.CLASS_TABS.sheet.tabs includes ${classId}`).toBe(true)
    }
  })

  test('homebrew classId registered via game.dcc.registerSheetPart propagates through inherited getter', async ({ page }) => {
    // A sibling module registering a homebrew class's sheet parts
    // should be picked up by any sheet subclass pinning that CLASS_ID
    // — without any other DCC system change. This is the §2.8
    // (homebrew) promise. Restore the empty state after so subsequent
    // tests stay correct.
    const result = await page.evaluate(async () => {
      const original = CONFIG.DCC.sheetParts['p5s4-squire']
      game.dcc.registerSheetPart('p5s4-squire', {
        parts: {
          squire: { id: 'squire', template: 'systems/dcc/templates/actor-partial-warrior.html' }
        },
        tabs: {
          sheet: { tabs: [{ id: 'squire', group: 'sheet', label: 'P5S4.Squire' }] }
        }
      })

      const after = {
        registered: !!CONFIG.DCC.sheetParts['p5s4-squire'],
        partTemplate: CONFIG.DCC.sheetParts['p5s4-squire']?.parts?.squire?.template ?? null,
        tabLabel: CONFIG.DCC.sheetParts['p5s4-squire']?.tabs?.sheet?.tabs?.[0]?.label ?? null
      }

      // Restore the empty state.
      if (original === undefined) {
        delete CONFIG.DCC.sheetParts['p5s4-squire']
      } else {
        CONFIG.DCC.sheetParts['p5s4-squire'] = original
      }

      return after
    })

    expect(result.registered).toBe(true)
    expect(result.partTemplate).toBe('systems/dcc/templates/actor-partial-warrior.html')
    expect(result.tabLabel).toBe('P5S4.Squire')
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

  // -------------------------------------------------------------------
  // registerClassStartingItems / applyClassStartingItems (Phase 5 session 2)
  // -------------------------------------------------------------------

  test('game.dcc.registerClassStartingItems is exposed and is a function', async ({ page }) => {
    const result = await page.evaluate(() => ({
      hasFn: typeof game.dcc.registerClassStartingItems === 'function',
      keys: Object.keys(game.dcc).filter(k => k === 'registerClassStartingItems')
    }))
    expect(result.hasFn).toBe(true)
    expect(result.keys).toEqual(['registerClassStartingItems'])
  })

  test('built-in dwarf starting-items entry seeds the ShieldBash weapon', async ({ page }) => {
    // Validates that the seed table in module/built-in-class-starting-items.mjs
    // registered the dwarf at init. Assert on entry shape so a future
    // table-format change has a regression guard.
    const result = await page.evaluate(() => {
      const entries = CONFIG.DCC?.classStartingItems?.dwarf ?? []
      return {
        present: entries.length > 0,
        firstEntry: entries[0] ?? null,
        otherClassesPresent: ['cleric', 'thief', 'halfling', 'warrior', 'wizard', 'elf']
          .filter(c => Array.isArray(CONFIG.DCC?.classStartingItems?.[c]))
      }
    })
    expect(result.present).toBe(true)
    expect(result.firstEntry).toMatchObject({
      nameKey: 'DCC.ShieldBash',
      type: 'weapon',
      img: 'systems/dcc/styles/images/game-icons-net/shield-bash.svg',
      system: {
        melee: true,
        damage: '1d3',
        config: { actionDieOverride: '1d14' }
      }
    })
    // No other DCC built-in class should have starting items today.
    expect(result.otherClassesPresent).toEqual([])
  })

  test('applyClassStartingItems creates the dwarf ShieldBash on a fresh actor', async ({ page }) => {
    // End-to-end check: register-time entry → apply-time embedded doc
    // create against a live Player document. Mirrors what the dwarf
    // sheet's `_prepareContext` now does (the `'initialized'` branch
    // delegates to applyClassStartingItems).
    const result = await page.evaluate(async () => {
      const { applyClassStartingItems } = await import('../../../../../../../../systems/dcc/module/extension-api.mjs')
      const player = await Actor.create({ name: 'P5S2 Dwarf StartingItems Probe', type: 'Player' })

      const before = player.items.size
      const created = await applyClassStartingItems(player, 'dwarf')
      const after = {
        size: player.items.size,
        hasShieldBash: player.items.some(item => item.type === 'weapon' && item.name === game.i18n.localize('DCC.ShieldBash'))
      }

      await player.delete()
      return { before, createdCount: created.length, after }
    })

    expect(result.before).toBe(0)
    expect(result.createdCount).toBe(1)
    expect(result.after.size).toBe(1)
    expect(result.after.hasShieldBash).toBe(true)
  })

  test('applyClassStartingItems is idempotent — calling twice does not duplicate', async ({ page }) => {
    // The "already-have-it" duplicate check matches (type, localized
    // name). A dwarf sheet reopen (or a class-change re-fire) shouldn't
    // create a second ShieldBash weapon.
    const result = await page.evaluate(async () => {
      const { applyClassStartingItems } = await import('../../../../../../../../systems/dcc/module/extension-api.mjs')
      const player = await Actor.create({ name: 'P5S2 Dwarf Idempotent Probe', type: 'Player' })

      const first = await applyClassStartingItems(player, 'dwarf')
      const second = await applyClassStartingItems(player, 'dwarf')
      const finalSize = player.items.size

      await player.delete()
      return {
        firstCount: first.length,
        secondCount: second.length,
        finalSize
      }
    })

    expect(result.firstCount).toBe(1)
    expect(result.secondCount).toBe(0)
    expect(result.finalSize).toBe(1)
  })

  test('homebrew class registered via game.dcc.registerClassStartingItems gets items applied through the same code path', async ({ page }) => {
    // Validates the registry's homebrew use case: a sibling module
    // registers starting items for its own classId; the existing
    // applyClassStartingItems helper picks them up without any
    // sheet-side change. Restore the empty state after so subsequent
    // tests / world state stay correct.
    const result = await page.evaluate(async () => {
      const { applyClassStartingItems } = await import('../../../../../../../../systems/dcc/module/extension-api.mjs')
      const original = CONFIG.DCC.classStartingItems.squire
      game.dcc.registerClassStartingItems('squire', [{
        nameKey: 'DCC.Longsword',
        type: 'weapon',
        system: { melee: true, damage: '1d8' }
      }])

      const player = await Actor.create({ name: 'P5S2 Squire Homebrew Probe', type: 'Player' })
      const created = await applyClassStartingItems(player, 'squire')
      const after = {
        createdCount: created.length,
        createdName: created[0]?.name ?? null,
        createdType: created[0]?.type ?? null
      }
      await player.delete()

      // Restore the registry to its original state so other tests
      // can assume no 'squire' entry exists.
      if (original === undefined) {
        delete CONFIG.DCC.classStartingItems.squire
      } else {
        CONFIG.DCC.classStartingItems.squire = original
      }

      return after
    })

    expect(result.createdCount).toBe(1)
    expect(result.createdType).toBe('weapon')
    expect(typeof result.createdName).toBe('string')
    expect(result.createdName.length).toBeGreaterThan(0)
  })
})
