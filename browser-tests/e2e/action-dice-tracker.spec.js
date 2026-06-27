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

  // Phase 3: roll-path auto-spend. Proves planActionDie + spendPlannedActionDie
  // walk the per-round budget live — first action spends slot 0, second spends
  // slot 1, third is over budget — and that the chat line localizes.
  test('plans and spends the per-round action-die budget, then flags over budget', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const mod = await import('../../../../../../../../systems/dcc/module/action-dice-tracker.mjs')

      const prevMaster = game.settings.get('dcc', 'multipleActionDice')
      await game.settings.set('dcc', 'multipleActionDice', true)

      let actor, combat
      try {
        actor = await Actor.create({
          name: 'P3 ActionDice Spend Probe',
          type: 'Player',
          system: { config: { actionDice: '1d20,1d16' } }
        })

        combat = await Combat.create({})
        await combat.createEmbeddedDocuments('Combatant', [{ actorId: actor.id }])
        await combat.startCombat()
        await combat.activate() // planActionDie reads game.combat (the active one)
        const combatant = combat.combatants.contents[0]

        // Off-path probe: with the master off, no plan even in combat.
        await game.settings.set('dcc', 'multipleActionDice', false)
        const offPlan = mod.planActionDie(actor, 'attack')
        await game.settings.set('dcc', 'multipleActionDice', true)

        // Action 1 → slot 0.
        const plan1 = mod.planActionDie(actor, 'attack')
        const desc1 = await mod.spendPlannedActionDie(plan1)
        const flag1 = combatant.getFlag('dcc', 'actionDice')

        // Action 2 → slot 1.
        const plan2 = mod.planActionDie(actor, 'attack')
        const desc2 = await mod.spendPlannedActionDie(plan2)
        const flag2 = combatant.getFlag('dcc', 'actionDice')

        // Action 3 → over budget (no write).
        const plan3 = mod.planActionDie(actor, 'attack')
        const desc3 = await mod.spendPlannedActionDie(plan3)
        const line3 = mod.formatActionDiceChatLine(desc3)

        const line1 = mod.formatActionDiceChatLine(desc1)

        return {
          offPlanNull: offPlan === null,
          choice1: plan1.choice.index,
          desc1,
          flag1,
          choice2: plan2.choice.index,
          desc2,
          flag2,
          choice3Null: plan3.choice === null,
          desc3,
          line1,
          line3
        }
      } finally {
        if (combat) await combat.delete()
        if (actor) await actor.delete()
        await game.settings.set('dcc', 'multipleActionDice', prevMaster)
      }
    })

    expect(result.offPlanNull).toBe(true)

    expect(result.choice1).toBe(0)
    expect(result.desc1).toEqual({ actionNumber: 1, count: 2, overBudget: false, die: '1d20' })
    expect(result.flag1.spent).toEqual([true, false])

    expect(result.choice2).toBe(1)
    expect(result.desc2).toEqual({ actionNumber: 2, count: 2, overBudget: false, die: '1d16' })
    expect(result.flag2.spent).toEqual([true, true])

    expect(result.choice3Null).toBe(true)
    expect(result.desc3).toEqual({ actionNumber: 3, count: 2, overBudget: true, die: '' })

    // The chat line localizes (real i18n, not the key) and names the die.
    expect(result.line1).toContain('1d20')
    expect(result.line1).not.toContain('ActionDiceChatLine')
    expect(result.line3).not.toContain('ActionDiceChatLineOverBudget')
  })
})
