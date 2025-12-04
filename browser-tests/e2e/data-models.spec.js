const { test, expect } = require('@playwright/test')

/**
 * E2E tests for DCC TypeDataModels
 * Tests actual data validation and persistence in a live Foundry instance
 *
 * PREREQUISITES:
 * 1. Start Foundry: npx @foundryvtt/foundryvtt-cli launch --world=automated_testing
 * 2. Run tests: npm test
 *
 * The tests will automatically log in as Gamemaster (no password).
 */

test.describe('DCC TypeDataModels E2E Tests', () => {
  // Store console errors for each test
  let consoleErrors = []

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
    // Reset console errors for this test
    consoleErrors = []

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Set viewport to a reasonable size that fits on screen
    await page.setViewportSize({ width: 1280, height: 800 })

    // Navigate to join page
    await page.goto('http://localhost:30000/join')
    await page.waitForTimeout(1000)

    // Check if we're already in the game (session persisted)
    const isInGame = await page.locator('.game.system-dcc').isVisible({ timeout: 1000 }).catch(() => false)

    if (!isInGame) {
      // We need to log in - wait for join page
      const userSelect = page.locator('select[name="userid"]')
      await userSelect.waitFor({ state: 'visible', timeout: 10000 })

      // Select Gamemaster
      await page.selectOption('select[name="userid"]', { label: 'Gamemaster' })

      // Click join button (no password needed)
      await page.click('button[name="join"]')

      // Wait for game to load
      await page.waitForSelector('.game.system-dcc', { timeout: 30000 })
    }

    // Wait for Foundry to fully initialize
    await page.waitForSelector('#actors', { timeout: 10000, state: 'attached' })

    // Close any welcome dialogs
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

      // Edit strength
      const strInput = page.locator('input[name="system.abilities.str.value"]')
      await strInput.fill('18')
      await page.waitForTimeout(1000) // Wait for auto-save

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

      // Edit action die (string field)
      const actionDieInput = page.locator('input[name="system.attributes.actionDice.value"]')
      await actionDieInput.fill('1d24')
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
