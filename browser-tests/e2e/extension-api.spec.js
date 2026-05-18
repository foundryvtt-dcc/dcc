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
