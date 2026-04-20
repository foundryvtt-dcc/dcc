/**
 * Fumble System
 *
 * Handles fumble roll calculations including:
 * - Fumble die determination by armor type
 * - Luck modifier application (lower is worse!)
 * - Fumble table lookups
 */
import type { DieType, DiceRoller } from "../types/dice.js";
import type { FumbleInput, FumbleResult, ArmorType, CombatEvents } from "../types/combat.js";
export { FUMBLE_DICE } from "../types/combat.js";
/**
 * Armor check penalty by armor type (DCC core rules Table 3-3)
 * This penalty applies to certain skill checks.
 */
export declare const ARMOR_CHECK_PENALTY: Record<ArmorType, number>;
/**
 * Speed reduction by armor type, in feet (DCC core rules Table 3-3).
 */
export declare const ARMOR_SPEED_PENALTY: Record<ArmorType, number>;
/**
 * Get the fumble die for an armor type
 *
 * @param armorType - Type of armor worn
 * @returns Fumble die type
 */
export declare function getFumbleDie(armorType: ArmorType): DieType;
/**
 * Get armor type from armor name
 *
 * @param armorName - Name of the armor
 * @returns Armor type, defaulting to unarmored
 */
export declare function getArmorType(armorName: string): ArmorType;
/**
 * Roll a fumble
 *
 * In DCC, fumbles use a die based on armor worn. Heavier armor
 * means a larger fumble die, which means worse fumble results.
 * Luck modifier is SUBTRACTED from the roll (lower is better for
 * the fumbler, but the roll itself - lower luck = worse fumbles).
 *
 * Actually, in DCC, luck modifier is subtracted from the fumble roll,
 * meaning HIGHER luck results in LOWER fumble results (which are better).
 *
 * @param input - Fumble input parameters
 * @param roller - Optional custom dice roller
 * @param events - Optional event callbacks
 * @returns Fumble result
 *
 * @example
 * // Fumble in chainmail with good luck
 * const result = rollFumble({
 *   armorType: "chainmail",
 *   luckModifier: 2, // Subtracts from roll, so lower result
 * });
 *
 * @example
 * // Fumble unarmored with bad luck
 * const result = rollFumble({
 *   armorType: "unarmored",
 *   luckModifier: -1, // Adds to roll (since subtracted), so higher result
 * });
 */
export declare function rollFumble(input: FumbleInput, roller?: DiceRoller, events?: CombatEvents): FumbleResult;
/**
 * Calculate fumble modifier (for preview)
 *
 * @param luckModifier - Luck modifier
 * @returns Net modifier to fumble roll (negative luck = positive modifier)
 */
export declare function calculateFumbleModifier(luckModifier: number): number;
/**
 * Build fumble formula string for display
 *
 * @param fumbleDie - Fumble die type
 * @param luckModifier - Luck modifier
 * @returns Formatted fumble formula
 */
export declare function buildFumbleFormula(fumbleDie: DieType, luckModifier: number): string;
/**
 * Check if a natural roll is a fumble
 *
 * @param naturalRoll - The natural die result
 * @returns True if the roll is a fumble (natural 1)
 */
export declare function isFumble(naturalRoll: number): boolean;
/**
 * Get armor check penalty for an armor type
 *
 * @param armorType - Type of armor
 * @returns Check penalty (negative number)
 */
export declare function getArmorCheckPenalty(armorType: ArmorType): number;
/**
 * Get speed penalty for an armor type
 *
 * @param armorType - Type of armor
 * @returns Speed reduction in feet
 */
export declare function getArmorSpeedPenalty(armorType: ArmorType): number;
//# sourceMappingURL=fumbles.d.ts.map