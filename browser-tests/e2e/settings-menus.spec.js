/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Settings submenus (module/settings-menus.mjs) end-to-end against live
 * Foundry. The system groups the QOL-imported enhanced-combat settings, the
 * table/compendium pickers, and the multiple-action-dice options into three
 * registered submenus. The main settings window must show the submenu buttons
 * and no longer list the moved settings; the submenu apps must render their
 * fieldsets, disable dependent settings while their master toggle is off, and
 * persist edits on save.
 */
const test = createSessionTest()

test.describe('Settings submenus', () => {
  test('the main settings window shows submenu buttons and hides moved settings', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const app = new foundry.applications.settings.SettingsConfig()
      await app.render(true)
      const el = app.element
      const out = {
        menuButtons: ['enhancedCombatMenu', 'tableSettingsMenu', 'actionDiceMenu']
          .map(key => !!el.querySelector(`button[data-action="openSubmenu"][data-key="dcc.${key}"]`)),
        movedSettingsHidden: ['dcc.enhancedAttackCards', 'dcc.attackCardFormat', 'dcc.autoApplyDamage', 'dcc.critsCompendium', 'dcc.fumbleTable', 'dcc.multipleActionDice', 'dcc.manualCompendiumConfiguration']
          .map(name => !el.querySelector(`[name="${name}"]`)),
        looseSettingStillShown: !!el.querySelector('[name="dcc.mightyDeedsEnabled"]')
      }
      await app.close()
      return out
    })

    expect(result.menuButtons).toEqual([true, true, true])
    expect(result.movedSettingsHidden).toEqual([true, true, true, true, true, true, true])
    expect(result.looseSettingStillShown).toBe(true)
  })

  test('the Enhanced Combat menu renders groups, gates dependent settings, and saves', async ({ page }) => {
    // Deterministic starting point: master toggle off, hit/miss on.
    const prev = await page.evaluate(async () => {
      const prevValues = {
        enhancedAttackCards: game.settings.get('dcc', 'enhancedAttackCards'),
        showHitMissOnCard: game.settings.get('dcc', 'showHitMissOnCard')
      }
      await game.settings.set('dcc', 'enhancedAttackCards', false)
      await game.settings.set('dcc', 'showHitMissOnCard', true)
      const MenuClass = game.settings.menus.get('dcc.enhancedCombatMenu').type
      const app = new MenuClass()
      await app.render(true)
      return prevValues
    })

    const dialog = page.locator('#dcc-enhanced-combat-settings')
    await expect(dialog).toBeVisible()

    // Two fieldsets: attack cards and combat automation, with their settings.
    await expect(dialog.locator('fieldset')).toHaveCount(2)
    await expect(dialog.locator('input[name="enhancedAttackCards"]')).toBeVisible()
    await expect(dialog.locator('select[name="attackCardFormat"]')).toBeVisible()
    await expect(dialog.locator('input[name="autoApplyDamage"]')).toBeVisible()

    // Master toggle off: the dependent card settings are disabled.
    await expect(dialog.locator('select[name="attackCardFormat"]')).toBeDisabled()
    await expect(dialog.locator('input[name="showHitMissOnCard"]')).toBeDisabled()

    // Turning the master on enables them.
    await dialog.locator('input[name="enhancedAttackCards"]').click()
    await expect(dialog.locator('select[name="attackCardFormat"]')).toBeEnabled()
    await expect(dialog.locator('input[name="showHitMissOnCard"]')).toBeEnabled()

    // Uncheck hit/miss and save: both changes persist and the app closes.
    await dialog.locator('input[name="showHitMissOnCard"]').click()
    await dialog.locator('button[type="submit"]').click()
    await expect(dialog).not.toBeVisible()

    const saved = await page.evaluate(() => ({
      enhancedAttackCards: game.settings.get('dcc', 'enhancedAttackCards'),
      showHitMissOnCard: game.settings.get('dcc', 'showHitMissOnCard')
    }))
    expect(saved.enhancedAttackCards).toBe(true)
    expect(saved.showHitMissOnCard).toBe(false)

    // Restore the previous values.
    await page.evaluate(async previous => {
      await game.settings.set('dcc', 'enhancedAttackCards', previous.enhancedAttackCards)
      await game.settings.set('dcc', 'showHitMissOnCard', previous.showHitMissOnCard)
    }, prev)
  })

  test('the Tables & Compendia menu disables pickers while manual configuration is off', async ({ page }) => {
    await page.evaluate(async () => {
      const MenuClass = game.settings.menus.get('dcc.tableSettingsMenu').type
      const app = new MenuClass()
      await app.render(true)
    })

    const dialog = page.locator('#dcc-table-settings')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('fieldset')).toHaveCount(3)

    // Manual configuration is off in the test world: every picker is disabled.
    await expect(dialog.locator('input[name="manualCompendiumConfiguration"]')).not.toBeChecked()
    await expect(dialog.locator('select[name="critsCompendium"]')).toBeDisabled()
    await expect(dialog.locator('select[name="fumbleTable"]')).toBeDisabled()

    // Toggling manual configuration on (without saving) enables them.
    await dialog.locator('input[name="manualCompendiumConfiguration"]').click()
    await expect(dialog.locator('select[name="critsCompendium"]')).toBeEnabled()
    await expect(dialog.locator('select[name="fumbleTable"]')).toBeEnabled()

    await page.evaluate(async () => {
      await foundry.applications.instances.get('dcc-table-settings')?.close()
    })
  })

  test('the Multiple Action Dice menu gates its sub-options behind the master toggle', async ({ page }) => {
    await page.evaluate(async () => {
      const MenuClass = game.settings.menus.get('dcc.actionDiceMenu').type
      const app = new MenuClass()
      await app.render(true)
    })

    const dialog = page.locator('#dcc-action-dice-settings')
    await expect(dialog).toBeVisible()

    const master = dialog.locator('input[name="multipleActionDice"]')
    const dependent = dialog.locator('input[name="trackActionDiceInCombat"]')
    if (await master.isChecked()) {
      await expect(dependent).toBeEnabled()
    } else {
      await expect(dependent).toBeDisabled()
    }

    await page.evaluate(async () => {
      await foundry.applications.instances.get('dcc-action-dice-settings')?.close()
    })
  })
})
