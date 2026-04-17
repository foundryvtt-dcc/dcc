/**
 * Initiative System
 *
 * Handles initiative roll calculations including:
 * - Base initiative rolls
 * - Agility modifier
 * - Class-based initiative dice (warriors use different dice by level)
 * - Two-weapon fighting bonus (halflings)
 */
import type { DieType, DiceRoller } from "../types/dice.js";
import type { InitiativeInput, InitiativeResult, CombatEvents } from "../types/combat.js";
import type { RollBonus } from "../types/bonuses.js";
/**
 * Warrior initiative die progression by level
 * Warriors roll higher dice as they level up
 */
export declare const WARRIOR_INITIATIVE_DIE: Record<number, DieType>;
/**
 * Default initiative die for most classes
 */
export declare const DEFAULT_INITIATIVE_DIE: DieType;
/**
 * Get initiative die for a class at a level
 *
 * @param classId - Class identifier
 * @param level - Character level
 * @returns Initiative die type
 */
export declare function getInitiativeDie(classId: string, level: number): DieType;
/**
 * Roll initiative
 *
 * @param input - Initiative input parameters
 * @param roller - Optional custom dice roller
 * @param events - Optional event callbacks
 * @returns Initiative result
 *
 * @example
 * // Standard initiative roll
 * const result = rollInitiative({
 *   initiativeDie: "d16",
 *   agilityModifier: 2,
 * });
 *
 * @example
 * // Halfling with two-weapon fighting
 * const result = rollInitiative({
 *   initiativeDie: "d16",
 *   agilityModifier: 1,
 *   twoWeaponBonus: 1,
 * });
 *
 * @example
 * // Warrior with improved initiative die
 * const result = rollInitiative({
 *   initiativeDie: "d20",
 *   agilityModifier: 0,
 *   classModifier: 0,
 * });
 */
export declare function rollInitiative(input: InitiativeInput, roller?: DiceRoller, events?: CombatEvents): InitiativeResult;
/**
 * Calculate total initiative modifier
 *
 * @param agilityModifier - Agility modifier
 * @param classModifier - Class-based modifier (if any)
 * @param twoWeaponBonus - Two-weapon fighting bonus (if any)
 * @param bonuses - Additional bonuses
 * @returns Total initiative modifier
 */
export declare function calculateInitiativeModifier(agilityModifier: number, classModifier?: number, twoWeaponBonus?: number, bonuses?: RollBonus[]): number;
/**
 * Build initiative formula string for display
 *
 * @param initiativeDie - Initiative die type
 * @param agilityModifier - Agility modifier
 * @param otherModifiers - Other modifiers
 * @returns Formatted initiative formula
 */
export declare function buildInitiativeFormula(initiativeDie: DieType, agilityModifier: number, otherModifiers?: number): string;
/**
 * Sort combatants by initiative (highest first)
 *
 * @param initiatives - Array of initiative results with identifiers
 * @returns Sorted array (highest initiative first)
 */
export declare function sortByInitiative<T extends {
    initiative: number;
}>(combatants: readonly T[]): T[];
/**
 * Check for tied initiatives
 *
 * @param a - First initiative result
 * @param b - Second initiative result
 * @returns True if the initiatives are tied
 */
export declare function isInitiativeTied(a: InitiativeResult, b: InitiativeResult): boolean;
/**
 * Get two-weapon initiative bonus
 *
 * Halflings get +1 to initiative when fighting with two weapons.
 *
 * @param isHalfling - Whether the character is a halfling
 * @param isTwoWeaponFighting - Whether fighting with two weapons
 * @returns Initiative bonus
 */
export declare function getTwoWeaponInitiativeBonus(isHalfling: boolean, isTwoWeaponFighting: boolean): number;
//# sourceMappingURL=initiative.d.ts.map