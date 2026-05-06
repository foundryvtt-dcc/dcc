/**
 * Luck Check (Roll-Under)
 *
 * In DCC, luck checks use "roll-under" mechanics:
 * - Roll 1d20
 * - Success if the roll is equal to or less than the character's Luck score
 * - No modifiers are applied to the roll
 *
 * This is different from ability checks which add modifiers and compare against a DC.
 */
import type { Character } from "../types/character.js";
import type { DiceRoller } from "../types/dice.js";
import { type CharacterAccessors } from "./accessors.js";
/**
 * Result of a luck check
 */
export interface LuckCheckResult {
    /** The d20 roll */
    roll: number;
    /** The luck score being checked against */
    target: number;
    /** Whether the check succeeded (roll <= target) */
    success: boolean;
    /** Description of the check */
    label: string;
}
/**
 * Options for rolling a luck check
 */
export interface RollLuckCheckOptions {
    /** Custom dice roller */
    roller?: DiceRoller;
    /** Custom accessors for extracting data from the character */
    accessors?: CharacterAccessors;
    /** Label for the check */
    label?: string;
}
/**
 * Roll a luck check for a character
 *
 * Luck checks use roll-under mechanics: roll 1d20 and succeed if the result
 * is equal to or less than the character's current Luck score.
 *
 * @param character - The character making the check
 * @param options - Roll options
 * @returns The luck check result
 *
 * @example
 * import { rollLuckCheck } from 'dcc-core-lib';
 *
 * const result = rollLuckCheck(character);
 * if (result.success) {
 *   console.log(`Success! Rolled ${result.roll} vs Luck ${result.target}`);
 * }
 */
export declare function rollLuckCheck(character: Character, options?: RollLuckCheckOptions): LuckCheckResult;
/**
 * Roll a luck check with a specific target score
 *
 * Use this when you need to check against a specific luck value
 * rather than extracting it from a character.
 *
 * @param luckScore - The luck score to check against
 * @param roller - Custom dice roller (optional)
 * @param label - Label for the check (optional)
 * @returns The luck check result
 *
 * @example
 * import { rollLuckCheckSimple } from 'dcc-core-lib';
 *
 * const result = rollLuckCheckSimple(12);
 * if (result.success) {
 *   console.log(`Success! Rolled ${result.roll} vs ${result.target}`);
 * }
 */
export declare function rollLuckCheckSimple(luckScore: number, roller?: DiceRoller, label?: string): LuckCheckResult;
//# sourceMappingURL=luck-check.d.ts.map