/* global ChatMessage, console, foundry, game, ui */

import { logAbilityChange } from './ability-score-log.js'
import { getClassTrait } from './extension-api.mjs'
import { rollOrNullOnCancel } from './roll-cancellation.mjs'

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
 *
 * Luck can also be burned after seeing the roll, from the roll card's
 * context menu (`burnLuckAfterRoll`). That posts a follow-up card with the
 * bonus and the new total rather than rewriting the original card, whose
 * outcome (hit, save, spell result) the judge then reads off the new total.
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
 * synchronous term callback can hand it to the dialog to await.
 *
 * @param {Object} actor
 * @param {number} points
 * @param {string} [source]  Roll name, for the log entry
 * @param {Object} [options]
 * @param {boolean} [options.announce=true]  Post the Luck-spend card
 * @returns {Promise<boolean>} whether the Luck was spent
 */
export async function applyLuckBurn (actor, points, source = '', { announce = true } = {}) {
  if (!(points > 0)) return
  try {
    await logAbilityChange(actor, {
      ability: 'lck',
      change: -points,
      type: 'luckSpend',
      source: source || game.i18n.localize('DCC.RollModifierLuckBurnTerm')
    }, { announce })
    return true
  } catch (err) {
    console.error('[DCC] luck burn apply rejected', { actor: actor?.name, points, err })
    ui.notifications?.error?.(game.i18n.localize('DCC.LuckBurnApplyFailed'))
    return false
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
 * @param {boolean} [options.announce=true]  Post the ability score log's
 *   Luck-spend card
 * @param {function(number, number): void} [options.onBurn]  Observer called
 *   with the points burned and the bonus they bought (a luck die's rolled
 *   total) when a non-zero burn is submitted
 * @returns {Object|null} a `LuckBurn` term descriptor for `DCCRoll.createRoll`
 */
export function buildLuckBurnTerm (actor, { source = '', announce = true, onBurn } = {}) {
  const descriptor = luckBurnDescriptor(actor)
  if (!descriptor) return null
  return {
    type: 'LuckBurn',
    formula: '+0',
    ...descriptor,
    // The dialog builds its roll once on open (nothing burned yet) and
    // again on submit; only the submit carries points, so the open-time
    // call spends nothing. The dialog awaits `term.pending` before handing
    // the roll back, so the caller reads the post-burn Luck.
    callback: (_formula, term) => {
      const points = Number(term?.points) || 0
      if (points <= 0) return
      const bonus = Number(term.bonus) || 0
      term.pending = applyLuckBurn(actor, points, source, { announce })
        .then(spent => { if (spent) onBurn?.(points, bonus) })
    }
  }
}

/** Card roll types Luck can be burned on after the roll (plus attack cards). */
const LUCK_BURN_ROLL_TYPES = new Set(['AbilityCheck', 'SavingThrow', 'SkillCheck', 'SpellCheck'])

/**
 * The actor who can burn Luck on a chat card after the roll, or null: the
 * card must be an attack, check, save, skill or spell check card, and its
 * speaker a PC this user owns with Luck left.
 *
 * @param {ChatMessage} message
 * @returns {Object|null}
 */
export function luckBurnMessageActor (message) {
  if (!message?.rolls?.length) return null
  const isLuckRoll = message.getFlag?.('dcc', 'isToHit') ||
    LUCK_BURN_ROLL_TYPES.has(message.getFlag?.('dcc', 'RollType'))
  if (!isLuckRoll) return null
  const actor = message.speaker ? ChatMessage.getSpeakerActor(message.speaker) : null
  if (!actor?.isOwner || !luckBurnDescriptor(actor)) return null
  return actor
}

/**
 * Burn Luck on a roll already in chat: open the Roll Modifier dialog with
 * just the Luck Burn term, spend the Luck, and post a card with the bonus
 * and the roll's new total.
 *
 * @param {ChatMessage} message  The roll card
 * @returns {Promise<void>}
 */
export async function burnLuckAfterRoll (message) {
  const actor = luckBurnMessageActor(message)
  if (!actor) return
  let burn = null
  // Flavor can carry markup; the log entry wants plain text
  // (stray angle brackets from malformed tags go too)
  const flavor = String(message.flavor ?? '').replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim()
  const term = buildLuckBurnTerm(actor, {
    source: flavor || game.i18n.localize('DCC.RollModifierLuckBurnTerm'),
    // This card already says what was burned
    announce: false,
    onBurn: (points, bonus) => { burn = { points, bonus } }
  })
  const roll = await rollOrNullOnCancel(game.dcc.DCCRoll.createRoll([term], {}, {
    showModifierDialog: true,
    title: game.i18n.localize('DCC.LuckBurnAfterRollTitle'),
    rollLabel: game.i18n.localize('DCC.ChatContextBurnLuck')
  }))
  // `burn` is only set once the Luck was actually spent
  if (!roll || !burn) return

  // A second burn on the same card builds on the earlier ones
  const earlier = (game.messages?.contents ?? [])
    .filter(m => m.getFlag?.('dcc', 'luckBurnFor') === message.id)
    .reduce((sum, m) => sum + (Number(m.getFlag('dcc', 'luckBurnBonus')) || 0), 0)
  const before = (Number(message.rolls[0].total) || 0) + earlier
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p>${game.i18n.format('DCC.LuckBurnAfterRoll', {
      name: foundry.utils.escapeHTML(actor.name),
      roll: foundry.utils.escapeHTML(flavor || message.rolls[0].formula),
      points: burn.points,
      bonus: `+${burn.bonus}`,
      before,
      after: before + burn.bonus
    })}</p>`,
    flags: { dcc: { RollType: 'LuckBurn', luckBurnFor: message.id, luckBurnBonus: burn.bonus } }
  })
}
