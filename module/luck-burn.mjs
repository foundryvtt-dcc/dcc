/* global console, game, ui */

import { logAbilityChange } from './ability-score-log.js'
import { getClassTrait } from './extension-api.mjs'

/**
 * Luck burn in the Roll Modifier dialog (#963).
 *
 * Any PC may burn Luck for a one-time bonus on a roll: +1 per point by
 * default. Two class traits change that: `luckBurnDie` rolls the class
 * luck die (`system.class.luckDie`) per point instead (thief), and
 * `luckBurnMultiplier` scales the flat bonus (halfling, ×2).
 *
 * The dialog flattens the burn to a plain number before the roll is built
 * (see `RollModifierDialog#_constructRoll`), so every roll path — the
 * Foundry-evaluated attack roll and the adapter paths that fold the
 * dialog's flat total into a lib pass — takes it without special handling.
 */

/**
 * Read a Luck-burn descriptor off an actor, or null when the actor can't
 * burn Luck (not a PC, or no Luck left).
 *
 * Raw BASE Luck by design (#801): burning consumes the base score, so a
 * transient `otherMod` neither raises nor lowers how much can be burned.
 *
 * @param {Object} actor
 * @returns {{lck: number, luckDie: (string|null), multiplier: number}|null}
 */
export function luckBurnDescriptor (actor) {
  if (actor?.type !== 'Player') return null
  const lck = parseInt(actor.system?.abilities?.lck?.value) || 0
  if (lck <= 0) return null
  const dieMatch = String(actor.system?.class?.luckDie ?? '').trim().match(/^1?(d\d+)$/i)
  const luckDie = getClassTrait(actor, 'luckBurnDie') === true && dieMatch
    ? dieMatch[1].toLowerCase()
    : null
  const multiplier = Number(getClassTrait(actor, 'luckBurnMultiplier')) || 1
  return { lck, luckDie, multiplier }
}

/**
 * The bonus formula for burning `points` of Luck: `+0` when nothing is
 * burned, `+2d3` with a luck die, else the flat `+points × multiplier`.
 *
 * @param {number} points
 * @param {{luckDie: (string|null), multiplier: number}} descriptor
 * @returns {string}
 */
export function luckBurnFormula (points, { luckDie = null, multiplier = 1 } = {}) {
  if (!(points > 0)) return '+0'
  return luckDie ? `+${points}${luckDie}` : `+${points * multiplier}`
}

/**
 * Spend burned Luck through the ability score log (logged as a Luck spend,
 * so the `luckRecovers` classes regain it). Always resolves, so a
 * synchronous term callback can fire-and-forget it.
 *
 * @param {Object} actor
 * @param {number} points
 * @param {string} [source]  Roll name, for the log entry
 * @returns {Promise<void>}
 */
export async function applyLuckBurn (actor, points, source = '') {
  if (!(points > 0)) return
  try {
    await logAbilityChange(actor, {
      ability: 'lck',
      change: -points,
      type: 'luckSpend',
      source: source || game.i18n.localize('DCC.RollModifierLuckBurnTerm')
    }, { announce: true })
  } catch (err) {
    console.error('[DCC] luck burn apply rejected', { actor: actor?.name, points, err })
    ui.notifications?.error?.(game.i18n.localize('DCC.LuckBurnApplyFailed'))
  }
}

/**
 * Build the Roll Modifier dialog's `LuckBurn` term for an actor, or null
 * when the actor can't burn Luck. The term spends the Luck itself when the
 * dialog submits. Published as `game.dcc.buildLuckBurnTerm` for dependent
 * modules.
 *
 * @param {Object} actor
 * @param {Object} [options]
 * @param {string} [options.source]  Roll name, for the log entry
 * @returns {Object|null} a `LuckBurn` term descriptor for `DCCRoll.createRoll`
 */
export function buildLuckBurnTerm (actor, { source = '' } = {}) {
  const descriptor = luckBurnDescriptor(actor)
  if (!descriptor) return null
  return {
    type: 'LuckBurn',
    formula: '+0',
    ...descriptor,
    // The dialog builds its roll once on open (nothing burned yet) and
    // again on submit; only the submit carries points, so the open-time
    // call spends nothing.
    callback: (_formula, term) => {
      applyLuckBurn(actor, Number(term?.points) || 0, source)
    }
  }
}
