/* global ChatMessage, foundry, game, Hooks, Roll */

/**
 * `processSpellCheck` extracted from `module/dcc.js`.
 *
 * Stable extension surface — `game.dcc.processSpellCheck` is published
 * via the init hook in `module/dcc.js` and consumed by `DCCItem.rollSpellCheck`,
 * `DCCActor.rollSpellCheck`'s adapter-declined paths, and sibling content
 * modules. See `docs/dev/EXTENSION_API.md`'s Stable surface table and
 * `docs/00-progress.md`'s Decision #6 (permanent stable API, no
 * deprecation path).
 *
 * Pure refactor — the function body is byte-identical to the prior
 * inline definition. Continues to read `game.dcc.SpellResult` /
 * `game.dcc.FleetingLuck` rather than importing those modules directly,
 * mirroring how `module/actor.js`'s spell-check paths already invoke
 * them; keeps the init-time `game.dcc` registration order unchanged.
 */

/**
 * Handle the results of a spell check cast through any mechanism.
 * Apply a roll to a table and apply spell check logic for crits and fumbles.
 * @param {Actor} actor        The actor rolling the check
 * @param {Object} spellData    Information about the spell being cast
 * @returns {Object}            Table result object
 */
export async function processSpellCheck (actor, spellData) {
  // Unpack spellData
  // - rollTable (optional): the roll table for the spell's results
  // - roll: the roll object to evaluate for the spell
  // - item (optional): the item representing the spell or spell-like skill
  // - flavor: flavor text for the spell if no table is available to provide it
  const rollTable = spellData.rollTable
  const roll = spellData.roll
  const item = spellData.item
  const flavor = spellData.flavor
  const forceCrit = spellData.forceCrit || false
  const forceFumble = spellData.forceFumble || false
  // Opt-out flag: a caller can set `suppressPatronTaint: true` on the
  // spell-check call to skip DCC's built-in d100 patron-taint roll for this
  // cast — e.g. a variant module that implements its own patron mechanic and
  // reacts via the `dcc.afterSpellCheckResult` hook below. Defaults false, so
  // existing callers are unaffected.
  const suppressPatronTaint = spellData.suppressPatronTaint || false

  let crit = false
  let fumble = false
  let result = null

  // Make sure we evaluate the roll
  if (!roll._evaluated) {
    await roll.evaluate()
  }

  let naturalRoll = roll.dice[0].total

  // Force a critical for testing (shift-click)
  if (forceCrit && naturalRoll !== 1) {
    const originalDieRoll = naturalRoll
    naturalRoll = 20
    roll.terms[0].results[0].result = 20
    roll.terms[0]._total = 20
    roll._total += (20 - originalDieRoll)
  }

  // Force a fumble for testing (ctrl+shift-click). Unconditional (a forced
  // fumble always lands on a natural 1) so it's deterministic; the `!== 1`
  // guard just avoids a redundant no-op mutation.
  if (forceFumble && naturalRoll !== 1) {
    const originalDieRoll = naturalRoll
    naturalRoll = 1
    roll.terms[0].results[0].result = 1
    roll.terms[0]._total = 1
    roll._total += (1 - originalDieRoll)
  }

  // Check for Patron Taint
  let patronTaint = null
  if (item && actor) {
    const patronField = actor.system.class?.patron
    const spellName = item.name || ''
    const associatedPatron = item.system?.associatedPatron || ''

    // Check if actor has a patron and spell is patron-related
    if (!suppressPatronTaint && patronField && (spellName.includes('Patron') || associatedPatron)) {
      // Roll d100 for patron taint
      const patronTaintRoll = new Roll('1d100')
      await patronTaintRoll.evaluate()

      // Get current patron taint chance (parse percentage string like "1%")
      const patronTaintChanceStr = actor.system.class?.patronTaintChance || '1%'
      const currentChance = parseInt(patronTaintChanceStr) || 1

      // Check if taint occurred (roll <= chance)
      const tainted = patronTaintRoll.total <= currentChance

      // Calculate new patron taint chance
      const newChance = currentChance + 1

      // Store patron taint data for display
      patronTaint = {
        roll: patronTaintRoll.total,
        tainted,
        oldChance: currentChance,
        newChance,
        description: tainted
          ? `<strong>${game.i18n.localize('DCC.PatronTaintChance')}!</strong>`
          : game.i18n.localize('DCC.NoPatronTaint')
      }

      // Update actor's patron taint chance
      await actor.update({ 'system.class.patronTaintChance': `${newChance}%` })
    }
  }

  try {
    // Detect fumbles and crits before applying to table
    if (roll.dice.length > 0) {
      if (naturalRoll === 1) {
        fumble = true
      } else if (naturalRoll === 20) {
        if (actor.type === 'Player') {
          crit = true
        }
      }
    }

    // Apply the roll to the table if present
    if (rollTable) {
      result = rollTable.getResultsForRoll(roll.total)

      if (fumble) {
        result = rollTable.getResultsForRoll(1)
      } else if (crit) {
        const levelValue = parseInt(actor.system.details.level.value)
        const critRoll = roll.total + levelValue
        result = rollTable.getResultsForRoll(critRoll)
        roll.terms.push(new foundry.dice.terms.OperatorTerm({ operator: '+' }))
        roll.terms.push(new foundry.dice.terms.NumericTerm({ number: levelValue }))
        roll._formula += ` + ${levelValue}`
        roll._total += levelValue
      }

      const spellResultOptions = { crit, fumble, item, patronTaint }
      const messageData = {}
      if (flavor) {
        messageData.flavor = flavor
      }
      if (!item && actor) {
        messageData.speaker = ChatMessage.getSpeaker({ actor })
      }
      if (Object.keys(messageData).length) {
        spellResultOptions.messageData = messageData
      }
      await game.dcc.SpellResult.addChatMessage(roll, rollTable, result, spellResultOptions)
      // Otherwise just roll the dice
    } else {
      if (!roll._evaluated) {
        await roll.evaluate()
      }

      // Build the spell result indicator for pass/fail display
      const noTableLevel = item ? item.system.level : 1
      const noTableSuccess = roll.total >= (10 + noTableLevel * 2)
      let spellResultHtml = ''
      if (fumble) {
        spellResultHtml = `<p class="emote-alert fumble">${game.i18n.localize('DCC.SpellCheckFumbleNoTable')}</p>`
      } else if (crit) {
        spellResultHtml = `<p class="emote-alert critical">${game.i18n.localize('DCC.SpellCheckCritNoTable')}</p>`
      } else if (noTableSuccess) {
        spellResultHtml = `<p class="emote-alert critical">${game.i18n.localize('DCC.SpellCheckSuccessNoTable')}</p>`
      } else {
        spellResultHtml = `<p class="emote-alert fumble">${game.i18n.localize('DCC.SpellCheckFailureNoTable')}</p>`
      }

      // Generate flags for the roll
      const flags = {
        'dcc.RollType': 'SpellCheck',
        'dcc.isSpellCheck': true,
        'dcc.isSkillCheck': true,
        'dcc.ItemId': item?.id,
        'dcc.spellResult': spellResultHtml
      }
      game.dcc.FleetingLuck.updateFlags(flags, roll)

      // Display the roll
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor,
        flags,
        system: { spellId: item?.id }
      })
    }

    // Determine casting mode from the item or actor - default to wizard
    let castingMode = item ? item.system.config.castingMode : 'wizard'
    if (!item && actor.classId === 'cleric') {
      // Cleric sheets will use the cleric casting mode if not set by the item
      castingMode = 'cleric'
    }

    // Spell check threshold is 10 + spell level * 2, anything below this is a failure
    const level = item ? item.system.level : 1
    let success = roll.total >= (10 + level * 2)

    // Handle spell failure based on casting mode
    if (castingMode === 'wizard') {
      // Check if automation is enabled for Wizard spells
      const automate = game.settings.get('dcc', 'automateWizardSpellLoss')

      // Check for failed casting
      if (automate && !success) {
        // Lose the spell
        await actor.loseSpell(item)
      }
    } else if (castingMode === 'cleric') {
      // Check if automation is enabled for Cleric spells
      const automate = game.settings.get('dcc', 'automateClericDisapproval')

      // Check if our natural roll was inside the disapproval range
      if (automate && naturalRoll <= actor.system.class.disapproval) {
        // Trigger disapproval
        await actor.rollDisapproval(naturalRoll)

        // This is an automatic failure!
        success = false
      }

      // Check for a failure to cast
      if (automate && !success) {
        // Add a point of disapproval
        await actor.applyDisapproval()
      }
    }

    // Store the roll result in the item for display on the spells tab
    if (item) {
      await item.update({ 'system.lastResult': roll.total })
    }

    // Post-result extension point. Fires once per spell check after the
    // result is computed and rendered, so modules can react to the outcome
    // (e.g. a variant rolling its own patron-taint table on a natural 1).
    // Informational — listeners observe the result, they do not alter the
    // already-rendered chat message. Mirrors `dcc.modifyAttackRollTerms`'s
    // role for attacks, on the post-roll side for spell checks.
    Hooks.callAll('dcc.afterSpellCheckResult', actor, {
      roll,
      item,
      naturalRoll,
      total: roll.total,
      result,
      crit,
      fumble,
      success,
      castingMode,
      patronTaint,
      suppressPatronTaint,
      spellburn: spellData.spellburn || 0
    })
  } catch (ex) {
    console.error(ex)
  }
}
