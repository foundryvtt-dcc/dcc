/* global game, fromUuid, console */

/**
 * Auto-apply weapon damage to a targeted token (DCC QoL integration).
 *
 * When the `autoApplyDamage` setting is on and an attack hits its target, the
 * rolled damage is applied to that target. Application is a privileged write
 * (the attacker rarely owns the target), so it routes through the system
 * socket: the active GM performs the `actor.applyDamage`. Gated by
 * `qolHandlingCombat` so dcc-qol drives it while that module is active.
 *
 * Triggered from the weapon-attack dispatch (the automated inline-damage path)
 * which fires exactly once per attack, so no de-duplication flag is needed.
 */

import { qolHandlingCombat } from './integrations.mjs'
import { executeAsGM, registerSocketHandler } from './socket.mjs'

export const APPLY_DAMAGE_ACTION = 'dcc.applyDamage'

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
 * Whether the attack hit the target: a fumble always misses, a crit always
 * hits, otherwise the attack total (`hitsAc`) must meet the target's AC.
 *
 * @param {object} attackRollResult - result from `rollToHit` (crit/fumble/hitsAc)
 * @param {Actor} targetActor - the targeted token's actor
 * @returns {boolean}
 */
export function attackHitsTarget (attackRollResult, targetActor) {
  if (!attackRollResult || attackRollResult.fumble) return false
  if (attackRollResult.crit) return true
  const ac = parseInt(targetActor?.system?.attributes?.ac?.value)
  return Number.isFinite(ac) && attackRollResult.hitsAc >= ac
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
    if (!attackHitsTarget(attackRollResult, targetActor)) return
    await applyDamageViaGM(targetActor.uuid, amount)
  } catch (err) {
    console.error('DCC | auto-apply damage failed', err)
  }
}

/** GM-side socket handler: resolve the target and apply the damage. */
async function applyDamageHandler ({ actorUuid, amount }) {
  const doc = await fromUuid(actorUuid)
  const actor = doc?.documentName === 'Actor' ? doc : doc?.actor
  if (typeof actor?.applyDamage !== 'function' || !(amount > 0)) return
  await actor.applyDamage(amount, 1)
}

/** Register the GM-side apply-damage socket handler. Call once at ready. */
export function registerAutoApplyDamageHandler () {
  registerSocketHandler(APPLY_DAMAGE_ACTION, applyDamageHandler)
}
