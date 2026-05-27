/**
 * Hit Point Calculation System
 *
 * Functions for calculating and recalculating character HP based on
 * level, stamina modifier, and roll history.
 *
 * @example
 * ```typescript
 * // Calculate max HP from history (for recalculation when stamina changes)
 * const maxHP = calculateMaxHP(character);
 *
 * // Recalculate HP when stamina modifier changes
 * const updated = recalculateHP(character);
 *
 * // Estimate expected HP for a given level (no history needed)
 * const expected = estimateMaxHP("warrior", 5, 1); // level 5 warrior with +1 STA
 * ```
 */
import type { Character, HPRollRecord } from "../types/character.js";
/**
 * Calculate max HP from roll history with current stamina modifier
 *
 * If no history is available, returns the current max HP unchanged.
 *
 * @param character - The character to calculate HP for
 * @returns Calculated max HP based on history and current stamina
 *
 * @example
 * ```typescript
 * const maxHP = calculateMaxHP(character);
 * ```
 */
export declare function calculateMaxHP(character: Character): number;
/**
 * Recalculate character HP based on history and current stamina
 *
 * Returns a new character with updated HP values. If stamina has changed,
 * this will adjust max HP accordingly. Current HP is adjusted proportionally.
 *
 * @param character - The character to recalculate HP for
 * @returns New character with recalculated HP
 *
 * @example
 * ```typescript
 * // After stamina damage heals
 * const updated = recalculateHP(character);
 * ```
 */
export declare function recalculateHP(character: Character): Character;
/**
 * Estimate expected max HP for a character of given class and level
 *
 * Uses average die rolls. Useful for NPC generation or validation.
 *
 * @param classId - Class ID (for hit die lookup)
 * @param level - Character level (0 for 0-level)
 * @param staminaModifier - Stamina modifier to apply per level
 * @returns Estimated max HP
 *
 * @example
 * ```typescript
 * // Expected HP for level 5 warrior with +2 STA mod
 * const hp = estimateMaxHP("warrior", 5, 2); // ~45 HP
 * ```
 */
export declare function estimateMaxHP(classId: string | undefined, level: number, staminaModifier: number): number;
/**
 * Calculate minimum possible HP for a character
 *
 * Assumes minimum rolls on all dice. Useful for validation.
 *
 * @param level - Character level (0 for 0-level)
 * @returns Minimum possible HP (at least 1 per level)
 */
export declare function calculateMinimumHP(level: number): number;
/**
 * Calculate maximum possible HP for a character
 *
 * Assumes maximum rolls on all dice with given stamina modifier.
 *
 * @param classId - Class ID (for hit die lookup)
 * @param level - Character level (0 for 0-level)
 * @param staminaModifier - Stamina modifier to apply per level
 * @returns Maximum possible HP
 */
export declare function calculateMaximumHP(classId: string | undefined, level: number, staminaModifier: number): number;
/**
 * Create an HP roll record for a level-up
 *
 * @param level - Level at which HP is being gained
 * @param die - Die being rolled
 * @param rolled - Raw die result
 * @param staminaModifier - Current stamina modifier
 * @returns HP roll record
 */
export declare function createHPRollRecord(level: number, die: string, rolled: number, staminaModifier: number): HPRollRecord;
/**
 * Add an HP roll to a character's history
 *
 * @param character - Character to update
 * @param record - HP roll record to add
 * @returns Updated character with new HP history entry
 */
export declare function addHPRollToHistory(character: Character, record: HPRollRecord): Character;
/**
 * Get total HP gained from history
 *
 * @param history - HP roll history
 * @returns Total HP from all recorded rolls
 */
export declare function getTotalHPFromHistory(history: HPRollRecord[]): number;
//# sourceMappingURL=hit-points.d.ts.map