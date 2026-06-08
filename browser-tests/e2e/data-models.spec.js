/* eslint-disable no-undef -- Browser globals (game, ui, Actor, Item) used in page.evaluate callbacks */
const { expect, createSessionTest } = require('./fixtures')

/**
 * E2E tests for DCC TypeDataModels
 * Tests actual data validation and persistence in a live Foundry instance
 *
 * Setup: see docs/dev/TESTING.md#browser-tests-playwright for Node 24,
 * fvtt CLI installPath/dataPath, and launch command. TL;DR:
 *   nvm use 24 && npx @foundryvtt/foundryvtt-cli launch --world=v14
 *   npm test
 *
 * Tests auto-log in as Gamemaster (no password). Close any manual
 * Foundry browser tab first — a logged-in Gamemaster disables the
 * join-page select option and the spec will time out.
 */

// Module-scoped console-error capture. The fixture attaches the listener ONCE
// per worker (via onConsole below); beforeEach clears this array and afterEach
// asserts on it. Safe as a module global with workers:1 (playwright.config.js).
const consoleErrors = []
const test = createSessionTest({
  onConsole: msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) }
})

test.describe('DCC TypeDataModels E2E Tests', () => {
  // Check that Foundry is running before all tests (simple fetch check)
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
        '1. Run: npx @foundryvtt/foundryvtt-cli launch --world=automated_testing\n' +
        '2. Run tests again: npm test'
      )
    }
  })

  test.beforeEach(async ({ page }) => {
    // Login + system boot is handled ONCE per worker by the sessionPage
    // fixture; here we only do world-state hygiene (close windows, purge test
    // actors/items, clear banners) and then reset captured console errors LAST.
    //
    // Clearing the console-error buffer at the END (not the start) matters
    // under session reuse: a prior test may delete an actor without awaiting
    // its directory re-render (e.g. the "Action Die Test" teardown), emitting a
    // transient `Actor "<id>" does not exist` log shortly after the test ends.
    // With a fresh page per test that noise was discarded by the reload; with a
    // reused page it would otherwise count against THIS test's zero-error gate.
    // Cleaning up + settling + clearing here scopes the gate to the test body.
    await page.evaluate(async () => {
      document.querySelectorAll('#notifications .notification').forEach(n => n.remove())
      const testNames = ['Test Player', 'Test NPC', 'Persistence Test', 'Action Die Test', 'Test Weapon', 'Test Armor', 'Test Treasure']
      for (const app of Object.values(ui.windows)) {
        try { await app.close() } catch {}
      }
      for (const actor of game.actors.filter(a => testNames.includes(a.name))) {
        try { await actor.delete() } catch {}
      }
      for (const item of game.items.filter(i => testNames.includes(i.name))) {
        try { await item.delete() } catch {}
      }
    }).catch(() => {})

    // Welcome dialogs are dismissed once in the fixture; re-dismiss only if one
    // reappeared.
    for (const sel of ['#dcc-welcome-dialog', '#dcc-core-book-welcome-dialog']) {
      const dialog = page.locator(sel)
      if (await dialog.isVisible({ timeout: 300 }).catch(() => false)) {
        await page.keyboard.press('Escape')
      }
    }

    // Let prior-test teardown re-renders drain, THEN clear — so the zero-error
    // gate in afterEach measures only this test's body.
    await page.waitForTimeout(400)
    consoleErrors.length = 0
  })

  test.afterEach(async () => {
    // Check for console errors after each test
    const significantErrors = consoleErrors.filter(err =>
      // Filter out known benign errors if needed
      !err.includes('favicon.ico')
    )
    expect(significantErrors, `Console errors detected: ${significantErrors.join('\n')}`).toHaveLength(0)
  })

  test.describe('Actor Creation and Validation', () => {
    test('can create a new Player actor with default values', async ({ page }) => {
      // Click the actors tab
      await page.click('button[data-tab="actors"]')
      await page.waitForSelector('#actors.active', { timeout: 5000 })

      // Create new actor via the sidebar
      await page.click('#actors button[data-action="createEntry"]')

      // Wait for the create dialog
      await page.waitForSelector('dialog.application', { timeout: 5000 })

      // Fill in the name
      await page.fill('input[name="name"]', 'Test Player')

      // Select Player type
      await page.selectOption('select[name="type"]', 'Player')

      // Submit the form
      await page.click('button[data-action="ok"]')

      // Wait for actor sheet to open
      await page.waitForSelector('.dcc.actor.sheet', { timeout: 5000 })

      // Verify default values are set correctly
      const hpValue = await page.locator('input[name="system.attributes.hp.value"]').inputValue()
      expect(parseInt(hpValue)).toBeGreaterThanOrEqual(0)

      // Close the sheet
      await page.click('.dcc.actor.sheet button[data-action="close"]')

      // Clean up - delete the test actor
      await page.click('.entry-name:has-text("Test Player")', { button: 'right' })
      await page.click('#context-menu li:has-text("Delete")')
      await page.waitForSelector('dialog.application', { timeout: 2000 })
      await page.click('button[data-action="yes"]')
    })

    test('actor derived-stat computation survives actor/derived-stats-mixin.mjs extraction', async ({ page }) => {
      // Phase 7 (Appendix-A actor.js shrinkage): the four derived-stat computation
      // helpers (computeMeleeAndMissileAttackAndDamage / computeSavingThrows /
      // computeSpellCheck / computeInitiative) moved out of actor.js into the
      // DerivedStatsMixin in module/actor/derived-stats-mixin.mjs; DCCActor now
      // extends DerivedStatsMixin(ActiveEffectsMixin(Actor)). This probe calls each
      // extracted method directly on a live actor and asserts the derived writes
      // (saves with bonuses + override, initiative, spell-check formula) the
      // extraction must preserve — reading the actor's own ability mods so it is
      // robust to the DCC modifier table.
      const result = await page.evaluate(async () => {
        const observed = {}
        let actor
        try {
          actor = await Actor.create({ name: 'V14 Derived Stats Probe', type: 'Player' })
          observed.aglMod = parseInt(actor.system.abilities.agl.mod)

          // Saving throws: agl mod + class + other bonus; override wins on frt.
          actor.system.saves.ref.classBonus = 2
          actor.system.saves.ref.otherBonus = 1
          actor.system.saves.frt.override = 5
          actor.computeSavingThrows()
          observed.ref = actor.system.saves.ref.value
          observed.frt = actor.system.saves.frt.value

          // Initiative: agl mod + otherMod (no class level).
          actor.system.attributes.init.otherMod = 1
          actor.computeInitiative({ addClassLevelToInitiative: false })
          observed.init = actor.system.attributes.init.value

          // Spell check: produces a non-empty formula string and fires the stable hook.
          let hookFired = false
          const hookId = Hooks.on('dcc.afterComputeSpellCheck', () => { hookFired = true })
          actor.system.details.level.value = 3
          actor.computeSpellCheck()
          Hooks.off('dcc.afterComputeSpellCheck', hookId)
          observed.spellCheck = actor.system.class.spellCheck
          observed.hookFired = hookFired
        } finally {
          if (actor) await actor.delete().catch(() => {})
        }
        return observed
      })

      const signed = (n) => (n >= 0 ? `+${n}` : `${n}`)
      expect(result.ref).toBe(signed(result.aglMod + 3)) // agl mod + class 2 + other 1
      expect(result.frt).toBe('+5') // override wins
      expect(result.init).toBe(result.aglMod + 1) // agl mod + otherMod
      expect(result.spellCheck).toBeTruthy()
      expect(result.hookFired).toBe(true) // stable dcc.afterComputeSpellCheck hook preserved
    })

    test('actor roll-input accessors survive actor/roll-data-mixin.mjs extraction', async ({ page }) => {
      // Phase 7 (Appendix-A actor.js shrinkage): the three roll-input accessors
      // (getRollData / getAttackBonusMode / getActionDice) moved out of actor.js
      // into the RollDataMixin in module/actor/roll-data-mixin.mjs; DCCActor now
      // extends RollDataMixin(DerivedStatsMixin(ActiveEffectsMixin(Actor))). This
      // probe drives each extracted accessor on a live actor and asserts the public
      // shape the sheet/adapter/XCC consumers depend on — getRollData's ability
      // shorthands + super-augmentation, getAttackBonusMode normalization, and
      // getActionDice's comma-list parse + untrained preset + legacy + migration.
      const result = await page.evaluate(async () => {
        const observed = {}
        let actor
        try {
          actor = await Actor.create({ name: 'V14 Roll Data Probe', type: 'Player' })

          // getRollData: augments super.getRollData() with DCC shorthands.
          const rollData = actor.getRollData()
          observed.str = rollData.str
          observed.actorStrMod = parseInt(actor.system.abilities.str.mod)
          observed.cl = rollData.cl
          observed.level = actor.system.details.level.value
          observed.hasXp = Object.prototype.hasOwnProperty.call(rollData, 'xp') // Player only

          // getAttackBonusMode: known modes pass through, invalid -> 'flat'.
          actor.system.config.attackBonusMode = 'autoPerAttack'
          observed.knownMode = actor.getAttackBonusMode()
          actor.system.config.attackBonusMode = 'bogus'
          observed.invalidMode = actor.getAttackBonusMode()

          // getActionDice: comma list -> presets, untrained appends 1d10, + -> ,
          actor.system.config.actionDice = '1d20+1d14'
          const dice = actor.getActionDice({ includeUntrained: true })
          observed.dice = dice.map(d => d.formula)
          observed.migratedActionDice = actor.system.config.actionDice
        } finally {
          if (actor) await actor.delete().catch(() => {})
        }
        return observed
      })

      expect(result.str).toBe(result.actorStrMod) // getRollData str shorthand = ability mod
      expect(result.cl).toBe(result.level) // caster-level shorthand mirrors level
      expect(result.hasXp).toBe(true) // Player-only xp shorthand present
      expect(result.knownMode).toBe('autoPerAttack')
      expect(result.invalidMode).toBe('flat') // invalid mode normalizes to flat
      expect(result.dice).toEqual(['1d20', '1d14', '1d10']) // parsed + untrained preset
      expect(result.migratedActionDice).toBe('1d20,1d14') // implicit + -> , migration persisted
    })

    test('buildDamageBreakdown survives actor/damage-breakdown.mjs extraction', async ({ page }) => {
      // Phase 7 (Appendix-A actor.js shrinkage): the pure _buildDamageBreakdown
      // method moved out of actor.js into a free function in
      // module/actor/damage-breakdown.mjs (it reads nothing off the actor). This
      // probe imports the live-served module and confirms the deployed helper
      // reproduces the multi-type summing + single-type null contract that
      // _rollDamage's chat breakdown depends on.
      const result = await page.evaluate(async () => {
        const mod = await import('../../../../../../../../systems/dcc/module/actor/damage-breakdown.mjs')
        const op = (operator) => ({ operator })
        const die = (total, flavor = '') => ({ total, flavor })
        return {
          single: mod.buildDamageBreakdown({ terms: [die(6, 'fire')] }),
          twoType: mod.buildDamageBreakdown({ terms: [die(3, ''), op('+'), die(5, 'fire')] }),
          accumulated: mod.buildDamageBreakdown({ terms: [die(2, 'cold'), op('+'), die(3, 'cold'), op('+'), die(4, 'fire')] })
        }
      })

      expect(result.single).toBeNull() // single damage type -> no breakdown
      expect(result.twoType).toBe('3 + 5 fire')
      expect(result.accumulated).toBe('5 cold + 4 fire') // same-flavor terms summed, operators skipped
    })

    test('§2.1 schema-slimming: the lib Character projection of a live halfling is class-clean', async ({ page }) => {
      // §2.1 resolution guard (see docs/dev/SCHEMA_SLIMMING.md). Foundry's static
      // one-schema-per-subtype model means a live halfling carries EVERY class's
      // schema fields (shieldBash / disapproval / knownSpells / thief skills…).
      // The resolution is that the lib is the class-clean read-side source of
      // truth: actorToCharacter projects the actor reading only cross-class fields.
      // This drives the real adapter projection on a live halfling and asserts the
      // produced Character carries no foreign-class state even though the actor's
      // schema does — proving the roll path is independent of the un-slimmable
      // monolithic schema.
      const result = await page.evaluate(async () => {
        const { actorToCharacter } = await import('../../../../../../../../systems/dcc/module/adapter/character-accessors.mjs')
        let actor
        try {
          actor = await Actor.create({ name: 'V14 Halfling Projection Probe', type: 'Player' })
          await actor.update({ 'system.class.className': 'Halfling', 'system.details.sheetClass': 'Halfling' })
          // The live actor carries the monolithic schema's foreign-class fields.
          const carriesShieldBash = actor.system.skills?.shieldBash !== undefined
          const carriesKnownSpells = actor.system.class?.knownSpells !== undefined

          const character = actorToCharacter(actor)
          return {
            carriesShieldBash,
            carriesKnownSpells,
            classId: character.classInfo?.classId,
            topKeys: Object.keys(character).sort(),
            stateKeys: Object.keys(character.state).sort(),
            hasSkills: Object.prototype.hasOwnProperty.call(character, 'skills'),
            hasClericState: character.state.cleric !== undefined,
            hasWizardState: character.state.wizard !== undefined
          }
        } finally {
          if (actor) await actor.delete().catch(() => {})
        }
      })

      // The actor's schema DOES carry foreign-class fields (the un-slimmable part)...
      expect(result.carriesShieldBash).toBe(true)
      expect(result.carriesKnownSpells).toBe(true)
      // ...but the lib projection is class-clean: only identity/state/classInfo,
      // state has only abilities/saves, and the classId is halfling.
      expect(result.classId).toBe('halfling')
      expect(result.topKeys).toEqual(['classInfo', 'identity', 'state'])
      expect(result.stateKeys).toEqual(['abilities', 'saves'])
      expect(result.hasSkills).toBe(false)
      expect(result.hasClericState).toBe(false)
      expect(result.hasWizardState).toBe(false)
    })

    test('can create a new NPC actor', async ({ page }) => {
      // Click the actors tab
      await page.click('button[data-tab="actors"]')
      await page.waitForSelector('#actors.active', { timeout: 5000 })

      // Create new actor
      await page.click('#actors button[data-action="createEntry"]')
      await page.waitForSelector('dialog.application', { timeout: 5000 })

      // Fill in details
      await page.fill('input[name="name"]', 'Test NPC')
      await page.selectOption('select[name="type"]', 'NPC')
      await page.click('button[data-action="ok"]')

      // Wait for actor sheet
      await page.waitForSelector('.dcc.actor.sheet', { timeout: 5000 })

      // Verify the sheet opened successfully
      await expect(page.locator('.dcc.actor.sheet')).toBeVisible()

      // Verify NPC-specific field exists (special attacks field)
      const specialInput = page.locator('input[name="system.attributes.special.value"]')
      if (await specialInput.isVisible()) {
        await specialInput.fill('Bite +2 (1d6)')
        await page.waitForTimeout(500)
        const specialValue = await specialInput.inputValue()
        expect(specialValue).toBe('Bite +2 (1d6)')
      }

      // Close and clean up
      await page.click('.dcc.actor.sheet button[data-action="close"]')
      await page.click('.entry-name:has-text("Test NPC")', { button: 'right' })
      await page.click('#context-menu li:has-text("Delete")')
      await page.waitForSelector('dialog.application', { timeout: 2000 })
      await page.click('button[data-action="yes"]')
    })
  })

  test.describe('Item Creation and Validation', () => {
    test('can create a weapon with valid dice notation', async ({ page }) => {
      // Click the items tab
      await page.click('button[data-tab="items"]')
      await page.waitForSelector('#items.active', { timeout: 5000 })

      // Create new item
      await page.click('#items button[data-action="createEntry"]')
      await page.waitForSelector('dialog.application', { timeout: 5000 })

      // Fill in details
      await page.fill('input[name="name"]', 'Test Sword')
      await page.selectOption('select[name="type"]', 'weapon')
      await page.click('button[data-action="ok"]')

      // Wait for item sheet
      await page.waitForSelector('.dcc.sheet.item', { timeout: 5000 })

      // Set weapon damage (base damage die)
      await page.fill('input[name="system.damageWeapon"]', '1d8')
      await page.waitForTimeout(500)

      // Verify it saved (no error)
      const damageValue = await page.locator('input[name="system.damageWeapon"]').inputValue()
      expect(damageValue).toBe('1d8')

      // Close and clean up
      await page.click('.dcc.sheet.item button[data-action="close"]')
      await page.click('.entry-name:has-text("Test Sword")', { button: 'right' })
      await page.click('#context-menu li:has-text("Delete")')
      await page.waitForSelector('dialog.application', { timeout: 2000 })
      await page.click('button[data-action="yes"]')
    })

    test('can create armor with fumble die', async ({ page }) => {
      // Click the items tab
      await page.click('button[data-tab="items"]')
      await page.waitForSelector('#items.active', { timeout: 5000 })

      // Create new armor
      await page.click('#items button[data-action="createEntry"]')
      await page.waitForSelector('dialog.application', { timeout: 5000 })

      await page.fill('input[name="name"]', 'Test Armor')
      await page.selectOption('select[name="type"]', 'armor')
      await page.click('button[data-action="ok"]')

      // Wait for item sheet
      await page.waitForSelector('.dcc.sheet.item', { timeout: 5000 })

      // Set fumble die
      const fumbleDieInput = page.locator('input[name="system.fumbleDie"]')
      if (await fumbleDieInput.isVisible()) {
        await fumbleDieInput.fill('1d8')
        await page.waitForTimeout(500)
        const fumbleValue = await fumbleDieInput.inputValue()
        expect(fumbleValue).toBe('1d8')
      }

      // Close and clean up
      await page.click('.dcc.sheet.item button[data-action="close"]')
      await page.click('.entry-name:has-text("Test Armor")', { button: 'right' })
      await page.click('#context-menu li:has-text("Delete")')
      await page.waitForSelector('dialog.application', { timeout: 2000 })
      await page.click('button[data-action="yes"]')
    })

    test('can create treasure with currency values', async ({ page }) => {
      // Click the items tab
      await page.click('button[data-tab="items"]')
      await page.waitForSelector('#items.active', { timeout: 5000 })

      // Create new treasure
      await page.click('#items button[data-action="createEntry"]')
      await page.waitForSelector('dialog.application', { timeout: 5000 })

      await page.fill('input[name="name"]', 'Test Treasure')
      await page.selectOption('select[name="type"]', 'treasure')
      await page.click('button[data-action="ok"]')

      // Wait for item sheet
      await page.waitForSelector('.dcc.sheet.item', { timeout: 5000 })

      // Set currency values
      const gpInput = page.locator('input[name="system.value.gp"]')
      if (await gpInput.isVisible()) {
        await gpInput.fill('100')
        await page.waitForTimeout(500)
        const gpValue = await gpInput.inputValue()
        expect(gpValue).toBe('100')
      }

      // Close and clean up
      await page.click('.dcc.sheet.item button[data-action="close"]')
      await page.click('.entry-name:has-text("Test Treasure")', { button: 'right' })
      await page.click('#context-menu li:has-text("Delete")')
      await page.waitForSelector('dialog.application', { timeout: 2000 })
      await page.click('button[data-action="yes"]')
    })
  })

  test.describe('Data Persistence', () => {
    test('actor ability scores persist after editing', async ({ page }) => {
      // Create actor
      await page.click('button[data-tab="actors"]')
      await page.waitForSelector('#actors.active', { timeout: 5000 })
      await page.click('#actors button[data-action="createEntry"]')
      await page.waitForSelector('dialog.application', { timeout: 5000 })
      await page.fill('input[name="name"]', 'Persistence Test')
      await page.selectOption('select[name="type"]', 'Player')
      await page.click('button[data-action="ok"]')
      await page.waitForSelector('.dcc.actor.sheet', { timeout: 5000 })
      await page.waitForTimeout(500) // Wait for sheet to fully render

      // Edit strength - fill then submit the form explicitly
      const strInput = page.locator('input[name="system.abilities.str.value"]')
      await strInput.fill('18')
      await page.evaluate(() => document.querySelector('form.dcc.actor.sheet')?.requestSubmit())
      await page.waitForTimeout(1000) // Wait for save and re-render

      // Close the sheet
      await page.click('.dcc.actor.sheet button[data-action="close"]')
      await page.waitForTimeout(500)

      // Reopen the sheet
      await page.click('.entry-name:has-text("Persistence Test")')
      await page.waitForSelector('.dcc.actor.sheet', { timeout: 5000 })

      // Verify value persisted
      const strValue = await page.locator('input[name="system.abilities.str.value"]').inputValue()
      expect(strValue).toBe('18')

      // Clean up
      await page.click('.dcc.actor.sheet button[data-action="close"]')
      await page.click('.entry-name:has-text("Persistence Test")', { button: 'right' })
      await page.click('#context-menu li:has-text("Delete")')
      await page.waitForSelector('dialog.application', { timeout: 2000 })
      await page.click('button[data-action="yes"]')
    })

    test('actor action die as string persists correctly', async ({ page }) => {
      // Create actor
      await page.click('button[data-tab="actors"]')
      await page.waitForSelector('#actors.active', { timeout: 5000 })
      await page.click('#actors button[data-action="createEntry"]')
      await page.waitForSelector('dialog.application', { timeout: 5000 })
      await page.fill('input[name="name"]', 'Action Die Test')
      await page.selectOption('select[name="type"]', 'Player')
      await page.click('button[data-action="ok"]')
      await page.waitForSelector('.dcc.actor.sheet', { timeout: 5000 })
      await page.waitForTimeout(500) // Wait for sheet to fully render

      // Edit action die (string field) - fill then submit the form explicitly
      const actionDieInput = page.locator('input[name="system.attributes.actionDice.value"]')
      await actionDieInput.fill('1d24')
      await page.evaluate(() => document.querySelector('form.dcc.actor.sheet')?.requestSubmit())
      await page.waitForTimeout(1000)

      // Close and reopen
      await page.click('.dcc.actor.sheet button[data-action="close"]')
      await page.waitForTimeout(500)
      await page.click('.entry-name:has-text("Action Die Test")')
      await page.waitForSelector('.dcc.actor.sheet', { timeout: 5000 })

      // Verify
      const actionDieValue = await page.locator('input[name="system.attributes.actionDice.value"]').inputValue()
      expect(actionDieValue).toBe('1d24')

      // Clean up
      await page.click('.dcc.actor.sheet button[data-action="close"]')
      await page.click('.entry-name:has-text("Action Die Test")', { button: 'right' })
      await page.click('#context-menu li:has-text("Delete")')
      await page.waitForSelector('dialog.application', { timeout: 2000 })
      await page.click('button[data-action="yes"]')
    })
  })

  test.describe('Migration Tests', () => {
    test('legacy actor data loads without errors', async ({ page }) => {
      // This test verifies that the game loaded without console errors
      // related to data model validation
      // Note: Console errors are already captured by beforeEach/afterEach

      // Navigate to actors tab and verify it loads
      await page.click('button[data-tab="actors"]')
      await page.waitForSelector('#actors.active', { timeout: 5000 })

      // Give time for any lazy-loaded errors
      await page.waitForTimeout(2000)

      // The afterEach hook will fail if any console errors occurred
    })
  })
})
