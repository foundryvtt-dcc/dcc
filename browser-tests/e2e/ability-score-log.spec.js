/* eslint-disable no-undef -- Browser globals (game, Actor, ui, etc.) used in page.evaluate callbacks */
const { test, expect } = require('@playwright/test')

/**
 * E2E tests for the Ability Score Change Log
 *
 * Scenario from the design doc: enable the setting, click Str, pick
 * Spellburn, apply -3, open the log, click Heal twice, verify value +2 and
 * the row shows "healed 2/3"; a third click fully heals and dims the row.
 *
 * PREREQUISITES:
 * 1. Start Foundry: npx @foundryvtt/foundryvtt-cli launch --world=v14
 * 2. Run tests: npm test
 */

test.describe('DCC Ability Score Log E2E Tests', () => {
  let consoleErrors = []

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
    consoleErrors = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
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

    // Remove notification banners
    await page.evaluate(() => document.querySelectorAll('#notifications .notification').forEach(n => n.remove()))

    // Wait for DCC system ready hook to complete (settings register in the async ready hook)
    await page.waitForFunction(() => game?.dcc?.KeyState !== undefined, { timeout: 10000 })

    // Clean up leftover test data, close windows, and enable the setting
    await page.evaluate(async () => {
      for (const app of Object.values(ui.windows)) {
        await app.close()
      }
      for (const actor of game.actors.filter(a => a.name.startsWith('ASL '))) {
        await actor.delete()
      }
      await game.settings.set('dcc', 'enableAbilityScoreLog', true)
    })

    // Close welcome dialogs
    const dccDialog = page.locator('#dcc-welcome-dialog')
    if (await dccDialog.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }
    const coreBookDialog = page.locator('#dcc-core-book-welcome-dialog')
    if (await coreBookDialog.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }
  })

  test.afterEach(async ({ page }) => {
    // Clean up test data and disable the setting again
    await page.evaluate(async () => {
      for (const app of Object.values(ui.windows)) {
        await app.close()
      }
      for (const actor of game.actors.filter(a => a.name.startsWith('ASL '))) {
        await actor.delete()
      }
      await game.settings.set('dcc', 'enableAbilityScoreLog', false)
    }).catch(() => {}) // Don't fail cleanup

    const significantErrors = consoleErrors.filter(err =>
      !err.includes('favicon.ico')
    )
    expect(significantErrors, `Console errors detected: ${significantErrors.join('\n')}`).toHaveLength(0)
  })

  /**
   * Create a level 2 wizard with Str 12/12 and open its sheet
   */
  async function createAndOpenActor (page) {
    await page.evaluate(async () => {
      const actor = await Actor.create({
        name: 'ASL Test Wizard',
        type: 'Player',
        system: {
          abilities: { str: { value: 12, max: 12 } },
          details: { level: { value: 2 }, sheetClass: 'Wizard' }
        }
      })
      actor.sheet.render(true)
    })
    await page.waitForSelector('.dcc.actor.sheet', { timeout: 10000 })
    await page.waitForTimeout(2000) // Wait for _prepareContext class setup + re-render
  }

  test('spellburn via the edit dialog, then heal back through the log', async ({ page }) => {
    await createAndOpenActor(page)

    // The Str value input is readonly and opens the edit dialog
    const strInput = page.locator('.dcc.actor.sheet input[name="system.abilities.str.value"]')
    await expect(strInput).toHaveAttribute('readonly', '')
    await strInput.click()
    await page.waitForSelector('.dcc.ability-score-config', { timeout: 5000 })

    // Spellburn is the default reason for Str; set the new value and a note
    await expect(page.locator('.dcc.ability-score-config input[value="spellburn"]')).toBeChecked()
    await page.fill('.dcc.ability-score-config input[name="newValue"]', '9')
    await page.fill('.dcc.ability-score-config input[name="note"]', 'Invoke Patron')
    await page.click('.dcc.ability-score-config button[type="submit"]')
    await page.waitForTimeout(500)

    // One update wrote the value and the typed log entry
    const afterApply = await page.evaluate(() => {
      const actor = game.actors.getName('ASL Test Wizard')
      return {
        value: actor.system.abilities.str.value,
        log: actor.system.abilityLog
      }
    })
    expect(afterApply.value).toBe(9)
    expect(afterApply.log).toHaveLength(1)
    expect(afterApply.log[0]).toMatchObject({
      ability: 'str',
      change: -3,
      type: 'spellburn',
      source: 'Invoke Patron',
      newValue: 9,
      healedAmount: 0
    })

    // Open the log viewer from the ability column button
    await page.click('.dcc.actor.sheet .ability-log-button')
    await page.waitForSelector('.dcc.ability-score-log', { timeout: 5000 })
    const row = page.locator('.dcc.ability-score-log .ability-log-table tbody tr')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Spellburn')
    await expect(row).toContainText('Invoke Patron')

    // Heal twice: one point per click
    await row.locator('.heal-button').click()
    await page.waitForTimeout(400)
    await page.locator('.dcc.ability-score-log .heal-button').click()
    await page.waitForTimeout(400)

    const afterTwoHeals = await page.evaluate(() => {
      const actor = game.actors.getName('ASL Test Wizard')
      return {
        value: actor.system.abilities.str.value,
        healedAmount: actor.system.abilityLog[0].healedAmount
      }
    })
    expect(afterTwoHeals.value).toBe(11)
    expect(afterTwoHeals.healedAmount).toBe(2)
    await expect(page.locator('.dcc.ability-score-log .ability-log-table tbody tr')).toContainText('2/3')

    // Third click fully heals and dims the row
    await page.locator('.dcc.ability-score-log .heal-button').click()
    await page.waitForTimeout(400)

    const afterThirdHeal = await page.evaluate(() => {
      const actor = game.actors.getName('ASL Test Wizard')
      return {
        value: actor.system.abilities.str.value,
        healedAmount: actor.system.abilityLog[0].healedAmount,
        logLength: actor.system.abilityLog.length
      }
    })
    expect(afterThirdHeal.value).toBe(12)
    expect(afterThirdHeal.healedAmount).toBe(3)
    expect(afterThirdHeal.logLength).toBe(1) // healing never deletes the row

    const healedRow = page.locator('.dcc.ability-score-log .ability-log-table tbody tr.healed')
    await expect(healedRow).toHaveCount(1)
    await expect(healedRow.locator('.heal-button')).toHaveCount(0)
  })

  test('clicking the ability title rolls a check without opening the edit dialog (issue #779)', async ({ page }) => {
    await createAndOpenActor(page)

    // With the log enabled the title label drops its `for=` so a click is not
    // forwarded to the readonly value input (which carries the edit action).
    const strTitle = page.locator('.dcc.actor.sheet .ability-box[data-ability="str"] label.box-title.rollable')
    await expect(strTitle).not.toHaveAttribute('for')

    const messagesBefore = await page.evaluate(() => game.messages.size)

    await strTitle.click()
    await page.waitForTimeout(600)

    // The check rolled (a chat card was created) ...
    const messagesAfter = await page.evaluate(() => game.messages.size)
    expect(messagesAfter).toBe(messagesBefore + 1)

    // ... and the edit dialog did NOT pop open on top of the roll
    await expect(page.locator('.dcc.ability-score-config')).toHaveCount(0)
  })

  test('direct API updates are logged as manual entries, flagged updates are not', async ({ page }) => {
    await createAndOpenActor(page)

    const result = await page.evaluate(async () => {
      const actor = game.actors.getName('ASL Test Wizard')

      // Unflagged direct edit (a module or macro) gets a manual fallback entry
      await actor.update({ 'system.abilities.str.value': 10 })
      const afterDirect = actor.system.abilityLog.map(e => ({ type: e.type, change: e.change }))

      // game.dcc.logAbilityChange is exported for dependent modules
      await game.dcc.logAbilityChange(actor, {
        ability: 'str',
        change: -1,
        type: 'damage',
        source: 'E2E giant rat'
      }, { announce: false })
      const afterTyped = actor.system.abilityLog.map(e => ({ type: e.type, change: e.change }))

      return { afterDirect, afterTyped, value: actor.system.abilities.str.value }
    })

    expect(result.afterDirect).toEqual([{ type: 'manual', change: -2 }])
    expect(result.afterTyped).toEqual([
      { type: 'manual', change: -2 },
      { type: 'damage', change: -1 }
    ])
    expect(result.value).toBe(9)
  })

  test('setting off leaves the sheet unchanged', async ({ page }) => {
    await page.evaluate(async () => {
      await game.settings.set('dcc', 'enableAbilityScoreLog', false)
    })
    await createAndOpenActor(page)

    const strInput = page.locator('.dcc.actor.sheet input[name="system.abilities.str.value"]')
    await expect(strInput).not.toHaveAttribute('readonly', '')
    await expect(page.locator('.dcc.actor.sheet .ability-log-button')).toHaveCount(0)

    // Direct edits write no log entries
    const log = await page.evaluate(async () => {
      const actor = game.actors.getName('ASL Test Wizard')
      await actor.update({ 'system.abilities.str.value': 10 })
      return actor.system.abilityLog
    })
    expect(log).toHaveLength(0)
  })
})
