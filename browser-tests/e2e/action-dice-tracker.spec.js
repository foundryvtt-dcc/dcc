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
    expect(result.desc1).toEqual({ actionNumber: 1, count: 2, overBudget: false, noEligibleDie: false, die: '1d20' })
    expect(result.flag1.spent).toEqual([true, false])

    expect(result.choice2).toBe(1)
    expect(result.desc2).toEqual({ actionNumber: 2, count: 2, overBudget: false, noEligibleDie: false, die: '1d16' })
    expect(result.flag2.spent).toEqual([true, true])

    expect(result.choice3Null).toBe(true)
    // Both dice 'any' and both spent ⇒ over budget, not "no eligible die".
    expect(result.desc3).toEqual({ actionNumber: 3, count: 2, overBudget: true, noEligibleDie: false, die: '' })

    // The chat line localizes (real i18n, not the key) and names the die.
    expect(result.line1).toContain('1d20')
    expect(result.line1).not.toContain('ActionDiceChatLine')
    expect(result.line3).not.toContain('ActionDiceChatLineOverBudget')
  })

  // Phase 4 (soft spells-only filtering / D1): a wizard's second die is
  // spells-only (authored `1d16*spell`), so once the first die is spent a
  // weapon attack finds no eligible die. The plan records the restricted die,
  // the chat line reads "no eligible action die" (not "over budget"), and the
  // soft-filter warning names the action + die — but the roll is never blocked.
  test('a spells-only die is not offered for a weapon attack — warn, not block', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const mod = await import('../../../../../../../../systems/dcc/module/action-dice-tracker.mjs')

      const prevMaster = game.settings.get('dcc', 'multipleActionDice')
      await game.settings.set('dcc', 'multipleActionDice', true)

      let actor, combat
      try {
        // Explicit `*spell` tag ⇒ slot 1 is spells-only regardless of class.
        actor = await Actor.create({
          name: 'P4 SpellsOnly Probe',
          type: 'Player',
          system: { config: { actionDice: '1d20,1d16*spell' } }
        })
        const uses = (actor.system.attributes.actionDice.list || []).map(s => s.use)

        combat = await Combat.create({})
        await combat.createEmbeddedDocuments('Combatant', [{ actorId: actor.id }])
        await combat.startCombat()
        await combat.activate()

        // Fresh round: the first eligible die for either action is slot 0 (the
        // unrestricted 'any' die comes first — 'any' matches everything).
        const freshSpellChoice = mod.planActionDie(actor, 'spell').choice?.index ?? null

        // Attack action 1 → slot 0 (the 'any' die). Spend it.
        const atkPlan1 = mod.planActionDie(actor, 'attack')
        await mod.spendPlannedActionDie(atkPlan1)

        // With slot 0 spent: the spells-only die is now the next die — eligible
        // for a spell (index 1) but NOT for a weapon attack (no eligible die).
        const spellAfterSpend = mod.planActionDie(actor, 'spell').choice?.index ?? null
        const atkPlan2 = mod.planActionDie(actor, 'attack')
        const desc2 = await mod.spendPlannedActionDie(atkPlan2)
        const warning = mod.noEligibleActionDieWarning(atkPlan2, 'attack')
        const line2 = mod.formatActionDiceChatLine(desc2)

        return {
          uses,
          freshSpellChoice,
          atk1ChoiceIndex: atkPlan1.choice?.index ?? null,
          spellAfterSpend,
          atk2ChoiceNull: atkPlan2.choice === null,
          atk2Restricted: atkPlan2.restrictedUnspentDice,
          desc2,
          warning,
          line2
        }
      } finally {
        if (combat) await combat.delete()
        if (actor) await actor.delete()
        await game.settings.set('dcc', 'multipleActionDice', prevMaster)
      }
    })

    // Slot 1 is spells-only; slot 0 is unrestricted.
    expect(result.uses).toEqual(['any', 'spell'])

    // On a fresh round both actions take slot 0 (the unrestricted die first).
    expect(result.freshSpellChoice).toBe(0)
    expect(result.atk1ChoiceIndex).toBe(0)

    // After slot 0 is spent, the spells-only die serves a spell (index 1) but
    // not a weapon attack — which finds no eligible die (not "over budget":
    // the spells-only die is unspent, just ineligible).
    expect(result.spellAfterSpend).toBe(1)
    expect(result.atk2ChoiceNull).toBe(true)
    expect(result.atk2Restricted).toEqual(['1d16'])
    expect(result.desc2.noEligibleDie).toBe(true)

    // The warning localizes (real i18n) and names the restricted die; the chat
    // line uses the no-eligible-die wording, not over-budget.
    expect(result.warning).toContain('1d16')
    expect(result.warning).not.toContain('ActionDiceNoEligibleWarning')
    expect(result.line2).toContain('no eligible')
  })

  // Phase 3 (hardening): player action-die spends route through the active GM
  // (a player owns their actor but not the combatant, so a direct setFlag is
  // rejected). Exercises the registered `WRITE_ACTION_DICE` socket handler
  // end-to-end via the GM socket API — resolve combatant, ownership check, write.
  test('the GM-side socket handler writes a requested action-die spend', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const mod = await import('../../../../../../../../systems/dcc/module/action-dice-tracker.mjs')
      const prevMaster = game.settings.get('dcc', 'multipleActionDice')
      await game.settings.set('dcc', 'multipleActionDice', true)

      let actor, combat
      try {
        actor = await Actor.create({
          name: 'P3 Socket Spend Probe',
          type: 'Player',
          system: { config: { actionDice: '1d20,1d16' } }
        })
        combat = await Combat.create({})
        await combat.createEmbeddedDocuments('Combatant', [{ actorId: actor.id }])
        await combat.startCombat()
        const combatant = combat.combatants.contents[0]

        const socketExposed = !!game.dcc?.socket?.executeAsGM
        // As the active GM, executeAsGM runs the registered handler locally.
        await game.dcc.socket.executeAsGM(mod.WRITE_ACTION_DICE, {
          combatantUuid: combatant.uuid,
          state: { round: combat.round, spent: [true, false] }
        })
        const flag = combatant.getFlag('dcc', 'actionDice')
        return { socketExposed, flagSpent: flag?.spent, flagRound: flag?.round, round: combat.round }
      } finally {
        if (combat) await combat.delete()
        if (actor) await actor.delete()
        await game.settings.set('dcc', 'multipleActionDice', prevMaster)
      }
    })

    expect(result.socketExposed).toBe(true)
    expect(result.flagSpent).toEqual([true, false])
    expect(result.flagRound).toBe(result.round)
  })

  // Phase 3 (sub-branch): a roll-under Luck check is an action, so it spends a
  // die and shows the line. The spent slot's die is rolled (consistent with
  // other check paths), so the second action rolls the smaller die — exercises
  // the `_rollLuckCheckViaAdapter` branch + `renderAbilityCheckRollUnder`.
  test('roll-under Luck checks spend the budget and roll the spent die', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const prevMaster = game.settings.get('dcc', 'multipleActionDice')
      await game.settings.set('dcc', 'multipleActionDice', true)

      let actor, combat
      const createdMessageIds = []
      try {
        actor = await Actor.create({
          name: 'P3 RollUnder Spend Probe',
          type: 'Player',
          system: { config: { actionDice: '1d20,1d16' } }
        })
        combat = await Combat.create({})
        await combat.createEmbeddedDocuments('Combatant', [{ actorId: actor.id }])
        await combat.startCombat()
        await combat.activate()
        const combatant = combat.combatants.contents[0]
        const msgIdsBefore = new Set(game.messages.contents.map(m => m.id))

        await actor.rollAbilityCheck('lck', { rollUnder: true })
        const flag1 = combatant.getFlag('dcc', 'actionDice')
        await actor.rollAbilityCheck('lck', { rollUnder: true })
        const flag2 = combatant.getFlag('dcc', 'actionDice')

        const actorMsgs = game.messages.contents.filter(m => m.speaker?.actor === actor.id)
        for (const m of game.messages.contents) {
          if (!msgIdsBefore.has(m.id)) createdMessageIds.push(m.id)
        }
        const firstContent = actorMsgs[0]?.content || ''
        const lastContent = actorMsgs[actorMsgs.length - 1]?.content || ''

        return {
          flag1Spent: flag1?.spent,
          flag2Spent: flag2?.spent,
          firstHasLine: firstContent.includes('dcc-action-dice-line'),
          firstMentionsD20: firstContent.includes('1d20'),
          lastMentionsAction2: lastContent.includes('2 of 2'),
          lastMentionsD16: lastContent.includes('1d16')
        }
      } finally {
        for (const id of createdMessageIds) {
          const m = game.messages.get(id)
          if (m) await m.delete()
        }
        if (combat) await combat.delete()
        if (actor) await actor.delete()
        await game.settings.set('dcc', 'multipleActionDice', prevMaster)
      }
    })

    // Budget advances one slot per Luck check.
    expect(result.flag1Spent).toEqual([true, false])
    expect(result.flag2Spent).toEqual([true, true])

    // Action 1 rolls/labels d20 (slot 0); action 2 the smaller d16 (slot 1).
    expect(result.firstHasLine).toBe(true)
    expect(result.firstMentionsD20).toBe(true)
    expect(result.lastMentionsAction2).toBe(true)
    expect(result.lastMentionsD16).toBe(true)
  })

  // Phase 4 (preset filtering / Sim 3 step 2): the roll-modifier dialog's
  // action-die presets are filtered by the slot's use tag, so a weapon attack
  // never offers a spells-only die. Exercises the live `getActionDice` against a
  // real derived `actionDice.list` (built because the master setting is on).
  test('getActionDice filters the spells-only preset for an attack, not a spell', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const prevMaster = game.settings.get('dcc', 'multipleActionDice')

      let actor
      try {
        // Master OFF first: no derived list ⇒ forAction is a no-op (off-path).
        await game.settings.set('dcc', 'multipleActionDice', false)
        actor = await Actor.create({
          name: 'P4 Preset Filter Probe',
          type: 'Player',
          system: { config: { actionDice: '1d20,1d16*spell' } }
        })
        const offFormulas = actor.getActionDice({ includeUntrained: true, forAction: 'attack' }).map(d => d.formula)

        // Master ON: prepareDerivedData builds the list (slot 1 = spells-only).
        await game.settings.set('dcc', 'multipleActionDice', true)
        actor.prepareData()
        const uses = (actor.system.attributes.actionDice.list || []).map(s => s.use)

        const attackFormulas = actor.getActionDice({ includeUntrained: true, forAction: 'attack' }).map(d => d.formula)
        const spellFormulas = actor.getActionDice({ includeUntrained: true, forAction: 'spell' }).map(d => d.formula)
        const unfilteredFormulas = actor.getActionDice({ includeUntrained: true }).map(d => d.formula)

        return { offFormulas, uses, attackFormulas, spellFormulas, unfilteredFormulas }
      } finally {
        if (actor) await actor.delete()
        await game.settings.set('dcc', 'multipleActionDice', prevMaster)
      }
    })

    // Off-path: forAction does nothing without a derived list (both dice shown).
    expect(result.offFormulas.some(f => f.startsWith('1d16'))).toBe(true)

    // On: slot 1 is spells-only.
    expect(result.uses).toEqual(['any', 'spell'])

    // A weapon attack drops the spells-only die but keeps the d20 + untrained.
    expect(result.attackFormulas).toContain('1d20')
    expect(result.attackFormulas).toContain('1d10')
    expect(result.attackFormulas.some(f => f.startsWith('1d16'))).toBe(false)

    // A spell check keeps the spells-only die; no filter without forAction.
    expect(result.spellFormulas.some(f => f.startsWith('1d16'))).toBe(true)
    expect(result.unfilteredFormulas.some(f => f.startsWith('1d16'))).toBe(true)
  })

  // Phase 3 (continued): the skill-check roll path spends an action die and
  // surfaces the "Action N of M" line. Drives the real `rollSkillCheck`
  // dispatcher end-to-end: a 2-die actor in combat rolls a skill twice — the
  // first action spends slot 0 (d20), the second spends slot 1 (d16) and the
  // emitted chat card carries the localized action-dice line.
  test('skill-check rolls spend the per-round budget and emit the action line', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const prevMaster = game.settings.get('dcc', 'multipleActionDice')
      await game.settings.set('dcc', 'multipleActionDice', true)

      let actor, combat
      const createdMessageIds = []
      try {
        actor = await Actor.create({
          name: 'P3 Skill Spend Probe',
          type: 'Player',
          system: { config: { actionDice: '1d20,1d16' } }
        })
        // A rollable skill item (useDie) so resolution is deterministic and
        // takes the standard `_rollSkillCheckViaAdapter` branch.
        await actor.createEmbeddedDocuments('Item', [{
          name: 'Probe Skill',
          type: 'skill',
          system: { config: { useDie: true }, die: '1d20' }
        }])

        combat = await Combat.create({})
        await combat.createEmbeddedDocuments('Combatant', [{ actorId: actor.id }])
        await combat.startCombat()
        await combat.activate() // planActionDie reads game.combat (the active one)
        const combatant = combat.combatants.contents[0]

        const msgIdsBefore = new Set(game.messages.contents.map(m => m.id))

        // Action 1 → slot 0 (d20).
        await actor.rollSkillCheck('Probe Skill')
        const flag1 = combatant.getFlag('dcc', 'actionDice')

        // Action 2 → slot 1 (d16).
        await actor.rollSkillCheck('Probe Skill')
        const flag2 = combatant.getFlag('dcc', 'actionDice')

        const actorMsgs = game.messages.contents.filter(m => m.speaker?.actor === actor.id)
        for (const m of game.messages.contents) {
          if (!msgIdsBefore.has(m.id)) createdMessageIds.push(m.id)
        }
        const lastContent = actorMsgs[actorMsgs.length - 1]?.content || ''
        const firstContent = actorMsgs[0]?.content || ''

        return {
          flag1Spent: flag1?.spent,
          flag2Spent: flag2?.spent,
          firstHasLine: firstContent.includes('dcc-action-dice-line'),
          lastHasLine: lastContent.includes('dcc-action-dice-line'),
          lastMentionsAction2: lastContent.includes('2 of 2'),
          lastMentionsD16: lastContent.includes('1d16')
        }
      } finally {
        for (const id of createdMessageIds) {
          const m = game.messages.get(id)
          if (m) await m.delete()
        }
        if (combat) await combat.delete()
        if (actor) await actor.delete()
        await game.settings.set('dcc', 'multipleActionDice', prevMaster)
      }
    })

    // The per-round budget advances one slot per skill check.
    expect(result.flag1Spent).toEqual([true, false])
    expect(result.flag2Spent).toEqual([true, true])

    // Both emitted cards carry the action-dice line; the second names the
    // smaller die and "Action 2 of 2".
    expect(result.firstHasLine).toBe(true)
    expect(result.lastHasLine).toBe(true)
    expect(result.lastMentionsAction2).toBe(true)
    expect(result.lastMentionsD16).toBe(true)
  })

  // Phase 3 (continued): the ability-check roll path spends an action die and
  // surfaces the "Action N of M" line. Drives the real `rollAbilityCheck`
  // dispatcher: a 2-die actor in combat rolls a Strength check twice — the
  // first action spends slot 0 (d20), the second spends slot 1 (d16) and the
  // emitted chat card carries the localized action-dice line.
  test('ability-check rolls spend the per-round budget and emit the action line', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const prevMaster = game.settings.get('dcc', 'multipleActionDice')
      await game.settings.set('dcc', 'multipleActionDice', true)

      let actor, combat
      const createdMessageIds = []
      try {
        actor = await Actor.create({
          name: 'P3 AbilityCheck Spend Probe',
          type: 'Player',
          system: { config: { actionDice: '1d20,1d16' } }
        })

        combat = await Combat.create({})
        await combat.createEmbeddedDocuments('Combatant', [{ actorId: actor.id }])
        await combat.startCombat()
        await combat.activate() // planActionDie reads game.combat (the active one)
        const combatant = combat.combatants.contents[0]

        const msgIdsBefore = new Set(game.messages.contents.map(m => m.id))

        // Action 1 → slot 0 (d20).
        await actor.rollAbilityCheck('str')
        const flag1 = combatant.getFlag('dcc', 'actionDice')

        // Action 2 → slot 1 (d16).
        await actor.rollAbilityCheck('str')
        const flag2 = combatant.getFlag('dcc', 'actionDice')

        const actorMsgs = game.messages.contents.filter(m => m.speaker?.actor === actor.id)
        for (const m of game.messages.contents) {
          if (!msgIdsBefore.has(m.id)) createdMessageIds.push(m.id)
        }
        const lastContent = actorMsgs[actorMsgs.length - 1]?.content || ''
        const firstContent = actorMsgs[0]?.content || ''

        return {
          flag1Spent: flag1?.spent,
          flag2Spent: flag2?.spent,
          firstHasLine: firstContent.includes('dcc-action-dice-line'),
          lastHasLine: lastContent.includes('dcc-action-dice-line'),
          lastMentionsAction2: lastContent.includes('2 of 2'),
          lastMentionsD16: lastContent.includes('1d16')
        }
      } finally {
        for (const id of createdMessageIds) {
          const m = game.messages.get(id)
          if (m) await m.delete()
        }
        if (combat) await combat.delete()
        if (actor) await actor.delete()
        await game.settings.set('dcc', 'multipleActionDice', prevMaster)
      }
    })

    // The per-round budget advances one slot per ability check.
    expect(result.flag1Spent).toEqual([true, false])
    expect(result.flag2Spent).toEqual([true, true])

    // Both emitted cards carry the action-dice line; the second names the
    // smaller die and "Action 2 of 2".
    expect(result.firstHasLine).toBe(true)
    expect(result.lastHasLine).toBe(true)
    expect(result.lastMentionsAction2).toBe(true)
    expect(result.lastMentionsD16).toBe(true)
  })

  // Phase 3 / D2 (§10): the high-level `1d20+4, 1d20, 1d16` line keeps its +4
  // rider on slot 0 only. The action-die chat line names `1d20+4` for the first
  // action (matching the die the incumbent path rolls from
  // `attributes.actionDice.value`) and bare smaller dice for the next two — the
  // +4 never leaks onto the extra dice, the guard against double-counting the
  // attack bonus. Walked deterministically via plan/spend (no random rolls).
  test('a 1d20+4 line rides the +4 on the first action only', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const mod = await import('../../../../../../../../systems/dcc/module/action-dice-tracker.mjs')

      const prevMaster = game.settings.get('dcc', 'multipleActionDice')
      await game.settings.set('dcc', 'multipleActionDice', true)

      let actor, combat
      try {
        // config carries the full line; value carries the first die WITH its
        // rider (what actor-level-change.js writes for a real high-level actor).
        actor = await Actor.create({
          name: 'P3 D2 Rider Probe',
          type: 'Player',
          system: {
            config: { actionDice: '1d20+4,1d20,1d16' },
            attributes: { actionDice: { value: '1d20+4' } }
          }
        })
        const derivedModifiers = (actor.system.attributes.actionDice.list || []).map(s => s.modifier)

        combat = await Combat.create({})
        await combat.createEmbeddedDocuments('Combatant', [{ actorId: actor.id }])
        await combat.startCombat()
        await combat.activate()

        const dice = []
        for (let i = 0; i < 3; i++) {
          const plan = mod.planActionDie(actor, 'attack')
          const desc = await mod.spendPlannedActionDie(plan)
          dice.push(desc.die)
        }
        return { derivedModifiers, dice }
      } finally {
        if (combat) await combat.delete()
        if (actor) await actor.delete()
        await game.settings.set('dcc', 'multipleActionDice', prevMaster)
      }
    })

    // The rider is captured on slot 0 only by the derivation.
    expect(result.derivedModifiers).toEqual([4, 0, 0])

    // The chat-line die names the rider once (action 1) and bare extras after —
    // no +4 leak onto the second or third action.
    expect(result.dice).toEqual(['1d20+4', '1d20', '1d16'])
  })

  // Phase 3 (continued): the spell-check roll path spends an action die and
  // surfaces the "Action N of M" line. Drives the real `rollSpellCheck`
  // dispatcher with a generic-castingMode spell (the side-effect-free
  // `_castViaCastSpell` branch): a 2-die actor in combat casts twice — the
  // first action spends slot 0 (d20), the second spends slot 1 (d16) and the
  // emitted chat card carries the localized action-dice line.
  test('spell-check rolls spend the per-round budget and emit the action line', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const prevMaster = game.settings.get('dcc', 'multipleActionDice')
      await game.settings.set('dcc', 'multipleActionDice', true)

      let actor, combat
      const createdMessageIds = []
      try {
        actor = await Actor.create({
          name: 'P3 SpellCheck Spend Probe',
          type: 'Player',
          system: { config: { actionDice: '1d20,1d16' } }
        })
        // A generic-castingMode spell so the cast is side-effect-free and takes
        // the `_castViaCastSpell` branch (no spell-loss / disapproval).
        await actor.createEmbeddedDocuments('Item', [{
          name: 'Probe Spell',
          type: 'spell',
          system: { config: { castingMode: 'generic' }, spellCheck: { die: '1d20', value: '+0' } }
        }])

        combat = await Combat.create({})
        await combat.createEmbeddedDocuments('Combatant', [{ actorId: actor.id }])
        await combat.startCombat()
        await combat.activate() // planActionDie reads game.combat (the active one)
        const combatant = combat.combatants.contents[0]

        const msgIdsBefore = new Set(game.messages.contents.map(m => m.id))

        // Action 1 → slot 0 (d20).
        await actor.rollSpellCheck({ spell: 'Probe Spell' })
        const flag1 = combatant.getFlag('dcc', 'actionDice')

        // Action 2 → slot 1 (d16).
        await actor.rollSpellCheck({ spell: 'Probe Spell' })
        const flag2 = combatant.getFlag('dcc', 'actionDice')

        const actorMsgs = game.messages.contents.filter(m => m.speaker?.actor === actor.id)
        for (const m of game.messages.contents) {
          if (!msgIdsBefore.has(m.id)) createdMessageIds.push(m.id)
        }
        const lastContent = actorMsgs[actorMsgs.length - 1]?.content || ''
        const firstContent = actorMsgs[0]?.content || ''

        return {
          flag1Spent: flag1?.spent,
          flag2Spent: flag2?.spent,
          firstHasLine: firstContent.includes('dcc-action-dice-line'),
          lastHasLine: lastContent.includes('dcc-action-dice-line'),
          lastMentionsAction2: lastContent.includes('2 of 2'),
          lastMentionsD16: lastContent.includes('1d16')
        }
      } finally {
        for (const id of createdMessageIds) {
          const m = game.messages.get(id)
          if (m) await m.delete()
        }
        if (combat) await combat.delete()
        if (actor) await actor.delete()
        await game.settings.set('dcc', 'multipleActionDice', prevMaster)
      }
    })

    // The per-round budget advances one slot per spell check.
    expect(result.flag1Spent).toEqual([true, false])
    expect(result.flag2Spent).toEqual([true, true])

    // Both emitted cards carry the action-dice line; the second names the
    // smaller die and "Action 2 of 2".
    expect(result.firstHasLine).toBe(true)
    expect(result.lastHasLine).toBe(true)
    expect(result.lastMentionsAction2).toBe(true)
    expect(result.lastMentionsD16).toBe(true)
  })
})
