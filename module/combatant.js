/* global Combatant, game */

/**
 * Extend the base Combatant entity with a custom initiative mechanism.
 * @extends {Combatant}
 */
class DCCCombatant extends Combatant {
  /** @override */
  _getInitiativeFormula () {
    // Calculate the initiative roll and extract formula, or fallback to the default formula
    // Can't pass any options here - using the Roll Modifier Dialog would require this interface to be async
    return this.actor.getInitiativeRoll()?.formula || game.system.initiative
  }
}

export default DCCCombatant
