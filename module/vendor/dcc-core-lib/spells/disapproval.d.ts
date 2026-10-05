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
    /**
     * The disapproval roll: (natural)d4 minus the cleric's Luck modifier.
     * Not clamped — may be below 1 when Luck is high. The table lookup
     * clamps to row 1 (see `rollDisapproval`).
     */
    roll: number;
    /** The dice expression rolled, e.g. "3d4" */
    formula: string;
    /** Number of d4s rolled (equals the triggering natural roll) */
    diceCount: number;
    /** The natural spell-check roll that triggered disapproval */
    naturalRoll: number;
    /** The cleric's Luck modifier (subtracted from the dice total) */
    luckModifier: number;
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
export declare function rollDisapproval(naturalRoll: number, disapprovalRange: number, disapprovalTable: SimpleTable, luckModifier?: number, options?: RollOptions): DisapprovalResult;
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
export declare function checkAndRollDisapproval(natural: number, disapprovalRange: number, disapprovalTable: SimpleTable, luckModifier?: number, options?: RollOptions): DisapprovalResult | undefined;
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
 *
 * Any natural roll from 1 to the range triggers disapproval, and the roll is
 * (natural)d4 − Luck modifier, so the best case is a natural 1 rolling a 1
 * and the worst case is a natural equal to the range rolling all 4s.
 * The average assumes each triggering natural is equally likely.
 */
export declare function getExpectedSeverity(disapprovalRange: number, luckModifier?: number): {
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
