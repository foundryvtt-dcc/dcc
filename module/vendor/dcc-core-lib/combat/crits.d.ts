/**
 * Critical Hit System
 *
 * Handles critical hit roll calculations including:
 * - Crit die rolling
 * - Crit table determination
 * - Luck modifier application
 * - Level-based crit bonuses
 */
import type { CritDieFormula, DieType, DiceRoller } from "../types/dice.js";
import type { CriticalInput, CriticalResult, CritTableId, CombatEvents } from "../types/combat.js";
import type { RollBonus } from "../types/bonuses.js";
/**
 * Default crit die when no class progression is registered
 */
export declare const DEFAULT_CRIT_DIE: DieType;
/**
 * Get the crit table for a class at a level. Crit tables can vary by level
 * (e.g., warriors use III at L1-2, IV at L3-4, V at L5+), so prefer passing
 * the character's current level. If omitted, defaults to level 1.
 *
 * @param classId - Class identifier
 * @param level - Character level (default 1)
 * @returns Crit table ID
 */
export declare function getCritTable(classId: string, level?: number): CritTableId;
/**
 * Get crit die for a class at a level. Reads from the registered class
 * progression data (see `registerClassProgression`). Returns the `DEFAULT_CRIT_DIE`
 * when no progression is registered for the class.
 *
 * @param classId - Class identifier
 * @param level - Character level
 * @returns Crit die formula (e.g., "d12", "2d20", "d30+2")
 */
export declare function getCritDie(classId: string, level: number): CritDieFormula;
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
export declare function buildCritFormula(critDie: CritDieFormula, luckModifier: number, level?: number): string;
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