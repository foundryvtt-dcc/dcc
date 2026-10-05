/**
 * Cleric disapproval — the one place the system resolves a disapproval
 * roll (issue #961).
 *
 * Every caller (cleric spell casts, Turn Unholy / Lay on Hands / Divine
 * Aid, `game.dcc.processSpellCheck`, the sheet button and macro) reaches
 * this through `DCCActor.rollDisapproval`. Foundry evaluates the dice so
 * the roll-modifier dialog, Dice So Nice and the chat card show real
 * dice; the lib's `rollDisapproval` owns the rules: (natural)d4 − Luck
 * modifier, the clamp to row 1 when Luck pushes the roll below 1, and the
 * table lookup.
 */

import { rollDisapproval as libRollDisapproval } from '../vendor/dcc-core-lib/index.js'
import { loadDisapprovalTable } from './spell-input.mjs'
import { renderDisapprovalRoll } from './chat-renderer.mjs'

/**
 * Split an evaluated disapproval Roll into the parts the lib needs.
 *
 * The dialog lets the player edit the formula, so the roll is read rather
 * than assumed: the first die term's count is the number of d4s (the
 * natural roll), every die term is "the dice", and whatever else the
 * formula adds or subtracts is treated as the Luck adjustment. That keeps
 * the lib's result equal to the Foundry total for any formula.
 *
 * @param {Roll} roll - An evaluated Foundry Roll.
 * @returns {{ diceCount: number, diceTotal: number, luckModifier: number }}
 */
export function readDisapprovalRoll (roll) {
  const dice = roll.dice ?? []
  const diceTotal = dice.reduce((sum, die) => sum + (Number(die.total) || 0), 0)
  const diceCount = Number(dice[0]?.number) || 1
  const luckModifier = diceTotal - (Number(roll.total) || 0)
  return { diceCount, diceTotal, luckModifier }
}

/**
 * Resolve an evaluated disapproval roll through the lib and post it to chat.
 *
 * With no disapproval table configured, or a roll past the table's last
 * row (the lib reports `matched: false` with an empty description), the
 * roll is posted without result text.
 *
 * @param {Object} params
 * @param {Object} params.actor - The cleric DCCActor.
 * @param {Roll} params.roll - The evaluated `Nd4 − Luck` Foundry Roll.
 * @param {number} [params.disapprovalRange] - The range the triggering check
 *   was made against. Defaults to the actor's current range, which a spell
 *   cast may already have raised.
 * @returns {Promise<Object|null>} The lib `DisapprovalResult`, or null when
 *   no table is configured.
 */
export async function resolveDisapprovalRoll ({ actor, roll, disapprovalRange }) {
  const { diceCount, diceTotal, luckModifier } = readDisapprovalRoll(roll)
  const table = await loadDisapprovalTable(actor)

  let disapprovalResult = null
  if (table) {
    disapprovalResult = libRollDisapproval(
      diceCount,
      Number(disapprovalRange ?? actor.system?.class?.disapproval) || 1,
      table,
      luckModifier,
      { roller: () => diceTotal }
    )
  }

  await renderDisapprovalRoll({ actor, disapprovalResult, roll })
  return disapprovalResult
}
