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

test.describe('Automated Fleeting Luck die-size gate', () => {
  /**
   * Roll a skill item on the given die with the die forced to a natural 1 and
   * return the new card's FleetingLuckEffect flag (null when unset).
   */
  async function rollNaturalOneSkill (page, die) {
    return page.evaluate(async (skillDie) => {
      const priorAutomate = game.settings.get('dcc', 'automateFleetingLuck')
      // Foundry: Math.ceil((1 - u) * faces); u → 1 rolls a natural 1 on any die
      const origRandomUniform = CONFIG.Dice.randomUniform
      let actor
      let effect
      try {
        // The flag is written regardless of the setting; keep the GM hook from
        // acting on it so the test never clears real luck in the world.
        await game.settings.set('dcc', 'automateFleetingLuck', false)
        actor = await Actor.create({ name: `FL Gate ${skillDie}`, type: 'Player' })
        await actor.createEmbeddedDocuments('Item', [{
          name: `FL-Gate-Skill-${skillDie}`,
          type: 'skill',
          system: {
            die: skillDie,
            value: '+0',
            config: { useDie: true, useAbility: false, useValue: true, useLevel: false, applyCheckPenalty: false }
          }
        }])
        const before = new Set(game.messages.contents.map(m => m.id))
        CONFIG.Dice.randomUniform = () => 0.9999
        await actor.rollSkillCheck(`FL-Gate-Skill-${skillDie}`)
        const deadline = Date.now() + 5000
        while (Date.now() < deadline && effect === undefined) {
          const msg = game.messages.contents.find(m => !before.has(m.id) && m.getFlag('dcc', 'isSkillCheck'))
          if (msg) effect = msg.getFlag('dcc', 'FleetingLuckEffect') ?? null
          else await new Promise(resolve => setTimeout(resolve, 50))
        }
      } finally {
        CONFIG.Dice.randomUniform = origRandomUniform
        await actor?.delete()
        await game.settings.set('dcc', 'automateFleetingLuck', priorAutomate)
      }
      return effect
    }, die)
  }

  test('a natural 1 on a small skill die (Orc rage die) does not lose luck', async ({ page }) => {
    expect(await rollNaturalOneSkill(page, '1d3')).toBeNull()
  })

  test('a natural 1 on a d20 skill check still loses luck', async ({ page }) => {
    expect(await rollNaturalOneSkill(page, '1d20')).toBe('Lose')
  })
})
