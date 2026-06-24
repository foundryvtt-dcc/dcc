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
 * Base monster fumble die under the optional Monster Fumbles rule, at a +0
 * targeted-PC Luck modifier (DCC Yearbook #8). The die steps along the dice
 * chain from here as the PC's Luck rises or falls.
 */
export declare const MONSTER_FUMBLE_BASE_DIE = "1d10";
/**
 * Optional "Monster Fumbles" rule (DCC Yearbook #8). When a monster fumbles
 * (natural 1 on its attack die) against a PC, the targeted PC's Luck modifier
 * always alters the monster's fumble die: starting from 1d10 at +0, each +1
 * steps the die one rung UP the dice chain (d10 → d12 → d14 → d16) and each -1
 * steps it one rung DOWN (d10 → d8 → d7 → d6). When several PCs are targeted,
 * the caller passes the highest Luck modifier among them.
 *
 * This is distinct from the core fumble rule (`rollFumble`), where the
 * *fumbler's own* Luck is a flat modifier on the roll. Here a *defending* PC's
 * Luck resizes the *die*, so the result is meant to be rolled directly (or fed
 * to `rollFumble` via `fumbleDieOverride` with `luckModifier: 0`). Modifiers
 * are applied one chain-step per point and extrapolate past the printed ±3
 * table; a modifier that would run off either end of the dice chain leaves the
 * die unchanged (the dice-chain helper's clamp behaviour).
 *
 * @param targetLuckModifier - The (highest) targeted PC's Luck modifier
 * @returns The monster's fumble die formula (e.g. "1d14")
 *
 * @example
 * getMonsterFumbleDie(2)   // "1d14" — creature attacking a +2 Luck PC
 * getMonsterFumbleDie(-3)  // "1d6"
 * getMonsterFumbleDie(0)   // "1d10"
 */
export declare function getMonsterFumbleDie(targetLuckModifier: number): string;
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
