const { test, expect } = require('@playwright/test')
const { FOUNDRY_URL, markWelcomeTourDone } = require('./fixtures')

/**
 * E2E tests for Mighty Deed table prompts (issue #319; inline-lookup rework #786)
 * Create a world deed table, attack with a warrior until the deed die
 * succeeds (3+), and verify the attack chat card offers the deed table
 * picker — and that choosing a table looks the (already-rolled) deed die
 * result up *inline* on the same card (no new roll, no separate chat
 * message, no "Roll Deed" button) and persists the choice on the message.
 *
 * PREREQUISITES:
 * 1. Start Foundry: npx @foundryvtt/foundryvtt-cli launch --world=v14
 * 2. Run tests: npm test
 *
 * The tests will automatically log in as Gamemaster (no password).
 */

/* global game, ui, Actor, Combat, RollTable, Scene, CONFIG, CONST, document */

/**
 * Create the test fixtures in the live world: a Mighty Deed roll table
 * and a warrior with a deed die attack bonus and an equipped weapon.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{actorId: string, weaponId: string, registryEntry: object}>}
 */
async function createDeedFixtures (page) {
  return page.evaluate(async () => {
    await RollTable.create({
      name: 'E2E Deed Table',
      formula: '1d7',
      results: [
        { type: CONST.TABLE_RESULT_TYPES.TEXT, description: 'Off-balance: enemy gets a Ref save or is knocked prone.', range: [3, 3] },
        { type: CONST.TABLE_RESULT_TYPES.TEXT, description: 'Knockdown: a human-sized opponent is knocked prone.', range: [4, 4] },
        { type: CONST.TABLE_RESULT_TYPES.TEXT, description: 'Throw: the opponent is knocked down and thrown 10 feet.', range: [5, 99] }
      ]
    })

    const actor = await Actor.create({
      name: 'E2E Warrior',
      type: 'Player',
      system: {
        details: { sheetClass: 'Warrior', attackBonus: '+d4' },
        class: { className: 'Warrior' },
        config: { attackBonusMode: 'autoPerAttack' }
      }
    })
    const [weapon] = await actor.createEmbeddedDocuments('Item', [{
      name: 'E2E Longsword',
      type: 'weapon',
      system: { actionDie: '1d20', toHit: '@ab', damage: '1d8+@ab', melee: true, equipped: true }
    }])

    return {
      actorId: actor.id,
      weaponId: weapon.id,
      registryEntry: CONFIG.DCC.mightyDeedsTables['E2E Deed Table']
    }
  })
}

/**
 * Attack with the warrior's weapon until the deed die result matches the
 * wanted success state, and return that attack's chat message data.
 * @param {import('@playwright/test').Page} page
 * @param {{actorId: string, weaponId: string}} ids
 * @param {boolean} wantSuccess - true to stop on a deed of 3+, false to stop on a failed deed
 */
async function attackUntilDeed (page, ids, wantSuccess) {
  return page.evaluate(async ({ actorId, weaponId, wantSuccess }) => {
    const actor = game.actors.get(actorId)
    for (let attempt = 0; attempt < 30; attempt++) {
      const before = game.messages.size
      await actor.rollWeaponAttack(weaponId)
      // rollWeaponAttack does not await its ChatMessage.create, so wait for the card to land
      for (let w = 0; w < 50 && game.messages.size === before; w++) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      const msg = game.messages.contents.at(-1)
      // deedRollSuccess already folds in the hit verdict (#1018): a fumble is
      // never a successful deed, so no separate miss-skip is needed.
      if (game.messages.size > before && Boolean(msg.system?.deedRollSuccess) === wantSuccess) {
        return {
          messageId: msg.id,
          natural: msg.getFlag('dcc', 'libResult')?.natural,
          deedDieRollResult: msg.system.deedDieRollResult,
          deedRollSuccess: msg.system.deedRollSuccess,
          deedNeedsHitNote: msg.system.deedNeedsHitNote,
          deedTables: msg.system.deedTables,
          contentHasPrompt: msg.content.includes('deed-table-prompt')
        }
      }
    }
    return null
  }, { ...ids, wantSuccess })
}

/**
 * Attack once with every die pinned (CONFIG.Dice.randomUniform: natural =
 * ceil((1 - u) * faces)), optionally against a targeted token of the given
 * AC, and read back the message plus its rendered emote / enhanced card.
 * @param {import('@playwright/test').Page} page
 * @param {{actorId: string, weaponId: string}} ids
 * @param {{uniform: number, targetAC?: number|null, enhanced?: boolean}} opts
 */
async function rollPinnedDeed (page, ids, { uniform, targetAC = null, enhanced = false }) {
  return page.evaluate(async ({ actorId, weaponId, uniform, targetAC, enhanced }) => {
    if (!game.canvas?.ready || !game.canvas?.scene) {
      const scene = await Scene.create({ name: 'E2E Deed Probe', width: 4000, height: 3000, grid: { type: 1, size: 100, distance: 5, units: 'ft' } })
      await scene.view()
    }
    const scene = game.canvas.scene
    const actor = game.actors.get(actorId)
    const prevEnhanced = game.settings.get('dcc', 'enhancedAttackCards')
    const origRandomUniform = CONFIG.Dice.randomUniform
    let target = null
    let tokenDoc = null
    try {
      await game.settings.set('dcc', 'enhancedAttackCards', enhanced)
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }))
      if (targetAC !== null) {
        target = await Actor.create({ name: 'E2E Deed Target', type: 'NPC', system: { attributes: { hp: { value: 30, max: 30 }, ac: { value: targetAC } } }, prototypeToken: { actorLink: true } })
        ;[tokenDoc] = await scene.createEmbeddedDocuments('Token', [{ name: 'E2E Deed Target', actorId: target.id, actorLink: true, x: 500, y: 500, width: 1, height: 1, disposition: -1 }])
        const tokenDeadline = Date.now() + 3000
        while (Date.now() < tokenDeadline && !game.canvas.tokens.get(tokenDoc.id)) await new Promise(resolve => setTimeout(resolve, 50))
        game.canvas.tokens.get(tokenDoc.id).setTarget(true, { releaseOthers: true })
      }

      CONFIG.Dice.randomUniform = () => uniform
      const before = new Set(game.messages.contents.map(m => m.id))
      await actor.rollWeaponAttack(weaponId)
      CONFIG.Dice.randomUniform = origRandomUniform

      const deadline = Date.now() + 5000
      while (Date.now() < deadline) {
        const msg = game.messages.contents.find(m => !before.has(m.id) && m.getFlag('dcc', 'isToHit'))
        const el = msg && document.querySelector(`.message[data-message-id="${msg.id}"]`)
        const rendered = el && (enhanced ? el.querySelector('.dcc-enhanced-card') : el.querySelector('.message-content'))
        if (rendered) {
          return {
            natural: msg.getFlag('dcc', 'libResult')?.natural,
            hitsTarget: msg.getFlag('dcc', 'hitsTarget'),
            deedDieRollResult: msg.system.deedDieRollResult,
            deedRollSuccess: msg.system.deedRollSuccess,
            deedTables: msg.system.deedTables,
            hasPicker: !!rendered.querySelector('.deed-table-prompt'),
            hasNote: !!rendered.querySelector('.deed-needs-hit-note'),
            // Enhanced card: the deed line; emote: the inline deed die span.
            deedStyledSuccess: enhanced
              ? !!rendered.querySelector('.deed-result.critical')
              : !!rendered.querySelector(`.inline-roll.critical[title="${msg.system.deedDieFormula}"]`)
          }
        }
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      return null
    } finally {
      CONFIG.Dice.randomUniform = origRandomUniform
      if (tokenDoc) {
        game.canvas.tokens.get(tokenDoc.id)?.setTarget(false, { releaseOthers: true })
        await scene.deleteEmbeddedDocuments('Token', [tokenDoc.id])
      }
      await target?.delete()
      await game.settings.set('dcc', 'enhancedAttackCards', prevEnhanced)
    }
  }, { ...ids, uniform, targetAC, enhanced })
}

/**
 * Toggle the `mightyDeedsEnabled` world setting (issue #319, on by default since #962).
 * @param {import('@playwright/test').Page} page
 * @param {boolean} enabled
 */
async function setMightyDeedsEnabled (page, enabled) {
  await page.evaluate((value) => game.settings.set('dcc', 'mightyDeedsEnabled', value), enabled)
}

test.describe('Mighty Deeds E2E Tests', () => {
  let consoleErrors = []
  let priorDeedsEnabled

  test.beforeAll(async () => {
    let serverUp
    try {
      const response = await fetch(`${FOUNDRY_URL}/`, { signal: AbortSignal.timeout(5000) })
      serverUp = response.ok
    } catch {
      serverUp = false
    }
    if (!serverUp) {
      throw new Error(
        `Could not connect to Foundry VTT at ${FOUNDRY_URL}.\n\n` +
        'Please start Foundry before running tests:\n' +
        '1. Run: npx @foundryvtt/foundryvtt-cli launch --world=v14\n' +
        '2. Run tests again: npm test'
      )
    }
  })

  test.beforeEach(async ({ page }) => {
    consoleErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.setViewportSize({ width: 1280, height: 800 })

    await page.goto(`${FOUNDRY_URL}/join`)
    await page.waitForTimeout(1000)

    const isInGame = await page.locator('.game.system-dcc').isVisible({ timeout: 1000 }).catch(() => false)

    if (!isInGame) {
      const userSelect = page.locator('select[name="userId"]')
      await userSelect.waitFor({ state: 'visible', timeout: 10000 })
      await markWelcomeTourDone(page)
      await page.selectOption('select[name="userId"]', { label: 'Gamemaster' })
      await page.click('button[name="join"]')
      await page.waitForSelector('.game.system-dcc', { timeout: 30000 })
    }

    await page.waitForSelector('#actors', { timeout: 10000, state: 'attached' })

    // System settings register in the async ready hook on every client
    // load - sheet renders read them, so wait until registration is done
    await page.waitForFunction(() => game.settings?.settings?.has('dcc.coinWeight'), { timeout: 15000 })

    // Remove any Foundry notification banners
    await page.evaluate(() => document.querySelectorAll('#notifications .notification').forEach(n => n.remove()))

    // Clean up leftover test entities from previous runs
    await page.evaluate(async () => {
      for (const actor of game.actors.filter(a => a.name.startsWith('E2E '))) {
        await actor.delete()
      }
      for (const table of game.tables.filter(t => t.name.startsWith('E2E '))) {
        await table.delete()
      }
    })

    // Start each test with the deed prompt off for isolation (issue #319);
    // afterEach restores the world's value
    priorDeedsEnabled = await page.evaluate(() => game.settings.get('dcc', 'mightyDeedsEnabled'))
    await setMightyDeedsEnabled(page, false)

    // Close any welcome dialogs
    for (const selector of ['#dcc-welcome-dialog', '#dcc-core-book-welcome-dialog']) {
      const dialog = page.locator(selector)
      if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
      }
    }
  })

  test.afterEach(async ({ page }) => {
    await setMightyDeedsEnabled(page, priorDeedsEnabled)
    const significantErrors = consoleErrors.filter(err => !err.includes('favicon.ico'))
    expect(significantErrors, `Console errors detected: ${significantErrors.join('\n')}`).toHaveLength(0)
  })

  test('world tables with Deed in the name register and unregister', async ({ page }) => {
    const fixtures = await createDeedFixtures(page)

    // The createRollTable hook picked the world table up immediately
    expect(fixtures.registryEntry).toEqual({ name: 'E2E Deed Table', path: 'E2E Deed Table' })

    // Deleting the table removes it from the registry
    const afterDelete = await page.evaluate(async () => {
      await game.tables.getName('E2E Deed Table').delete()
      return CONFIG.DCC.mightyDeedsTables['E2E Deed Table'] || null
    })
    expect(afterDelete).toBeNull()
  })

  test('a successful deed offers the picker and looks the result up inline (no button, no new message)', async ({ page }) => {
    const fixtures = await createDeedFixtures(page)
    await setMightyDeedsEnabled(page, true)

    const success = await attackUntilDeed(page, fixtures, true)
    expect(success, 'no successful deed in 30 attacks').not.toBeNull()
    expect(success.deedDieRollResult).toBeGreaterThanOrEqual(3)
    // Other deed tables may be registered too (e.g. the dcc-core-book pack)
    expect(success.deedTables).toContainEqual({ name: 'E2E Deed Table', path: 'E2E Deed Table' })
    expect(success.contentHasPrompt).toBe(true)
    // No target, so the deed only counts if the attack hits (#1018) — unless
    // the action die rolled its max, which always hits.
    if (success.natural === 20) {
      expect(success.deedNeedsHitNote).toBeFalsy()
    } else {
      expect(success.deedNeedsHitNote).toBe(await page.evaluate(() => game.i18n.localize('DCC.DeedNeedsHitNote')))
    }

    // Bring the card into view
    await page.evaluate(() => ui.sidebar.expand())
    await page.click('button[data-tab="chat"]')
    await page.waitForTimeout(500)
    await page.evaluate(() => ui.chat.scrollBottom({ immediate: true }))
    const card = page.locator(`#chat .chat-message[data-message-id="${success.messageId}"]`)

    // Picking a deed is a lookup of the already-rolled deed die, not a new roll:
    // there is no "Roll Deed" button, nothing is preselected (a disabled
    // "Choose Deed" placeholder leads), and no result shows until a table is picked.
    await expect(card.locator('.roll-deed-table')).toHaveCount(0)
    const select = card.locator('.deed-table-select')
    await expect(select).toBeVisible()
    expect(await select.inputValue(), 'nothing preselected — placeholder is empty').toBe('')
    await expect(card.locator('.deed-table-result'), 'no lookup shown until a table is picked').toHaveCount(0)

    // The attack sentence must stay intact: the block-level deed table picker
    // renders *after* the "…for X points of damage!" sentence, not spliced into
    // the middle of it (bug: the deed/damage emote text was cut apart because the
    // picker landed between "deed roll of N" and "for X points of damage!").
    const emoteOrder = await card.evaluate((el) => {
      const html = (el.querySelector('.message-content') ?? el).innerHTML
      return { damageIdx: html.indexOf('points of damage'), promptIdx: html.indexOf('deed-table-prompt') }
    })
    expect(emoteOrder.damageIdx, 'damage sentence present in emote').toBeGreaterThan(-1)
    expect(emoteOrder.promptIdx, 'deed picker renders after the damage sentence, not inside it').toBeGreaterThan(emoteOrder.damageIdx)

    // Pick the test table → the looked-up result renders inline on the SAME card,
    // and no new chat message is posted.
    const messagesBefore = await page.evaluate(() => game.messages.size)
    await select.selectOption('E2E Deed Table')

    const result = card.locator('.deed-table-result')
    await expect(result).toBeVisible({ timeout: 10000 })
    // The inline result is the table entry matching the deed die value
    const expected = {
      3: 'Off-balance',
      4: 'Knockdown'
    }[success.deedDieRollResult] || 'Throw'
    await expect(result).toContainText(expected)

    // No standalone Mighty Deed message was created — the lookup is inline now,
    // whereas the old "Roll Deed" flow posted a separate chat message. The
    // unchanged message count proves nothing new was posted (a global
    // isMightyDeed scan would false-positive on stale messages from old runs).
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => game.messages.size)).toBe(messagesBefore)

    // The choice is persisted on the message (shared with other viewers / GM)
    expect(
      await page.evaluate((id) => game.messages.get(id).getFlag('dcc', 'deedSelectedTable'), success.messageId)
    ).toBe('E2E Deed Table')

    // ...and survives a re-render (as clicking Damage/Crit later would trigger):
    // the picker reflects the stored choice and the result is re-derived from it.
    await page.evaluate((id) => ui.chat.updateMessage(game.messages.get(id)), success.messageId)
    const reRendered = page.locator(`#chat .chat-message[data-message-id="${success.messageId}"]`)
    await expect(reRendered.locator('.deed-table-result')).toContainText(expected)
    expect(await reRendered.locator('.deed-table-select').inputValue()).toBe('E2E Deed Table')
  })

  test('a failed deed shows no table prompt', async ({ page }) => {
    const fixtures = await createDeedFixtures(page)
    await setMightyDeedsEnabled(page, true)

    const failure = await attackUntilDeed(page, fixtures, false)
    expect(failure, 'no failed deed in 30 attacks').not.toBeNull()
    // Usually a deed die under 3; a fumble with a 3+ also fails (#1018).
    expect(failure.deedRollSuccess).toBeFalsy()
    expect(failure.deedTables).toEqual([])
    expect(failure.contentHasPrompt).toBe(false)
  })

  test('with the setting disabled, a successful deed shows no prompt', async ({ page }) => {
    const fixtures = await createDeedFixtures(page)
    // mightyDeedsEnabled is left off by beforeEach.
    // The table is still registered, but the attack card must not offer it.
    expect(fixtures.registryEntry).toEqual({ name: 'E2E Deed Table', path: 'E2E Deed Table' })

    const success = await attackUntilDeed(page, fixtures, true)
    expect(success, 'no successful deed in 30 attacks').not.toBeNull()
    expect(success.deedDieRollResult).toBeGreaterThanOrEqual(3)
    // Feature off: no tables attached and no prompt rendered even on a deed success
    expect(success.deedTables).toEqual([])
    expect(success.contentHasPrompt).toBe(false)
  })

  // The roll modifier dialog rewrites the damage formula with explicit die
  // counts ("+d4" -> "+1d4"). Damage must still reuse the attack's deed roll
  // rather than rolling the deed die again — including when the weapon's own
  // damage carries a signed die the same size as the deed die ("1d6+1d4").
  test('damage reuses the attack deed roll after the roll modifier dialog', async ({ page }) => {
    const previousAutomate = await page.evaluate(() => game.settings.get('dcc', 'automateDamageFumblesCrits'))
    await page.evaluate(() => game.settings.set('dcc', 'automateDamageFumblesCrits', true))

    try {
      const ids = await page.evaluate(async () => {
        const actor = await Actor.create({
          name: 'E2E Dialog Warrior',
          type: 'Player',
          system: {
            details: { sheetClass: 'Warrior', attackBonus: '+d4' },
            class: { className: 'Warrior' },
            config: { attackBonusMode: 'autoPerAttack' }
          }
        })
        const weapons = await actor.createEmbeddedDocuments('Item', [
          { name: 'E2E Plain Sword', type: 'weapon', system: { actionDie: '1d20', toHit: '@ab', damageWeapon: '1d8', melee: true, equipped: true } },
          { name: 'E2E Flame Sword', type: 'weapon', system: { actionDie: '1d20', toHit: '@ab', damageWeapon: '1d6+1d4', melee: true, equipped: true } }
        ])
        // Keyed by name: createEmbeddedDocuments does not guarantee the
        // returned array matches the input order.
        return { actorId: actor.id, weaponIds: Object.fromEntries(weapons.map(w => [w.name, w.id])) }
      })

      // [weapon name, d4 dice that belong to the weapon's own damage]
      for (const [weaponName, weaponD4Count] of [['E2E Plain Sword', 0], ['E2E Flame Sword', 1]]) {
        const weaponId = ids.weaponIds[weaponName]
        const messagesBefore = await page.evaluate(() => game.messages.size)
        await page.evaluate(({ actorId, weaponId }) => {
          window.__deedDialogAttack = game.actors.get(actorId).rollWeaponAttack(weaponId, { showModifierDialog: true })
        }, { actorId: ids.actorId, weaponId })

        const rollBtn = page.locator('.dcc-roll-modifier button.roll').first()
        await rollBtn.waitFor({ state: 'visible', timeout: 5000 })
        await rollBtn.click()

        const result = await page.evaluate(async ({ messagesBefore }) => {
          await window.__deedDialogAttack
          const deadline = Date.now() + 5000
          while (Date.now() < deadline && game.messages.size === messagesBefore) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
          const msg = game.messages.contents.at(-1)
          const damageRoll = msg?.rolls.find(r => r.options?.dcc?.isDamageRoll)
          if (!damageRoll) return null
          return {
            deedDieRollResult: msg.system.deedDieRollResult,
            damageFormula: damageRoll.formula,
            damageD4Count: damageRoll.dice.filter(d => d.faces === 4).length
          }
        }, { messagesBefore })

        expect(result, `attack with ${weaponName} posted a damage roll`).not.toBeNull()
        expect(result.deedDieRollResult).toBeGreaterThanOrEqual(1)
        // The deed die was substituted by its attack result, not rolled again;
        // only the weapon's own d4s remain as dice in the damage roll.
        expect(result.damageD4Count, `${weaponName} damage formula ${result.damageFormula}`).toBe(weaponD4Count)
        expect(result.damageFormula).toMatch(new RegExp(`\\+\\s*${result.deedDieRollResult}(?!\\d)`))
      }
    } finally {
      await page.evaluate((value) => game.settings.set('dcc', 'automateDamageFumblesCrits', value), previousAutomate)
    }
  })

  // u = 0.45 pins the d4 deed die to a 3 on the attack; u = 0.7 pins it to a 2
  // on rollAttackBonus. Only the die is stored; each shorthand is its own
  // attack value with the die replaced by that roll (#1041). Str 16 = +2.
  for (const [attackBonus, flat] of [['+d4', 0], ['+d4+1', 1]]) {
    test(`${attackBonus}: the attack shorthands carry the last deed roll, from an attack or rollAttackBonus (#1041)`, async ({ page }) => {
      const ids = await createDeedFixtures(page)
      await page.evaluate(({ actorId, attackBonus }) => game.actors.get(actorId).update({
        'system.details.attackBonus': attackBonus,
        'system.abilities.str.value': 16
      }), { ...ids, attackBonus })

      const shorthands = () => page.evaluate(({ actorId }) => {
        const actor = game.actors.get(actorId)
        const { ab, mab, mad, rab, rad } = actor.getRollData()
        return { stored: actor.system.details.lastRolledAttackBonus, ab, mab, mad, rab, rad }
      }, ids)
      const expected = (die) => ({ stored: die, ab: die + flat, mab: die + 2 + flat, mad: die + 2 + flat, rab: die + flat, rad: die + flat })

      const attack = await rollPinnedDeed(page, ids, { uniform: 0.45 })
      expect(attack?.deedDieRollResult).toBe(3)
      expect(await shorthands()).toEqual(expected(3))

      const standalone = await page.evaluate(async ({ actorId }) => {
        const actor = game.actors.get(actorId)
        const origRandomUniform = CONFIG.Dice.randomUniform
        CONFIG.Dice.randomUniform = () => 0.7
        let result
        try {
          result = await actor.rollAttackBonus()
        } finally {
          CONFIG.Dice.randomUniform = origRandomUniform
        }
        const msg = game.messages.contents.findLast(m => m.getFlag('dcc', 'RollType') === 'AttackBonus')
        return { returned: result.attackBonus, messageTotal: msg?.rolls[0]?.total, deedDie: msg?.rolls[0]?.dice[0]?.total }
      }, ids)
      expect(standalone).toEqual({ returned: 2 + flat, messageTotal: 2 + flat, deedDie: 2 })
      expect(await shorthands()).toEqual(expected(2))
    })
  }

  test('in combat only a deed from the current round counts (#1041)', async ({ page }) => {
    const ids = await createDeedFixtures(page)
    await page.evaluate(({ actorId }) => game.actors.get(actorId).update({ 'system.details.attackBonus': '+d4+1' }), ids)
    const abNow = () => page.evaluate(({ actorId }) => game.actors.get(actorId).getRollData().ab, ids)

    // A deed rolled before the fight counts until the actor is fighting
    await page.evaluate(({ actorId }) => game.actors.get(actorId).rememberDeedDie(2), ids)
    expect(await abNow()).toBe(3)

    const combatId = await page.evaluate(async ({ actorId }) => {
      for (const combat of game.combats.filter(c => c.combatants.some(cb => cb.actor?.name?.startsWith('E2E ')))) {
        await combat.delete()
      }
      const combat = await Combat.create({})
      await combat.createEmbeddedDocuments('Combatant', [{ actorId }])
      await combat.startCombat()
      return combat.id
    }, ids)

    try {
      expect(await abNow()).toBe(1) // in a started combat: the pre-combat deed no longer counts

      const attack = await rollPinnedDeed(page, ids, { uniform: 0.45 })
      expect(attack?.deedDieRollResult).toBe(3)
      const stamp = await page.evaluate(({ actorId }) => {
        const { lastRolledAttackBonusCombat, lastRolledAttackBonusRound } = game.actors.get(actorId).system.details
        return { combat: lastRolledAttackBonusCombat, round: lastRolledAttackBonusRound }
      }, ids)
      expect(stamp).toEqual({ combat: combatId, round: 1 })
      expect(await abNow()).toBe(4)

      await page.evaluate((id) => game.combats.get(id).nextRound(), combatId)
      expect(await abNow()).toBe(1) // next round: no deed, flat part only

      await page.evaluate((id) => game.combats.get(id).previousRound(), combatId)
      expect(await abNow()).toBe(4) // stepped back: the deed counts again
    } finally {
      await page.evaluate((id) => game.combats.get(id)?.delete(), combatId)
    }
    expect(await abNow()).toBe(1) // combat over: the deed no longer counts
  })

  test('a useDeed skill adds the last deed roll plus the flat part (#1041)', async ({ page }) => {
    const ids = await createDeedFixtures(page)
    const totals = await page.evaluate(async ({ actorId }) => {
      const actor = game.actors.get(actorId)
      await actor.update({ 'system.details.attackBonus': '+d4+1', 'system.skills.shieldBash.useDeed': true })
      const origRandomUniform = CONFIG.Dice.randomUniform
      const rollShieldBash = async (die) => {
        await actor.rememberDeedDie(die)
        const before = new Set(game.messages.contents.map(m => m.id))
        CONFIG.Dice.randomUniform = () => 0.5
        try {
          await actor.rollSkillCheck('shieldBash')
        } finally {
          CONFIG.Dice.randomUniform = origRandomUniform
        }
        const deadline = Date.now() + 5000
        while (Date.now() < deadline) {
          const msg = game.messages.contents.find(m => !before.has(m.id) && m.rolls.length)
          if (msg) return msg.rolls[0].total
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      }
      return { withDeed: await rollShieldBash(3), withoutDeed: await rollShieldBash(0) }
    }, ids)
    expect(totals.withDeed).not.toBeNull()
    expect(totals.withDeed - totals.withoutDeed).toBe(4)
  })

  test('rollAttackBonus with a flat bonus returns it without rolling or storing (#1041)', async ({ page }) => {
    const ids = await createDeedFixtures(page)
    const result = await page.evaluate(async ({ actorId }) => {
      const actor = game.actors.get(actorId)
      await actor.update({ 'system.details.attackBonus': '+2', 'system.details.lastRolledAttackBonus': 4 })
      const before = game.messages.size
      const returned = await actor.rollAttackBonus()
      return { returned, stored: actor.system.details.lastRolledAttackBonus, newMessages: game.messages.size - before }
    }, ids)
    expect(result).toEqual({ returned: { rolled: false, attackBonus: 2 }, stored: 4, newMessages: 0 })
  })

  // A deed needs a 3+ AND a hit (#1018). u = 0.45 pins the action die to a
  // natural 11 and the d4 deed die to a 3: total 14, so AC 30 misses and AC 10 hits.
  for (const enhanced of [false, true]) {
    const card = enhanced ? 'enhanced card' : 'emote'
    test(`${card}: a 3+ deed that misses the target is not a deed`, async ({ page }) => {
      const fixtures = await createDeedFixtures(page)
      await setMightyDeedsEnabled(page, true)

      const result = await rollPinnedDeed(page, fixtures, { uniform: 0.45, targetAC: 30, enhanced })
      expect(result, 'attack card did not render').not.toBeNull()
      expect(result.natural).toBe(11)
      expect(result.deedDieRollResult).toBe(3)
      expect(result.hitsTarget).toBe(false)
      expect(result.deedRollSuccess).toBe(false)
      expect(result.deedTables).toEqual([])
      expect(result.hasPicker).toBe(false)
      expect(result.hasNote).toBe(false)
      expect(result.deedStyledSuccess).toBe(false)
    })

    test(`${card}: a 3+ deed that hits the target offers the picker, with no note`, async ({ page }) => {
      const fixtures = await createDeedFixtures(page)
      await setMightyDeedsEnabled(page, true)

      const result = await rollPinnedDeed(page, fixtures, { uniform: 0.45, targetAC: 10, enhanced })
      expect(result, 'attack card did not render').not.toBeNull()
      expect(result.hitsTarget).toBe(true)
      expect(result.deedRollSuccess).toBe(true)
      expect(result.hasPicker).toBe(true)
      expect(result.hasNote).toBe(false)
      expect(result.deedStyledSuccess).toBe(true)
    })

    test(`${card}: an untargeted 3+ deed offers the picker with a needs-a-hit note`, async ({ page }) => {
      const fixtures = await createDeedFixtures(page)
      await setMightyDeedsEnabled(page, true)

      const result = await rollPinnedDeed(page, fixtures, { uniform: 0.45, enhanced })
      expect(result, 'attack card did not render').not.toBeNull()
      expect(result.hitsTarget).toBeUndefined()
      expect(result.deedRollSuccess).toBe(true)
      expect(result.hasPicker).toBe(true)
      expect(result.hasNote).toBe(true)
      expect(result.deedStyledSuccess).toBe(true)
    })
  }
})
