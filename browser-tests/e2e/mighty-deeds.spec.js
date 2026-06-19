const { test, expect } = require('@playwright/test')

/**
 * E2E tests for Mighty Deed table prompts (issue #319)
 * Create a world deed table, attack with a warrior until the deed die
 * succeeds (3+), and verify the attack chat card offers the deed table
 * prompt and that clicking Roll Deed posts the table result to chat.
 *
 * PREREQUISITES:
 * 1. Start Foundry: npx @foundryvtt/foundryvtt-cli launch --world=v14
 * 2. Run tests: npm test
 *
 * The tests will automatically log in as Gamemaster (no password).
 */

/* global game, ui, Actor, RollTable, CONFIG, CONST */

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
      if (game.messages.size > before && Boolean(msg.system?.deedRollSuccess) === wantSuccess) {
        return {
          messageId: msg.id,
          deedDieRollResult: msg.system.deedDieRollResult,
          deedRollSuccess: msg.system.deedRollSuccess,
          deedTables: msg.system.deedTables,
          contentHasPrompt: msg.content.includes('deed-table-prompt')
        }
      }
    }
    return null
  }, { ...ids, wantSuccess })
}

/**
 * Toggle the off-by-default `mightyDeedsEnabled` world setting (issue #319).
 * @param {import('@playwright/test').Page} page
 * @param {boolean} enabled
 */
async function setMightyDeedsEnabled (page, enabled) {
  await page.evaluate((value) => game.settings.set('dcc', 'mightyDeedsEnabled', value), enabled)
}

test.describe('Mighty Deeds E2E Tests', () => {
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
      for (const table of game.tables.filter(t => t.name.startsWith('E2E '))) {
        await table.delete()
      }
    })

    // Reset the deed prompt to its off-by-default state for test isolation (issue #319)
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

  test.afterEach(async () => {
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

  test('a successful deed offers the table prompt and Roll Deed posts the result', async ({ page }) => {
    const fixtures = await createDeedFixtures(page)
    await setMightyDeedsEnabled(page, true)

    const success = await attackUntilDeed(page, fixtures, true)
    expect(success, 'no successful deed in 30 attacks').not.toBeNull()
    expect(success.deedDieRollResult).toBeGreaterThanOrEqual(3)
    // Other deed tables may be registered too (e.g. the dcc-core-book pack)
    expect(success.deedTables).toContainEqual({ name: 'E2E Deed Table', path: 'E2E Deed Table' })
    expect(success.contentHasPrompt).toBe(true)

    // Select the test table and click Roll Deed on the rendered chat card
    await page.evaluate(() => ui.sidebar.expand())
    await page.click('button[data-tab="chat"]')
    await page.waitForTimeout(500)
    await page.evaluate(() => ui.chat.scrollBottom({ immediate: true }))
    const card = page.locator(`#chat .chat-message[data-message-id="${success.messageId}"]`)
    await card.locator('.deed-table-select').selectOption('E2E Deed Table')
    const button = card.locator('.roll-deed-table')
    await button.scrollIntoViewIfNeeded()
    await expect(button).toBeVisible()

    const messagesBefore = await page.evaluate(() => game.messages.size)
    await button.click()
    await expect.poll(async () => {
      return page.evaluate(() => game.messages.size)
    }, { timeout: 10000 }).toBeGreaterThan(messagesBefore)

    const result = await page.evaluate(() => {
      const msg = game.messages.contents.at(-1)
      return { flavor: msg.flavor, content: msg.content, isMightyDeed: msg.getFlag('dcc', 'isMightyDeed') }
    })
    expect(result.isMightyDeed).toBe(true)
    expect(result.flavor).toContain('E2E Deed Table')
    expect(result.flavor).toContain(`(${success.deedDieRollResult})`)
    // The posted result is the table entry matching the deed die value
    const expected = {
      3: 'Off-balance',
      4: 'Knockdown'
    }[success.deedDieRollResult] || 'Throw'
    expect(result.content).toContain(expected)

    // One-shot: the button disables after posting and a second click adds no further result
    await expect(button).toBeDisabled()
    const countAfterFirst = await page.evaluate(() => game.messages.size)
    await button.click({ force: true }).catch(() => {})
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => game.messages.size)).toBe(countAfterFirst)
  })

  test('a failed deed shows no table prompt', async ({ page }) => {
    const fixtures = await createDeedFixtures(page)
    await setMightyDeedsEnabled(page, true)

    const failure = await attackUntilDeed(page, fixtures, false)
    expect(failure, 'no failed deed in 30 attacks').not.toBeNull()
    expect(failure.deedDieRollResult).toBeLessThan(3)
    expect(failure.deedTables).toEqual([])
    expect(failure.contentHasPrompt).toBe(false)
  })

  test('with the setting disabled (default), a successful deed shows no prompt', async ({ page }) => {
    const fixtures = await createDeedFixtures(page)
    // mightyDeedsEnabled is left at its default (false) by beforeEach.
    // The table is still registered, but the attack card must not offer it.
    expect(fixtures.registryEntry).toEqual({ name: 'E2E Deed Table', path: 'E2E Deed Table' })

    const success = await attackUntilDeed(page, fixtures, true)
    expect(success, 'no successful deed in 30 attacks').not.toBeNull()
    expect(success.deedDieRollResult).toBeGreaterThanOrEqual(3)
    // Feature off: no tables attached and no prompt rendered even on a deed success
    expect(success.deedTables).toEqual([])
    expect(success.contentHasPrompt).toBe(false)
  })
})
