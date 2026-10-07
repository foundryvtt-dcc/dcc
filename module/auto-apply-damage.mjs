/* global game, fromUuid, console, foundry, ChatMessage, Roll, ui */

/**
 * Auto-apply weapon damage to a targeted token (DCC QoL integration).
 *
 * When the `autoApplyDamage` setting is on and an attack hits its target, the
 * rolled damage is applied to that target. Application is a privileged write
 * (the attacker rarely owns the target), so it routes through the system
 * socket: the active GM performs the `actor.applyDamage`. Gated by
 * `qolHandlingCombat` so dcc-qol drives it while that module is active.
 *
 * Every request names a chat card, never a raw actor and amount (#994): the
 * card records the hit verdict and the target's UUID when it is created, the GM
 * reads the target from those flags, checks the requester may act for the
 * card, and marks it `dcc.damageApplied` so it applies only once.
 *
 * Three triggers:
 * - Automated damage: once the weapon-attack dispatch has posted its card, the
 *   damage roll on that card is applied.
 * - Friendly fire: a stray shot that hits an ally applies the damage roll on
 *   the friendly-fire card to that ally.
 * - Manual damage (#992): with automation off, the card's Roll Damage button
 *   (enhanced card) or inline damage roll (plain / emote card) applies the roll
 *   when it lands.
 */

import { qolHandlingCombat } from './integrations.mjs'
import { executeAsGM, registerSocketHandler } from './socket.mjs'

export const APPLY_CARD_DAMAGE_ACTION = 'dcc.applyCardDamage'

/**
 * Flavor of the attack card's unrolled inline damage roll (`[[/r … # Damage]]`).
 * The roll's anchor carries it as `data-flavor`, which is how the manual
 * damage click is recognised.
 */
export const DAMAGE_INLINE_FLAVOR = 'Damage'

/** Card ids whose damage the GM is applying right now (see the handler). */
const cardsApplying = new Set()

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
 * Whether a card's damage is still owed to its target: auto-apply is on,
 * dcc-qol isn't driving, the card is an attack or friendly-fire card that hit
 * a known target, and no damage has been applied from it yet.
 *
 * @param {ChatMessage} message - an attack or friendly-fire card
 * @returns {boolean}
 */
function cardDamagePending (message) {
  try {
    if (qolHandlingCombat()) return false
    if (!game.settings.get('dcc', 'autoApplyDamage')) return false
    const flag = (key) => message?.getFlag?.('dcc', key)
    if (!flag('isToHit') && !flag('isFriendlyFire')) return false
    return flag('hitsTarget') === true && !!flag('targetUuid') && !flag('damageApplied')
  } catch {
    return false
  }
}

/** Whether the card rolled its own damage (automated attack, friendly fire). */
function isAutomatedCard (message) {
  return message?.getFlag?.('dcc', 'automated') === true
}

/**
 * The total of the damage roll carried on the card itself (the roll tagged
 * `dcc.isDamageRoll`), or `undefined` when it has none.
 *
 * @param {ChatMessage} message
 * @returns {number|undefined}
 */
function cardDamageRollTotal (message) {
  return message?.rolls?.find?.(r => r?.options?.dcc?.isDamageRoll)?.total
}

/**
 * Apply the damage roll carried on an automated card (an automated attack card
 * or a friendly-fire card) to the card's target, through the GM. No-op when
 * the card has no damage owed or the user may not act for it. The GM takes
 * the amount from the card's roll, so the request carries only the card's id.
 * Errors are swallowed (logged) so a feedback failure never breaks the attack.
 *
 * @param {ChatMessage} [message] - the posted card (absent if its creation was cancelled)
 * @returns {Promise<void>}
 */
export async function applyAutomatedCardDamage (message) {
  try {
    if (!isAutomatedCard(message) || !cardDamagePending(message)) return
    if (!(cardDamageRollTotal(message) > 0)) return
    if (!canApplyCardDamage(message, game.user)) return
    await executeAsGM(APPLY_CARD_DAMAGE_ACTION, { messageId: message.id })
  } catch (err) {
    console.error('DCC | auto-apply damage failed', err)
  }
}

/**
 * Whether an attack card's manual damage roll should be applied to its target:
 * the card's damage is still owed and the card wasn't automated (automated
 * cards apply the damage they rolled themselves, never a second roll).
 *
 * @param {ChatMessage} message - the attack card
 * @returns {boolean}
 */
export function cardAwaitsDamage (message) {
  return cardDamagePending(message) && !!message.getFlag('dcc', 'isToHit') && !isAutomatedCard(message)
}

/**
 * The actor that made the card's attack: the speaker (a token's own actor
 * first), else the stored `system.actorId`.
 *
 * @param {ChatMessage} message - the attack card
 * @returns {Actor|null}
 */
function attackingActor (message) {
  return ChatMessage.getSpeakerActor?.(message.speaker) ?? game.actors?.get(message.system?.actorId) ?? null
}

/**
 * Whether a user may apply a card's manual damage: a GM, the card's author,
 * or anyone with Owner permission on the attacking character (e.g. the
 * player whose PC the GM rolled for).
 *
 * @param {ChatMessage} message - the attack card
 * @param {User} user
 * @returns {boolean}
 */
export function canApplyCardDamage (message, user) {
  if (!user) return false
  if (user.isGM || message.testUserPermission?.(user, 'OWNER')) return true
  return !!attackingActor(message)?.testUserPermission?.(user, 'OWNER')
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
    if (!canApplyCardDamage(message, game.user)) return
    await executeAsGM(APPLY_CARD_DAMAGE_ACTION, { messageId: message.id, amount: Math.max(1, total) })
  } catch (err) {
    console.error('DCC | auto-apply card damage failed', err)
  }
}

/**
 * Roll a plain / emote attack card's inline damage roll the way Foundry's
 * inline-roll click does, then apply it to the card's target. The roll is
 * posted as the attacker with the attacker's roll data, not as whatever token
 * the clicking user has selected.
 */
async function rollInlineDamage (message, anchor) {
  const speaker = message.speaker
  const actor = attackingActor(message)
  const roll = Roll.create(anchor.dataset.formula, actor ? actor.getRollData() : {})
  const messageMode = foundry.dice.Roll._mapLegacyRollMode?.(anchor.dataset.mode)
  await roll.toMessage({ flavor: anchor.dataset.flavor, speaker }, messageMode ? { messageMode } : {})
  await applyCardDamage(message, roll.total)
}

/**
 * On a plain or emote attack card awaiting manual damage, take over the click
 * on its inline damage roll (`[[/r … # Damage]]`) so the roll is applied to the
 * target as well as posted. Any other inline roll, a card that isn't awaiting
 * damage, or a viewer who may not apply it keeps Foundry's default handling.
 *
 * @param {ChatMessage} message - the attack card
 * @param {HTMLElement} html - the rendered message element
 */
export function attachManualDamageAutoApply (message, html) {
  if (!html?.addEventListener || !cardAwaitsDamage(message)) return
  if (!canApplyCardDamage(message, game.user)) return
  html.addEventListener('click', (event) => {
    const anchor = event.target?.closest?.('a.inline-roll')
    if (!anchor || anchor.classList.contains('inline-result') || anchor.dataset.flavor !== DAMAGE_INLINE_FLAVOR) return
    if (!cardAwaitsDamage(message)) return
    event.preventDefault()
    event.stopPropagation()
    rollInlineDamage(message, anchor).catch(err => {
      // Foundry's own handling was suppressed, so say so rather than fail silently.
      console.error('DCC | inline damage roll failed', err)
      ui.notifications?.error(game.i18n.format('DCC.RollErrorNotification', { rollType: game.i18n.localize('DCC.Damage') }))
    })
  }, { capture: true })
}

/**
 * GM-side handler: apply a card's damage once. Hardened against a crafted
 * payload — the target comes from the card's own flags (never the payload),
 * an automated card's amount comes from its own damage roll (only a manual
 * roll's amount is taken from the payload), the card must still owe damage,
 * and the requester (the sender Foundry stamps on the socket message) must
 * pass `canApplyCardDamage`. A card is claimed in `cardsApplying` before any
 * await and flagged applied before the damage lands, so a second request
 * can't apply it twice. A target that no longer exists leaves the card
 * unapplied.
 *
 * @param {{messageId: string, amount?: number}} payload - `amount` only for a manual roll
 * @param {string} [userId] requesting user id (client-supplied; verified here)
 */
async function applyCardDamageHandler ({ messageId, amount } = {}, userId) {
  const message = game.messages?.get(messageId)
  if (!message || !cardDamagePending(message)) return
  if (isAutomatedCard(message)) amount = cardDamageRollTotal(message)
  else if (!message.getFlag('dcc', 'isToHit')) return
  if (!(amount > 0)) return
  const sender = userId ? game.users?.get(userId) : null
  if (!canApplyCardDamage(message, sender)) return
  // Claim the card synchronously: the flag write below is a server round trip,
  // and a second request (a double-click) arriving during it would still see
  // the card awaiting damage.
  if (cardsApplying.has(messageId)) return
  cardsApplying.add(messageId)
  try {
    // Resolve the target first: if its token was deleted since the attack,
    // leave the card unapplied rather than marking damage that never landed.
    const doc = await fromUuid(message.getFlag('dcc', 'targetUuid'))
    const target = doc?.documentName === 'Actor' ? doc : doc?.actor
    if (typeof target?.applyDamage !== 'function') {
      console.warn(`DCC | card ${messageId}: target ${message.getFlag('dcc', 'targetUuid')} no longer exists; damage not applied`)
      return
    }
    await message.setFlag('dcc', 'damageApplied', true)
    await target.applyDamage(amount, 1)
  } catch (err) {
    console.error('DCC | applying card damage failed', err)
  } finally {
    cardsApplying.delete(messageId)
  }
}

/** Register the GM-side apply-damage socket handler. Call once at ready. */
export function registerAutoApplyDamageHandler () {
  registerSocketHandler(APPLY_CARD_DAMAGE_ACTION, applyCardDamageHandler)
}
