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
  const defeatedId = CONFIG.specialStatusEffects?.DEFEATED ?? 'dead'

  // Live effects are the source of truth; the derived status set can lag
  // right after an effect is applied.
  const hasDeadEffect = [...(actor.effects ?? [])].some(e => e.statuses?.has?.(defeatedId))
  if (!actor.statuses?.has(defeatedId) && !hasDeadEffect) {
    await actor.toggleStatusEffect(defeatedId, { active: true, overlay: true })
  }

  // Mirror the tracker button's combatant flag in every active combat.
  for (const combat of game.combats?.contents ?? []) {
    for (const combatant of combat.combatants.filter(c => c.actor === actor)) {
      if (!combatant.defeated) await combatant.update({ defeated: true })
    }
  }
}
