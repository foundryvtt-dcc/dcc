const { test, expect } = require('@playwright/test')

/**
 * E2E tests for charged magic items (issue #500)
 * Attach a spell to an equipment item, cast it from the API and from the
 * inventory cast button, and verify charge spend rules in live Foundry.
 *
 * PREREQUISITES:
 * 1. Start Foundry: npx @foundryvtt/foundryvtt-cli launch --world=v14
 * 2. Run tests: npm test
 *
 * The tests will automatically log in as Gamemaster (no password).
 */

/* global game, Actor, Item, RollTable, CONST */

/**
 * Create the test fixtures in the live world: a results table, a spell
 * with a fixed spell check, an actor, and a wand with the spell attached.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{actorId: string, wandId: string, attached: object}>}
 */
async function createWandFixtures (page) {
  return page.evaluate(async () => {
    await RollTable.create({
      name: 'E2E Wand Table',
      formula: '1d20',
      results: [{
        type: CONST.TABLE_RESULT_TYPES.TEXT,
        text: 'A glittering missile streaks from the wand!',
        range: [1, 100],
        weight: 1
      }]
    })

    const spell = await Item.create({
      name: 'E2E Magic Missile',
      type: 'spell',
      system: {
        config: {
          inheritActionDie: false,
          inheritSpellCheck: false,
          inheritCheckPenalty: false,
          castingMode: 'wizard'
        },
        spellCheck: { die: '1d20', value: '+3' },
        results: { table: 'E2E Wand Table', collection: null },
        level: 1
      }
    })

    const actor = await Actor.create({ name: 'E2E Caster', type: 'Player' })
    const [wand] = await actor.createEmbeddedDocuments('Item', [{
      name: 'E2E Wand',
      type: 'equipment',
      system: { charges: { value: 2, max: 3 } }
    }])

    await wand.attachSpell(spell)

    return {
      actorId: actor.id,
      wandId: wand.id,
      attached: {
        name: wand.system.spell?.name,
        lost: wand.system.spell?.system?.lost,
        id: wand.system.spell?._id,
        castingMode: wand.system.spell?.system?.config?.castingMode
      }
    }
  })
}

/**
 * Cast the wand's spell via the API and report the resulting state.
 * @param {import('@playwright/test').Page} page
 * @param {{actorId: string, wandId: string}} ids
 */
async function castViaApi (page, ids) {
  return page.evaluate(async ({ actorId, wandId }) => {
    const actor = game.actors.get(actorId)
    const wand = actor.items.get(wandId)
    const messagesBefore = game.messages.size
    await wand.castSpell()
    const last = game.messages.contents.at(-1)
    return {
      charges: wand.system.charges.value,
      newMessages: game.messages.size - messagesBefore,
      lastMessageText: `${last?.flavor ?? ''} ${last?.content ?? ''}`
    }
  }, ids)
}

test.describe('Charged Magic Items E2E Tests', () => {
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
      for (const item of game.items.filter(i => i.name.startsWith('E2E '))) {
        await item.delete()
      }
      for (const table of game.tables.filter(t => t.name.startsWith('E2E '))) {
        await table.delete()
      }
    })

    // Close any welcome dialogs
    for (const selector of ['#dcc-welcome-dialog', '#dcc-core-book-welcome-dialog']) {
      const dialog = page.locator(selector)
      if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
      }
    }
  })

  test.afterEach(async () => {
    const significantErrors = consoleErrors.filter(err => !err.includes('favicon.ico'))
    expect(significantErrors, `Console errors detected: ${significantErrors.join('\n')}`).toHaveLength(0)
  })

  test('attaching a spell stores a sanitized snapshot', async ({ page }) => {
    const fixtures = await createWandFixtures(page)

    expect(fixtures.attached.name).toBe('E2E Magic Missile')
    // The snapshot is sanitized: no source id, never lost
    expect(fixtures.attached.id).toBeUndefined()
    expect(fixtures.attached.lost).toBe(false)
    expect(fixtures.attached.castingMode).toBe('wizard')
  })

  test('casting spends a charge, posts a chat card, and blocks at zero', async ({ page }) => {
    const fixtures = await createWandFixtures(page)

    // First cast: 2 -> 1 charge, spell check chat card posted
    const first = await castViaApi(page, fixtures)
    expect(first.charges).toBe(1)
    expect(first.newMessages).toBeGreaterThanOrEqual(1)
    expect(first.lastMessageText).toContain('E2E Magic Missile')

    // Second cast: 1 -> 0 charges
    const second = await castViaApi(page, fixtures)
    expect(second.charges).toBe(0)
    expect(second.newMessages).toBeGreaterThanOrEqual(1)

    // Third cast: blocked at zero - no roll, no charge change
    const third = await castViaApi(page, fixtures)
    expect(third.charges).toBe(0)
    expect(third.newMessages).toBe(0)
  })

  test('the inventory cast button casts the attached spell', async ({ page }) => {
    const fixtures = await createWandFixtures(page)

    // Open the actor sheet and switch to the equipment tab
    await page.evaluate(async ({ actorId }) => {
      await game.actors.get(actorId).sheet.render(true)
    }, fixtures)
    await page.waitForSelector('.dcc.actor.sheet', { timeout: 5000 })
    await page.click('.dcc.actor.sheet a[data-action="tab"][data-tab="equipment"]')

    // The wand row shows a cast button for the attached spell
    const castButton = page.locator('.dcc.actor.sheet [data-action="castEquipmentSpell"]')
    await expect(castButton).toBeVisible()

    const messagesBefore = await page.evaluate(() => game.messages.size)
    await castButton.click()

    // Wait for the cast to resolve and the chat card to land
    await expect.poll(async () => {
      return page.evaluate(() => game.messages.size)
    }, { timeout: 10000 }).toBeGreaterThan(messagesBefore)

    const charges = await page.evaluate(({ actorId, wandId }) => {
      return game.actors.get(actorId).items.get(wandId).system.charges.value
    }, fixtures)
    expect(charges).toBe(1)
  })
})
