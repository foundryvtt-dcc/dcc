/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { test, expect } = require('@playwright/test')

/**
 * Phase 1 adapter-dispatch validation.
 *
 * For every Phase 1 roll (ability check, save, skill check, initiative)
 * this spec drives the public `DCCActor` method in a live Foundry, then
 * asserts the `[DCC adapter] <rollType> -> <via adapter|LEGACY path>`
 * console log emitted by `module/adapter/debug.mjs`. The log is the
 * signal the session-start prompt uses to verify the dispatcher picks
 * the intended branch; this spec makes that check automatic.
 *
 * The spec is gated on the dispatch logging being present in
 * `module/actor.js`. When the Phase 1 cleanup commit strips
 * `logDispatch`, this file should be deleted (or re-targeted at
 * chat-message flags / libResult payloads, which survive the cleanup).
 *
 * PREREQUISITES:
 * 1. Start Foundry: npx @foundryvtt/foundryvtt-cli launch --world=automated_testing
 * 2. Run tests: npm test -- phase1-adapter-dispatch.spec.js
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
})
