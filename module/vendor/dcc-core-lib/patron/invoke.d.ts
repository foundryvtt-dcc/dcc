/**
 * Invoke Patron Mechanics
 *
 * Pure functions for the Invoke Patron spell check.
 * Invoke Patron is a level 1 wizard spell that calls upon the caster's patron
 * for supernatural aid. Results are determined by a spell check against the
 * patron's unique invoke table.
 */
import type { RollOptions, LegacyRollModifier } from "../types/dice.js";
import type { TieredTable } from "../tables/types.js";
import type { InvokePatronInput, InvokePatronResult, PatronEvents } from "../types/patron.js";
/**
 * Minimum check result for patron to answer.
 * Below this threshold, the invocation fails.
 */
export declare const INVOKE_PATRON_MIN_SUCCESS = 12;
/**
 * Natural 1 always triggers patron taint on invoke.
 */
export declare const INVOKE_PATRON_FUMBLE_TRIGGERS_TAINT = true;
/**
 * Calculate all modifiers for an Invoke Patron check.
 *
 * @param input - Invoke patron input
 * @returns Array of roll modifiers
 */
export declare function buildInvokeModifiers(input: InvokePatronInput): LegacyRollModifier[];
/**
 * Sum all modifiers to get total modifier value.
 *
 * @param modifiers - Array of roll modifiers
 * @returns Total modifier value
 */
export declare function sumModifiers(modifiers: readonly LegacyRollModifier[]): number;
/**
 * Build the formula string for display.
 *
 * @param natural - The natural die roll
 * @param modifiers - Array of roll modifiers
 * @returns Formula string (e.g., "15 + 3 + 2 = 20")
 */
export declare function buildInvokeFormula(natural: number, modifiers: readonly LegacyRollModifier[]): string;
/**
 * Invoke a patron.
 *
 * This performs the Invoke Patron spell check:
 * 1. Roll d20 + modifiers
 * 2. Check for fumble (natural 1) - triggers patron taint
 * 3. Check for critical (natural 20) - enhanced result
 * 4. Look up result in patron's invoke table
 * 5. Determine if patron answers based on total
 *
 * @param input - Invoke patron input
 * @param options - Roll options (including custom roller)
 * @param events - Event callbacks
 * @returns Invoke patron result
 */
export declare function invokePatron(input: InvokePatronInput, options?: RollOptions, events?: PatronEvents): InvokePatronResult;
/**
 * Check if an invoke result was successful.
 *
 * @param result - The invoke patron result
 * @returns True if patron answered
 */
export declare function isInvokeSuccess(result: InvokePatronResult): boolean;
/**
 * Check if an invoke result was a fumble.
 *
 * @param result - The invoke patron result
 * @returns True if natural 1 was rolled
 */
export declare function isInvokeFumble(result: InvokePatronResult): boolean;
/**
 * Get a summary of the invoke result for display.
 *
 * @param result - The invoke patron result
 * @returns Summary string
 */
export declare function getInvokeSummary(result: InvokePatronResult): string;
/**
 * Calculate the minimum check needed for a specific invoke result tier.
 * This helps players understand what they need to roll for desired effects.
 *
 * @param invokeTable - The patron's invoke table
 * @param desiredTier - The tier to achieve
 * @returns Minimum check total needed, or undefined if tier not in table
 */
export declare function getMinimumForInvokeTier(invokeTable: TieredTable, desiredTier: string): number | undefined;
/**
 * Estimate the chance of success given modifiers.
 * Assumes a d20 roll.
 *
 * @param totalModifier - Total modifier to the roll
 * @param targetDC - Target DC (default INVOKE_PATRON_MIN_SUCCESS)
 * @returns Probability of success (0-1)
 */
export declare function estimateInvokeSuccessChance(totalModifier: number, targetDC?: number): number;
//# sourceMappingURL=invoke.d.ts.map