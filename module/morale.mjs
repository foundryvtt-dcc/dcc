/* global game */

/**
 * Morale checks from the combat tracker (#972).
 *
 * The roll itself is `DCCActor#rollMoraleCheck` (lib `makeMoraleCheck`).
 * This module adds two GM-only context-menu entries:
 *   - the combatant menu (`getCombatTrackerContextOptions`): roll morale
 *     for that NPC
 *   - the encounter menu (`getCombatContextOptions`): roll morale for
 *     every NPC combatant that isn't defeated, one card each
 *
 * Foundry collects both menus once, at the tracker's first render, so the
 * hooks are registered at import time and each entry decides at click
 * time through `visible`.
 */

/**
 * The NPC actor behind a combatant, or null.
 * @param {Combatant|undefined} combatant
 * @returns {Actor|null}
 */
function npcActor (combatant) {
  const actor = combatant?.actor
  return actor?.type === 'NPC' ? actor : null
}

/**
 * NPC combatants in a combat that can still check morale (not defeated).
 * @param {Combat|undefined} combat
 * @returns {Combatant[]}
 */
export function moraleEligibleCombatants (combat) {
  if (!combat) return []
  return combat.combatants.filter(c => !c.isDefeated && npcActor(c))
}

/**
 * Add "Morale Check" to the combatant context menu.
 * @param {CombatTracker} app
 * @param {Array<Object>} options - The menu entries (mutated)
 */
export function onGetCombatTrackerContextOptions (app, options) {
  const getCombatant = li => app.viewed?.combatants.get(li.dataset.combatantId)
  options.push({
    label: 'DCC.MoraleCheck',
    icon: 'fa-solid fa-person-running',
    visible: li => game.user.isGM && !!npcActor(getCombatant(li)),
    onClick: (event, li) => npcActor(getCombatant(li))?.rollMoraleCheck()
  })
}

/**
 * Add "Morale Check (NPCs)" to the encounter context menu.
 * @param {CombatTracker} app
 * @param {Array<Object>} options - The menu entries (mutated)
 */
export function onGetCombatContextOptions (app, options) {
  options.push({
    label: 'DCC.MoraleCheckNPCs',
    icon: 'fa-solid fa-person-running',
    visible: () => game.user.isGM && moraleEligibleCombatants(app.viewed).length > 0,
    onClick: async () => {
      for (const combatant of moraleEligibleCombatants(app.viewed)) {
        await combatant.actor.rollMoraleCheck()
      }
    }
  })
}
