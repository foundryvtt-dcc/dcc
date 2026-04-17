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
import { DEFAULT_ACCESSORS } from "./accessors.js";
/**
 * Default dice roller using Math.random
 */
function defaultRoller(expression) {
    // Parse "1d20" format
    const match = /^(\d+)d(\d+)$/.exec(expression);
    if (!match) {
        throw new Error(`Invalid dice expression: ${expression}`);
    }
    const countStr = match[1];
    const facesStr = match[2];
    if (!countStr || !facesStr) {
        throw new Error(`Invalid dice expression: ${expression}`);
    }
    const count = parseInt(countStr, 10);
    const faces = parseInt(facesStr, 10);
    let total = 0;
    for (let i = 0; i < count; i++) {
        total += Math.floor(Math.random() * faces) + 1;
    }
    return total;
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
export function rollLuckCheck(character, options = {}) {
    const accessors = options.accessors ?? DEFAULT_ACCESSORS;
    const roller = options.roller ?? defaultRoller;
    const label = options.label ?? "Luck Check";
    // Get current luck score
    const luckScore = accessors.getLuck(character);
    // Roll 1d20
    const roll = roller("1d20");
    // Success if roll <= luck score
    const success = roll <= luckScore;
    return {
        roll,
        target: luckScore,
        success,
        label,
    };
}
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
export function rollLuckCheckSimple(luckScore, roller, label = "Luck Check") {
    const actualRoller = roller ?? defaultRoller;
    // Roll 1d20
    const roll = actualRoller("1d20");
    // Success if roll <= luck score
    const success = roll <= luckScore;
    return {
        roll,
        target: luckScore,
        success,
        label,
    };
}
//# sourceMappingURL=luck-check.js.map