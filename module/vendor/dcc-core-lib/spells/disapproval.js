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
function defaultRoller(faces) {
    return Math.floor(Math.random() * faces) + 1;
}
/**
 * Roll for disapproval effect.
 *
 * In DCC, the disapproval roll is typically:
 * 1d4 × current disapproval range
 *
 * @param disapprovalRange - Current disapproval range
 * @param disapprovalTable - Table to look up the result
 * @param options - Roll options
 * @returns The disapproval result
 */
export function rollDisapproval(disapprovalRange, disapprovalTable, options = {}) {
    // Roll 1d4
    let baseRoll;
    if (options.roller) {
        baseRoll = options.roller("1d4");
    }
    else {
        baseRoll = defaultRoller(4);
    }
    // Multiply by disapproval range
    const roll = baseRoll * disapprovalRange;
    // Look up result
    const tableResult = lookupSimple(disapprovalTable, roll);
    const result = {
        roll,
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
 * @param options - Roll options
 * @returns DisapprovalResult if triggered, undefined otherwise
 */
export function checkAndRollDisapproval(natural, disapprovalRange, disapprovalTable, options = {}) {
    if (!rollTriggersDisapproval(natural, disapprovalRange)) {
        return undefined;
    }
    return rollDisapproval(disapprovalRange, disapprovalTable, options);
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
 */
export function getExpectedSeverity(disapprovalRange) {
    const minRoll = disapprovalRange; // Roll of 1 × range
    const maxRoll = disapprovalRange * 4; // Roll of 4 × range
    const avgRoll = Math.floor(disapprovalRange * 2.5); // Average of 2.5 × range
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
//# sourceMappingURL=disapproval.js.map