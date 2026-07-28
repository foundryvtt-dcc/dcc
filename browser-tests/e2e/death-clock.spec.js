/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Death clock (module/death-clock.mjs, issue #843 phase 1) end-to-end
 * against live Foundry. The session is the active GM, so the updateActor /
 * updateCombat reactions fire here: with enableDeathClock on, a leveled PC
 * dropped to 0 HP starts a (level)-round Dying countdown, combat round
 * advances tick it down to the dead status, healing clears it, and 0-level
 * PCs die immediately.
 */
const test = createSessionTest()

test.describe('Death clock', () => {
  test('a leveled PC at 0 HP starts a (level)-round clock; healing clears it', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const pollFor = async (fn, timeout = 2000) => {
        const deadline = Date.now() + timeout
        let value = await fn()
        while (Date.now() < deadline && !value) {
          await new Promise(resolve => setTimeout(resolve, 50))
          value = await fn()
        }
        return value
      }
      const prev = game.settings.get('dcc', 'enableDeathClock')
      await game.settings.set('dcc', 'enableDeathClock', true)

      const pc = await Actor.create({
        name: 'P_DeathClock PC',
        type: 'Player',
        system: { attributes: { hp: { value: 6, max: 6 } }, details: { level: { value: 2 } } }
      })
      const observed = {}
      try {
        const getDying = () => pc.effects?.contents?.find(e => e.statuses?.has?.('dying'))

        await pc.update({ 'system.attributes.hp.value': 0 })
        const dying = await pollFor(getDying)
        observed.dyingStarted = !!dying
        observed.roundsRemaining = dying?.getFlag('dcc', 'deathClock')?.roundsRemaining
        observed.dyingName = dying?.name
        observed.startCardPosted = !!(await pollFor(() =>
          game.messages.contents.slice(-5).find(m => m.content.includes('bleeding out') && m.content.includes(pc.name))))

        // Dropping further while dying does not restart or duplicate the clock.
        await pc.update({ 'system.attributes.hp.value': -3 })
        await new Promise(resolve => setTimeout(resolve, 300))
        observed.singleClock = pc.effects.contents.filter(e => e.statuses?.has?.('dying')).length === 1
        observed.roundsAfterRedrop = getDying()?.getFlag('dcc', 'deathClock')?.roundsRemaining

        // Healing above 0 clears the clock.
        await pc.update({ 'system.attributes.hp.value': 3 })
        observed.clearedOnHeal = await pollFor(() => !getDying())
        observed.notDead = !pc.effects.contents.some(e => e.statuses?.has?.('dead'))
      } finally {
        await game.settings.set('dcc', 'enableDeathClock', prev)
        await pc.delete()
      }
      return observed
    })

    expect(result.dyingStarted).toBe(true)
    expect(result.roundsRemaining).toBe(2) // level 2 → 2 rounds
    expect(result.startCardPosted).toBe(true)
    expect(result.singleClock).toBe(true)
    expect(result.roundsAfterRedrop).toBe(2)
    expect(result.clearedOnHeal).toBe(true)
    expect(result.notDead).toBe(true)
  })

  test('a 0-level PC at 0 HP dies immediately', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const pollFor = async (fn, timeout = 2000) => {
        const deadline = Date.now() + timeout
        let value = await fn()
        while (Date.now() < deadline && !value) {
          await new Promise(resolve => setTimeout(resolve, 50))
          value = await fn()
        }
        return value
      }
      const prev = game.settings.get('dcc', 'enableDeathClock')
      await game.settings.set('dcc', 'enableDeathClock', true)

      const pc = await Actor.create({
        name: 'P_DeathClock Funnel PC',
        type: 'Player',
        system: { attributes: { hp: { value: 3, max: 3 } }, details: { level: { value: 0 } } }
      })
      const observed = {}
      try {
        await pc.update({ 'system.attributes.hp.value': 0 })
        observed.dead = !!(await pollFor(() => pc.effects?.contents?.some(e => e.statuses?.has?.('dead'))))
        observed.noClock = !pc.effects.contents.some(e => e.statuses?.has?.('dying'))
      } finally {
        await game.settings.set('dcc', 'enableDeathClock', prev)
        await pc.delete()
      }
      return observed
    })

    expect(result.dead).toBe(true)
    expect(result.noClock).toBe(true)
  })

  test('combat rounds tick the clock down to death, with a tracker badge', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const pollFor = async (fn, timeout = 2000) => {
        const deadline = Date.now() + timeout
        let value = await fn()
        while (Date.now() < deadline && !value) {
          await new Promise(resolve => setTimeout(resolve, 50))
          value = await fn()
        }
        return value
      }
      const prev = game.settings.get('dcc', 'enableDeathClock')
      await game.settings.set('dcc', 'enableDeathClock', true)

      const pc = await Actor.create({
        name: 'P_DeathClock Combat PC',
        type: 'Player',
        system: { attributes: { hp: { value: 5, max: 5 } }, details: { level: { value: 2 } } }
      })
      const combat = await Combat.create({})
      const observed = {}
      try {
        await combat.createEmbeddedDocuments('Combatant', [{ actorId: pc.id }])
        await combat.startCombat()

        const getDying = () => pc.effects?.contents?.find(e => e.statuses?.has?.('dying'))
        await pc.update({ 'system.attributes.hp.value': 0 })
        await pollFor(getDying)
        observed.roundsAtStart = getDying()?.getFlag('dcc', 'deathClock')?.roundsRemaining

        // The tracker badge renders the remaining rounds. Drive the render
        // handler against a synthetic combatant row (the live tracker does
        // not render combatant rows in this headless world — same approach
        // as action-dice-tracker.spec.js).
        const mod = await import('../../../../../../../../systems/dcc/module/death-clock.mjs')
        const combatant = combat.combatants.contents[0]
        const ol = document.createElement('ol')
        ol.innerHTML = `<li class="combatant" data-combatant-id="${combatant.id}"><div class="token-name"><strong class="name">${pc.name}</strong></div></li>`
        mod.onRenderCombatTrackerForDeathClock({ viewed: combat }, ol)
        observed.badgeText = ol.querySelector('.dcc-death-clock')?.textContent ?? null

        // Round 1 → 2: one round burned.
        await combat.nextRound()
        await pollFor(() => getDying()?.getFlag('dcc', 'deathClock')?.roundsRemaining === 1)
        observed.roundsAfterOne = getDying()?.getFlag('dcc', 'deathClock')?.roundsRemaining

        // Round 2 → 3: the clock expires — dead status, clock gone, chat card.
        await combat.nextRound()
        observed.dead = !!(await pollFor(() => pc.effects?.contents?.some(e => e.statuses?.has?.('dead'))))
        observed.clockGone = await pollFor(() => !getDying())
        observed.deathCardPosted = !!(await pollFor(() =>
          game.messages.contents.slice(-5).find(m => m.content.includes(pc.name) && m.content.includes('died'))))
      } finally {
        await game.settings.set('dcc', 'enableDeathClock', prev)
        await combat.delete()
        await pc.delete()
      }
      return observed
    })

    expect(result.roundsAtStart).toBe(2)
    expect(result.badgeText).toContain('2')
    expect(result.roundsAfterOne).toBe(1)
    expect(result.dead).toBe(true)
    expect(result.clockGone).toBe(true)
    expect(result.deathCardPosted).toBe(true)
  })

  test('the clock does not run while the setting is off', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const prev = game.settings.get('dcc', 'enableDeathClock')
      await game.settings.set('dcc', 'enableDeathClock', false)

      const pc = await Actor.create({
        name: 'P_DeathClock Disabled PC',
        type: 'Player',
        system: { attributes: { hp: { value: 5, max: 5 } }, details: { level: { value: 2 } } }
      })
      const observed = {}
      try {
        await pc.update({ 'system.attributes.hp.value': 0 })
        await new Promise(resolve => setTimeout(resolve, 500))
        observed.noClock = !pc.effects.contents.some(e => e.statuses?.has?.('dying'))
        observed.notDead = !pc.effects.contents.some(e => e.statuses?.has?.('dead'))
      } finally {
        await game.settings.set('dcc', 'enableDeathClock', prev)
        await pc.delete()
      }
      return observed
    })

    expect(result.noClock).toBe(true)
    expect(result.notDead).toBe(true)
  })
})
