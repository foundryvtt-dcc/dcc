/**
 * Critical Hit System
 *
 * Handles critical hit roll calculations including:
 * - Crit die rolling
 * - Crit table determination
 * - Luck modifier application
 * - Level-based crit bonuses
 */
import type { DieType, DiceRoller } from "../types/dice.js";
import type { CriticalInput, CriticalResult, CritTableId, CombatEvents } from "../types/combat.js";
import type { RollBonus } from "../types/bonuses.js";
/**
 * Warrior crit die progression by level
 */
export declare const WARRIOR_CRIT_DIE: Record<number, DieType>;
/**
 * Thief crit die progression by level
 */
export declare const THIEF_CRIT_DIE: Record<number, DieType>;
/**
 * Default crit die for classes without special progression
 */
export declare const DEFAULT_CRIT_DIE: DieType;
/**
 * Map of class to crit table
 */
export declare const CLASS_CRIT_TABLE: Record<string, CritTableId>;
/**
 * Get the crit table for a class
 *
 * @param classId - Class identifier
 * @returns Crit table ID
 */
export declare function getCritTable(classId: string): CritTableId;
/**
 * Get crit die for a class at a level
 *
 * @param classId - Class identifier
 * @param level - Character level
 * @returns Crit die type
 */
export declare function getCritDie(classId: string, level: number): DieType;
/**
 * Roll a critical hit
 *
 * @param input - Critical hit input parameters
 * @param roller - Optional custom dice roller
 * @param events - Optional event callbacks
 * @returns Critical hit result
 *
 * @example
 * // Warrior critical hit
 * const result = rollCritical({
 *   critTable: "III",
 *   critDie: "d14",
 *   luckModifier: 2,
 *   level: 3,
 * });
 *
 * @example
 * // Thief critical hit
 * const result = rollCritical({
 *   critTable: "II",
 *   critDie: "d12",
 *   luckModifier: -1,
 * });
 */
export declare function rollCritical(input: CriticalInput, roller?: DiceRoller, events?: CombatEvents): CriticalResult;
/**
 * Calculate total crit modifier
 *
 * @param luckModifier - Luck modifier
 * @param level - Character level (if applicable)
 * @param bonuses - Additional bonuses
 * @returns Total crit roll modifier
 */
export declare function calculateCritModifier(luckModifier: number, level?: number, bonuses?: RollBonus[]): number;
/**
 * Determine which crit table to use based on class and weapon
 *
 * @param classId - Character's class
 * @param weaponCritTable - Optional weapon-specific crit table override
 * @returns Crit table ID
 */
export declare function determineCritTable(classId: string, weaponCritTable?: CritTableId): CritTableId;
/**
 * Build crit formula string for display
 *
 * @param critDie - Crit die type
 * @param luckModifier - Luck modifier
 * @param level - Optional level modifier
 * @returns Formatted crit formula
 */
export declare function buildCritFormula(critDie: DieType, luckModifier: number, level?: number): string;
/**
 * Parse crit table result into extra damage
 *
 * This is a utility function for parsing crit table entries.
 * In practice, crit tables vary widely, so this just handles
 * common patterns like "+1d6 damage" or "+2 damage".
 *
 * @param tableResultText - Text from crit table lookup
 * @returns Parsed extra damage info, or undefined if not applicable
 */
export declare function parseCritExtraDamage(tableResultText: string): {
    dice?: string;
    modifier?: number;
} | undefined;
//# sourceMappingURL=crits.d.ts.map