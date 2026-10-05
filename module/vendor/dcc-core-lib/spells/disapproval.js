/**
 * Disapproval Module
 *
 * Pure functions for cleric disapproval mechanics.
 * Disapproval occurs when clerics roll within their disapproval range,
 * potentially requiring them to appease their deity.
 */
import { lookupSimple } from "../tables/lookup.js";
// =============================================================================
// Disapproval Range
// =============================================================================
/**
 * Default starting disapproval range for clerics
 */
export const DEFAULT_DISAPPROVAL_RANGE = 1;
/**
 * Maximum disapproval range (at which point casting becomes very difficult)
 */
export const MAX_DISAPPROVAL_RANGE = 20;
/**
 * Check if a natural roll triggers disapproval.
 *
 * @param natural - The natural die roll
 * @param disapprovalRange - Current disapproval range (e.g., 1 means only nat 1)
 * @returns True if the roll is within the disapproval range
 */
export function rollTriggersDisapproval(natural, disapprovalRange) {
    return natural <= disapprovalRange;
}
/**
 * Increase the disapproval range.
 * Range increases by 1 on natural 1 (by default).
 *
 * @param currentRange - Current disapproval range
 * @param increase - Amount to increase (default 1)
 * @returns New disapproval range (capped at MAX_DISAPPROVAL_RANGE)
 */
export function increaseDisapprovalRange(currentRange, increase = 1) {
    return Math.min(MAX_DISAPPROVAL_RANGE, currentRange + increase);
}
/**
 * Reset disapproval range (after appropriate penance/atonement).
 *
 * @param fullReset - If true, reset to 1; if false, reduce by a fixed amount
 * @param currentRange - Current disapproval range
 * @param reduction - Amount to reduce if not full reset (default 1)
 * @returns New disapproval range
 */
export function reduceDisapprovalRange(currentRange, reduction = 1, minimum = DEFAULT_DISAPPROVAL_RANGE) {
    return Math.max(minimum, currentRange - reduction);
}
/**
 * Fully reset disapproval range to default.
 */
export function resetDisapprovalRange() {
    return DEFAULT_DISAPPROVAL_RANGE;
}
/**
 * Default random number generator for disapproval rolls
 */
function defaultRoller(count, faces) {
    let total = 0;
    for (let i = 0; i < count; i++) {
        total += Math.floor(Math.random() * faces) + 1;
    }
    return total;
}
/**
 * Roll for disapproval effect.
 *
 * DCC RAW (core rulebook, Table 5-7): the cleric rolls 1d4 for every point
 * of the natural spell-check roll (a natural 1 rolls 1d4, a natural 4 inside
 * the range rolls 4d4), and the roll is reduced by the cleric's Luck
 * modifier. The disapproval range itself only decides *whether* disapproval
 * happens; it does not scale the roll.
 *
 * A Luck modifier can push the roll below 1. The table starts at 1, so the
 * lookup clamps to 1 (the mildest result); `roll` keeps the unclamped value
 * so callers can show the arithmetic.
 *
 * @param naturalRoll - The natural d20 roll that triggered disapproval
 * @param disapprovalRange - Current disapproval range (reported only)
 * @param disapprovalTable - Table to look up the result
 * @param luckModifier - The cleric's Luck modifier (default 0)
 * @param options - Roll options. A custom roller receives "Nd4".
 * @returns The disapproval result
 */
export function rollDisapproval(naturalRoll, disapprovalRange, disapprovalTable, luckModifier = 0, options = {}) {
    const diceCount = Math.max(1, Math.floor(naturalRoll));
    const formula = `${String(diceCount)}d4`;
    const diceTotal = options.roller
        ? options.roller(formula)
        : defaultRoller(diceCount, 4);
    const roll = diceTotal - luckModifier;
    const tableResult = lookupSimple(disapprovalTable, Math.max(1, roll));
    const result = {
        roll,
        formula,
        diceCount,
        naturalRoll,
        luckModifier,
        description: tableResult?.text ?? `Disapproval (roll ${String(roll)})`,
        disapprovalRange,
    };
    if (tableResult?.effect) {
        result.effect = tableResult.effect;
        // Extract duration if present
        if (tableResult.effect.duration) {
            result.duration = tableResult.effect.duration;
        }
    }
    return result;
}
// =============================================================================
// Disapproval with Natural Roll Check
// =============================================================================
/**
 * Combined check and roll for disapproval.
 * Returns undefined if disapproval was not triggered.
 *
 * @param natural - The natural die roll from the spell check
 * @param disapprovalRange - Current disapproval range
 * @param disapprovalTable - Table to look up the result
 * @param luckModifier - The cleric's Luck modifier (default 0)
 * @param options - Roll options
 * @returns DisapprovalResult if triggered, undefined otherwise
 */
export function checkAndRollDisapproval(natural, disapprovalRange, disapprovalTable, luckModifier = 0, options = {}) {
    if (!rollTriggersDisapproval(natural, disapprovalRange)) {
        return undefined;
    }
    return rollDisapproval(natural, disapprovalRange, disapprovalTable, luckModifier, options);
}
/**
 * Get the severity level of a disapproval roll.
 * Based on typical DCC disapproval table structure.
 */
export function getDisapprovalSeverity(roll) {
    if (roll <= 4)
        return "minor";
    if (roll <= 8)
        return "moderate";
    if (roll <= 12)
        return "major";
    if (roll <= 16)
        return "severe";
    return "catastrophic";
}
/**
 * Calculate the expected disapproval severity for a given range.
 * Useful for warning players about high disapproval ranges.
 *
 * Any natural roll from 1 to the range triggers disapproval, and the roll is
 * (natural)d4 − Luck modifier, so the best case is a natural 1 rolling a 1
 * and the worst case is a natural equal to the range rolling all 4s.
 * The average assumes each triggering natural is equally likely.
 */
export function getExpectedSeverity(disapprovalRange, luckModifier = 0) {
    const range = Math.max(1, Math.floor(disapprovalRange));
    const minRoll = Math.max(1, 1 - luckModifier);
    const maxRoll = Math.max(1, range * 4 - luckModifier);
    // Mean natural over 1..range is (range + 1) / 2; each d4 averages 2.5.
    const avgRoll = Math.max(1, Math.floor(((range + 1) / 2) * 2.5 - luckModifier));
    return {
        minimum: getDisapprovalSeverity(minRoll),
        maximum: getDisapprovalSeverity(maxRoll),
        average: getDisapprovalSeverity(avgRoll),
    };
}
// =============================================================================
// Utility Functions
// =============================================================================
/**
 * Calculate the probability of triggering disapproval on a d20.
 */
export function getDisapprovalProbability(disapprovalRange) {
    return Math.min(1, disapprovalRange / 20);
}
/**
 * Get a description of how risky the current disapproval range is.
 */
export function getDisapprovalRiskDescription(disapprovalRange) {
    const probability = getDisapprovalProbability(disapprovalRange);
    const percent = Math.round(probability * 100);
    if (disapprovalRange <= 1) {
        return `Low risk (${String(percent)}% - natural 1 only)`;
    }
    if (disapprovalRange <= 3) {
        return `Moderate risk (${String(percent)}% - natural 1-${String(disapprovalRange)})`;
    }
    if (disapprovalRange <= 5) {
        return `High risk (${String(percent)}% - natural 1-${String(disapprovalRange)})`;
    }
    return `Extreme risk (${String(percent)}% - natural 1-${String(disapprovalRange)})`;
}
