/* global game, console */

/**
 * Auto-apply the "dead" status to NPCs that drop to 0 HP (DCC QoL integration).
 *
 * Reacts to `updateActor`: when the `autoApplyDeadStatus` setting is on and an
 * NPC's hit points fall to 0 or below, the active GM toggles the `dead` status
 * effect on. Runs only on the active GM (status changes need GM permission and
 * should happen once even with several GMs connected). PCs are excluded — at 0
 * HP they are dying/recovering per DCC rules, not automatically dead. The
 * status is applied, never auto-removed on healing. Gated by qolHandlingCombat
 * so dcc-qol drives it while that module is active.
 */

import { qolHandlingCombat } from './integrations.mjs'
import { isActiveGM } from './socket.mjs'

/**
 * `updateActor` handler. Applies the `dead` status to an NPC whose HP this
 * update drove to <= 0.
 *
 * @param {Actor} actor - the updated actor
 * @param {object} changes - the update diff
 */
export async function onUpdateActorForDeath (actor, changes) {
  try {
    if (qolHandlingCombat()) return
    if (!game.settings.get('dcc', 'autoApplyDeadStatus')) return
    if (!isActiveGM()) return
    if (actor?.type !== 'NPC') return

    // Only when this update changed HP (to 0 or below).
    const newHp = changes?.system?.attributes?.hp?.value
    if (newHp === undefined || newHp > 0) return

    // Already dead? Check the live effects (the source of truth) as well as the
    // derived status set, which can lag right after an effect is applied.
    const hasDeadEffect = [...(actor.effects ?? [])].some(e => e.statuses?.has?.('dead'))
    if (actor.statuses?.has('dead') || hasDeadEffect) return

    await actor.toggleStatusEffect('dead', { active: true })
  } catch (err) {
    console.error('DCC | auto-apply dead status failed', err)
  }
}
