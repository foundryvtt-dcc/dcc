/* global ChatMessage, foundry, game, Hooks, Roll */

/**
 * `processSpellCheck` extracted from `module/dcc.js`.
 *
 * Stable extension surface — `game.dcc.processSpellCheck` is published
 * via the init hook in `module/dcc.js` and consumed by `DCCItem.rollSpellCheck`,
 * `DCCActor.rollSpellCheck`'s adapter-declined paths, and sibling content
 * modules. See `docs/dev/EXTENSION_API.md`'s Stable surface table
 * (permanent stable API, no deprecation path).
 *
 * Originally a pure (byte-identical) extraction of the inline definition;
 * since extended with the explicit `castingMode` override (issue #375).
 * Continues to read `game.dcc.SpellResult` /
 * `game.dcc.FleetingLuck` rather than importing those modules directly,
 * mirroring how `module/actor.js`'s spell-check paths already invoke
 * them; keeps the init-time `game.dcc` registration order unchanged.
 * (`actionDiceLineHtml` is the one direct import — a pure string formatter
 * with no init-time side effects, so it carries no ordering risk.)
 */

import { actionDiceLineHtml } from './adapter/chat-renderer.mjs'

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
  // - castingMode (optional): explicit casting mode ('generic', 'wizard', or
  //   'cleric') for the failure automation below. Takes precedence over the
  //   item's configured casting mode and the sheet-class default, so custom
  //   skills with spell-like features can opt into wizard spell loss or
  //   cleric disapproval handling (issue #375).
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
  // Multiple-action-dice "Action N of M" line (#834), supplied by
  // `DCCItem.rollSpellCheck`. Optional and empty on the off-path, so callers
  // that never set it — including sibling content modules calling this stable
  // API — render byte-identically to before.
  const actionDiceChatLine = spellData.actionDiceChatLine || ''

  let crit = false
  let fumble = false
  let result = null

  // Make sure we evaluate the roll
  if (!roll._evaluated) {
    await roll.evaluate()
  }

  let naturalRoll = roll.dice[0].total

  // Force a critical for testing (shift-click). Lands on the die's own max face
  // rather than a literal 20, so it still registers as a crit when the action
  // die is smaller than a d20 (see the faces-aware detection below) — and never
  // writes a result the die cannot roll.
  if (forceCrit && naturalRoll !== 1) {
    const originalDieRoll = naturalRoll
    const critFace = roll.dice[0].faces || 20
    naturalRoll = critFace
    roll.terms[0].results[0].result = critFace
    roll.terms[0]._total = critFace
    roll._total += (critFace - originalDieRoll)
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

  // Determine casting mode early — the disapproval auto-failure below and
  // the failure automation both key off it. An explicit override from the
  // caller wins, then the item's configuration, defaulting to wizard; cleric
  // sheets fall back to cleric for item-less checks (issue #375).
  // Optional-chained: this is a stable extension API and runs before the
  // try/catch — a sibling module's item-like object without `system.config`
  // must not throw out of the call.
  let castingMode = spellData.castingMode || (item ? item.system?.config?.castingMode : 'wizard')
  if (!spellData.castingMode && !item && actor.classId === 'cleric') {
    castingMode = 'cleric'
  }

  try {
    // Detect fumbles and crits before applying to table.
    //
    // The crit threshold follows the die actually rolled rather than a
    // hardcoded 20. The multiple-action-dice override can hand this path a
    // smaller action die (a wizard's spells-only d14), and a custom action die
    // can be any size — on either, a natural 20 is unrollable, so a hardcoded
    // 20 made a crit impossible while the natural-1 fumble got *more* likely.
    // This matches the lib's own spell-check rule
    // (`natural === getDieFaces(die)` in vendor/dcc-core-lib/spells/cast.js),
    // which the adapter-routed actor path already uses, and the crit/fumble
    // realignment docs/dev/MULTIPLE_ACTION_DICE_DESIGN.md requires of an
    // override die. Unchanged for every d20 caller.
    if (roll.dice.length > 0) {
      const dieFaces = roll.dice[0].faces || 20
      if (naturalRoll === 1) {
        fumble = true
      } else if (naturalRoll === dieFaces) {
        if (actor.type === 'Player') {
          crit = true
        }
      }
    }

    // DCC RAW (core rulebook p. 30, cleric magic): "any natural roll within
    // that range automatically fails ... even though a roll of 13 would
    // normally mean success". So a cleric whose natural roll lands inside the
    // disapproval range fails outright — the card must show the failure row,
    // not the success row the total would otherwise buy (#874). The chat
    // highlight already paints the total red for these rolls (the die's
    // `lowerThreshold` is the disapproval range); this makes the card body
    // agree with it. Natural 1 stays a fumble; a would-be crit inside the
    // range is still an automatic failure.
    const disapprovalRange = parseInt(actor.system.class?.disapproval, 10) || 1
    const disapprovalFailure = castingMode === 'cleric' && !fumble && naturalRoll <= disapprovalRange
    if (disapprovalFailure) {
      crit = false
    }

    // Apply the roll to the table if present
    if (rollTable) {
      result = rollTable.getResultsForRoll(roll.total)

      if (fumble || disapprovalFailure) {
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

      const spellResultOptions = { crit, fumble, disapprovalFailure, item, patronTaint, actionDiceChatLine }
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
      // Items without a level field (e.g. spell-like skills) are treated as level 1
      const noTableLevel = (item ? item.system.level : 1) ?? 1
      const noTableSuccess = roll.total >= (10 + noTableLevel * 2)
      let spellResultHtml = ''
      if (fumble) {
        spellResultHtml = `<p class="emote-alert fumble">${game.i18n.localize('DCC.SpellCheckFumbleNoTable')}</p>`
      } else if (disapprovalFailure) {
        spellResultHtml = `<p class="emote-alert fumble">${game.i18n.localize('DCC.SpellCheckDisapprovalFailure')}</p>`
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

      // Display the roll. When a multiple-action-dice line is present it has to
      // ride under the rolled formula, which means rendering the body by hand
      // (mirrors `renderSkillCheck` in `adapter/chat-renderer.mjs`); with no
      // line `content` stays unset and `toMessage` builds its default body.
      const toMessageData = {
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor,
        flags,
        system: { spellId: item?.id }
      }
      if (actionDiceChatLine) {
        toMessageData.content = `${await roll.render()}${actionDiceLineHtml(actionDiceChatLine)}`
      }
      await roll.toMessage(toMessageData)
    }

    // Spell check threshold is 10 + spell level * 2, anything below this is a failure.
    // A natural roll inside the disapproval range is an automatic failure
    // regardless of the total (RAW — see disapprovalFailure above).
    // Items without a level field (e.g. spell-like skills) are treated as level 1
    const level = (item ? item.system.level : 1) ?? 1
    let success = roll.total >= (10 + level * 2) && !disapprovalFailure

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
      if (automate && naturalRoll <= disapprovalRange) {
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

    // Store the roll result in the item for display on the spells tab.
    // Spell-like skill items update their own lastResult in the skill-roll
    // path, so skip them here to avoid a redundant update (issue #375)
    if (item?.id && item.type !== 'skill') {
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
      disapprovalFailure,
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
