/**
 * Disapproval Module
 *
 * Pure functions for cleric disapproval mechanics.
 * Disapproval occurs when clerics roll within their disapproval range,
 * potentially requiring them to appease their deity.
 */
import type { RollOptions } from "../types/dice.js";
import type { SimpleTable, TableEffect } from "../tables/types.js";
/**
 * Default starting disapproval range for clerics
 */
export declare const DEFAULT_DISAPPROVAL_RANGE = 1;
/**
 * Maximum disapproval range (at which point casting becomes very difficult)
 */
export declare const MAX_DISAPPROVAL_RANGE = 20;
/**
 * Check if a natural roll triggers disapproval.
 *
 * @param natural - The natural die roll
 * @param disapprovalRange - Current disapproval range (e.g., 1 means only nat 1)
 * @returns True if the roll is within the disapproval range
 */
export declare function rollTriggersDisapproval(natural: number, disapprovalRange: number): boolean;
/**
 * Increase the disapproval range.
 * Range increases by 1 on natural 1 (by default).
 *
 * @param currentRange - Current disapproval range
 * @param increase - Amount to increase (default 1)
 * @returns New disapproval range (capped at MAX_DISAPPROVAL_RANGE)
 */
export declare function increaseDisapprovalRange(currentRange: number, increase?: number): number;
/**
 * Reset disapproval range (after appropriate penance/atonement).
 *
 * @param fullReset - If true, reset to 1; if false, reduce by a fixed amount
 * @param currentRange - Current disapproval range
 * @param reduction - Amount to reduce if not full reset (default 1)
 * @returns New disapproval range
 */
export declare function reduceDisapprovalRange(currentRange: number, reduction?: number, minimum?: number): number;
/**
 * Fully reset disapproval range to default.
 */
export declare function resetDisapprovalRange(): number;
/**
 * Result of rolling on the disapproval table
 */
export interface DisapprovalResult {
    /** The roll result (1d4 multiplied by disapproval range, typically) */
    roll: number;
    /** Description of the disapproval effect */
    description: string;
    /** Duration of the effect (if applicable) */
    duration?: string;
    /** Structured effect data */
    effect?: TableEffect;
    /** The disapproval range that was used */
    disapprovalRange: number;
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
export declare function rollDisapproval(disapprovalRange: number, disapprovalTable: SimpleTable, options?: RollOptions): DisapprovalResult;
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
export declare function checkAndRollDisapproval(natural: number, disapprovalRange: number, disapprovalTable: SimpleTable, options?: RollOptions): DisapprovalResult | undefined;
/**
 * Disapproval severity level
 */
export type DisapprovalSeverity = "minor" | "moderate" | "major" | "severe" | "catastrophic";
/**
 * Get the severity level of a disapproval roll.
 * Based on typical DCC disapproval table structure.
 */
export declare function getDisapprovalSeverity(roll: number): DisapprovalSeverity;
/**
 * Calculate the expected disapproval severity for a given range.
 * Useful for warning players about high disapproval ranges.
 */
export declare function getExpectedSeverity(disapprovalRange: number): {
    minimum: DisapprovalSeverity;
    maximum: DisapprovalSeverity;
    average: DisapprovalSeverity;
};
/**
 * Calculate the probability of triggering disapproval on a d20.
 */
export declare function getDisapprovalProbability(disapprovalRange: number): number;
/**
 * Get a description of how risky the current disapproval range is.
 */
export declare function getDisapprovalRiskDescription(disapprovalRange: number): string;
//# sourceMappingURL=disapproval.d.ts.map