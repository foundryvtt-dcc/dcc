/**
 * Saving Throw Calculation System
 *
 * Functions for calculating saving throws based on class, level, and abilities.
 * Saves are computed as: class bonus + ability modifier
 *
 * - Reflex = class ref bonus + Agility modifier
 * - Fortitude = class frt bonus + Stamina modifier
 * - Will = class wil bonus + Personality modifier
 *
 * @example
 * ```typescript
 * // Calculate saves for a character
 * const saves = calculateSavingThrows(character);
 *
 * // Get individual save
 * const reflexSave = calculateReflexSave(character);
 * ```
 */
import type { Character, SavingThrows, AbilityScores } from "../types/character.js";
/**
 * Input for calculating saving throws
 */
export interface SaveCalculationInput {
    /** Class ID (undefined for 0-level) */
    classId?: string | undefined;
    /** Character level (0 for 0-level) */
    level: number;
    /** Current ability scores */
    abilities: AbilityScores;
}
/**
 * Detailed breakdown of a saving throw calculation
 */
export interface SaveBreakdown {
    /** Total save bonus */
    total: number;
    /** Base bonus from class/level */
    classBonus: number;
    /** Bonus from ability modifier */
    abilityModifier: number;
    /** Which ability affects this save */
    ability: "agl" | "sta" | "per";
}
/**
 * Complete save breakdown for all three saves
 */
export interface SaveBreakdowns {
    reflex: SaveBreakdown;
    fortitude: SaveBreakdown;
    will: SaveBreakdown;
}
/**
 * Calculate all saving throws for a character
 *
 * @param character - Character to calculate saves for
 * @returns All three saving throw values
 *
 * @example
 * ```typescript
 * const saves = calculateSavingThrows(character);
 * console.log(saves.reflex, saves.fortitude, saves.will);
 * ```
 */
export declare function calculateSavingThrows(character: Character): SavingThrows;
/**
 * Calculate saving throws from raw input
 *
 * @param input - Save calculation input
 * @returns All three saving throw values
 */
export declare function calculateSavesFromInput(input: SaveCalculationInput): SavingThrows;
/**
 * Calculate saving throws with detailed breakdown
 *
 * @param character - Character to calculate saves for
 * @returns Breakdown of each save's components
 *
 * @example
 * ```typescript
 * const breakdown = calculateSavingThrowsWithBreakdown(character);
 * console.log(`Reflex: ${breakdown.reflex.classBonus} + ${breakdown.reflex.abilityModifier}`);
 * ```
 */
export declare function calculateSavingThrowsWithBreakdown(character: Character): SaveBreakdowns;
/**
 * Calculate Reflex save (Agility-based)
 */
export declare function calculateReflexSave(character: Character): number;
/**
 * Calculate Fortitude save (Stamina-based)
 */
export declare function calculateFortitudeSave(character: Character): number;
/**
 * Calculate Will save (Personality-based)
 */
export declare function calculateWillSave(character: Character): number;
/**
 * Recalculate and update a character's saving throws
 *
 * Returns a new character with updated save values.
 * Use this after abilities change (spellburn, curse, etc.)
 *
 * @param character - Character to update
 * @returns New character with recalculated saves
 */
export declare function recalculateSavingThrows(character: Character): Character;
//# sourceMappingURL=saving-throws.d.ts.map