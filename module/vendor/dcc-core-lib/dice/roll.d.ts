/**
 * Roll formula parsing and evaluation
 *
 * Handles dice roll formulas like "1d20+5", supporting:
 * - Formula-only mode (returns formula without rolling)
 * - Built-in random roller
 * - Custom roller injection (for FoundryVTT, testing, etc.)
 */
import type { DieType, RollOptions, RollResult, RollModifier, ParsedDiceExpression } from "../types/dice.js";
/**
 * Ensure a modifier string has a + prefix if positive
 *
 * @param value - The value to format
 * @param includeZero - If true, returns "+0" for zero; if false, returns ""
 * @returns Formatted string with + prefix for non-negative values
 *
 * @example
 * ensurePlus("5") // "+5"
 * ensurePlus("-3") // "-3"
 * ensurePlus("0") // "+0"
 * ensurePlus("0", false) // ""
 * ensurePlus("d6") // "+d6"
 */
export declare function ensurePlus(value: string, includeZero?: boolean): string;
/**
 * Extract the first die expression from a formula
 *
 * @param formula - Roll formula like "1d20+5+1d6"
 * @returns First die expression (e.g., "1d20") or empty string
 */
export declare function getFirstDie(formula: string): string;
/**
 * Extract the first numeric modifier from a formula
 *
 * @param formula - Roll formula like "1d20+5-2"
 * @returns First modifier (e.g., "+5") or empty string
 */
export declare function getFirstMod(formula: string): string;
/**
 * Build a roll formula from components
 *
 * @param die - Base die (e.g., "d20")
 * @param count - Number of dice
 * @param modifiers - Array of modifiers to add
 * @returns Complete formula string
 */
export declare function buildFormula(die: DieType, count: number, modifiers: RollModifier[]): string;
/**
 * Parse a complete roll formula into components
 *
 * Handles formulas like:
 * - "1d20"
 * - "2d6+5"
 * - "1d20+3-2"
 * - "1d20+1d6+5"
 *
 * @param formula - The formula to parse
 * @returns Parsed components
 */
export interface ParsedFormula {
    /** The primary dice expression */
    dice: ParsedDiceExpression | null;
    /** Total of all numeric modifiers */
    totalModifier: number;
    /** Individual modifier values found */
    modifierValues: number[];
    /** Additional dice expressions found */
    additionalDice: ParsedDiceExpression[];
    /** The original formula */
    original: string;
    /** Cleaned/normalized formula */
    normalized: string;
}
export declare function parseFormula(formula: string): ParsedFormula;
/**
 * Evaluate a roll formula
 *
 * @param formula - The roll formula (e.g., "1d20+5")
 * @param options - Roll options (mode, custom roller)
 * @returns Roll result
 */
export declare function evaluateRoll(formula: string, options?: RollOptions): RollResult;
/**
 * Create a roll with modifiers
 *
 * This is a higher-level function that builds a formula from
 * components and optionally evaluates it.
 *
 * @param die - The die to roll
 * @param modifiers - Modifiers to apply
 * @param options - Roll options
 * @returns Roll result
 */
export declare function createRoll(die: DieType, modifiers: RollModifier[], options?: RollOptions): RollResult;
/**
 * Roll a simple die
 *
 * Convenience function for quick single-die rolls.
 *
 * @param die - Die type (e.g., "d20")
 * @param modifier - Optional flat modifier
 * @param options - Roll options
 * @returns Roll result
 */
export declare function rollSimple(die: DieType, modifier?: number, options?: RollOptions): RollResult;
/**
 * Check if a roll is a natural 20 (or max on the die)
 */
export declare function isNatural20(result: RollResult): boolean;
/**
 * Check if a roll is a natural 1
 */
export declare function isNatural1(result: RollResult): boolean;
/**
 * Adjust threat range for dice larger than d20
 *
 * A threat range represents "top N values of the die". For example:
 * - Threat range 20 on d20 = only 20 (top 1 value)
 * - Threat range 19 on d20 = 19-20 (top 2 values)
 * - Threat range 19 on d24 = 23-24 (top 2 values)
 *
 * Formula: adjustedRange = dieFaces - (20 - threatRange)
 *
 * @param threatRange - Base threat range (designed for d20)
 * @param dieFaces - Number of faces on the die being rolled
 * @returns Adjusted threat range for the die
 */
export declare function adjustThreatRange(threatRange: number, dieFaces: number): number;
/**
 * Check if a roll meets or exceeds a threat range
 *
 * For dice larger than d20, the threat range is adjusted to preserve
 * the same "top N values" relationship. For example, a threat range
 * of 19-20 on d20 becomes 23-24 on d24.
 *
 * @param result - The roll result
 * @param threatRange - Minimum natural roll for threat (e.g., 19 for 19-20 on d20)
 * @returns True if natural roll meets the adjusted threat range
 */
export declare function meetsThreatRange(result: RollResult, threatRange: number): boolean;
/**
 * Check if a roll is an automatic hit (natural max on the die)
 *
 * Only a natural 20 on d20 (or the maximum value on larger dice)
 * is an automatic hit. This is distinct from threat range - a warrior
 * with 19-20 threat range rolling a 19 does NOT auto-hit.
 *
 * @param result - The roll result
 * @returns True if natural roll equals the die's maximum value
 */
export declare function isAutoHit(result: RollResult): boolean;
//# sourceMappingURL=roll.d.ts.map