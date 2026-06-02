/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

// No console capture needed — this spec asserts on returned state, not a
// zero-console-error gate.
const test = createSessionTest()

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
    // Login + system boot is handled ONCE per worker by the sessionPage fixture
    // above; this hook only does world-state hygiene between tests.
    //
    // World-state hygiene. Mirrors `data-models.spec.js` / `adapter-dispatch.spec.js`
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
    // adapter-dispatch / v14-features hygiene; this test
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

  test('DCC table-loading surface (setupCoreBookCompendiumLinks / registerTables / getSkillTable / RollTable lifecycle hooks) survives table-loading.mjs extraction', async ({ page }) => {
    // Phase 7 session 5: the `setupCoreBookCompendiumLinks` /
    // `registerTables` / `getSkillTable` functions plus five hooks
    // (`diceSoNiceReady`, `importAdventure`, `createRollTable`,
    // `deleteRollTable`, `updateRollTable`) were relocated from
    // `module/dcc.js` into `module/table-loading.mjs`. The init / ready
    // sequence still installs the same CONFIG slots; `game.dcc.getSkillTable`
    // remains published; and the three world-RollTable lifecycle hooks
    // still keep `CONFIG.DCC.disapprovalTables` in sync.
    //
    // End-to-end probe: assert the registries seeded at ready time
    // exist, then exercise the live world-RollTable lifecycle by
    // creating + updating + deleting a RollTable named "P_TableLoad
    // Probe Disapproval" and confirming `CONFIG.DCC.disapprovalTables`
    // tracks the changes via the relocated hook handlers.
    const result = await page.evaluate(async () => {
      const observed = {}

      // 1. `registerTables` seeds the three TablePackManager registries.
      observed.disapprovalPacksType = CONFIG.DCC.disapprovalPacks?.constructor?.name ?? null
      observed.criticalHitPacksType = CONFIG.DCC.criticalHitPacks?.constructor?.name ?? null
      observed.patronTaintPacksType = CONFIG.DCC.patronTaintPacks?.constructor?.name ?? null
      // Patron-taint registry is seeded with the core + xcc side-effect packs.
      observed.patronTaintSeededDccCore = CONFIG.DCC.patronTaintPacks?.packs?.includes('dcc-core-book.dcc-core-spell-side-effect-tables') ?? false
      observed.patronTaintSeededXccCore = CONFIG.DCC.patronTaintPacks?.packs?.includes('xcc-core-book.xcc-core-spell-side-effect-tables') ?? false

      // 2. `setupCoreBookCompendiumLinks` either populates the slot
      //    (dcc-core-book active) or sets it to null. Either is valid
      //    depending on which modules the test world has enabled — what
      //    matters is the slot has been touched (key exists).
      observed.coreBookLinksKeyExists = 'coreBookCompendiumLinks' in CONFIG.DCC

      // 3. `getSkillTable` is exposed on the stable surface.
      observed.getSkillTableType = typeof game.dcc.getSkillTable

      // 4. Exercise the relocated world-RollTable lifecycle hooks. Snapshot
      //    the current `disapprovalTables` so we can restore at the end.
      const beforeSnapshot = { ...(CONFIG.DCC.disapprovalTables ?? {}) }
      const probeName = 'P_TableLoad Probe Disapproval'
      let probeTable
      try {
        // createRollTable: world table whose name contains "Disapproval"
        // should be registered in `CONFIG.DCC.disapprovalTables` by the
        // relocated `onCreateRollTable` handler.
        probeTable = await RollTable.create({ name: probeName })
        observed.afterCreate = CONFIG.DCC.disapprovalTables?.[probeName] ?? null

        // updateRollTable: rename to a non-disapproval name. The
        // relocated `onUpdateRollTable` handler rebuilds the world half
        // from scratch, so the old entry drops out and (since the new
        // name does not match) no new entry appears.
        const renamedName = 'P_TableLoad Probe Renamed'
        await probeTable.update({ name: renamedName })
        observed.afterRenameOldName = CONFIG.DCC.disapprovalTables?.[probeName] ?? null
        observed.afterRenameNewName = CONFIG.DCC.disapprovalTables?.[renamedName] ?? null

        // updateRollTable again: rename back to a disapproval-matching
        // name — the world entry should reappear.
        const restoredName = 'P_TableLoad Probe Disapproval Restored'
        await probeTable.update({ name: restoredName })
        observed.afterRestoreEntry = CONFIG.DCC.disapprovalTables?.[restoredName] ?? null

        // deleteRollTable: removing the table drops the entry.
        await probeTable.delete()
        probeTable = null
        observed.afterDelete = CONFIG.DCC.disapprovalTables?.[restoredName] ?? null
      } finally {
        if (probeTable) {
          await probeTable.delete().catch(() => {})
        }
        // Restore the disapproval-tables snapshot so downstream tests
        // start from the same state.
        CONFIG.DCC.disapprovalTables = beforeSnapshot
      }

      return observed
    })

    expect(result.disapprovalPacksType).toBe('TablePackManager')
    expect(result.criticalHitPacksType).toBe('TablePackManager')
    expect(result.patronTaintPacksType).toBe('TablePackManager')
    expect(result.patronTaintSeededDccCore).toBe(true)
    expect(result.patronTaintSeededXccCore).toBe(true)
    expect(result.coreBookLinksKeyExists).toBe(true)
    expect(result.getSkillTableType).toBe('function')
    // onCreateRollTable populated the entry.
    expect(result.afterCreate).toEqual({ name: 'P_TableLoad Probe Disapproval', path: 'P_TableLoad Probe Disapproval' })
    // After rename to a non-disapproval name, both old and new are absent.
    expect(result.afterRenameOldName).toBeNull()
    expect(result.afterRenameNewName).toBeNull()
    // After rename back to a matching name, the new entry is present.
    expect(result.afterRestoreEntry).toEqual({ name: 'P_TableLoad Probe Disapproval Restored', path: 'P_TableLoad Probe Disapproval Restored' })
    // After delete, the entry is gone.
    expect(result.afterDelete).toBeNull()
  })

  test('DCC chat- and hook-wiring (preCreateActor / preCreateItem / preUpdateActor + 8 other hooks) survives chat-and-hook-wiring.mjs extraction', async ({ page }) => {
    // Phase 7 session 6: the eleven `Hooks.on` / `Hooks.once` handlers
    // (`hotbarDrop`, `renderChatMessageHTML`, `getChatMessageContextOptions`,
    // `renderActorDirectory`, `preCreateActor`, `preCreateItem`,
    // `applyActiveEffect`, `preUpdateActor`, `updateCombat`,
    // `item-piles-ready`, `getProseMirrorMenuDropDowns`) were relocated
    // from `module/dcc.js` into `module/chat-and-hook-wiring.mjs` and
    // are wired by a single `registerChatAndHookWiring()` call.
    //
    // End-to-end probe: create a temporary Player actor without an img
    // and assert the relocated `onPreCreateActor` handler fires (DCC
    // default image applied, prototype-token actor-link set). Create a
    // weapon item without an img on that actor and assert
    // `onPreCreateItem` assigns a default item image. Then update the
    // actor's img and assert `onPreUpdateActor` syncs the prototype-
    // token texture (it was a default image, so the sync should fire).
    // Cleanup the actor in a `finally` block so downstream tests see a
    // clean state.
    const result = await page.evaluate(async () => {
      const observed = {}
      let probe

      try {
        // 1. preCreateActor: create a fresh Player with no img.
        probe = await Actor.create({
          type: 'Player',
          name: 'P_ChatHook Probe'
        })
        observed.actorImg = probe.img
        observed.actorImgIsString = typeof probe.img === 'string'
        observed.actorImgNonEmpty = (probe.img || '').length > 0
        observed.protoTokenActorLink = probe.prototypeToken?.actorLink === true

        // 2. preCreateItem: create a weapon item with no img on the probe.
        const items = await probe.createEmbeddedDocuments('Item', [{
          type: 'weapon',
          name: 'P_ChatHook Probe Weapon'
        }])
        const probeItem = items[0]
        observed.itemImg = probeItem.img
        observed.itemImgNonEmpty = (probeItem.img || '').length > 0

        // 3. preUpdateActor: changing the actor's img should sync the
        //    prototype-token texture when the existing texture was a
        //    default image (we just created the actor with the system
        //    default — the relocated hook recognises this and updates).
        const customImg = 'icons/svg/aura.svg'
        await probe.update({ img: customImg })
        observed.protoTokenTextureSrc = probe.prototypeToken?.texture?.src
        observed.protoTokenSyncedToCustom = probe.prototypeToken?.texture?.src === customImg
      } finally {
        if (probe) {
          await probe.delete().catch(() => {})
        }
      }

      return observed
    })

    // preCreateActor: default image got assigned + prototype-token actor-link set.
    expect(result.actorImgIsString).toBe(true)
    expect(result.actorImgNonEmpty).toBe(true)
    expect(result.protoTokenActorLink).toBe(true)
    // preCreateItem: default item image got assigned.
    expect(result.itemImgNonEmpty).toBe(true)
    // preUpdateActor: prototype-token texture synced to the new actor image.
    expect(result.protoTokenSyncedToCustom).toBe(true)
  })

  test('DCC compiled stylesheet survives the styles/dcc.scss split into 18 partials', async ({ page }) => {
    // Phase 7 session 7: the ~2979-line `styles/dcc.scss` monolith is
    // split into 18 focused partials (`_base.scss`, `_journal.scss`,
    // `_armor.scss`, `_chat.scss`, `_weapons.scss`, `_class-sheets.scss`,
    // `_party-sheet.scss`, `_hit-points-dialog.scss`, `_items.scss`,
    // `_config-dialogs.scss`, `_skills.scss`, `_tabs.scss`,
    // `_entity-link.scss`, `_dialogs.scss`, `_actor-sheet.scss`,
    // `_effects.scss`, `_level-change-dialog.scss`,
    // `_container-items.scss`). The new `dcc.scss` is a manifest of
    // `@use 'partial-name'` directives in source order so the compiled
    // `dcc.css` is byte-identical to the pre-split build.
    //
    // End-to-end probe: fetch the served `dcc.css` and assert it
    // contains representative selectors from selected partials
    // (proves the SCSS pipeline still produces functional output and
    // is being served by Foundry).
    const result = await page.evaluate(async () => {
      const response = await fetch('/systems/dcc/styles/dcc.css')
      const text = await response.text()
      return {
        status: response.status,
        bytes: text.length,
        // Selectors from selected partials — if any are missing, a
        // partial was lost or the manifest is out of sync.
        hasGrid: text.includes('.grid-align-center'),
        hasJournal: text.includes('.journal-sheet'),
        hasChat: text.includes('.deed-result.critical'),
        hasPartySheet: text.includes('.dcc .party-body'),
        hasItems: text.includes('.dcc .equipment-bg'),
        hasTabs: text.includes('.dcc.sheet .sheet-tabs'),
        hasRollModifier: text.includes('.dcc-roll-modifier'),
        hasFleetingLuck: text.includes('.dcc .fleeting-luck'),
        hasSpellDuel: text.includes('.dcc .spell-duel'),
        hasContainerItems: text.includes('.dcc .container-sheet'),
        // Sanity-check size — pre-split build was ~65KB.
        sizeReasonable: text.length > 50000 && text.length < 80000
      }
    })

    expect(result.status).toBe(200)
    expect(result.hasGrid).toBe(true)
    expect(result.hasJournal).toBe(true)
    expect(result.hasChat).toBe(true)
    expect(result.hasPartySheet).toBe(true)
    expect(result.hasItems).toBe(true)
    expect(result.hasTabs).toBe(true)
    expect(result.hasRollModifier).toBe(true)
    expect(result.hasFleetingLuck).toBe(true)
    expect(result.hasSpellDuel).toBe(true)
    expect(result.hasContainerItems).toBe(true)
    expect(result.sizeReasonable).toBe(true)
  })

  test('DCC theming-contract --system-* vars resolve to documented values in both themes', async ({ page }) => {
    // Phase 7 session 8: the hex-literal → theme-variable migration
    // introduced 12 new --system-* CSS custom properties as the
    // theming contract for variants (xcc, mcc). Six are
    // theme-agnostic semantic colors (muted text, damage red,
    // rollable hover, flat-button border, two-weapon hand
    // indicators); six are tab-overflow dropdown colors paired with
    // dark-theme overrides in `styles/variables.css`. The old
    // `body.theme-dark & .sheet-tabs ... .tabs-overflow-menu`
    // override block in `_tabs.scss` is now redundant — the dark
    // cascade flows through the variable overrides instead.
    //
    // This probe asserts the documented contract end-to-end:
    //   1. The compiled `dcc.css` references the new vars in place
    //      of the prior hex literals (regression net for any future
    //      re-introduction).
    //   2. The redundant `body.theme-dark ... .tabs-overflow-menu`
    //      block is gone from the compiled output.
    //   3. `getComputedStyle()` resolves each var to its documented
    //      light value via `:root`, and to its documented dark
    //      override value via a transient `.theme-dark` probe
    //      element (no live-theme flip required, so the test is
    //      robust to whatever theme the test user has selected).
    const result = await page.evaluate(async () => {
      const css = await fetch('/systems/dcc/styles/dcc.css').then(r => r.text())
      // Probe element scoped under `.theme-dark` — descendants of an
      // element matching `.theme-dark` see the variable overrides.
      const probe = document.createElement('div')
      probe.className = 'theme-dark'
      document.body.appendChild(probe)
      const lightStyle = getComputedStyle(document.documentElement)
      const darkStyle = getComputedStyle(probe)
      const read = (style, varName) => style.getPropertyValue(varName).trim()
      const out = {
        // (1) Compiled CSS references the new vars.
        hasRollableHoverVar: css.includes('color: var(--system-rollable-hover-color)'),
        hasDamageVar: css.includes('color: var(--system-damage-color)'),
        hasMutedVar: css.includes('color: var(--system-text-muted-color)'),
        hasFlatButtonBorderVar: css.includes('border: 2px groove var(--system-flat-button-border-color)'),
        hasTwoWeaponPrimaryVar: css.includes('color: var(--system-two-weapon-primary-color)'),
        hasTwoWeaponSecondaryVar: css.includes('color: var(--system-two-weapon-secondary-color)'),
        hasTabOverflowBgVar: css.includes('background: var(--system-tab-overflow-background)'),
        // (2) Redundant body.theme-dark tabs-overflow block gone.
        noDarkOverrideBlock: !css.includes('body.theme-dark .dcc.sheet .sheet-tabs.responsive-tabs .tabs-overflow .tabs-overflow-menu'),
        // (3a) Theme-agnostic semantic vars — documented light defaults.
        mutedColorLight: read(lightStyle, '--system-text-muted-color'),
        damageColorLight: read(lightStyle, '--system-damage-color'),
        rollableHoverLight: read(lightStyle, '--system-rollable-hover-color'),
        flatButtonBorderLight: read(lightStyle, '--system-flat-button-border-color'),
        twoWeaponPrimaryLight: read(lightStyle, '--system-two-weapon-primary-color'),
        twoWeaponSecondaryLight: read(lightStyle, '--system-two-weapon-secondary-color'),
        // (3b) Tab-overflow vars — light defaults.
        tabOverflowBgLight: read(lightStyle, '--system-tab-overflow-background'),
        tabOverflowBorderLight: read(lightStyle, '--system-tab-overflow-border-color'),
        tabOverflowTextLight: read(lightStyle, '--system-tab-overflow-text-color'),
        tabOverflowHoverBgLight: read(lightStyle, '--system-tab-overflow-hover-background'),
        tabOverflowHoverTextLight: read(lightStyle, '--system-tab-overflow-hover-text-color'),
        // (3c) Tab-overflow vars — dark overrides via .theme-dark probe.
        tabOverflowBgDark: read(darkStyle, '--system-tab-overflow-background'),
        tabOverflowBorderDark: read(darkStyle, '--system-tab-overflow-border-color'),
        tabOverflowTextDark: read(darkStyle, '--system-tab-overflow-text-color'),
        tabOverflowHoverBgDark: read(darkStyle, '--system-tab-overflow-hover-background'),
        tabOverflowHoverTextDark: read(darkStyle, '--system-tab-overflow-hover-text-color'),
        tabOverflowActiveTextDark: read(darkStyle, '--system-tab-overflow-active-text-color')
      }
      probe.remove()
      return out
    })

    // (1) Compiled CSS references the new vars.
    expect(result.hasRollableHoverVar).toBe(true)
    expect(result.hasDamageVar).toBe(true)
    expect(result.hasMutedVar).toBe(true)
    expect(result.hasFlatButtonBorderVar).toBe(true)
    expect(result.hasTwoWeaponPrimaryVar).toBe(true)
    expect(result.hasTwoWeaponSecondaryVar).toBe(true)
    expect(result.hasTabOverflowBgVar).toBe(true)
    // (2) Redundant body.theme-dark tabs-overflow block is gone.
    expect(result.noDarkOverrideBlock).toBe(true)
    // (3a) Theme-agnostic semantic vars resolve to documented values.
    expect(result.mutedColorLight).toBe('#666')
    expect(result.damageColorLight).toBe('#8b0000')
    expect(result.rollableHoverLight).toBe('#000')
    expect(result.flatButtonBorderLight).toBe('#c9c7b8')
    expect(result.twoWeaponPrimaryLight).toBe('#4caf50')
    expect(result.twoWeaponSecondaryLight).toBe('#d32f2f')
    // (3b) Tab-overflow vars — light defaults.
    expect(result.tabOverflowBgLight).toBe('#f0e8d8')
    expect(result.tabOverflowBorderLight).toBe('#8b7355')
    expect(result.tabOverflowTextLight).toBe('#4a3c2a')
    expect(result.tabOverflowHoverBgLight).toBe('#e0d5c0')
    expect(result.tabOverflowHoverTextLight).toBe('#2a1f14')
    // (3c) Tab-overflow vars — dark overrides.
    expect(result.tabOverflowBgDark).toBe('#2a2a2a')
    expect(result.tabOverflowBorderDark).toBe('#444')
    expect(result.tabOverflowTextDark).toBe('#ccc')
    expect(result.tabOverflowHoverBgDark).toBe('#3a3a3a')
    expect(result.tabOverflowHoverTextDark).toBe('#fff')
    expect(result.tabOverflowActiveTextDark).toBe('#fff')
  })

  test('DCC adapter table caches short-circuit pack walks and invalidate on world-RollTable events', async ({ page }) => {
    // Phase 7 session 9: the four table-loading sites in
    // spell-input.mjs (`loadDisapprovalTable`,
    // `loadMercurialMagicTable`) and utilities.js (`getCritTableLink`,
    // `getCritTableResult`) now consult `module/adapter/table-cache.mjs`
    // before walking compendium packs + world tables. World-RollTable
    // lifecycle hooks (`createRollTable` / `updateRollTable` /
    // `deleteRollTable`) drop every cache to keep stale data out.
    //
    // End-to-end probe:
    //   (1) Import the cache module live and confirm the four named
    //       caches are exposed as Map instances + the dispatch table
    //       carries exactly the three world-RollTable lifecycle hooks.
    //   (2) Seed each cache with a probe entry, fire `createRollTable`
    //       via `Hooks.callAll` on a transient probe table, and confirm
    //       every cache is empty afterwards (invalidation wired by
    //       `registerTableCacheInvalidation()` at init).
    //   (3) Repeat for `updateRollTable` and `deleteRollTable`.
    //   (4) Clean up the probe table so downstream tests start from a
    //       known state.
    const result = await page.evaluate(async () => {
      const cache = await import('../../../../../../../../systems/dcc/module/adapter/table-cache.mjs')

      // (1) Module shape.
      const shape = {
        cachesAreMaps: [
          cache.disapprovalTableCache,
          cache.mercurialMagicTableCache,
          cache.critTableLinkCache,
          cache.critTableDocCache
        ].every((c) => c instanceof Map),
        dispatchKeys: Object.keys(cache.TABLE_CACHE_INVALIDATION_HOOKS).sort(),
        dispatchAllNonOnce: Object.values(cache.TABLE_CACHE_INVALIDATION_HOOKS)
          .every((entry) => entry.once === false)
      }

      // Helper: seed one entry per cache so we can prove invalidation
      // empties them.
      const seedAll = () => {
        cache.disapprovalTableCache.set('probe-disapproval', { rows: [] })
        cache.mercurialMagicTableCache.set('probe-mercurial', { rows: [] })
        cache.critTableLinkCache.set('probe-link', '@UUID[Compendium.x.y]')
        cache.critTableDocCache.set('probe-doc', { id: 'x' })
      }
      const allSizes = () => ({
        disapproval: cache.disapprovalTableCache.size,
        mercurial: cache.mercurialMagicTableCache.size,
        critLink: cache.critTableLinkCache.size,
        critDoc: cache.critTableDocCache.size
      })

      // Create a probe table once so the lifecycle hooks have a real
      // document to fire against. We reuse it across the three CRUD
      // assertions (rename + delete operate on the same doc).
      const probeTable = await RollTable.create({ name: 'P_TableCache Probe' })

      // (2) createRollTable invalidation. Note: seeding AFTER the
      // create — the create event already fired and would have cleared
      // an existing cache. Now fire a re-create via Hooks.callAll on a
      // *separate* table-name to drive the handler chain cleanly.
      seedAll()
      const sizesBeforeCreate = allSizes()
      Hooks.callAll('createRollTable', probeTable)
      const sizesAfterCreate = allSizes()

      // (3a) updateRollTable invalidation.
      seedAll()
      const sizesBeforeUpdate = allSizes()
      await probeTable.update({ name: 'P_TableCache Probe Renamed' })
      const sizesAfterUpdate = allSizes()

      // (3b) deleteRollTable invalidation.
      seedAll()
      const sizesBeforeDelete = allSizes()
      await probeTable.delete()
      const sizesAfterDelete = allSizes()

      return {
        shape,
        invalidation: {
          create: { before: sizesBeforeCreate, after: sizesAfterCreate },
          update: { before: sizesBeforeUpdate, after: sizesAfterUpdate },
          delete: { before: sizesBeforeDelete, after: sizesAfterDelete }
        }
      }
    })

    // (1) The cache module exposes the four named caches as Maps + the
    // dispatch table covers exactly the three world-RollTable lifecycle
    // hooks, all `once: false`.
    expect(result.shape.cachesAreMaps).toBe(true)
    expect(result.shape.dispatchKeys).toEqual([
      'createRollTable',
      'deleteRollTable',
      'updateRollTable'
    ])
    expect(result.shape.dispatchAllNonOnce).toBe(true)

    // (2) + (3) Every cache had 1 entry before each lifecycle event and
    // is empty after — the invalidation hooks fired and `clearAllTableCaches`
    // ran.
    for (const phase of ['create', 'update', 'delete']) {
      const { before, after } = result.invalidation[phase]
      expect(before.disapproval).toBe(1)
      expect(before.mercurial).toBe(1)
      expect(before.critLink).toBe(1)
      expect(before.critDoc).toBe(1)
      expect(after.disapproval).toBe(0)
      expect(after.mercurial).toBe(0)
      expect(after.critLink).toBe(0)
      expect(after.critDoc).toBe(0)
    }
  })

  test('DCC chat-renderer shared helpers (buildLibResultFlag + applyFleetingLuck) survive the Phase 7 session 10 extraction', async ({ page }) => {
    // Phase 7 session 10: the four chat renderers (ability / save /
    // skill / spell) shared a near-identical `dcc.libResult` payload
    // plus an identical guarded `FleetingLuck.updateFlags` block. The
    // shared core (die / natural / total / formula / critical / fumble /
    // modifiers) is now owned by `buildLibResultFlag(result, extras)`
    // and the luck update by `applyFleetingLuck(flags, roll)` in
    // `module/adapter/chat-renderer.mjs`; callers pass the result-id
    // (`skillId` for checks, `spellId` for spell checks) plus the
    // spell-only fields (tier / spellLost / corruptionTriggered) as
    // extras. This probe imports the live-served module and confirms the
    // deployed helpers reproduce both payload shapes the renderers emit
    // and that the luck helper stays a guard-safe no-op without a roll.
    const result = await page.evaluate(async () => {
      const mod = await import('../../../../../../../../systems/dcc/module/adapter/chat-renderer.mjs')

      const libResult = {
        skillId: 'sneakSilently',
        spellId: 'magic-missile',
        die: 'd20',
        natural: 14,
        total: 17,
        formula: '1d20 + 3',
        critical: false,
        fumble: false,
        tier: 'success-minor',
        spellLost: false,
        corruptionTriggered: true,
        modifiers: [{ kind: 'ability', value: 3, applied: true }]
      }

      // Check-shaped payload (renderAbilityCheck / renderSavingThrow /
      // renderSkillCheck all build this).
      const checkFlag = mod.buildLibResultFlag(libResult, { skillId: libResult.skillId })
      // Spell-shaped payload (renderSpellCheck).
      const spellFlag = mod.buildLibResultFlag(libResult, {
        spellId: libResult.spellId,
        tier: libResult.tier,
        spellLost: libResult.spellLost,
        corruptionTriggered: libResult.corruptionTriggered
      })

      // applyFleetingLuck: exported + guard-safe. Calling with an
      // absent roll must be a no-op (no keys added, no throw) — the
      // same guard the four renderers relied on inline pre-extraction.
      const luckFlags = { 'dcc.RollType': 'AbilityCheck' }
      let luckThrew = false
      try {
        mod.applyFleetingLuck(luckFlags, undefined)
      } catch {
        luckThrew = true
      }

      return {
        isFunction: typeof mod.buildLibResultFlag === 'function',
        applyFleetingLuckIsFunction: typeof mod.applyFleetingLuck === 'function',
        applyFleetingLuckNoRollIsNoOp: !luckThrew && Object.keys(luckFlags).length === 1,
        checkKeys: Object.keys(checkFlag).sort(),
        checkValues: {
          skillId: checkFlag.skillId,
          die: checkFlag.die,
          total: checkFlag.total,
          modifiersIsArray: Array.isArray(checkFlag.modifiers)
        },
        checkHasSpellId: Object.prototype.hasOwnProperty.call(checkFlag, 'spellId'),
        spellKeys: Object.keys(spellFlag).sort(),
        spellValues: {
          spellId: spellFlag.spellId,
          tier: spellFlag.tier,
          corruptionTriggered: spellFlag.corruptionTriggered
        },
        spellHasSkillId: Object.prototype.hasOwnProperty.call(spellFlag, 'skillId')
      }
    })

    expect(result.isFunction).toBe(true)
    expect(result.applyFleetingLuckIsFunction).toBe(true)
    expect(result.applyFleetingLuckNoRollIsNoOp).toBe(true)

    // Check payload: shared core + skillId, no spell-only fields.
    expect(result.checkKeys).toEqual(
      ['critical', 'die', 'formula', 'fumble', 'modifiers', 'natural', 'skillId', 'total'].sort()
    )
    expect(result.checkValues.skillId).toBe('sneakSilently')
    expect(result.checkValues.die).toBe('d20')
    expect(result.checkValues.total).toBe(17)
    expect(result.checkValues.modifiersIsArray).toBe(true)
    expect(result.checkHasSpellId).toBe(false)

    // Spell payload: shared core + spellId + tier + spellLost +
    // corruptionTriggered, and NO skillId.
    expect(result.spellKeys).toEqual(
      ['corruptionTriggered', 'critical', 'die', 'formula', 'fumble', 'modifiers', 'natural', 'spellId', 'spellLost', 'tier', 'total'].sort()
    )
    expect(result.spellValues.spellId).toBe('magic-missile')
    expect(result.spellValues.tier).toBe('success-minor')
    expect(result.spellValues.corruptionTriggered).toBe(true)
    expect(result.spellHasSkillId).toBe(false)
  })

  test('DCC renderDisapprovalRoll / renderMercurialEffect post deterministic chat cards with the expected flags (Phase 7 session 27)', async ({ page }) => {
    // Phase 7 session 27: the two deterministic chat-emit renderers
    // `renderDisapprovalRoll` + `renderMercurialEffect` gained direct unit
    // coverage (PR #720 test-coverage gap — previously only exercised
    // transitively by the cleric-disapproval / mercurial browser tests).
    // These renderers are thin wrappers around Foundry's chat pipeline
    // (build a `${N}d1` Roll → toMessage { create:false } → ChatMessage.create),
    // so the highest-value end-to-end check runs the DEPLOYED functions
    // against the live `Roll` + `ChatMessage` and asserts the real message's
    // flags + flavor. A throwaway Player is the speaker; both created
    // messages are deleted afterward so the world is left untouched.
    const result = await page.evaluate(async () => {
      const mod = await import('../../../../../../../../systems/dcc/module/adapter/chat-renderer.mjs')
      const actor = await Actor.create({ name: 'P_ChatEmitProbe', type: 'Player' })
      const created = []
      try {
        const disapproval = await mod.renderDisapprovalRoll({
          actor,
          disapprovalResult: { roll: 3, description: 'You anger your deity', disapprovalRange: 2 }
        })
        created.push(disapproval)

        const mercurial = await mod.renderMercurialEffect({
          actor,
          spellItem: { id: 'P_ChatEmit_spell' },
          effect: { rollValue: 42, summary: 'Spell warps', description: 'A lasting boon', displayOnCast: true }
        })
        created.push(mercurial)

        // A falsy mercurial effect must be a true no-op (returns undefined,
        // posts nothing).
        const mercurialNoop = await mod.renderMercurialEffect({ actor, effect: null })

        return {
          fnsAreFunctions:
            typeof mod.renderDisapprovalRoll === 'function' &&
            typeof mod.renderMercurialEffect === 'function',
          disapproval: {
            rollType: disapproval.getFlag('dcc', 'RollType'),
            isDisapproval: disapproval.getFlag('dcc', 'isDisapproval'),
            lib: disapproval.getFlag('dcc', 'libDisapproval'),
            total: disapproval.rolls?.[0]?.total,
            flavorHasDescription: (disapproval.flavor || '').includes('You anger your deity')
          },
          mercurial: {
            rollType: mercurial.getFlag('dcc', 'RollType'),
            isMercurial: mercurial.getFlag('dcc', 'isMercurial'),
            itemId: mercurial.getFlag('dcc', 'ItemId'),
            lib: mercurial.getFlag('dcc', 'libMercurial'),
            total: mercurial.rolls?.[0]?.total,
            contentHasDescription: (mercurial.content || '').includes('A lasting boon')
          },
          mercurialNoopIsUndefined: mercurialNoop === undefined
        }
      } finally {
        for (const m of created) { if (m?.delete) await m.delete() }
        await actor.delete()
      }
    })

    expect(result.fnsAreFunctions).toBe(true)

    // Disapproval: deterministic ${roll}d1 totals to the lib roll, flags +
    // flavor carry the table draw.
    expect(result.disapproval.rollType).toBe('Disapproval')
    expect(result.disapproval.isDisapproval).toBe(true)
    expect(result.disapproval.total).toBe(3)
    expect(result.disapproval.flavorHasDescription).toBe(true)
    expect(result.disapproval.lib).toMatchObject({
      roll: 3,
      description: 'You anger your deity',
      disapprovalRange: 2
    })

    // Mercurial: deterministic ${rollValue}d1, flags carry the spell item id
    // + the libMercurial payload, content carries the description.
    expect(result.mercurial.rollType).toBe('MercurialMagic')
    expect(result.mercurial.isMercurial).toBe(true)
    expect(result.mercurial.itemId).toBe('P_ChatEmit_spell')
    expect(result.mercurial.total).toBe(42)
    expect(result.mercurial.contentHasDescription).toBe(true)
    expect(result.mercurial.lib).toMatchObject({
      rollValue: 42,
      summary: 'Spell warps',
      description: 'A lasting boon',
      displayOnCast: true
    })

    // Falsy effect → true no-op.
    expect(result.mercurialNoopIsUndefined).toBe(true)
  })

  test('DCC game.dcc.DCCRoll.createRoll is a synchronous-declared function (Phase 7 session 28)', async ({ page }) => {
    // Phase 7 session 28: the shared `__mocks__/dcc-roll.js` `createRoll` was
    // declared `static async` while production (module/dcc-roll.js:17) is a
    // sync-declared function returning the Roll directly — the mismatch that
    // forced adapter dispatch-path tests to install per-file sync overrides.
    // The mock is now sync, and the Vitest suite guards mock↔production
    // parity. This probe locks the *production* half of that contract against
    // live Foundry: the deployed `game.dcc.DCCRoll.createRoll` must remain a
    // sync-declared function (constructor.name 'Function', not
    // 'AsyncFunction') so callers like `rollWeaponAttack`'s damage block
    // (`damageRoll = DCCRoll.createRoll(...)`, no await) keep working.
    const result = await page.evaluate(() => ({
      isFunction: typeof game.dcc?.DCCRoll?.createRoll === 'function',
      ctorName: game.dcc?.DCCRoll?.createRoll?.constructor?.name
    }))
    expect(result.isFunction).toBe(true)
    expect(result.ctorName).toBe('Function')
    expect(result.ctorName).not.toBe('AsyncFunction')
  })

  test('DCC migrationOutcome gates version-stamping on a clean run + DCC.MigrationFailures resolves (Phase 7 session 11)', async ({ page }) => {
    // Phase 7 session 11: `migrateWorld` now accumulates per-document
    // failures and applies the pure `migrationOutcome(failures)` policy
    // — a clean run stamps the world version + shows the "complete"
    // toast; any failure leaves the version unstamped and raises a
    // `ui.notifications.warn(DCC.MigrationFailures, { count })`. This
    // probe imports the live-served module to confirm the deployed
    // helper's stamp/notify decisions and that the new i18n key is
    // registered + interpolates the {count} placeholder. It does NOT
    // run migrateWorld (which would mutate the live world).
    const result = await page.evaluate(async () => {
      const mod = await import('../../../../../../../../systems/dcc/module/migrations.js')

      const clean = mod.migrationOutcome([])
      const failed = mod.migrationOutcome([
        { type: 'Actor', name: 'P_MigProbe A' },
        { type: 'Item', name: 'P_MigProbe I' }
      ])

      // Live i18n: a registered key interpolates; an unregistered key
      // is returned verbatim by Foundry's localizer.
      const failuresMsg = game.i18n.format('DCC.MigrationFailures', { count: 2 })

      return {
        isFunction: typeof mod.migrationOutcome === 'function',
        clean,
        failed,
        i18nResolves: failuresMsg !== 'DCC.MigrationFailures',
        i18nInterpolatesCount: failuresMsg.includes('2')
      }
    })

    expect(result.isFunction).toBe(true)
    // Clean run → stamp + complete.
    expect(result.clean).toEqual({ stampVersion: true, notify: 'complete', failureCount: 0 })
    // Failed run → no stamp + warn with the exact count.
    expect(result.failed).toEqual({ stampVersion: false, notify: 'failures', failureCount: 2 })
    // The new failure-summary i18n key is registered and interpolates.
    expect(result.i18nResolves).toBe(true)
    expect(result.i18nInterpolatesCount).toBe(true)
  })

  test('DCC checkMigrations is async + reports migrationComplete (Phase 7 session 13)', async ({ page }) => {
    // Phase 7 session 13: `checkMigrations` was relocated out of
    // `module/dcc.js` into `migrations.js`, made `async`, and now `await`s
    // `migrateWorld` so the system's ready hook can `await` it before
    // firing `dcc.ready` (fixing the "fire-and-forget from a sync ready
    // hook" race). It returns `{ migrationComplete }`, which `dcc.js`
    // threads onto the `dcc.ready` payload. This probe imports the
    // live-served module to confirm the deployed helper is an async
    // function and that — on the already-migrated test world (decision
    // `'skip'`) — invoking it is a true no-op: it returns
    // `{ migrationComplete: true }` without running `migrateWorld` (no
    // MigrationInfo toast, no version write). The 'skip' path returns
    // before any mutation, so calling it live is safe.
    const result = await page.evaluate(async () => {
      const mod = await import('../../../../../../../../systems/dcc/module/migrations.js')

      const isFunction = typeof mod.checkMigrations === 'function'
      const isAsync = mod.checkMigrations.constructor.name === 'AsyncFunction'

      const storedVersion = game.settings.get('dcc', 'systemMigrationVersion')
      const decision = mod.classifyMigrationDecision(storedVersion)

      // Only invoke live when the decision is the no-op 'skip' (the booted
      // world is already stamped). Spy on the info toast to prove
      // migrateWorld — whose first line announces via MigrationInfo — never
      // runs on the skip path.
      let skipResult = null
      let infoFiredDuringCheck = false
      if (decision === 'skip') {
        const realInfo = ui.notifications.info.bind(ui.notifications)
        ui.notifications.info = (...args) => { infoFiredDuringCheck = true; return realInfo(...args) }
        try {
          skipResult = await mod.checkMigrations()
        } finally {
          ui.notifications.info = realInfo
        }
      }

      return { isFunction, isAsync, decision, skipResult, infoFiredDuringCheck }
    })

    expect(result.isFunction).toBe(true)
    expect(result.isAsync).toBe(true)
    // The booted test world has already been migrated → classifies 'skip'.
    expect(result.decision, 'booted test world should already be migrated (skip)').toBe('skip')
    // Live no-op invocation reports complete and runs no migrateWorld.
    expect(result.skipResult).toEqual({ migrationComplete: true })
    expect(result.infoFiredDuringCheck).toBe(false)
  })

  test('DCC normalizeLibDie consolidation: canonical helper + live _stripDieCount delegation (Phase 7 session 12)', async ({ page }) => {
    // Phase 7 session 12: the three former die-normalize copies
    // (attack-input.mjs `normalizeLibDie`, spell-input.mjs private
    // `normalizeLibDie`, actor.js `_stripDieCount`) are consolidated onto
    // the single canonical `normalizeLibDie(foundryDie, fallback = 'd20')`
    // in `module/adapter/attack-input.mjs`. spell-input now imports it;
    // `DCCActor._stripDieCount` delegates with `fallback: null`. This
    // probe imports the live-served canonical helper to confirm its
    // behavior (incl. the null-fallback contract `_stripDieCount` relies
    // on) and creates a live Player actor to confirm `_stripDieCount`
    // delegates correctly end-to-end.
    const result = await page.evaluate(async () => {
      const attack = await import('../../../../../../../../systems/dcc/module/adapter/attack-input.mjs')
      const n = attack.normalizeLibDie

      const cases = {
        clean: n('1d20'),
        bare: n('d16'),
        upper: n('D20'),
        falsyDefault: n(''),
        garbageDefault: n('garbage'),
        nullFallbackParsed: n('1d14', null),
        nullFallbackFalsy: n('', null),
        nullFallbackGarbage: n('xyz', null)
      }

      // Live _stripDieCount delegation on a throwaway Player actor.
      const actor = await Actor.create({ name: 'P_DieProbe', type: 'Player' })
      let strip
      try {
        strip = {
          parsed: actor._stripDieCount('1d14'),
          bare: actor._stripDieCount('d20'),
          falsy: actor._stripDieCount(''),
          garbage: actor._stripDieCount('not-a-die')
        }
      } finally {
        await actor.delete()
      }

      return { isFunction: typeof n === 'function', cases, strip }
    })

    expect(result.isFunction).toBe(true)
    // Canonical helper: default fallback 'd20', case-insensitive,
    // unparseable → fallback.
    expect(result.cases.clean).toBe('d20')
    expect(result.cases.bare).toBe('d16')
    expect(result.cases.upper).toBe('d20')
    expect(result.cases.falsyDefault).toBe('d20')
    expect(result.cases.garbageDefault).toBe('d20')
    // null-fallback contract (what _stripDieCount depends on).
    expect(result.cases.nullFallbackParsed).toBe('d14')
    expect(result.cases.nullFallbackFalsy).toBe(null)
    expect(result.cases.nullFallbackGarbage).toBe(null)
    // Live _stripDieCount delegates to the canonical helper.
    expect(result.strip.parsed).toBe('d14')
    expect(result.strip.bare).toBe('d20')
    expect(result.strip.falsy).toBe(null)
    expect(result.strip.garbage).toBe(null)
  })

  test('DCC migrateActorData / migrateItemData data-driven branches run against live foundry.utils (Phase 7 session 26)', async ({ page }) => {
    // Phase 7 session 26: the data-driven migration helpers `migrateActorData`
    // / `migrateItemData` are exported from `migrations.js` for unit testing
    // of their always-run (non-version-gated) branches — the V14-critical
    // ActiveEffect numeric-mode → string-type converter chief among them.
    // The Vitest suite exercises every branch against a mocked `foundry.utils`;
    // this probe imports the live-served module and runs the deployed helpers
    // against the REAL `foundry.utils.deepClone` / `isEmpty` / `mergeObject`
    // and the live `game.i18n`, confirming the unit mocks' assumptions hold
    // end-to-end. Synthetic plain objects are used (not live documents) so the
    // legacy data shapes the converter targets are reproduced deterministically
    // rather than depending on the current v14 ActiveEffect schema defaults.
    // It does NOT run migrateWorld (no live-world mutation).
    const result = await page.evaluate(async () => {
      const mod = await import('../../../../../../../../systems/dcc/module/migrations.js')

      const exportsAreFunctions =
        typeof mod.migrateActorData === 'function' &&
        typeof mod.migrateItemData === 'function'

      // migrateItemData (sync): a legacy item-like object with a numeric
      // ActiveEffect mode is converted; a string-typed one is a no-op.
      const itemNumeric = mod.migrateItemData({
        effects: [{ toObject: () => ({ changes: [{ key: 'system.config.actionDice', mode: 2, value: '1' }] }) }]
      })
      const itemStringTyped = mod.migrateItemData({
        effects: [{ toObject: () => ({ changes: [{ key: 'k', type: 'override', value: '1' }] }) }]
      })

      // migrateActorData (async): a legacy actor-like object exercising the
      // AE converter (mode 5 → override) alongside the luckyRoll → birthAugur
      // and critRange string → number branches in one pass. sheetClass is set
      // so the className → sheetClass / locale-lookup branch stays a no-op.
      const actorUpdate = await mod.migrateActorData({
        system: {
          details: { alignment: 'n', sheetClass: 'Wizard', luckyRoll: 'Lived through famine', critRange: '18' },
          class: { className: 'Wizard', disapproval: 1 }
        },
        effects: [{ toObject: () => ({ changes: [{ key: 'system.abilities.str.value', mode: 5, value: '2' }] }) }]
      })
      const actorChange = actorUpdate.effects?.[0]?.changes?.[0]

      return {
        exportsAreFunctions,
        itemNumericType: itemNumeric.effects?.[0]?.changes?.[0]?.type,
        itemNumericHasMode: Object.prototype.hasOwnProperty.call(itemNumeric.effects?.[0]?.changes?.[0] ?? {}, 'mode'),
        itemStringTypedNoop: Object.keys(itemStringTyped).length === 0,
        actorBirthAugur: actorUpdate['system.details.birthAugur'],
        actorCritRange: actorUpdate['system.details.critRange'],
        actorHasEffectUpdate: Array.isArray(actorUpdate.effects),
        actorChangeType: actorChange?.type,
        actorChangeHasMode: Object.prototype.hasOwnProperty.call(actorChange ?? {}, 'mode')
      }
    })

    expect(result.exportsAreFunctions).toBe(true)
    // migrateItemData: numeric mode 2 → 'add', mode field stripped.
    expect(result.itemNumericType).toBe('add')
    expect(result.itemNumericHasMode).toBe(false)
    // Already-string-typed change is a no-op.
    expect(result.itemStringTypedNoop).toBe(true)
    // migrateActorData multi-branch pass against live foundry.utils:
    expect(result.actorBirthAugur).toBe('Lived through famine')
    expect(result.actorCritRange).toBe(18)
    expect(result.actorHasEffectUpdate).toBe(true)
    expect(result.actorChangeType).toBe('override')
    expect(result.actorChangeHasMode).toBe(false)
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
      // Snapshot the existing default sheet constructor BEFORE we
      // register our non-default sheet. The test asserts that
      // `registerItemSheet` with `makeDefault: false` does NOT displace
      // whatever was the existing default — but the literal class name
      // depends on which sibling modules are installed in the test
      // world (e.g. xcc-core-book installs `XCCItemSheet` as its
      // default in its own `init` hook, replacing DCC's default). Take
      // a snapshot so the assertion is resilient to that.
      const probeActorPre = await Actor.create({ name: 'P1 SheetProbe Pre', type: 'NPC' })
      const [probeItemPre] = await probeActorPre.createEmbeddedDocuments('Item', [{ name: 'P1-Probe-pre', type: 'weapon' }])
      const sheetCtorNameBefore = probeItemPre?.sheet?.constructor?.name
      await probeActorPre.delete()

      class TestModuleWeaponSheet extends foundry.applications.api.DocumentSheetV2 {
        static DEFAULT_OPTIONS = { id: 'test-module-weapon-sheet' }
      }

      game.dcc.registerItemSheet('weapon', TestModuleWeaponSheet, {
        scope: 'extension-api-test',
        label: 'Extension API Test Sheet',
        makeDefault: false
      })

      // Inspect what Foundry resolves a weapon's sheet to AFTER the
      // registration. With `makeDefault: false` the existing default
      // should be unchanged.
      const tmpActor = await Actor.create({ name: 'P1 SheetProbe Actor', type: 'NPC' })
      const [tmpItem] = await tmpActor.createEmbeddedDocuments('Item', [{ name: 'P1-ProbeWeapon', type: 'weapon' }])
      const sheetCtorName = tmpItem?.sheet?.constructor?.name
      await tmpActor.delete()

      // Verify our sheet class is in CONFIG.Item.sheetClasses.weapon.
      const weaponEntries = Object.keys(CONFIG.Item.sheetClasses?.weapon || {})

      return {
        weaponEntries,
        ourEntry: CONFIG.Item.sheetClasses?.weapon?.['extension-api-test.TestModuleWeaponSheet'] ?? null,
        sheetCtorName,
        sheetCtorNameBefore
      }
    })

    expect(result.weaponEntries, 'our sheet should appear in CONFIG.Item.sheetClasses.weapon').toContain('extension-api-test.TestModuleWeaponSheet')
    expect(result.ourEntry).not.toBeNull()
    expect(result.ourEntry.label).toBe('Extension API Test Sheet')
    expect(result.ourEntry.default).toBe(false)
    // `makeDefault: false` must not displace whatever was the existing
    // default — whether that's DCCItemSheet or a sibling module's
    // override (e.g. xcc-core-book's XCCItemSheet). The pre-snapshot
    // and the post-registration class name should match.
    expect(result.sheetCtorName).toBe(result.sheetCtorNameBefore)
    // Sanity check: a default sheet should be resolved at all.
    expect(result.sheetCtorName).toBeTruthy()
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
