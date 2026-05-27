/**
 * Encounter Engine
 *
 * Pure functions for managing combat encounters including:
 * - Creating encounters with players and monsters
 * - Rolling and managing initiative
 * - Processing combat actions
 * - Tracking damage and combat state
 */
import type { Character } from "../types/character.js";
import type { Creature } from "../types/creatures.js";
import type { DiceRoller } from "../types/dice.js";
import type { CombatEncounterState, PlayerCombatant, MonsterCombatant, Combatant, AttackActionResult, MonsterTurnResult } from "./types.js";
/**
 * Create player combatants from characters
 */
export declare function createPlayerCombatants(players: {
    discordUserId: string;
    character: Character;
}[]): PlayerCombatant[];
/**
 * Create monster combatants from creatures
 */
export declare function createMonsterCombatants(monsters: {
    creature: Creature;
    count: number;
}[], roller?: DiceRoller): MonsterCombatant[];
/**
 * Create a new combat encounter
 */
export declare function createCombatEncounter(encounterId: string, players: {
    discordUserId: string;
    character: Character;
}[], monsters: {
    creature: Creature;
    count: number;
}[], roller?: DiceRoller): CombatEncounterState;
/**
 * Roll initiative for all combatants and set up turn order
 */
export declare function rollAllInitiative(encounter: CombatEncounterState, roller?: DiceRoller): CombatEncounterState;
/**
 * Get the current turn's combatant
 */
export declare function getCurrentTurnCombatant(encounter: CombatEncounterState): Combatant | undefined;
/**
 * Check if it's a specific player's turn
 */
export declare function isPlayersTurn(encounter: CombatEncounterState, discordUserId: string): boolean;
/**
 * Get a combatant by ID
 */
export declare function getCombatantById(encounter: CombatEncounterState, combatantId: string): Combatant | undefined;
/**
 * Get a combatant by name (partial match, case-insensitive)
 */
export declare function getCombatantByName(encounter: CombatEncounterState, name: string): Combatant | undefined;
/**
 * Get all living combatants
 */
export declare function getLivingCombatants(encounter: CombatEncounterState): Combatant[];
/**
 * Get all living players
 */
export declare function getLivingPlayers(encounter: CombatEncounterState): PlayerCombatant[];
/**
 * Get all living monsters
 */
export declare function getLivingMonsters(encounter: CombatEncounterState): MonsterCombatant[];
/**
 * Advance to the next turn
 */
export declare function advanceTurn(encounter: CombatEncounterState): CombatEncounterState;
/**
 * Apply damage to a combatant
 */
export declare function applyCombatDamage(encounter: CombatEncounterState, targetId: string, damage: number): CombatEncounterState;
/**
 * Process a player attack action
 */
export declare function processPlayerAttack(encounter: CombatEncounterState, attackerId: string, targetId: string, roller?: DiceRoller): {
    encounter: CombatEncounterState;
    result: AttackActionResult;
};
/**
 * Check if combat has ended
 */
export declare function checkCombatEnd(encounter: CombatEncounterState): {
    ended: boolean;
    reason?: "victory" | "defeat" | "fled";
};
/**
 * End the combat encounter
 */
export declare function endCombat(encounter: CombatEncounterState, reason: "victory" | "defeat" | "fled"): CombatEncounterState;
/**
 * Process a single monster's turn
 */
export declare function processMonsterTurn(encounter: CombatEncounterState, monsterId: string, roller?: DiceRoller): {
    encounter: CombatEncounterState;
    result: MonsterTurnResult;
};
/**
 * Process all pending monster turns until it's a player's turn or combat ends
 */
export declare function processAllMonsterTurns(encounter: CombatEncounterState, roller?: DiceRoller): {
    encounter: CombatEncounterState;
    results: MonsterTurnResult[];
};
//# sourceMappingURL=encounter-engine.d.ts.map