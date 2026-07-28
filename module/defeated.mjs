/* global CONFIG, game */

/**
 * Mark an actor dead exactly the way the combat tracker's skull button does
 * (`CombatTracker#_onToggleDefeatedStatus`): apply the configured DEFEATED
 * status effect (default `dead`) as a token **overlay**, and set
 * `defeated: true` on the actor's combatants so the tracker bookkeeping
 * matches. Shared by the NPC auto-dead feature (auto-dead-status.mjs) and
 * the PC death clock (death-clock.mjs).
 *
 * Idempotent: an already-dead actor's effect is left alone, and only
 * not-yet-defeated combatants are updated.
 *
 * @param {Actor} actor
 */
export async function markActorDefeated (actor) {
  if (!isActorDefeated(actor)) {
    await actor.toggleStatusEffect(defeatedStatusId(), { active: true, overlay: true })
  }

  // Mirror the tracker button's combatant flag in every active combat.
  for (const combatant of actorCombatants(actor)) {
    if (!combatant.defeated) await combatant.update({ defeated: true })
  }
}

/**
 * The inverse of {@link markActorDefeated}: remove the DEFEATED status
 * effect and clear `defeated` on the actor's combatants — the full un-dead
 * that clicking the tracker's skull button on a defeated combatant performs.
 * Idempotent on a living actor.
 *
 * @param {Actor} actor
 */
export async function markActorRecovered (actor) {
  if (isActorDefeated(actor)) {
    await actor.toggleStatusEffect(defeatedStatusId(), { active: false })
  }

  for (const combatant of actorCombatants(actor)) {
    if (combatant.defeated) await combatant.update({ defeated: false })
  }
}

/**
 * Whether the actor currently carries the DEFEATED status. Live effects are
 * the source of truth; the derived status set can lag right after an effect
 * is applied.
 *
 * @param {Actor} actor
 * @returns {boolean}
 */
export function isActorDefeated (actor) {
  const defeatedId = defeatedStatusId()
  return actor.statuses?.has(defeatedId) ||
    [...(actor.effects ?? [])].some(e => e.statuses?.has?.(defeatedId))
}

/** The system-configured DEFEATED status id (core default: `dead`). */
function defeatedStatusId () {
  return CONFIG.specialStatusEffects?.DEFEATED ?? 'dead'
}

/** The actor's combatants across every active combat. */
function actorCombatants (actor) {
  return (game.combats?.contents ?? []).flatMap(
    combat => combat.combatants.filter(c => c.actor === actor))
}
