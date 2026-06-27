/* eslint-disable no-undef -- Browser globals used in page.evaluate */
const { expect, createSessionTest } = require('./fixtures')

/**
 * Multiple action dice — Phase 2 combat-tracker pips (module/action-dice-tracker.mjs)
 * end-to-end against live Foundry. Proves, with the master + tracking settings
 * on, that a 2-die actor derives its `actionDice.list`, that the render hook
 * injects one pip per die into a combatant row, that the `combatTurn` auto-reset
 * refills a stale per-round state, and that a manual pip toggle persists. Uses
 * the live-served module so the deployed code is what is exercised; builds a
 * synthetic tracker `<li>` so the probe doesn't depend on the sidebar being open.
 */
const test = createSessionTest()

test.describe('Action-dice combat tracker pips', () => {
  test('derives pips, injects them, auto-resets on turn, and toggles by hand', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const mod = await import('../../../../../../../../systems/dcc/module/action-dice-tracker.mjs')

      // Capture + set the feature settings (restored in finally).
      const keys = ['multipleActionDice', 'trackActionDiceInCombat', 'autoResetActionDice', 'hideSingleActionDiePips']
      const prev = Object.fromEntries(keys.map(k => [k, game.settings.get('dcc', k)]))
      await game.settings.set('dcc', 'multipleActionDice', true)
      await game.settings.set('dcc', 'trackActionDiceInCombat', true)
      await game.settings.set('dcc', 'autoResetActionDice', true)
      await game.settings.set('dcc', 'hideSingleActionDiePips', true)

      let actor, combat
      try {
        // A 2-action-die actor (no class ⇒ both dice 'any'); the master setting
        // is on, so prepareDerivedData builds the structured list.
        actor = await Actor.create({
          name: 'P2 ActionDice Probe',
          type: 'Player',
          system: { config: { actionDice: '1d20,1d16' } }
        })
        const derivedCount = actor.system.attributes.actionDice.list?.length ?? 0

        combat = await Combat.create({})
        await combat.createEmbeddedDocuments('Combatant', [{ actorId: actor.id }])
        await combat.startCombat() // round 1, turn 0
        const combatant = combat.combatants.contents[0]

        // --- Render: inject pips into a synthetic combatant row ---
        const ol = document.createElement('ol')
        ol.innerHTML = `<li class="combatant" data-combatant-id="${combatant.id}"><div class="token-name"><strong class="name">${actor.name}</strong></div></li>`
        mod.onRenderCombatTrackerForActionDice({ viewed: combat }, ol)
        const pipEls = ol.querySelectorAll('.dcc-action-dice-pips .dcc-action-die-pip')
        const pipClasses = [...pipEls].map(e => e.className)

        // --- Auto-reset: stale state at a new round refills to all-unspent ---
        await combatant.setFlag('dcc', 'actionDice', { round: 0, spent: [true, true] })
        await combat.update({ round: 5 })
        await mod.onCombatTurnForActionDice(combat)
        const afterReset = combatant.getFlag('dcc', 'actionDice')

        // --- Manual toggle: flip pip 0 spent ---
        await mod.toggleActionDiePip(combatant, 0, 5)
        const afterToggle = combatant.getFlag('dcc', 'actionDice')

        return {
          derivedCount,
          pipCount: pipEls.length,
          pipClasses,
          afterReset,
          afterToggle
        }
      } finally {
        if (combat) await combat.delete()
        if (actor) await actor.delete()
        for (const k of keys) await game.settings.set('dcc', k, prev[k])
      }
    })

    // Derivation works live.
    expect(result.derivedCount).toBe(2)

    // One pip per die, both ready (unspent, unrestricted) on a fresh tracker.
    expect(result.pipCount).toBe(2)
    expect(result.pipClasses.every(c => c.includes('ready'))).toBe(true)

    // combatTurn refilled the stale round-0 state to round 5, all unspent.
    expect(result.afterReset).toEqual({ round: 5, spent: [false, false] })

    // Manual toggle flipped slot 0 spent, leaving slot 1 ready.
    expect(result.afterToggle).toEqual({ round: 5, spent: [true, false] })
  })

  test('renders nothing when the master setting is off', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const mod = await import('../../../../../../../../systems/dcc/module/action-dice-tracker.mjs')
      const prevMaster = game.settings.get('dcc', 'multipleActionDice')
      await game.settings.set('dcc', 'multipleActionDice', false)

      let actor, combat
      try {
        actor = await Actor.create({
          name: 'P2 ActionDice Off Probe',
          type: 'Player',
          system: { config: { actionDice: '1d20,1d16' } }
        })
        // No derived list when the master is off.
        const hasList = Array.isArray(actor.system.attributes.actionDice.list)

        combat = await Combat.create({})
        await combat.createEmbeddedDocuments('Combatant', [{ actorId: actor.id }])
        const combatant = combat.combatants.contents[0]

        const ol = document.createElement('ol')
        ol.innerHTML = `<li class="combatant" data-combatant-id="${combatant.id}"><div class="token-name"></div></li>`
        mod.onRenderCombatTrackerForActionDice({ viewed: combat }, ol)
        const injected = ol.querySelectorAll('.dcc-action-dice-pips').length

        return { hasList, injected }
      } finally {
        if (combat) await combat.delete()
        if (actor) await actor.delete()
        await game.settings.set('dcc', 'multipleActionDice', prevMaster)
      }
    })

    expect(result.hasList).toBe(false)
    expect(result.injected).toBe(0)
  })
})
