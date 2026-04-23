/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { test: base, expect } = require('@playwright/test')

const ADAPTER_TAG = '[DCC adapter]'
const adapterLogs = []
const consoleErrors = []

/**
 * Session-reuse fixture. Playwright's default is a fresh browser context per
 * test; with Foundry that means a full `/join` navigation + login + system
 * boot every single time (~6–13 s of overhead per test). The
 * `sessionPage` fixture is worker-scoped — each worker logs in ONCE and
 * reuses the same page across every test it runs. The `page` override is
 * test-scoped and simply forwards `sessionPage`, keeping the existing test
 * bodies (`async ({ page }) => ...`) source-compatible. `beforeEach` then
 * only clears captured logs and cleans up `P1 ...` actors / open app
 * windows.
 *
 * The console listener is attached once per worker (attaching it per test
 * would leak listeners on the reused page).
 *
 * With `workers: 1` (playwright.config.js), `adapterLogs` / `consoleErrors`
 * as module-scoped arrays are safe. If we later parallelize, move them
 * onto the fixture object.
 */
const test = base.extend({
  sessionPage: [async ({ browser }, use) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()

    page.on('console', msg => {
      const text = msg.text()
      if (text.includes(ADAPTER_TAG)) adapterLogs.push(text)
      if (msg.type() === 'error') consoleErrors.push(text)
    })

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

    await page.waitForSelector('#actors', { timeout: 10000, state: 'attached' })
    await page.waitForFunction(() => game?.dcc?.KeyState !== undefined, { timeout: 10000 })

    for (const sel of ['#dcc-welcome-dialog', '#dcc-core-book-welcome-dialog']) {
      const dialog = page.locator(sel)
      if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
        await page.keyboard.press('Escape')
      }
    }

    await use(page)
    await context.close()
  }, { scope: 'worker' }],

  page: async ({ sessionPage }, use) => {
    await use(sessionPage)
  }
})

/**
 * Phase 1 adapter-dispatch validation.
 *
 * For every Phase 1 roll (ability check, save, skill check, initiative)
 * this spec drives the public `DCCActor` method in a live Foundry, then
 * asserts the `[DCC adapter] <rollType> -> <via adapter|LEGACY path>`
 * console log emitted by `module/adapter/debug.mjs`. The log is the
 * signal used to verify the dispatcher picks the intended branch; this
 * spec makes that check automatic.
 *
 * The dispatch logging is permanent (not a Phase 1 temporary scaffold) —
 * later phases add their own logDispatch calls and extend this spec.
 *
 * Setup: see docs/dev/TESTING.md#browser-tests-playwright for Node 24,
 * fvtt CLI installPath/dataPath, and launch command. TL;DR:
 *   nvm use 24 && npx @foundryvtt/foundryvtt-cli launch --world=v14
 *   npm test -- phase1-adapter-dispatch.spec.js
 */

test.describe('DCC Phase 1 — Adapter Dispatch Validation', () => {
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
    adapterLogs.length = 0
    consoleErrors.length = 0
    await page.evaluate(async () => {
      for (const app of Object.values(ui.windows)) { await app.close() }
      for (const actor of game.actors.filter(a => a.name.startsWith('P1 '))) { await actor.delete() }
      // Purge accumulated chat messages from prior tests so `find(m => …)`
      // scans don't grow O(N) with suite size — Foundry doesn't prune
      // them automatically and the session-reuse fixture preserves them
      // across all 70+ tests in the spec.
      const stale = game.messages.contents
        .filter(m => m.speaker?.alias?.startsWith('P1 '))
        .map(m => m.id)
      if (stale.length > 0) await ChatMessage.deleteDocuments(stale)
      document.querySelectorAll('#notifications .notification').forEach(n => n.remove())
    }).catch(() => {})
  })

  test.afterEach(async ({ page }) => {
    await page.evaluate(async () => {
      for (const app of Object.values(ui.windows)) { await app.close() }
      for (const actor of game.actors.filter(a => a.name.startsWith('P1 '))) { await actor.delete() }
    }).catch(() => {})
  })

  // ── helpers ─────────────────────────────────────────────────────────

  /**
   * Await the logDispatch line for a given rollType, up to `timeoutMs`.
   * Returns the first matching log, or throws with a diagnostic dump.
   */
  async function waitForAdapterLog (rollType, { timeoutMs = 6000, pollMs = 50 } = {}) {
    const deadline = Date.now() + timeoutMs
    const tag = `${ADAPTER_TAG} ${rollType}`
    while (Date.now() < deadline) {
      const hit = adapterLogs.find(l => l.startsWith(tag))
      if (hit) return hit
      await new Promise(resolve => setTimeout(resolve, pollMs))
    }
    throw new Error(
      `Timed out waiting for '${tag}' log.\n` +
      `Captured adapter logs:\n${adapterLogs.join('\n') || '  (none)'}`
    )
  }

  function assertPath (logLine, expectedPath, extras = {}) {
    const marker = expectedPath === 'adapter' ? 'via adapter' : 'LEGACY path'
    expect(logLine, `log line: ${logLine}`).toContain(marker)
    for (const [k, v] of Object.entries(extras)) {
      expect(logLine, `expected ${k}=${v} in log: ${logLine}`).toContain(`${k}=${v}`)
    }
  }

  /** Fire-and-forget: kicks off an async action, dismisses any modal it raises. */
  async function fireAndForget (page, bodyFn, arg) {
    await page.evaluate(bodyFn, arg)
    await page.waitForTimeout(150)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(100)
  }

  async function makePlayer (page, name, extraSystem = {}) {
    return page.evaluate(async ({ name, extraSystem }) => {
      const actor = await Actor.create({
        name,
        type: 'Player',
        system: extraSystem
      })
      return actor.id
    }, { name, extraSystem })
  }

  // ── rollAbilityCheck ────────────────────────────────────────────────

  test.describe('rollAbilityCheck', () => {
    test('default options → adapter', async ({ page }) => {
      await makePlayer(page, 'P1 Ability Default')
      await page.evaluate(async () => {
        await game.actors.getName('P1 Ability Default').rollAbilityCheck('lck')
      })
      const line = await waitForAdapterLog('rollAbilityCheck')
      assertPath(line, 'adapter', { abilityId: 'lck' })
    })

    test('rollUnder flag → legacy', async ({ page }) => {
      await makePlayer(page, 'P1 Ability RollUnder')
      await page.evaluate(async () => {
        await game.actors.getName('P1 Ability RollUnder').rollAbilityCheck('lck', { rollUnder: true })
      })
      const line = await waitForAdapterLog('rollAbilityCheck')
      assertPath(line, 'legacy', { abilityId: 'lck' })
    })

    test('showModifierDialog flag → legacy', async ({ page }) => {
      await makePlayer(page, 'P1 Ability Dialog')
      await fireAndForget(page, async () => {
        game.actors.getName('P1 Ability Dialog').rollAbilityCheck('str', { showModifierDialog: true })
      })
      const line = await waitForAdapterLog('rollAbilityCheck')
      assertPath(line, 'legacy', { abilityId: 'str' })
    })
  })

  // ── rollSavingThrow ─────────────────────────────────────────────────

  test.describe('rollSavingThrow', () => {
    test('default options → adapter', async ({ page }) => {
      await makePlayer(page, 'P1 Save Default')
      await page.evaluate(async () => {
        await game.actors.getName('P1 Save Default').rollSavingThrow('ref')
      })
      const line = await waitForAdapterLog('rollSavingThrow')
      assertPath(line, 'adapter', { saveId: 'ref' })
    })

    test('rollUnder flag → legacy', async ({ page }) => {
      await makePlayer(page, 'P1 Save RollUnder')
      await page.evaluate(async () => {
        await game.actors.getName('P1 Save RollUnder').rollSavingThrow('wil', { rollUnder: true })
      })
      const line = await waitForAdapterLog('rollSavingThrow')
      assertPath(line, 'legacy', { saveId: 'wil' })
    })

    test('showModifierDialog flag → legacy', async ({ page }) => {
      await makePlayer(page, 'P1 Save Dialog')
      await fireAndForget(page, async () => {
        game.actors.getName('P1 Save Dialog').rollSavingThrow('frt', { showModifierDialog: true })
      })
      const line = await waitForAdapterLog('rollSavingThrow')
      assertPath(line, 'legacy', { saveId: 'frt' })
    })

    // Cheesemaker repro — sheet shows Fortitude +1 (sta 14 → mod +1, no
    // class bonus at level 0) but the rolled formula came out as `1d20 + 2`
    // because the adapter passes the FULL `saves.frt.value` (which already
    // bakes in the Stamina mod) into the lib, and the lib's check
    // definition then adds the Stamina mod on top. Bonus must equal the
    // displayed save value.
    test('Fortitude roll bonus equals displayed save (no ability double-count)', async ({ page }) => {
      await page.evaluate(async () => {
        await Actor.create({
          name: 'P1 Save FortBonus',
          type: 'Player',
          system: {
            abilities: {
              str: { value: 15, max: 15 },
              agl: { value: 11, max: 11 },
              sta: { value: 14, max: 14 },
              per: { value: 17, max: 17 },
              int: { value: 16, max: 16 },
              lck: { value: 16, max: 16 }
            },
            details: { level: { value: 0 } }
          }
        })
      })

      const { displayedFort, formula, total, natural } = await page.evaluate(async () => {
        const actor = game.actors.getName('P1 Save FortBonus')
        const displayedFort = actor.system.saves.frt.value
        const roll = await actor.rollSavingThrow('frt')
        const die = roll.dice?.[0]
        return {
          displayedFort,
          formula: roll.formula,
          total: roll.total,
          natural: die?.total ?? null
        }
      })

      // Sanity: with sta 14 and no class, sheet should show +1.
      expect(displayedFort).toBe('+1')
      // Bonus = total - natural; must equal +1 (not +2).
      expect(total - natural, `formula=${formula} natural=${natural} total=${total}`).toBe(1)
    })
  })

  // ── rollSkillCheck ──────────────────────────────────────────────────

  test.describe('rollSkillCheck', () => {
    test('built-in skill (sneakSilently) → adapter', async ({ page }) => {
      await makePlayer(page, 'P1 Skill Builtin')
      await page.evaluate(async () => {
        await game.actors.getName('P1 Skill Builtin').rollSkillCheck('sneakSilently')
      })
      const line = await waitForAdapterLog('rollSkillCheck')
      assertPath(line, 'adapter', { skillId: 'sneakSilently' })
    })

    test('cleric skill with useDisapprovalRange + skillTable → legacy', async ({ page }) => {
      await makePlayer(page, 'P1 Skill Cleric')
      await page.evaluate(async () => {
        // divineAid is both in CONFIG.DCC.skillTables AND carries
        // useDisapprovalRange: true. Either alone routes to legacy.
        await game.actors.getName('P1 Skill Cleric').rollSkillCheck('divineAid')
      })
      const line = await waitForAdapterLog('rollSkillCheck')
      assertPath(line, 'legacy', { skillId: 'divineAid' })
    })

    test('skill item with die → adapter', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Skill Item Die', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Backstab',
          type: 'skill',
          system: {
            die: '1d14',
            ability: 'agl',
            value: '+2',
            config: { useDie: true, useAbility: true, useValue: true, useLevel: false, applyCheckPenalty: false }
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Skill Item Die').rollSkillCheck('P1-Backstab')
      })
      const line = await waitForAdapterLog('rollSkillCheck')
      assertPath(line, 'adapter', { skillId: 'P1-Backstab' })
    })

    test('description-only skill item (no die) → legacy', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Skill Item NoDie', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Lore',
          type: 'skill',
          system: {
            die: '',
            config: { useDie: false, useAbility: false, useValue: false, useLevel: false }
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Skill Item NoDie').rollSkillCheck('P1-Lore')
      })
      const line = await waitForAdapterLog('rollSkillCheck')
      assertPath(line, 'legacy', { skillId: 'P1-Lore' })
    })

    test('showModifierDialog flag → legacy', async ({ page }) => {
      await makePlayer(page, 'P1 Skill Dialog')
      await fireAndForget(page, async () => {
        game.actors.getName('P1 Skill Dialog').rollSkillCheck('sneakSilently', { showModifierDialog: true })
      })
      const line = await waitForAdapterLog('rollSkillCheck')
      assertPath(line, 'legacy', { skillId: 'sneakSilently' })
    })
  })

  // ── getInitiativeRoll ───────────────────────────────────────────────

  test.describe('getInitiativeRoll', () => {
    test('default → adapter with die=1d20', async ({ page }) => {
      await makePlayer(page, 'P1 Init Default')
      await page.evaluate(() => {
        game.actors.getName('P1 Init Default').getInitiativeRoll()
      })
      const line = await waitForAdapterLog('rollInit')
      assertPath(line, 'adapter', { die: '1d20' })
    })

    test('showModifierDialog flag → legacy', async ({ page }) => {
      await makePlayer(page, 'P1 Init Dialog')
      await page.evaluate(() => {
        game.actors.getName('P1 Init Dialog').getInitiativeRoll(null, { showModifierDialog: true })
      })
      const line = await waitForAdapterLog('rollInit')
      assertPath(line, 'legacy')
    })

    test('pre-built Roll short-circuits without dispatch log', async ({ page }) => {
      await makePlayer(page, 'P1 Init Prebuilt')
      const returned = await page.evaluate(() => {
        const actor = game.actors.getName('P1 Init Prebuilt')
        const preRoll = new Roll('1d20')
        const result = actor.getInitiativeRoll(preRoll)
        return result === preRoll
      })
      expect(returned).toBe(true)
      await page.waitForTimeout(250)
      const initLogs = adapterLogs.filter(l => l.includes('rollInit'))
      expect(initLogs, `expected no rollInit logs, got: ${initLogs.join('\n')}`).toHaveLength(0)
    })

    test('equipped two-handed weapon overrides die → adapter with weapon die', async ({ page }) => {
      const actualDie = await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Init TwoHanded', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1 Greataxe',
          type: 'weapon',
          system: {
            equipped: true,
            twoHanded: true,
            initiativeDie: '1d14'
          }
        }])
        return actor.items.getName('P1 Greataxe').system.initiativeDie
      })
      await page.evaluate(() => {
        game.actors.getName('P1 Init TwoHanded').getInitiativeRoll()
      })
      const line = await waitForAdapterLog('rollInit')
      // The weapon's initiativeDie may be normalized by the data model;
      // verify the adapter picked up whatever it ended up as, not 1d20.
      expect(actualDie, 'weapon initiativeDie should not fall back to 1d20').not.toBe('1d20')
      assertPath(line, 'adapter', { die: actualDie })
    })
  })

  // ── rollSpellCheck (Phase 2) ────────────────────────────────────────

  test.describe('rollSpellCheck', () => {
    test('generic-castingMode spell item → adapter (generic)', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Spell Generic', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Generic-Cantrip',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'generic', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' }
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell Generic').rollSpellCheck({ spell: 'P1-Generic-Cantrip' })
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { spell: 'P1-Generic-Cantrip', mode: 'generic' })
    })

    test('wizard-castingMode spell item on a Wizard actor → adapter (wizard)', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell Wizard',
          type: 'Player',
          system: { class: { className: 'Wizard' } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Wizard-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'wizard', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
            lost: false
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell Wizard').rollSpellCheck({ spell: 'P1-Wizard-Spell' })
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { spell: 'P1-Wizard-Spell', mode: 'wizard' })
    })

    test('wizard-castingMode spell item on a patron-bound wizard → adapter (session 4)', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell WizardPatron',
          type: 'Player',
          system: { class: { className: 'Wizard', patron: 'Bobugbubilz' } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Patron-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'wizard', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
            associatedPatron: 'Bobugbubilz'
          }
        }])
      })
      const beforeChance = await page.evaluate(() => {
        return game.actors.getName('P1 Spell WizardPatron').system.class.patronTaintChance
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell WizardPatron').rollSpellCheck({ spell: 'P1-Patron-Spell' })
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { spell: 'P1-Patron-Spell', mode: 'wizard' })

      // Adapter-side legacy patron-taint bump: chance increments by 1%
      // for any patron-related cast (associatedPatron set here).
      const afterChance = await page.evaluate(() => {
        return game.actors.getName('P1 Spell WizardPatron').system.class.patronTaintChance
      })
      const before = parseInt(beforeChance) || 1
      const after = parseInt(afterChance) || 1
      expect(after, `patronTaintChance should bump from ${beforeChance} to ${before + 1}%, got ${afterChance}`).toBe(before + 1)
    })

    test('cleric-castingMode spell item on a Cleric actor → adapter (cleric)', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell Cleric',
          type: 'Player',
          system: {
            class: { className: 'Cleric', disapproval: 1 },
            details: { sheetClass: 'Cleric' }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Cleric-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'cleric', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' }
          }
        }])
      })
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell Cleric').rollSpellCheck({ spell: 'P1-Cleric-Spell' })
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { spell: 'P1-Cleric-Spell', mode: 'cleric' })
    })

    test('naked spell check (no item) → legacy', async ({ page }) => {
      await makePlayer(page, 'P1 Spell Naked')
      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell Naked').rollSpellCheck()
      })
      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'legacy')
    })

    test('wizard cast with options.spellburn reduces physical ability scores (session 5)', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell Spellburn',
          type: 'Player',
          system: {
            class: { className: 'Wizard' },
            abilities: {
              str: { value: 14, max: 14 },
              agl: { value: 12, max: 12 },
              sta: { value: 13, max: 13 },
              per: { value: 10, max: 10 },
              int: { value: 16, max: 16 },
              lck: { value: 10, max: 10 }
            }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Spellburn-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'wizard', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
            lost: false
          }
        }])
      })

      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell Spellburn').rollSpellCheck({
          spell: 'P1-Spellburn-Spell',
          spellburn: { str: 2, agl: 0, sta: 1 }
        })
      })

      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { spell: 'P1-Spellburn-Spell', mode: 'wizard' })

      // Allow async actor.update to land (onSpellburnApplied bridge).
      await page.waitForTimeout(300)

      const { str, agl, sta } = await page.evaluate(() => {
        const actor = game.actors.getName('P1 Spell Spellburn')
        return {
          str: actor.system.abilities.str.value,
          agl: actor.system.abilities.agl.value,
          sta: actor.system.abilities.sta.value
        }
      })
      // Burn: str -2 → 12, agl unchanged → 12, sta -1 → 12.
      expect(str).toBe(12)
      expect(agl).toBe(12)
      expect(sta).toBe(12)
    })

    test('wizard first-cast pre-rolls mercurial magic (session 5)', async ({ page }) => {
      // CONFIG.DCC.mercurialMagicTable is set from a world setting at
      // init. Skip gracefully when no table is configured in this world
      // — the adapter falls back to silent no-op in that case.
      const tableConfigured = await page.evaluate(() => !!CONFIG.DCC.mercurialMagicTable)
      test.skip(!tableConfigured, 'No mercurialMagicTable configured in this world')

      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Spell Mercurial',
          type: 'Player',
          system: { class: { className: 'Wizard' } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Mercurial-Spell',
          type: 'spell',
          system: {
            level: 1,
            config: { castingMode: 'wizard', inheritCheckPenalty: true },
            spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
            lost: false
          }
        }])
      })

      await page.evaluate(async () => {
        await game.actors.getName('P1 Spell Mercurial').rollSpellCheck({ spell: 'P1-Mercurial-Spell' })
      })

      const line = await waitForAdapterLog('rollSpellCheck')
      assertPath(line, 'adapter', { spell: 'P1-Mercurial-Spell', mode: 'wizard' })

      // Allow the async item.update to land.
      await page.waitForTimeout(400)

      const mercurialValue = await page.evaluate(() => {
        const actor = game.actors.getName('P1 Spell Mercurial')
        const item = actor.items.getName('P1-Mercurial-Spell')
        return item?.system?.mercurialEffect?.value
      })
      // Foundry's spell data model coerces mercurialEffect.value to a
      // string at save time — normalize before the numeric assertion.
      expect(Number(mercurialValue), 'mercurial effect should be rolled and stored on first cast').toBeGreaterThan(0)
    })
  })

  // ── rollWeaponAttack (Phase 3 session 2) ────────────────────────────

  test.describe('rollWeaponAttack', () => {
    test('simplest weapon + automate on → adapter (happy path)', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Weapon Happy', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Longsword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            damage: '1d8',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Weapon Happy').items.getName('P1-Longsword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Weapon Happy').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-Longsword' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-Longsword' })
    })

    test('options.backstab on a thief → adapter (session 9)', async ({ page }) => {
      // Phase 3 session 9: backstab attack + damage flow through the
      // adapter. `isBackstab: true` drives the lib's auto-crit;
      // `rollWeaponAttack` swaps `damageRollFormula` to the alternate
      // backstab damage formula before reaching the adapter's gate,
      // so the damage path accepts the alternate die naturally.
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Weapon Backstab',
          type: 'Player',
          // L3 chaotic thief: Table 1-9 backstab bonus is +7.
          system: { class: { backstab: '+7' } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-BackstabDagger',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+1',
            critRange: 20,
            damageWeapon: '1d4',
            damage: '1d4',
            backstabDamage: '1d10',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Weapon Backstab').items.getName('P1-BackstabDagger').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Weapon Backstab').rollWeaponAttack(id, { backstab: true })
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-BackstabDagger' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-BackstabDagger' })
    })

    test('options.backstab populates libResult with auto-crit + class:backstab bonus', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Backstab LibFlag',
          type: 'Player',
          system: { class: { backstab: '+7' } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-BackstabShortSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+1',
            critRange: 20,
            damageWeapon: '1d6',
            damage: '1d6',
            backstabDamage: '1d6',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        // Force d20 to roll exactly 10 — below threatRange (20) so the
        // only crit path is backstab-auto, not threat-range / natural-max.
        // Foundry: Math.ceil((1 - randomUniform) * faces); 0.5 → 10 on d20.
        globalThis.__origRandomUniform = CONFIG.Dice.randomUniform
        CONFIG.Dice.randomUniform = () => 0.5
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Backstab LibFlag').items.getName('P1-BackstabShortSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Backstab LibFlag').rollWeaponAttack(id, { backstab: true })
      }, weaponId)

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Backstab LibFlag' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libResult')
            )
          if (msg) return msg.getFlag('dcc', 'libResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      // Restore randomUniform BEFORE asserting — if any assertion throws
      // and the deferred restore is skipped, the stub leaks across the
      // session-reuse fixture and downstream tests roll deterministically.
      await page.evaluate(() => {
        CONFIG.Dice.randomUniform = globalThis.__origRandomUniform
      })

      expect(flag, 'backstab adapter-path attack must set dcc.libResult').not.toBeNull()
      expect(flag.natural).toBe(10)
      expect(flag.isCriticalThreat).toBe(true)
      expect(flag.critSource).toBe('backstab-auto')
      const backstabEntry = flag.bonuses.find(b => b.id === 'class:backstab')
      expect(backstabEntry, 'class:backstab RollBonus must surface on libResult.bonuses').toBeDefined()
      expect(backstabEntry.effect.value).toBe(7)
    })

    test('showModifierDialog flag → adapter (session 13 / A6)', async ({ page }) => {
      // A6: modifier-dialog case now routes via adapter with
      // `damageTerms` threaded into `DCCRoll.createRoll`. Dispatch log
      // fires at the start of `rollToHit` before the (blocking) dialog
      // shows — fireAndForget dismisses the dialog with Escape so the
      // test run continues.
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Weapon Dialog', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-DialogSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+0',
            critRange: 20,
            damage: '1d6',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Weapon Dialog').items.getName('P1-DialogSword').id
      })
      await fireAndForget(page, async (id) => {
        game.actors.getName('P1 Weapon Dialog').rollWeaponAttack(id, { showModifierDialog: true })
      }, weaponId)
      const line = await waitForAdapterLog('rollWeaponAttack')
      assertPath(line, 'adapter', { weapon: 'P1-DialogSword' })
    })

    test('warrior deed die → adapter (session 10 / A3)', async ({ page }) => {
      // Phase 3 session 10 (A3): warrior / dwarf deed dice route through
      // the adapter. The actor's `+1d3` attackBonus + the weapon's
      // computed `+1d3+0` toHit both pass `parseDeedAttackBonus`; the
      // adapter feeds `AttackInput.deedDie: 'd3'` to the lib, which
      // rolls the deed via the sequenced roller and emits
      // `onDeedAttempt` with the natural + success flag.
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Weapon Warrior',
          type: 'Player',
          // L1 warrior: +1d3 deed die, no flat attack bonus.
          system: { details: { attackBonus: '+1d3' } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-WarriorSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            // Pre-bake the deed-die toHit; in real Foundry
            // computeMeleeAndMissileAttackAndDamage wires this for us
            // off the actor's `+1d3` attackBonus + str mod.
            toHit: '+1d3+0',
            critRange: 20,
            damageWeapon: '1d8',
            damage: '1d8',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Weapon Warrior').items.getName('P1-WarriorSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Weapon Warrior').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-WarriorSword' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-WarriorSword' })
    })

    test('warrior deed die populates libResult.deedDie + deedNatural + deedSuccess', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Deed LibFlag',
          type: 'Player',
          system: { details: { attackBonus: '+1d3' } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-DeedSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+1d3+0',
            critRange: 20,
            damageWeapon: '1d8',
            damage: '1d8',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        // Force every die to land on its midpoint (Foundry rounds up):
        // d20 → 10, d3 → 2 (deed fail). Lets us assert deedSuccess === false
        // while keeping the natural visible.
        globalThis.__origRandomUniform = CONFIG.Dice.randomUniform
        CONFIG.Dice.randomUniform = () => 0.5
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Deed LibFlag').items.getName('P1-DeedSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Deed LibFlag').rollWeaponAttack(id)
      }, weaponId)

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Deed LibFlag' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libResult')
            )
          if (msg) return msg.getFlag('dcc', 'libResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(flag, 'deed-die adapter-path attack must set dcc.libResult').not.toBeNull()
      expect(flag.deedDie).toBe('d3')
      expect(flag.deedNatural).toBe(2)
      expect(flag.deedSuccess).toBe(false)
      // Restore randomUniform BEFORE asserting — see backstab libResult test.
      await page.evaluate(() => {
        CONFIG.Dice.randomUniform = globalThis.__origRandomUniform
      })

      // The lib emits a `{ source: 'deed die', value: <natural> }`
      // entry on appliedModifiers when a deed is rolled.
      const deedMod = flag.modifiers.find(m => m.source === 'deed die')
      expect(deedMod, 'deed-die modifier must surface on libResult.modifiers').toBeDefined()
      expect(deedMod.value).toBe(2)
    })

    test('two-weapon primary → adapter (session 11 / A4)', async ({ page }) => {
      // Phase 3 session 11 (A4): two-weapon fighting routes through
      // the adapter. DCC's mechanic is a dice-chain reduction baked
      // into `weapon.system.actionDie` at prepareBaseData time
      // (e.g. d20 → d16 with the off-hand label appended); the
      // adapter strips the tag via `normalizeLibDie` and the lib
      // computes the attack on the bumped die. We deliberately do
      // NOT plumb the lib's flat `getTwoWeaponPenalty` — DCC RAW
      // uses dice-chain, not flat mods, so adding a -2 here would
      // double-count.
      //
      // Pre-baking `actionDie: '1d16[2w-primary]'` directly fails
      // schema validation (dice notation field rejects bracket tags
      // on write); set `twoWeaponPrimary: true` and let
      // item.js:prepareBaseData compute the bumped die in-memory.
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 TwoWeapon',
          type: 'Player',
          // Agility 12-15 → primary -1 die (1d20 → 1d16).
          system: { abilities: { agl: { value: 13 } } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-PrimaryDagger',
          type: 'weapon',
          system: {
            toHit: '+1',
            critRange: 20,
            damageWeapon: '1d4',
            damage: '1d4',
            melee: true,
            equipped: true,
            twoWeaponPrimary: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 TwoWeapon').items.getName('P1-PrimaryDagger').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 TwoWeapon').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-PrimaryDagger' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-PrimaryDagger' })
    })

    test('two-weapon secondary populates libResult.die + isTwoWeaponSecondary', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 OffHand LibFlag',
          type: 'Player',
          // Agility 13 → off-hand -2 dice (1d20 → 1d14 via DiceChain).
          system: { abilities: { agl: { value: 13 } } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-OffHandHatchet',
          type: 'weapon',
          system: {
            toHit: '+0',
            critRange: 20,
            damageWeapon: '1d6',
            damage: '1d6',
            melee: true,
            equipped: true,
            twoWeaponSecondary: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 OffHand LibFlag').items.getName('P1-OffHandHatchet').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 OffHand LibFlag').rollWeaponAttack(id)
      }, weaponId)

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 OffHand LibFlag' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libResult')
            )
          if (msg) return msg.getFlag('dcc', 'libResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(flag, 'two-weapon adapter-path attack must set dcc.libResult').not.toBeNull()
      // Die was bumped down from d20 — exact face count depends on
      // DiceChain.bumpDie semantics, but it must NOT be d20.
      expect(flag.die).toMatch(/^d\d+$/)
      expect(flag.die).not.toBe('d20')
      expect(flag.isTwoWeaponSecondary).toBe(true)
      expect(flag.isTwoWeaponPrimary).toBe(false)
      // Sanity: the lib's flat `two-weapon fighting` modifier source
      // must NOT appear — DCC uses dice-chain reductions, not flat mods.
      const flatTwoWeaponMod = flag.modifiers.find(m => m.source === 'two-weapon fighting')
      expect(flatTwoWeaponMod, 'must not introduce flat two-weapon penalty').toBeUndefined()
    })

    test('halfling two-weapon fumble note round-trips through adapter', async ({ page }) => {
      // Halfling RAW: a two-weapon fumble is only "real" if BOTH dice
      // came up natural 1. The chat card embeds a localized note in
      // that state so the player can decide. The note triggers off
      // `attackRollResult.fumble` + `weapon.system.twoWeapon*` +
      // `actor.system.details.sheetClass === 'Halfling'`. This e2e
      // verifies the adapter's `libResult.isFumble → fumble` round-trip
      // doesn't drop the note for the now-adapter-routed two-weapon
      // path.
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Halfling Fumble',
          type: 'Player',
          system: {
            abilities: { agl: { value: 13 } },
            details: { sheetClass: 'Halfling' }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-HalflingDagger',
          type: 'weapon',
          system: {
            toHit: '+0',
            critRange: 20,
            damageWeapon: '1d4',
            damage: '1d4',
            melee: true,
            equipped: true,
            twoWeaponPrimary: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        // Force natural 1 on the action die so the lib classifies a fumble.
        // Foundry: Math.ceil((1 - randomUniform) * faces); 0.99 → 1 on any die.
        globalThis.__origRandomUniform = CONFIG.Dice.randomUniform
        CONFIG.Dice.randomUniform = () => 0.99
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Halfling Fumble').items.getName('P1-HalflingDagger').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Halfling Fumble').rollWeaponAttack(id)
      }, weaponId)

      const noteHtml = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Halfling Fumble' &&
              m.getFlag('dcc', 'isToHit')
            )
          if (msg) return msg.content || ''
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      // Restore randomUniform BEFORE asserting — if an assertion throws,
      // a deferred restore would leave the global stub in place and
      // pollute subsequent tests via the session-reuse fixture.
      await page.evaluate(() => {
        CONFIG.Dice.randomUniform = globalThis.__origRandomUniform
      })

      expect(noteHtml, 'halfling two-weapon fumble must produce chat card').not.toBeNull()
      expect(noteHtml).toContain('Fumble only applies if both attack rolls were a natural 1')
    })

    test('halfling two-weapon crit range survives the adapter (1d16, threatRange 16)', async ({ page }) => {
      // Halfling RAW (DCC core): when fighting two-weapon at agl ≤17,
      // halflings score crits AND auto-hit on natural 16. item.js
      // prepareBaseData sets `weapon.system.critRange = 16` on the
      // pre-bumped weapon. The adapter passes that through as
      // `AttackInput.threatRange`. We force a natural 16 (mid-range
      // for a d16) and assert the lib classifies it as a crit.
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 Halfling Crit',
          type: 'Player',
          system: {
            abilities: { agl: { value: 13 } },
            details: { sheetClass: 'Halfling' }
          }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-HalflingHatchet',
          type: 'weapon',
          system: {
            toHit: '+0',
            // critRange omitted — item.js prepareBaseData sets 16 from
            // the halfling-two-weapon branch.
            damageWeapon: '1d4',
            damage: '1d4',
            melee: true,
            equipped: true,
            twoWeaponPrimary: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        // Force natural max on a d16: ceil((1 - 0.001) * 16) = 16.
        globalThis.__origRandomUniform = CONFIG.Dice.randomUniform
        CONFIG.Dice.randomUniform = () => 0.001
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Halfling Crit').items.getName('P1-HalflingHatchet').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Halfling Crit').rollWeaponAttack(id)
      }, weaponId)

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Halfling Crit' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libResult')
            )
          if (msg) return msg.getFlag('dcc', 'libResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      // Restore randomUniform BEFORE asserting — see fumble-note test.
      // randomUniform = 0.001 (always-max-die) leaks catastrophically
      // into downstream tests if a deferred restore is skipped.
      await page.evaluate(() => {
        CONFIG.Dice.randomUniform = globalThis.__origRandomUniform
      })

      expect(flag, 'halfling two-weapon crit-on-16 must set dcc.libResult').not.toBeNull()
      expect(flag.die).toBe('d16')
      expect(flag.natural).toBe(16)
      // A natural 16 on a d16 is auto-hit (max-on-die) — and the
      // halfling two-weapon critRange was set to 16 by prepareBaseData,
      // so this should classify as a crit. critSource will be
      // 'natural-max' since 16 IS the max on this die.
      expect(flag.isCriticalThreat).toBe(true)
      expect(flag.critSource).toBe('natural-max')
    })

    test('automate off → adapter (session 12 / A5)', async ({ page }) => {
      // A5: `automateDamageFumblesCrits` gates the downstream damage /
      // crit / fumble chain inside `rollWeaponAttack`, not the attack
      // adapter itself. Attack should still route via adapter and
      // populate `dcc.libResult` on the chat flags; downstream damage
      // falls back to the inline-roll-text prompt with no lib call.
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Weapon NoAutomate', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-NoAutomateSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+0',
            critRange: 20,
            damage: '1d6',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', false)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Weapon NoAutomate').items.getName('P1-NoAutomateSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Weapon NoAutomate').rollWeaponAttack(id)
      }, weaponId)
      const line = await waitForAdapterLog('rollWeaponAttack')
      assertPath(line, 'adapter', { weapon: 'P1-NoAutomateSword' })
      const { libResult, libDamageResult } = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Weapon NoAutomate' &&
              m.getFlag('dcc', 'isToHit')
            )
          if (msg) {
            return {
              libResult: msg.getFlag('dcc', 'libResult') ?? null,
              libDamageResult: msg.getFlag('dcc', 'libDamageResult') ?? null
            }
          }
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return { libResult: null, libDamageResult: null }
      })
      expect(libResult, 'attack routes via adapter → dcc.libResult set').not.toBeNull()
      expect(libResult.die).toBe('d20')
      // Downstream damage path stays on inline-roll-text fallback with
      // automate off, so no libDamageResult flag.
      expect(libDamageResult).toBeNull()
    })

    test('non-deed dice in toHit → adapter (session 14 / A7)', async ({ page }) => {
      // A7: dice-bearing `attackBonus` / `toHit` patterns that don't
      // match `parseDeedAttackBonus` (e.g. leading flat + trailing
      // die, multiple dice) no longer fall to legacy. Foundry's Roll
      // evaluates the dice portion natively; the lib sees the flat
      // portion via `parseToHitBonus`. `warnIfDivergent` surfaces the
      // mismatch; `attackRoll.total` remains the chat-authoritative
      // total. Closes gate exhaustiveness for D1.
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Weapon DiceMid', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-DiceMidSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            // Leading flat + trailing die — legitimate shape for a
            // magical weapon that grants a deed-die-style bonus on
            // top of a base. parseDeedAttackBonus anchors at start
            // and rejects this.
            toHit: '+2+1d3',
            critRange: 20,
            damage: '1d6',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Weapon DiceMid').items.getName('P1-DiceMidSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Weapon DiceMid').rollWeaponAttack(id)
      }, weaponId)
      const line = await waitForAdapterLog('rollWeaponAttack')
      assertPath(line, 'adapter', { weapon: 'P1-DiceMidSword' })
      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Weapon DiceMid' &&
              m.getFlag('dcc', 'isToHit')
            )
          if (msg) return msg.getFlag('dcc', 'libResult') ?? null
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })
      expect(flag, 'dice-bearing toHit still surfaces lib libResult').not.toBeNull()
      expect(flag.die).toBe('d20')
    })

    test('two-handed weapon attack → adapter (session 14 / A7 coverage)', async ({ page }) => {
      // Two-handed weapons affect initiative die (bumped down one
      // step) but not the attack formula itself. Adapter coverage
      // here confirms the attack routes identically to a one-handed
      // weapon, closing an explicit gap in dispatch-spec coverage.
      // Initiative-side two-handed coverage lives in the
      // `getInitiativeRoll` section above.
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Weapon TwoHanded', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-Greatsword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+1',
            critRange: 20,
            damage: '1d10',
            damageWeapon: '1d10',
            melee: true,
            equipped: true,
            twoHanded: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Weapon TwoHanded').items.getName('P1-Greatsword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Weapon TwoHanded').rollWeaponAttack(id)
      }, weaponId)
      const line = await waitForAdapterLog('rollWeaponAttack')
      assertPath(line, 'adapter', { weapon: 'P1-Greatsword' })
      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Weapon TwoHanded' &&
              m.getFlag('dcc', 'isToHit')
            )
          if (msg) return msg.getFlag('dcc', 'libResult') ?? null
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })
      expect(flag, 'two-handed weapon attack surfaces libResult').not.toBeNull()
      expect(flag.die).toBe('d20')
      // twoWeaponPrimary / twoWeaponSecondary should NOT be set on a
      // two-handed weapon (distinct mechanic from two-weapon fighting).
      expect(flag.isTwoWeaponPrimary).toBe(false)
      expect(flag.isTwoWeaponSecondary).toBe(false)
    })

    test('D1 retirement: _rollToHitLegacy + _canRouteAttackViaAdapter are gone (session 15)', async ({ page }) => {
      // A7 closed the attack gate (always true); D1 collapsed the
      // dispatcher + legacy body. `rollToHit` is now a single path.
      // Guard against regressions that reintroduce the dispatcher
      // scaffold.
      const surface = await page.evaluate(() => {
        const proto = Object.getPrototypeOf(game.actors.contents.find(a => a.type === 'Player')) ||
          CONFIG.Actor.documentClass?.prototype
        return {
          hasRollToHit: typeof proto.rollToHit === 'function',
          hasLegacy: typeof proto._rollToHitLegacy === 'function',
          hasGate: typeof proto._canRouteAttackViaAdapter === 'function',
          hasAdapterAlias: typeof proto._rollToHitViaAdapter === 'function'
        }
      })
      expect(surface.hasRollToHit, 'rollToHit remains the public method').toBe(true)
      expect(surface.hasLegacy, '_rollToHitLegacy retired in D1').toBe(false)
      expect(surface.hasGate, '_canRouteAttackViaAdapter retired in D1').toBe(false)
      expect(surface.hasAdapterAlias, '_rollToHitViaAdapter folded into rollToHit').toBe(false)
    })
  })

  // ── rollDamage (Phase 3 session 5, single-path post-session-19) ────

  test.describe('rollDamage', () => {
    test('multi-damage-type formula (`1d6[fire]+1d6[cold]`) routes via adapter (D2 damage sub-slice c)', async ({ page }) => {
      // Phase 3 session 19 broadened the gate to route per-term-flavor
      // formulas. The adapter uses native `new Roll` (not DCCRoll) so
      // Foundry preserves the per-term flavor labels in chat rendering,
      // exactly as legacy did via its `hasPerTermFlavors` branch. The
      // lib sees base `d6` + one `extraDamageDice` entry `{count: 1,
      // die: 'd6', flavor: 'cold'}`; the first term's flavor is dropped
      // for the lib's base breakdown (hardcoded `source: 'weapon'`) but
      // preserved visually in Foundry's chat breakdown.
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Damage MultiType', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-FlamingBlade',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            damage: '1d6[fire]+1d6[cold]',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Damage MultiType').items.getName('P1-FlamingBlade').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Damage MultiType').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-FlamingBlade' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-FlamingBlade' })

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Damage MultiType' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libDamageResult')
            )
          if (msg) return msg.getFlag('dcc', 'libDamageResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(flag, 'multi-type damage must set dcc.libDamageResult').not.toBeNull()
      expect(flag.passthrough).toBeUndefined()
      // Base d6 (fire) + extra d6 (cold). Both naturals in [1,6].
      expect(Array.isArray(flag.breakdown)).toBe(true)
      const weaponEntry = flag.breakdown.find(b => b.source === 'weapon')
      expect(weaponEntry, 'base-die breakdown entry').toBeDefined()
      expect(weaponEntry.amount).toBeGreaterThanOrEqual(1)
      expect(weaponEntry.amount).toBeLessThanOrEqual(6)
      const coldEntry = flag.breakdown.find(b => b.source === 'cold')
      expect(coldEntry, 'cold-flavored extra die must surface under its flavor').toBeDefined()
      expect(coldEntry.amount).toBeGreaterThanOrEqual(1)
      expect(coldEntry.amount).toBeLessThanOrEqual(6)
    })

    test('adapter path populates dcc.libDamageResult chat flag', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Damage LibFlag', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-LibFlagSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            damage: '1d8+1',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Damage LibFlag').items.getName('P1-LibFlagSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Damage LibFlag').rollWeaponAttack(id)
      }, weaponId)

      // Wait for the chat message that rollWeaponAttack created and read
      // back its `flags['dcc.libDamageResult']` structure.
      const flag = await page.evaluate(async () => {
        // Poll briefly — ChatMessage.create is async; the message may
        // appear a tick or two after rollWeaponAttack resolves.
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m => m.getFlag('dcc', 'isToHit') && m.getFlag('dcc', 'libDamageResult'))
          if (msg) return msg.getFlag('dcc', 'libDamageResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      // Assert on lib-result invariants rather than concrete numeric
      // values — a fresh Player's ability scores randomize each session,
      // which can rewrite `weapon.system.damage` through item prepareData
      // (str mod folding into the override). The invariants below hold
      // regardless of what specific formula reaches the adapter.
      expect(flag, 'adapter-path damage roll must set dcc.libDamageResult').not.toBeNull()
      expect(typeof flag.damageDie).toBe('string')
      expect(flag.damageDie).toMatch(/d\d+/)
      expect(typeof flag.natural).toBe('number')
      expect(flag.natural).toBeGreaterThanOrEqual(1)
      expect(flag.baseDamage).toBe(flag.natural)
      expect(typeof flag.modifierDamage).toBe('number')
      expect(flag.total).toBe(Math.max(1, flag.baseDamage + flag.modifierDamage))
      expect(Array.isArray(flag.breakdown)).toBe(true)
      expect(flag.breakdown.length).toBeGreaterThan(0)
      const weaponEntry = flag.breakdown.find(b => b.source === 'weapon')
      expect(weaponEntry, 'breakdown must include weapon entry').toBeDefined()
      expect(weaponEntry.amount).toBe(flag.baseDamage)
    })

    test('NPC with attackDamageBonus.melee.adjustment routes via adapter + bonus breakdown', async ({ page }) => {
      // Phase 3 session 7. NPC damage adjustments live on
      // `system.details.attackDamageBonus.{melee,missile}.adjustment` and
      // are baked into the damage formula by `rollWeaponAttack`. The
      // adapter peels the adjustment back off `strengthModifier` and
      // surfaces it as a `RollBonus` in the lib breakdown so the chat
      // flag attributes it correctly (rather than misattributing it as
      // Strength like a flat-fold would).
      await page.evaluate(async () => {
        const npc = await Actor.create({
          name: 'P1 NPC DamageBonus',
          type: 'NPC',
          system: { details: { attackDamageBonus: { melee: { adjustment: '+2' } } } }
        })
        await npc.createEmbeddedDocuments('Item', [{
          name: 'P1-NpcClub',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+1',
            critRange: 20,
            damage: '1d4',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 NPC DamageBonus').items.getName('P1-NpcClub').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 NPC DamageBonus').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-NpcClub' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-NpcClub' })

      const flag = await page.evaluate(async () => {
        // Chat messages persist across tests in the session-reuse fixture;
        // scope to our NPC by speaker.alias so we don't pick up a prior
        // test's libDamageResult.
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 NPC DamageBonus' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libDamageResult')
            )
          if (msg) return msg.getFlag('dcc', 'libDamageResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(flag, 'NPC adapter-path damage roll must set dcc.libDamageResult').not.toBeNull()
      expect(flag.modifierDamage).toBe(2)
      const strEntry = flag.breakdown.find(b => b.source === 'Strength')
      expect(strEntry, 'NPC damage breakdown must NOT credit Strength').toBeUndefined()
      const bonusEntry = flag.breakdown.find(b => b.source === 'bonuses')
      expect(bonusEntry, 'NPC adjustment must surface as a bonus breakdown entry').toBeDefined()
      expect(bonusEntry.amount).toBe(2)
    })

    test('PC with +1 magic weapon routes via adapter + magic breakdown entry', async ({ page }) => {
      // Phase 3 session 8. A weapon with `damageWeaponBonus: '+1'` flows
      // through the adapter's expanded gate. `item.js` bakes the magic
      // bonus into the damage formula as a second trailing modifier
      // (e.g. `1d8+2+1`); the adapter peels it back off strengthModifier
      // and sets `DamageInput.magicBonus`, so the lib breakdown carries
      // separate `Strength` and `magic` entries.
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 PC MagicSword',
          type: 'Player',
          system: { abilities: { str: { value: 13, mod: 1 } } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-MagicSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+1',
            critRange: 20,
            damageWeapon: '1d8',
            damageWeaponBonus: '+1',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 PC MagicSword').items.getName('P1-MagicSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 PC MagicSword').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-MagicSword' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-MagicSword' })

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 PC MagicSword' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libDamageResult')
            )
          if (msg) return msg.getFlag('dcc', 'libDamageResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(flag, 'PC +1 weapon adapter-path damage roll must set dcc.libDamageResult').not.toBeNull()
      const magicEntry = flag.breakdown.find(b => b.source === 'magic')
      expect(magicEntry, 'magic weapon bonus must surface as a breakdown entry').toBeDefined()
      expect(magicEntry.amount).toBe(1)
    })

    test('trailing bracket-flavor formula (`1d6+2[Slashing]`) routes via adapter (D2 damage sub-slice b)', async ({ page }) => {
      // D2 damage sub-slice (b). A flat-modifier-then-flavor formula
      // (`1d6+2[Slashing]`) is not per-term-flavored — legacy peels the
      // bracket into the `Compound` term's `flavor` field and feeds the
      // cleaned formula to DCCRoll.createRoll. The adapter does the same
      // so the flavor label still renders in chat, and `parseDamageFormula`
      // sees only the clean `1d6+2` and builds a valid `DamageInput`. This
      // formerly fell to legacy via the `includes('[')` gate rejection;
      // sub-slice (b) removes that rejection and peels the flavor first.
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Damage BracketFlavor', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-FlavorBlade',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            // Baked-in trailing flavor — simulates homebrew content or
            // modules that annotate damage type inline.
            damage: '1d6+2[Slashing]',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Damage BracketFlavor').items.getName('P1-FlavorBlade').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Damage BracketFlavor').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-FlavorBlade' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-FlavorBlade' })

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Damage BracketFlavor' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libDamageResult')
            )
          if (msg) return msg.getFlag('dcc', 'libDamageResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      // libDamageResult populated — parser saw the cleaned `1d6+2` after
      // `peelTrailingFlavor` stripped `[Slashing]`.
      expect(flag, 'bracket-flavor damage must set dcc.libDamageResult').not.toBeNull()
      expect(typeof flag.damageDie).toBe('string')
      expect(flag.damageDie).toMatch(/d\d+/)
      expect(flag.total).toBe(Math.max(1, flag.baseDamage + flag.modifierDamage))
    })

    test('unparseable formula (`(1d8)*2+3`) routes via adapter as lossless passthrough (D2 damage sub-slice a)', async ({ page }) => {
      // D2 damage sub-slice (a). A lance with `doubleIfMounted` produces
      // the formula `(1d8)*2+3` via `item.js:prepareBaseData`, which
      // `parseDamageFormula` can't digest (parens + multiplier). Before
      // this sub-slice the gate rejected on `parseDamageFormula === null`
      // and the damage fell to legacy. The passthrough now routes it via
      // adapter: Foundry evaluates the Roll normally, the lib call is
      // skipped, and `dcc.libDamageResult` carries just `total` with a
      // `passthrough: true` marker so downstream consumers know the
      // breakdown is deliberately empty (not an adapter bug).
      //
      // Note: a real mounted lance needs its rider mounted, which
      // adds setup we don't need — we reproduce the shape directly by
      // overriding `damage` with an unparseable formula via
      // `damageOverride`. That's the other class of unparseable
      // formulas this sub-slice enables (homebrew damage formulas).
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Damage Passthrough', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-PassthroughWeapon',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            damageWeapon: '1d6',
            // damageOverride forces the final damage formula verbatim,
            // bypassing the str-mod fold + magic-bonus stack. Exactly
            // how homebrew / custom content produces arbitrary formulas.
            config: { damageOverride: '(1d8)*2+3' },
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Damage Passthrough').items.getName('P1-PassthroughWeapon').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Damage Passthrough').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-PassthroughWeapon' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-PassthroughWeapon' })

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 Damage Passthrough' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libDamageResult')
            )
          if (msg) return msg.getFlag('dcc', 'libDamageResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(flag, 'passthrough damage must set dcc.libDamageResult').not.toBeNull()
      expect(flag.passthrough, 'passthrough marker must be set for unparseable formulas').toBe(true)
      expect(flag.breakdown).toEqual([])
      expect(typeof flag.total).toBe('number')
      expect(flag.total).toBeGreaterThanOrEqual(5) // (1d8 min 1)*2 + 3 = 5 min
      // Fields the lib would populate are null — passthrough contract.
      expect(flag.damageDie).toBeNull()
      expect(flag.natural).toBeNull()
    })

    test('cursed weapon (`damageWeaponBonus: "-1"`) routes via adapter with negative magicBonus (D2 damage sub-slice d)', async ({ page }) => {
      // Phase 3 session 19 broadened the gate to accept negative
      // `damageWeaponBonus`. `item.js` flattens a cursed flat bonus into
      // the damage formula via `Roll.safeEval` (e.g. str +3 + cursed -1
      // → `1d8+2`); the adapter reads `weapon.system.damageWeaponBonus`
      // directly, sets `DamageInput.magicBonus: -1`, and the lib
      // surfaces it as `breakdown[].source === 'cursed'` with a negative
      // amount. Strength is attributed correctly (not silently folded).
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 PC CursedBlade',
          type: 'Player',
          system: { abilities: { str: { value: 16, mod: 2 } } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-CursedBlade',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+1',
            critRange: 20,
            damageWeapon: '1d8',
            damageWeaponBonus: '-1',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 PC CursedBlade').items.getName('P1-CursedBlade').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 PC CursedBlade').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-CursedBlade' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-CursedBlade' })

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 PC CursedBlade' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libDamageResult')
            )
          if (msg) return msg.getFlag('dcc', 'libDamageResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(flag, 'cursed weapon adapter-path damage must set dcc.libDamageResult').not.toBeNull()
      expect(flag.passthrough).toBeUndefined()
      const cursedEntry = flag.breakdown.find(b => b.source === 'cursed')
      expect(cursedEntry, 'cursed bonus must surface as its own breakdown entry').toBeDefined()
      expect(cursedEntry.amount).toBe(-1)
    })

    test('dice-bearing magic bonus (`damageWeaponBonus: "+1d4"`) routes via adapter with extraDamageDice (D2 damage sub-slice d)', async ({ page }) => {
      // Phase 3 session 19 broadened the gate to accept dice-bearing
      // `damageWeaponBonus`. `item.js` concatenates the raw bonus onto
      // the derived damage formula (str +3 + `+1d4` magic → `1d8+3+1d4`);
      // the adapter strips the suffix, parses the base, and feeds the
      // dice as a single `extraDamageDice[]` entry (`source: 'magic'`).
      await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'P1 PC FlamingBlade',
          type: 'Player',
          system: { abilities: { str: { value: 16, mod: 2 } } }
        })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-FlamingDiceBlade',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+1',
            critRange: 20,
            damageWeapon: '1d8',
            damageWeaponBonus: '+1d4',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 PC FlamingBlade').items.getName('P1-FlamingDiceBlade').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 PC FlamingBlade').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-FlamingDiceBlade' })
      const damageLine = await waitForAdapterLog('rollDamage')
      assertPath(damageLine, 'adapter', { weapon: 'P1-FlamingDiceBlade' })

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m =>
              m.speaker?.alias === 'P1 PC FlamingBlade' &&
              m.getFlag('dcc', 'isToHit') &&
              m.getFlag('dcc', 'libDamageResult')
            )
          if (msg) return msg.getFlag('dcc', 'libDamageResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      expect(flag, 'dice-bearing magic adapter-path damage must set dcc.libDamageResult').not.toBeNull()
      expect(flag.passthrough).toBeUndefined()
      const magicEntry = flag.breakdown.find(b => b.source === 'magic')
      expect(magicEntry, 'dice-bearing magic bonus must surface as magic breakdown entry').toBeDefined()
      // Extra d4 natural in [1, 4].
      expect(magicEntry.amount).toBeGreaterThanOrEqual(1)
      expect(magicEntry.amount).toBeLessThanOrEqual(4)
    })
  })

  // ── rollCritical + rollFumble (Phase 3 session 6) ──────────────────

  test.describe('rollCritical', () => {
    test('adapter path fires when attack was adapter + natural crit (forced natural 20)', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Crit Adapter', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-CritSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            damage: '1d8',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        // Force natural 20 on every die roll so the attack is always a crit.
        // Foundry's Die#mapRandomFace = Math.ceil((1 - randomUniform) * faces);
        // so randomUniform near 0 → max face (20 on d20).
        globalThis.__origRandomUniform = CONFIG.Dice.randomUniform
        CONFIG.Dice.randomUniform = () => 0.0001
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Crit Adapter').items.getName('P1-CritSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Crit Adapter').rollWeaponAttack(id)
      }, weaponId)
      // Restore randomUniform BEFORE asserting — see backstab libResult test.
      await page.evaluate(() => {
        CONFIG.Dice.randomUniform = globalThis.__origRandomUniform
      })

      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-CritSword' })
      const critLine = await waitForAdapterLog('rollCritical')
      assertPath(critLine, 'adapter', { weapon: 'P1-CritSword' })
    })

    test('adapter path populates dcc.libCritResult chat flag', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Crit LibFlag', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-LibCritSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            damage: '1d8',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        globalThis.__origRandomUniform = CONFIG.Dice.randomUniform
        CONFIG.Dice.randomUniform = () => 0.0001
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Crit LibFlag').items.getName('P1-LibCritSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Crit LibFlag').rollWeaponAttack(id)
      }, weaponId)

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m => m.getFlag('dcc', 'isToHit') && m.getFlag('dcc', 'libCritResult'))
          if (msg) return msg.getFlag('dcc', 'libCritResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      await page.evaluate(() => {
        CONFIG.Dice.randomUniform = globalThis.__origRandomUniform
      })

      expect(flag, 'adapter-path crit must set dcc.libCritResult').not.toBeNull()
      expect(typeof flag.critDie).toBe('string')
      expect(flag.critDie).toMatch(/d\d+/)
      expect(typeof flag.natural).toBe('number')
      expect(flag.natural).toBeGreaterThanOrEqual(1)
      expect(typeof flag.total).toBe('number')
      expect(typeof flag.critTable).toBe('string')
      expect(Array.isArray(flag.modifiers)).toBe(true)
    })
  })

  test.describe('rollFumble', () => {
    test('adapter path fires when attack was adapter + natural 1 fumble', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Fumble Adapter', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-FumbleSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            damage: '1d6',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        // Force natural 1 → fumble on every die roll.
        // Foundry's Die#mapRandomFace = Math.ceil((1 - randomUniform) * faces);
        // so randomUniform near 1 → min face (1 on d20).
        globalThis.__origRandomUniform = CONFIG.Dice.randomUniform
        CONFIG.Dice.randomUniform = () => 0.9999
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Fumble Adapter').items.getName('P1-FumbleSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Fumble Adapter').rollWeaponAttack(id)
      }, weaponId)
      const attackLine = await waitForAdapterLog('rollWeaponAttack')
      assertPath(attackLine, 'adapter', { weapon: 'P1-FumbleSword' })
      const fumbleLine = await waitForAdapterLog('rollFumble')
      assertPath(fumbleLine, 'adapter', { weapon: 'P1-FumbleSword' })

      await page.evaluate(() => {
        CONFIG.Dice.randomUniform = globalThis.__origRandomUniform
      })
    })

    test('adapter path populates dcc.libFumbleResult chat flag', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Fumble LibFlag', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-LibFumbleSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+2',
            critRange: 20,
            damage: '1d6',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        globalThis.__origRandomUniform = CONFIG.Dice.randomUniform
        CONFIG.Dice.randomUniform = () => 0.9999
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 Fumble LibFlag').items.getName('P1-LibFumbleSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 Fumble LibFlag').rollWeaponAttack(id)
      }, weaponId)

      const flag = await page.evaluate(async () => {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const msg = game.messages.contents
            .slice()
            .reverse()
            .find(m => m.getFlag('dcc', 'isToHit') && m.getFlag('dcc', 'libFumbleResult'))
          if (msg) return msg.getFlag('dcc', 'libFumbleResult')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      })

      await page.evaluate(() => {
        CONFIG.Dice.randomUniform = globalThis.__origRandomUniform
      })

      expect(flag, 'adapter-path fumble must set dcc.libFumbleResult').not.toBeNull()
      expect(typeof flag.fumbleDie).toBe('string')
      expect(flag.fumbleDie).toMatch(/d\d+/)
      expect(typeof flag.natural).toBe('number')
      expect(typeof flag.total).toBe('number')
      expect(Array.isArray(flag.modifiers)).toBe(true)
    })

    test('D2 retirement: crit + fumble gate/legacy/adapter-alias methods are gone (session 16)', async ({ page }) => {
      // Session 16 folded the `!automate` branch into the adapter
      // path and deleted the legacy bodies. Guard against regressions
      // that reintroduce the dispatcher scaffold.
      const surface = await page.evaluate(() => {
        const proto = Object.getPrototypeOf(game.actors.contents.find(a => a.type === 'Player')) ||
          CONFIG.Actor.documentClass?.prototype
        return {
          hasCrit: typeof proto._rollCritical === 'function',
          hasFumble: typeof proto._rollFumble === 'function',
          hasCritGate: typeof proto._canRouteCritViaAdapter === 'function',
          hasFumbleGate: typeof proto._canRouteFumbleViaAdapter === 'function',
          hasCritLegacy: typeof proto._rollCriticalLegacy === 'function',
          hasFumbleLegacy: typeof proto._rollFumbleLegacy === 'function',
          hasCritAdapterAlias: typeof proto._rollCriticalViaAdapter === 'function',
          hasFumbleAdapterAlias: typeof proto._rollFumbleViaAdapter === 'function'
        }
      })
      expect(surface.hasCrit, '_rollCritical remains the public method').toBe(true)
      expect(surface.hasFumble, '_rollFumble remains the public method').toBe(true)
      expect(surface.hasCritGate, '_canRouteCritViaAdapter retired in D2').toBe(false)
      expect(surface.hasFumbleGate, '_canRouteFumbleViaAdapter retired in D2').toBe(false)
      expect(surface.hasCritLegacy, '_rollCriticalLegacy retired in D2').toBe(false)
      expect(surface.hasFumbleLegacy, '_rollFumbleLegacy retired in D2').toBe(false)
      expect(surface.hasCritAdapterAlias, '_rollCriticalViaAdapter folded into _rollCritical').toBe(false)
      expect(surface.hasFumbleAdapterAlias, '_rollFumbleViaAdapter folded into _rollFumble').toBe(false)
    })

    test('D2 damage retirement: gate/legacy/adapter-alias methods are gone (session 19)', async ({ page }) => {
      // Session 19 broadened the damage gate to exhaustion (multi-type,
      // dice-bearing, cursed, passthrough for unparseable) and collapsed
      // the dispatcher. `_rollDamage` is a single path whose body is the
      // former `_rollDamageViaAdapter`; the gate / legacy / via-adapter
      // alias are all deleted. Guard against regressions.
      const surface = await page.evaluate(() => {
        const proto = Object.getPrototypeOf(game.actors.contents.find(a => a.type === 'Player')) ||
          CONFIG.Actor.documentClass?.prototype
        return {
          hasDamage: typeof proto._rollDamage === 'function',
          hasBuildLibDamage: typeof proto._buildLibDamageResult === 'function',
          hasStructure: typeof proto._structureDamageInput === 'function',
          hasDamageGate: typeof proto._canRouteDamageViaAdapter === 'function',
          hasDamageLegacy: typeof proto._rollDamageLegacy === 'function',
          hasDamageAdapterAlias: typeof proto._rollDamageViaAdapter === 'function'
        }
      })
      expect(surface.hasDamage, '_rollDamage remains the single path').toBe(true)
      expect(surface.hasBuildLibDamage, '_buildLibDamageResult helper remains').toBe(true)
      expect(surface.hasStructure, '_structureDamageInput helper remains').toBe(true)
      expect(surface.hasDamageGate, '_canRouteDamageViaAdapter retired in D2 damage').toBe(false)
      expect(surface.hasDamageLegacy, '_rollDamageLegacy retired in D2 damage').toBe(false)
      expect(surface.hasDamageAdapterAlias, '_rollDamageViaAdapter folded into _rollDamage').toBe(false)
    })

    test('C1 cruft: critText/fumbleText shims retired from rollWeaponAttack messageData', async ({ page }) => {
      // C1 cruft slice: the DCC system previously emitted both the
      // canonical `critResult` / `fumbleResult` AND the legacy aliases
      // `critText` / `fumbleText` on the weapon-attack chat
      // `messageData.system`. The aliases were labeled "Legacy name for
      // dcc-qol compatibility" and are now retired. Guard that the
      // canonical fields are still emitted and the shim aliases are not.
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 C1 Shim Guard', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-ShimGuardSword',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+0',
            critRange: 20,
            damage: '1d6',
            melee: true,
            equipped: true
          }
        }])
        await game.settings.set('dcc', 'automateDamageFumblesCrits', true)
        globalThis.__c1CapturedSystem = null
        globalThis.__c1HookId = Hooks.on('dcc.rollWeaponAttack', (rolls, messageData) => {
          globalThis.__c1CapturedSystem = {
            hasCritResult: 'critResult' in messageData.system,
            hasFumbleResult: 'fumbleResult' in messageData.system,
            hasCritText: 'critText' in messageData.system,
            hasFumbleText: 'fumbleText' in messageData.system
          }
        })
      })
      const weaponId = await page.evaluate(() => {
        return game.actors.getName('P1 C1 Shim Guard').items.getName('P1-ShimGuardSword').id
      })
      await page.evaluate(async (id) => {
        await game.actors.getName('P1 C1 Shim Guard').rollWeaponAttack(id)
      }, weaponId)

      const captured = await page.evaluate(() => {
        Hooks.off('dcc.rollWeaponAttack', globalThis.__c1HookId)
        return globalThis.__c1CapturedSystem
      })

      expect(captured, 'dcc.rollWeaponAttack hook must have fired').not.toBeNull()
      expect(captured.hasCritResult, 'messageData.system.critResult stays as the canonical field').toBe(true)
      expect(captured.hasFumbleResult, 'messageData.system.fumbleResult stays as the canonical field').toBe(true)
      expect(captured.hasCritText, 'messageData.system.critText shim retired in C1').toBe(false)
      expect(captured.hasFumbleText, 'messageData.system.fumbleText shim retired in C1').toBe(false)
    })
  })
})
