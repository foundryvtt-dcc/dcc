/* global game, fromUuid, console, foundry, ChatMessage, Roll */

/**
 * Auto-apply weapon damage to a targeted token (DCC QoL integration).
 *
 * When the `autoApplyDamage` setting is on and an attack hits its target, the
 * rolled damage is applied to that target. Application is a privileged write
 * (the attacker rarely owns the target), so it routes through the system
 * socket: the active GM performs the `actor.applyDamage`. Gated by
 * `qolHandlingCombat` so dcc-qol drives it while that module is active.
 *
 * Two triggers:
 * - Automated damage: the weapon-attack dispatch applies the rolled damage once,
 *   right after the attack.
 * - Manual damage (#992): with automation off, the card's Roll Damage button
 *   (enhanced card) or inline damage roll (plain / emote card) applies the roll
 *   when it lands. The card records the hit verdict and the target's UUID at
 *   attack time; the GM marks it `dcc.damageApplied` so it applies only once.
 */

import { qolHandlingCombat } from './integrations.mjs'
import { executeAsGM, registerSocketHandler } from './socket.mjs'

export const APPLY_DAMAGE_ACTION = 'dcc.applyDamage'
export const APPLY_CARD_DAMAGE_ACTION = 'dcc.applyCardDamage'

/** Card ids whose damage the GM is applying right now (see the handler). */
const cardsApplying = new Set()

/**
 * Apply damage to an actor through the GM (the active GM runs the
 * `actor.applyDamage`). Shared by the auto-apply-damage and friendly-fire
 * paths so the privileged-write action name lives in one place. No-op for
 * non-positive amounts.
 *
 * @param {string} actorUuid - UUID of the actor (or its token) to damage
 * @param {number} amount - positive damage amount
 * @returns {Promise<void>}
 */
export async function applyDamageViaGM (actorUuid, amount) {
  if (!actorUuid || !(amount > 0)) return
  await executeAsGM(APPLY_DAMAGE_ACTION, { actorUuid, amount })
}

/**
 * Whether the attack hit the target. `rollToHit` already asked the lib when the
 * primary target's AC was readable (`hitsTarget`); otherwise a fumble always
 * misses, a natural max always hits, and the attack total (`hitsAc`) must meet
 * the target's AC. A crit is not an automatic hit (#978): a threat-range roll
 * or a backstab that misses is a miss. `undefined` when the target's AC can't
 * be read, so callers don't mistake "unknown" for a miss.
 *
 * @param {object} attackRollResult - result from `rollToHit` (fumble/autoHit/hitsAc/hitsTarget)
 * @param {Actor} targetActor - the targeted token's actor
 * @returns {boolean|undefined}
 */
export function attackHitsTarget (attackRollResult, targetActor) {
  if (!attackRollResult || attackRollResult.fumble) return false
  if (typeof attackRollResult.hitsTarget === 'boolean') return attackRollResult.hitsTarget
  if (attackRollResult.autoHit) return true
  const ac = parseInt(targetActor?.system?.attributes?.ac?.value)
  return Number.isFinite(ac) ? attackRollResult.hitsAc >= ac : undefined
}

/**
 * Apply a hit's rolled damage to the targeted token via the GM, when the
 * `autoApplyDamage` setting is on. No-op when dcc-qol is active, the setting is
 * off, there is no positive damage, no single target, or the attack missed.
 * Errors are swallowed (logged) so a feedback failure never breaks the attack.
 *
 * @param {object} options - the attack options (carries `targets`)
 * @param {object} attackRollResult - result from `rollToHit`
 * @param {Roll} [damageRoll] - the evaluated damage roll (absent when not automated)
 */
export async function autoApplyAttackDamage (options, attackRollResult, damageRoll) {
  try {
    if (qolHandlingCombat()) return
    if (!game.settings.get('dcc', 'autoApplyDamage')) return
    const amount = damageRoll?.total
    if (!(amount > 0)) return
    const target = options?.targets?.first?.()
    const targetActor = target?.actor
    if (!targetActor) return
    if (attackHitsTarget(attackRollResult, targetActor) !== true) return
    await applyDamageViaGM(targetActor.uuid, amount)
  } catch (err) {
    console.error('DCC | auto-apply damage failed', err)
  }
}

/**
 * Whether an attack card's manual damage roll should be applied to its target:
 * auto-apply is on, dcc-qol isn't driving, the attack hit a known target, and
 * the card hasn't had damage applied yet.
 *
 * @param {ChatMessage} message - the attack card
 * @returns {boolean}
 */
export function cardAwaitsDamage (message) {
  try {
    if (qolHandlingCombat()) return false
    if (!game.settings.get('dcc', 'autoApplyDamage')) return false
    const flag = (key) => message?.getFlag?.('dcc', key)
    return !!flag('isToHit') && flag('hitsTarget') === true && !!flag('targetUuid') && !flag('damageApplied')
  } catch {
    return false
  }
}

/**
 * Apply a manual damage roll from an attack card to the card's target, through
 * the GM. No-op unless `cardAwaitsDamage`. Damage has a minimum of 1, matching
 * the automated roll. Errors are logged, never thrown.
 *
 * @param {ChatMessage} message - the attack card the damage was rolled from
 * @param {number} total - the damage roll's total
 * @returns {Promise<void>}
 */
export async function applyCardDamage (message, total) {
  try {
    if (!cardAwaitsDamage(message) || !Number.isFinite(total)) return
    await executeAsGM(APPLY_CARD_DAMAGE_ACTION, { messageId: message.id, amount: Math.max(1, total) })
  } catch (err) {
    console.error('DCC | auto-apply card damage failed', err)
  }
}

/**
 * Roll a plain / emote attack card's inline damage roll the way Foundry's
 * inline-roll click does, then apply it to the card's target.
 */
async function rollInlineDamage (message, anchor) {
  const speaker = ChatMessage.getSpeaker()
  const actor = ChatMessage.getSpeakerActor(speaker)
  const roll = Roll.create(anchor.dataset.formula, actor ? actor.getRollData() : {})
  const messageMode = foundry.dice.Roll._mapLegacyRollMode?.(anchor.dataset.mode)
  await roll.toMessage({ flavor: anchor.dataset.flavor, speaker }, messageMode ? { messageMode } : {})
  await applyCardDamage(message, roll.total)
}

/**
 * On a plain or emote attack card awaiting manual damage, take over the click
 * on its inline damage roll (`[[/r … # Damage]]`) so the roll is applied to the
 * target as well as posted. Any other inline roll, or a card that isn't
 * awaiting damage, keeps Foundry's default handling.
 *
 * @param {ChatMessage} message - the attack card
 * @param {HTMLElement} html - the rendered message element
 */
export function attachManualDamageAutoApply (message, html) {
  if (!html?.addEventListener || !cardAwaitsDamage(message)) return
  html.addEventListener('click', (event) => {
    const anchor = event.target?.closest?.('a.inline-roll')
    if (!anchor || anchor.classList.contains('inline-result') || anchor.dataset.flavor !== 'Damage') return
    if (!cardAwaitsDamage(message)) return
    event.preventDefault()
    event.stopPropagation()
    rollInlineDamage(message, anchor).catch(err => console.error('DCC | inline damage roll failed', err))
  }, { capture: true })
}

/**
 * GM-side handler: apply a card's manual damage once. Hardened against a
 * crafted payload — the target comes from the card's own flags (never the
 * payload), the card must still await damage, and the requester (the sender
 * Foundry stamps on the socket message) must be a GM or own the card. A card
 * is claimed in `cardsApplying` before any await and flagged applied before
 * the damage lands, so a second request can't apply it twice.
 *
 * @param {{messageId: string, amount: number}} payload
 * @param {string} [userId] requesting user id (client-supplied; verified here)
 */
async function applyCardDamageHandler ({ messageId, amount } = {}, userId) {
  const message = game.messages?.get(messageId)
  if (!message || !cardAwaitsDamage(message) || !(amount > 0)) return
  const sender = userId ? game.users?.get(userId) : null
  if (!sender) return
  if (!sender.isGM && !message.testUserPermission?.(sender, 'OWNER')) return
  // Claim the card synchronously: the flag write below is a server round trip,
  // and a second request (a double-click) arriving during it would still see
  // the card awaiting damage.
  if (cardsApplying.has(messageId)) return
  cardsApplying.add(messageId)
  try {
    await message.setFlag('dcc', 'damageApplied', true)
    await applyDamageHandler({ actorUuid: message.getFlag('dcc', 'targetUuid'), amount })
  } finally {
    cardsApplying.delete(messageId)
  }
}

/** GM-side socket handler: resolve the target and apply the damage. */
async function applyDamageHandler ({ actorUuid, amount }) {
  const doc = await fromUuid(actorUuid)
  const actor = doc?.documentName === 'Actor' ? doc : doc?.actor
  if (typeof actor?.applyDamage !== 'function' || !(amount > 0)) return
  await actor.applyDamage(amount, 1)
}

/** Register the GM-side apply-damage socket handlers. Call once at ready. */
export function registerAutoApplyDamageHandler () {
  registerSocketHandler(APPLY_DAMAGE_ACTION, applyDamageHandler)
  registerSocketHandler(APPLY_CARD_DAMAGE_ACTION, applyCardDamageHandler)
}
