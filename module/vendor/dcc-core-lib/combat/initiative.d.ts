/**
 * Initiative System
 *
 * RAW (Core Book Ch. 4 — Initiative):
 *   "An initiative check is conducted by rolling 1d20 and adding the
 *    appropriate modifier: Agility modifier, and, for warriors, class
 *    level."
 *   "A d16 is used instead of a d20 for characters wielding two-handed
 *    weapons."
 *
 * There is no per-class initiative die scaling; warriors get a flat
 * class-level modifier instead. Halflings have no special initiative
 * rule (their two-weapon advantages are die-chain reductions only).
 */
import type { DieType, DiceRoller } from "../types/dice.js";
import type { InitiativeInput, InitiativeResult, CombatEvents } from "../types/combat.js";
import type { RollBonus } from "../types/bonuses.js";
/** Standard initiative die for all classes (RAW). */
export declare const DEFAULT_INITIATIVE_DIE: DieType;
/** Initiative die when wielding a two-handed weapon (RAW). */
export declare const TWO_HANDED_INITIATIVE_DIE: DieType;
/**
 * Get the initiative die a character should roll.
 *
 * @param isWieldingTwoHanded - True if the character is wielding a
 *   two-handed weapon. Defaults to false.
 * @returns `d16` when two-handing, `d20` otherwise.
 */
export declare function getInitiativeDie(isWieldingTwoHanded?: boolean): DieType;
/**
 * Roll initiative.
 *
 * Callers are responsible for selecting the right die (use
 * `getInitiativeDie`) and supplying any class-level modifier
 * (warriors add their class level via `classModifier`).
 *
 * @example
 * // Standard PC
 * rollInitiative({ initiativeDie: "d20", agilityModifier: 2 });
 *
 * @example
 * // Warrior level 3 with Agl +1
 * rollInitiative({
 *   initiativeDie: "d20",
 *   agilityModifier: 1,
 *   classModifier: 3, // class level
 * });
 *
 * @example
 * // Two-handing fighter (warrior level 3 still adds level)
 * rollInitiative({
 *   initiativeDie: "d16",
 *   agilityModifier: 1,
 *   classModifier: 3,
 * });
 */
export declare function rollInitiative(input: InitiativeInput, roller?: DiceRoller, events?: CombatEvents): InitiativeResult;
/**
 * Calculate total initiative modifier (no die roll).
 *
 * @param agilityModifier - Agility modifier
 * @param classModifier - Class-based modifier (warrior level)
 * @param bonuses - Additional bonuses
 */
export declare function calculateInitiativeModifier(agilityModifier: number, classModifier?: number, bonuses?: RollBonus[]): number;
/**
 * Build initiative formula string for display.
 */
export declare function buildInitiativeFormula(initiativeDie: DieType, agilityModifier: number, otherModifiers?: number): string;
/**
 * Sort combatants by initiative (highest first).
 */
export declare function sortByInitiative<T extends {
    initiative: number;
}>(combatants: readonly T[]): T[];
/**
 * Check for tied initiatives.
 */
export declare function isInitiativeTied(a: InitiativeResult, b: InitiativeResult): boolean;
//# sourceMappingURL=initiative.d.ts.map