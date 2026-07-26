/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Award Fleeting Luck via the Players list context menu (issue #826).
 *
 * The v14 Players application collects `getUserContextOptions` exactly once at
 * its first render (before the `ready` hook), so the system registers the
 * Award Fleeting Luck entry at import time and gates it dynamically through
 * the entry's `visible` predicate. These tests drive the real context menu:
 * right-click a non-GM player entry, assert the option appears (only when the
 * setting is enabled), and click it to verify a point of luck is awarded.
 */
const test = createSessionTest()

/** Enable/restore the setting and ensure a non-GM user exists to right-click. */
async function setupLuckTarget (page, enabled) {
  return page.evaluate(async (enableSetting) => {
    const priorSetting = game.settings.get('dcc', 'enableFleetingLuck')
    await game.settings.set('dcc', 'enableFleetingLuck', enableSetting)
    let user = game.users.find(u => !u.isGM)
    let created = false
    if (!user) {
      user = await User.create({ name: 'Luck Probe Player', role: CONST.USER_ROLES.PLAYER })
      created = true
    }
    await user.unsetFlag('dcc', 'fleetingLuckValue')
    return { priorSetting, userId: user.id, created }
  }, enabled)
}

async function cleanupLuckTarget (page, setup) {
  await page.evaluate(async ({ userId, created, priorSetting }) => {
    const user = game.users.get(userId)
    if (created) {
      await user?.delete()
    } else {
      await user?.unsetFlag('dcc', 'fleetingLuckValue')
    }
    await game.settings.set('dcc', 'enableFleetingLuck', priorSetting)
  }, setup)
}

/** Right-click the player's entry in the (expanded) Players list. */
async function openPlayerContextMenu (page, userId) {
  // Offline users live in the #players-inactive list, hidden unless expanded
  await page.evaluate(() => document.getElementById('players').classList.add('expanded'))
  await page.locator(`#players li.player[data-user-id="${userId}"]`).click({ button: 'right' })
}

test.describe('Award Fleeting Luck via Players context menu', () => {
  test('GM right-click on a player shows the option and awards a point of luck', async ({ page }) => {
    const setup = await setupLuckTarget(page, true)
    try {
      await openPlayerContextMenu(page, setup.userId)

      const award = page.locator('#context-menu li.context-item:has-text("Award Fleeting Luck")')
      await expect(award).toBeVisible()
      await award.click()

      // FleetingLuck.give is async (setFlag + chat message) — poll the flag
      await expect.poll(() =>
        page.evaluate((id) => game.users.get(id).getFlag('dcc', 'fleetingLuckValue'), setup.userId)
      ).toBe(1)
    } finally {
      await cleanupLuckTarget(page, setup)
    }
  })

  test('option is hidden when Enable Fleeting Luck is off', async ({ page }) => {
    const setup = await setupLuckTarget(page, false)
    try {
      await openPlayerContextMenu(page, setup.userId)

      // The core menu opens, but the DCC entry is filtered out by `visible`
      await expect(page.locator('#context-menu')).toBeVisible()
      await expect(page.locator('#context-menu li.context-item:has-text("Award Fleeting Luck")')).toHaveCount(0)
      await page.keyboard.press('Escape')
    } finally {
      await cleanupLuckTarget(page, setup)
    }
  })
})
