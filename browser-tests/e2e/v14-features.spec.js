/* eslint-disable no-undef -- Browser globals (game, Actor, Item, CONFIG, etc.) used in page.evaluate callbacks */
const { test, expect } = require('@playwright/test')

/**
 * V14-specific E2E tests for DCC system
 *
 * Tests Active Effects, dice chain, equipped item filtering,
 * class-specific tabs, compendium, and status icons.
 *
 * PREREQUISITES:
 * 1. Start Foundry: npx @foundryvtt/foundryvtt-cli launch --world=automated_testing
 * 2. Run tests: npm test
 */

test.describe('DCC V14 Features E2E Tests', () => {
  let consoleErrors = []

  /**
   * Helper: open an actor's sheet by clicking its name in the Actors sidebar
   */
  async function openActorSheet (page, actorName) {
    await page.click('button[data-tab="actors"]')
    await page.waitForSelector('#actors.active', { timeout: 5000 })
    await page.click(`.entry-name:has-text("${actorName}")`)
    await page.waitForSelector('.dcc.actor.sheet', { timeout: 10000 })
    await page.waitForTimeout(2000) // Wait for _prepareContext class setup + re-render
  }

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

    // Wait for DCC system ready hook to complete (async hook needs time after DOM is ready)
    await page.waitForFunction(() => game?.dcc?.KeyState !== undefined, { timeout: 10000 })

    // Clean up leftover test data and close open windows
    await page.evaluate(async () => {
      for (const app of Object.values(ui.windows)) {
        await app.close()
      }
      for (const actor of game.actors.filter(a => a.name.startsWith('V14 '))) {
        await actor.delete()
      }
      for (const item of game.items.filter(i => i.name.startsWith('V14 '))) {
        await item.delete()
      }
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
    // Clean up any remaining test data
    await page.evaluate(async () => {
      for (const app of Object.values(ui.windows)) {
        await app.close()
      }
      for (const actor of game.actors.filter(a => a.name.startsWith('V14 '))) {
        await actor.delete()
      }
      for (const item of game.items.filter(i => i.name.startsWith('V14 '))) {
        await item.delete()
      }
    }).catch(() => {}) // Don't fail cleanup

    const significantErrors = consoleErrors.filter(err =>
      !err.includes('favicon.ico')
    )
    expect(significantErrors, `Console errors detected: ${significantErrors.join('\n')}`).toHaveLength(0)
  })

  // ── Active Effects CRUD ──────────────────────────────────────────────

  test.describe('Active Effects CRUD', () => {
    test('can create a new effect on an actor via Effects tab', async ({ page }) => {
      // Create actor via API
      await page.evaluate(async () => {
        await Actor.create({ name: 'V14 Effects Create', type: 'Player' })
      })

      // Open sheet via sidebar click
      await openActorSheet(page, 'V14 Effects Create')

      // Navigate to Effects tab
      await page.click('.dcc.actor.sheet nav [data-tab="effects"]')
      await page.waitForTimeout(500)

      // Verify empty state
      await expect(page.locator('.effects-empty')).toBeVisible()

      // Click create effect button
      await page.click('[data-action="effectCreate"]')
      await page.waitForTimeout(1000)

      // Verify effect was created and appears in list
      await expect(page.locator('.effect-item')).toBeVisible()
      const nameText = await page.locator('.effect-name').textContent()
      expect(nameText.trim().length).toBeGreaterThan(0)
    })

    test('can toggle an effect on and off', async ({ page }) => {
      // Create actor with an effect via API
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 Effects Toggle', type: 'Player' })
        await actor.createEmbeddedDocuments('ActiveEffect', [{
          name: 'Toggle Test Effect',
          img: 'icons/svg/aura.svg',
          changes: [],
          disabled: false
        }])
      })

      await openActorSheet(page, 'V14 Effects Toggle')

      // Navigate to Effects tab
      await page.click('.dcc.actor.sheet nav [data-tab="effects"]')
      await page.waitForTimeout(500)

      // Verify toggle button is in enabled state (no disabled class)
      const toggleBtn = page.locator('[data-action="effectToggle"]')
      await expect(toggleBtn).toBeVisible()
      await expect(toggleBtn).not.toHaveClass(/effect-disabled/)

      // Click toggle to disable
      await toggleBtn.click()
      await page.waitForTimeout(500)

      // Verify it's now disabled
      await expect(page.locator('[data-action="effectToggle"]')).toHaveClass(/effect-disabled/)
      await expect(page.locator('[data-action="effectToggle"] i')).toHaveClass(/fa-eye-slash/)

      // Click toggle again to re-enable
      await page.click('[data-action="effectToggle"]')
      await page.waitForTimeout(500)

      // Verify it's enabled again
      await expect(page.locator('[data-action="effectToggle"]')).not.toHaveClass(/effect-disabled/)
      await expect(page.locator('[data-action="effectToggle"] i')).toHaveClass(/fa-eye/)
    })

    test('can delete an effect', async ({ page }) => {
      // Create actor with an effect
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 Effects Delete', type: 'Player' })
        await actor.createEmbeddedDocuments('ActiveEffect', [{
          name: 'Delete Me',
          img: 'icons/svg/aura.svg',
          changes: [],
          disabled: false
        }])
      })

      await openActorSheet(page, 'V14 Effects Delete')

      // Navigate to Effects tab
      await page.click('.dcc.actor.sheet nav [data-tab="effects"]')
      await page.waitForTimeout(500)

      // Verify effect exists
      await expect(page.locator('.effect-item')).toBeVisible()

      // Click delete button
      await page.click('[data-action="effectDelete"]')

      // Confirm deletion dialog
      await page.waitForSelector('dialog.application', { timeout: 5000 })
      await page.click('button[data-action="yes"]')
      await page.waitForTimeout(500)

      // Verify effect is gone
      expect(await page.locator('.effect-item').count()).toBe(0)

      // Verify empty state is shown
      await expect(page.locator('.effects-empty')).toBeVisible()
    })
  })

  // ── Active Effects Application ───────────────────────────────────────

  test.describe('Active Effects Application', () => {
    test('strength bonus effect modifies displayed ability score', async ({ page }) => {
      // Create actor with STR bonus effect
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 STR Bonus', type: 'Player' })
        await actor.createEmbeddedDocuments('ActiveEffect', [{
          name: 'STR +2',
          img: 'icons/svg/aura.svg',
          changes: [{
            key: 'system.abilities.str.value',
            value: '2',
            type: 'add'
          }],
          disabled: false
        }])
      })

      await openActorSheet(page, 'V14 STR Bonus')

      // Verify STR value is 12 (10 base + 2 from effect)
      const strValue = await page.locator('input[name="system.abilities.str.value"]').inputValue()
      expect(parseInt(strValue)).toBe(12)

      // Verify effect shows in Effects tab
      await page.click('.dcc.actor.sheet nav [data-tab="effects"]')
      await page.waitForTimeout(500)
      await expect(page.locator('.effect-name')).toContainText('STR +2')

      // Verify the effects summary shows the change
      await expect(page.locator('.effects-summary')).toBeVisible()
      await expect(page.locator('.change-summary')).toContainText('system.abilities.str.value')
    })

    test('disabling an effect reverts the modified value', async ({ page }) => {
      // Create actor with STR bonus effect
      const actorId = await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 Effect Revert', type: 'Player' })
        await actor.createEmbeddedDocuments('ActiveEffect', [{
          name: 'STR +3',
          img: 'icons/svg/aura.svg',
          changes: [{
            key: 'system.abilities.str.value',
            value: '3',
            type: 'add'
          }],
          disabled: false
        }])
        return actor.id
      })

      await openActorSheet(page, 'V14 Effect Revert')

      // Verify STR is 13 (10 + 3)
      let strValue = await page.locator('input[name="system.abilities.str.value"]').inputValue()
      expect(parseInt(strValue)).toBe(13)

      // Disable the effect via API
      await page.evaluate(async (id) => {
        const actor = game.actors.get(id)
        const effect = actor.effects.contents[0]
        await effect.update({ disabled: true })
      }, actorId)
      await page.waitForTimeout(1000)

      // Verify STR reverted to 10
      strValue = await page.locator('input[name="system.abilities.str.value"]').inputValue()
      expect(parseInt(strValue)).toBe(10)
    })
  })

  // ── Dice Chain Effects ───────────────────────────────────────────────

  test.describe('Dice Chain Effects', () => {
    test('add effect on dice field bumps die up the chain', async ({ page }) => {
      // Action die default is "1d20", +1 step should give "1d24"
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 Dice Chain', type: 'Player' })
        await actor.createEmbeddedDocuments('ActiveEffect', [{
          name: 'Action Die Upgrade',
          img: 'icons/svg/aura.svg',
          changes: [{
            key: 'system.attributes.actionDice.value',
            value: '1',
            type: 'add'
          }],
          disabled: false
        }])
      })

      await openActorSheet(page, 'V14 Dice Chain')

      // Verify action die was bumped from 1d20 to 1d24
      const actionDie = await page.locator('input[name="system.attributes.actionDice.value"]').inputValue()
      expect(actionDie).toBe('1d24')
    })

    test('subtract effect on dice field bumps die down the chain', async ({ page }) => {
      // Action die default "1d20", -1 step should give "1d16"
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 Dice Down', type: 'Player' })
        await actor.createEmbeddedDocuments('ActiveEffect', [{
          name: 'Action Die Downgrade',
          img: 'icons/svg/aura.svg',
          changes: [{
            key: 'system.attributes.actionDice.value',
            value: '1',
            type: 'subtract'
          }],
          disabled: false
        }])
      })

      await openActorSheet(page, 'V14 Dice Down')

      // Verify action die was bumped from 1d20 to 1d16
      const actionDie = await page.locator('input[name="system.attributes.actionDice.value"]').inputValue()
      expect(actionDie).toBe('1d16')
    })
  })

  // ── Equipped Item Effects ────────────────────────────────────────────

  test.describe('Equipped Item Effects', () => {
    test('item effect only applies when item is equipped', async ({ page }) => {
      // Create actor with armor item that has a STR +2 transfer effect
      const actorId = await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 Equip Test', type: 'Player' })

        const [armor] = await actor.createEmbeddedDocuments('Item', [{
          name: 'V14 Magic Armor',
          type: 'armor',
          system: { equipped: true }
        }])

        await armor.createEmbeddedDocuments('ActiveEffect', [{
          name: 'STR Boost',
          img: 'icons/svg/aura.svg',
          changes: [{
            key: 'system.abilities.str.value',
            value: '2',
            type: 'add'
          }],
          transfer: true,
          disabled: false
        }])

        return actor.id
      })

      await openActorSheet(page, 'V14 Equip Test')

      // STR should be 12 (10 + 2 from equipped armor effect)
      let strValue = await page.locator('input[name="system.abilities.str.value"]').inputValue()
      expect(parseInt(strValue)).toBe(12)

      // Unequip the armor via API
      await page.evaluate(async (id) => {
        const actor = game.actors.get(id)
        const armor = actor.items.getName('V14 Magic Armor')
        await armor.update({ 'system.equipped': false })
      }, actorId)
      await page.waitForTimeout(1000)

      // STR should revert to 10
      strValue = await page.locator('input[name="system.abilities.str.value"]').inputValue()
      expect(parseInt(strValue)).toBe(10)

      // Re-equip the armor
      await page.evaluate(async (id) => {
        const actor = game.actors.get(id)
        const armor = actor.items.getName('V14 Magic Armor')
        await armor.update({ 'system.equipped': true })
      }, actorId)
      await page.waitForTimeout(1000)

      // STR should be 12 again
      strValue = await page.locator('input[name="system.abilities.str.value"]').inputValue()
      expect(parseInt(strValue)).toBe(12)
    })
  })

  // ── Effect Transfer from Items ───────────────────────────────────────

  test.describe('Effect Transfer from Items', () => {
    test('item effect with transfer shows on item effects tab', async ({ page }) => {
      // Create actor with an item that has a transfer effect
      await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 Transfer Test', type: 'Player' })

        const [weapon] = await actor.createEmbeddedDocuments('Item', [{
          name: 'V14 Magic Sword',
          type: 'weapon',
          system: { equipped: true }
        }])

        await weapon.createEmbeddedDocuments('ActiveEffect', [{
          name: 'Sword Attack Bonus',
          img: 'icons/svg/aura.svg',
          changes: [{
            key: 'system.abilities.str.value',
            value: '1',
            type: 'add'
          }],
          transfer: true,
          disabled: false
        }])
      })

      await openActorSheet(page, 'V14 Transfer Test')

      // Verify the effect is applied (STR should be 11)
      const strValue = await page.locator('input[name="system.abilities.str.value"]').inputValue()
      expect(parseInt(strValue)).toBe(11)

      // Navigate to equipment tab
      await page.click('.dcc.actor.sheet nav [data-tab="equipment"]')
      await page.waitForTimeout(500)

      // Open the weapon's item sheet via edit button
      const itemId = await page.evaluate(() => {
        return game.actors.getName('V14 Transfer Test').items.getName('V14 Magic Sword')?.id
      })
      await page.click(`li[data-item-id="${itemId}"] [data-action="itemEdit"]`)
      await page.waitForSelector('.dcc.sheet.item', { timeout: 5000 })
      await page.waitForTimeout(500)

      // Navigate to item's Effects tab
      await page.click('.dcc.sheet.item nav [data-tab="effects"]')
      await page.waitForTimeout(500)

      // Verify effect appears on item with transfer status
      await expect(page.locator('.dcc.sheet.item .effect-item')).toBeVisible()
      await expect(page.locator('.dcc.sheet.item .effect-name')).toContainText('Sword Attack Bonus')
      await expect(page.locator('.dcc.sheet.item .effect-transfer')).toBeVisible()
    })
  })

  // ── Class-Specific Sheet Tabs ────────────────────────────────────────

  test.describe('Class-Specific Sheet Tabs', () => {
    const classConfigs = [
      {
        sheetClass: 'dcc.DCCActorSheetCleric',
        name: 'Cleric',
        expectedTabs: ['character', 'equipment', 'cleric', 'clericSpells', 'effects', 'notes']
      },
      {
        sheetClass: 'dcc.DCCActorSheetWarrior',
        name: 'Warrior',
        expectedTabs: ['character', 'equipment', 'warrior', 'effects', 'notes']
      },
      {
        sheetClass: 'dcc.DCCActorSheetWizard',
        name: 'Wizard',
        expectedTabs: ['character', 'equipment', 'wizard', 'wizardSpells', 'effects', 'notes']
      },
      {
        sheetClass: 'dcc.DCCActorSheetThief',
        name: 'Thief',
        expectedTabs: ['character', 'equipment', 'thief', 'effects', 'notes']
      },
      {
        sheetClass: 'dcc.DCCActorSheetElf',
        name: 'Elf',
        expectedTabs: ['character', 'equipment', 'elf', 'wizardSpells', 'effects', 'notes']
      },
      {
        sheetClass: 'dcc.DCCActorSheetDwarf',
        name: 'Dwarf',
        expectedTabs: ['character', 'equipment', 'dwarf', 'effects', 'notes']
      },
      {
        sheetClass: 'dcc.DCCActorSheetHalfling',
        name: 'Halfling',
        expectedTabs: ['character', 'equipment', 'halfling', 'effects', 'notes']
      }
    ]

    for (const { sheetClass, name, expectedTabs } of classConfigs) {
      test(`${name} sheet has correct tabs`, async ({ page }) => {
        // Create actor with specific sheet class
        await page.evaluate(async ({ sheetClass, name }) => {
          await Actor.create({
            name: `V14 ${name} Tabs`,
            type: 'Player',
            flags: { core: { sheetClass } }
          })
        }, { sheetClass, name })

        await openActorSheet(page, `V14 ${name} Tabs`)

        // Get all tab IDs from the sheet navigation
        const tabIds = await page.evaluate(() => {
          const sheet = document.querySelector('.dcc.actor.sheet')
          const tabs = sheet.querySelectorAll('nav [data-tab]')
          return Array.from(tabs).map(t => t.dataset.tab)
        })

        // Verify expected tabs are present
        expect(tabIds).toEqual(expectedTabs)
      })
    }
  })

  // ── Sheet Tab Navigation ─────────────────────────────────────────────

  test.describe('Sheet Tab Navigation', () => {
    test('can switch between all tabs and each renders content', async ({ page }) => {
      // Create a Cleric actor (has many tabs)
      await page.evaluate(async () => {
        await Actor.create({
          name: 'V14 Tab Navigate',
          type: 'Player',
          flags: { core: { sheetClass: 'dcc.DCCActorSheetCleric' } }
        })
      })

      await openActorSheet(page, 'V14 Tab Navigate')

      // Character tab (default active)
      await expect(page.locator('.dcc.actor.sheet nav [data-tab="character"]')).toHaveClass(/active/)

      // Switch to Equipment tab
      await page.click('.dcc.actor.sheet nav [data-tab="equipment"]')
      await page.waitForTimeout(500)
      await expect(page.locator('.dcc.actor.sheet nav [data-tab="equipment"]')).toHaveClass(/active/)

      // Switch to Cleric tab
      await page.click('.dcc.actor.sheet nav [data-tab="cleric"]')
      await page.waitForTimeout(500)
      await expect(page.locator('.dcc.actor.sheet nav [data-tab="cleric"]')).toHaveClass(/active/)

      // Switch to Spells tab
      await page.click('.dcc.actor.sheet nav [data-tab="clericSpells"]')
      await page.waitForTimeout(500)
      await expect(page.locator('.dcc.actor.sheet nav [data-tab="clericSpells"]')).toHaveClass(/active/)

      // Switch to Effects tab
      await page.click('.dcc.actor.sheet nav [data-tab="effects"]')
      await page.waitForTimeout(500)
      await expect(page.locator('.dcc.actor.sheet nav [data-tab="effects"]')).toHaveClass(/active/)

      // Switch to Notes tab
      await page.click('.dcc.actor.sheet nav [data-tab="notes"]')
      await page.waitForTimeout(500)
      await expect(page.locator('.dcc.actor.sheet nav [data-tab="notes"]')).toHaveClass(/active/)

      // Switch back to Character tab and verify ability scores are visible
      await page.click('.dcc.actor.sheet nav [data-tab="character"]')
      await page.waitForTimeout(500)
      await expect(page.locator('input[name="system.abilities.str.value"]')).toBeVisible()
    })
  })

  // ── Effects Compendium ───────────────────────────────────────────────

  test.describe('Effects Compendium', () => {
    test('DCC Effects compendium is registered and contains effects', async ({ page }) => {
      // Verify compendium exists and has entries via API
      const packInfo = await page.evaluate(async () => {
        const pack = game.packs.get('dcc.dcc-effects')
        if (!pack) return null
        const index = await pack.getIndex()
        return {
          label: pack.metadata.label,
          type: pack.metadata.type,
          count: index.size,
          sampleNames: Array.from(index.values()).slice(0, 5).map(e => e.name)
        }
      })

      expect(packInfo).not.toBeNull()
      expect(packInfo.type).toBe('ActiveEffect')
      expect(packInfo.count).toBeGreaterThan(10)
      expect(packInfo.sampleNames.length).toBeGreaterThan(0)
    })

    test('DCC Effects compendium is visible in sidebar', async ({ page }) => {
      // Click the compendium tab
      await page.click('button[data-tab="compendium"]')
      await page.waitForTimeout(500)

      // Find the DCC Effects compendium by data-pack attribute
      const packEntry = page.locator('[data-pack="dcc.dcc-effects"]')
      await expect(packEntry).toBeVisible()

      // Verify the pack entry shows the correct label
      await expect(packEntry).toContainText('DCC Effects')

      // Verify it's an ActiveEffect type pack
      await expect(packEntry).toHaveClass(/activeeffect/)
    })
  })

  // ── Status Icons ─────────────────────────────────────────────────────

  test.describe('Status Icons', () => {
    test('DCC-specific status effects are registered', async ({ page }) => {
      // Check for specific known DCC status effect IDs
      const statusEffects = await page.evaluate(() => {
        const dccStatusIds = [
          'armor-seized', 'battle-rage', 'disarmed', 'grip-disrupted',
          'kneecapped', 'off-balance', 'stumbling', 'turtled',
          'weapon-tangled-armor', 'weapon-damaged'
        ]
        return CONFIG.statusEffects
          .filter(s => dccStatusIds.includes(s.id))
          .map(s => ({ id: s.id, name: s.name, img: s.img }))
      })

      // Verify DCC-specific status effects exist
      expect(statusEffects.length).toBeGreaterThan(0)

      const statusIds = statusEffects.map(s => s.id)
      expect(statusIds).toContain('armor-seized')
      expect(statusIds).toContain('battle-rage')
      expect(statusIds).toContain('disarmed')
      expect(statusIds).toContain('weapon-damaged')

      // Verify each has an image path and name
      for (const effect of statusEffects) {
        expect(effect.img).toBeTruthy()
        expect(effect.name).toBeTruthy()
      }
    })

    test('can toggle a status effect on an actor', async ({ page }) => {
      // Create actor and toggle a status effect via API
      const result = await page.evaluate(async () => {
        const actor = await Actor.create({ name: 'V14 Status Test', type: 'Player' })

        // Check initial status - no effects with armor-seized status
        const before = actor.effects.contents.some(e => e.statuses.has('armor-seized'))

        // Toggle status on using the status ID directly
        await actor.toggleStatusEffect('armor-seized')
        const after = actor.effects.contents.some(e => e.statuses.has('armor-seized'))

        // Toggle status off
        await actor.toggleStatusEffect('armor-seized')
        const afterOff = actor.effects.contents.some(e => e.statuses.has('armor-seized'))

        return { before, after, afterOff }
      })

      expect(result.before).toBe(false)
      expect(result.after).toBe(true)
      expect(result.afterOff).toBe(false)
    })
  })
})
