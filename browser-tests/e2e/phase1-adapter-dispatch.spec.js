/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { test, expect } = require('@playwright/test')

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
  const ADAPTER_TAG = '[DCC adapter]'
  const adapterLogs = []
  const consoleErrors = []

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

    page.on('console', msg => {
      const text = msg.text()
      if (text.includes(ADAPTER_TAG)) {
        adapterLogs.push(text)
      }
      if (msg.type() === 'error') {
        consoleErrors.push(text)
      }
    })

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

    await page.waitForSelector('#actors', { timeout: 10000, state: 'attached' })
    await page.evaluate(() => document.querySelectorAll('#notifications .notification').forEach(n => n.remove()))
    await page.waitForFunction(() => game?.dcc?.KeyState !== undefined, { timeout: 10000 })

    await page.evaluate(async () => {
      for (const app of Object.values(ui.windows)) { await app.close() }
      for (const actor of game.actors.filter(a => a.name.startsWith('P1 '))) { await actor.delete() }
    })

    const dccDialog = page.locator('#dcc-welcome-dialog')
    if (await dccDialog.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press('Escape')
    }
    const coreBookDialog = page.locator('#dcc-core-book-welcome-dialog')
    if (await coreBookDialog.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press('Escape')
    }
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
  async function waitForAdapterLog (rollType, { timeoutMs = 3000, pollMs = 50 } = {}) {
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
      const line = await waitForAdapterLog('rollWeaponAttack')
      assertPath(line, 'adapter', { weapon: 'P1-Longsword' })
    })

    test('options.backstab → legacy', async ({ page }) => {
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'P1 Weapon Backstab', type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: 'P1-BackstabDagger',
          type: 'weapon',
          system: {
            actionDie: '1d20',
            toHit: '+1',
            critRange: 20,
            damage: '1d4',
            backstabDamage: '1d4',
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
      const line = await waitForAdapterLog('rollWeaponAttack')
      assertPath(line, 'legacy', { weapon: 'P1-BackstabDagger' })
    })

    test('showModifierDialog flag → legacy', async ({ page }) => {
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
      assertPath(line, 'legacy', { weapon: 'P1-DialogSword' })
    })

    test('automate off → legacy', async ({ page }) => {
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
      assertPath(line, 'legacy', { weapon: 'P1-NoAutomateSword' })
    })
  })
})
