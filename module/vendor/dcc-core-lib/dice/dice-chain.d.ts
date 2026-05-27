/**
 * DCC Dice Chain utilities
 *
 * The dice chain is DCC's unique dice progression system:
 * d3 → d4 → d5 → d6 → d7 → d8 → d10 → d12 → d14 → d16 → d20 → d24 → d30
 *
 * Characters can move up or down the chain based on various modifiers.
 */
import { type DieType, type ParsedDiceExpression } from "../types/dice.js";
/**
 * Parse a dice expression into its components
 *
 * @param expression - Dice expression like "1d20+5" or "2d6"
 * @returns Parsed components, or null if invalid
 */
export declare function parseDiceExpression(expression: string): ParsedDiceExpression | null;
/**
 * Get the primary die type from an expression
 *
 * @param expression - Dice expression like "1d20+5"
 * @returns The die type (e.g., "d20"), or null if no die found
 */
export declare function getPrimaryDie(expression: string): DieType | null;
/**
 * Get the number of faces on the primary die
 *
 * @param expression - Dice expression like "1d20+5"
 * @returns Number of faces, or 20 if no die found
 */
export declare function getPrimaryDieFaces(expression: string): number;
/**
 * Count the number of dice in an expression
 *
 * @param expression - Dice expression like "2d20+5"
 * @returns Number of dice, or 0 if invalid
 */
export declare function countDice(expression: string): number;
/**
 * Get the rank (index) of a die in the dice chain
 *
 * @param faces - Number of faces on the die
 * @param diceChain - The dice chain to use (defaults to standard DCC chain)
 * @returns Index in the chain, or -1 if not found
 */
export declare function getDieRank(faces: number, diceChain?: readonly number[]): number;
/**
 * Get the rank of the primary die in an expression
 *
 * @param expression - Dice expression like "1d20+5"
 * @param diceChain - The dice chain to use
 * @returns Rank in the chain, or -1 if not in chain
 */
export declare function rankDiceExpression(expression: string, diceChain?: readonly number[]): number;
/**
 * Bump a die up or down the dice chain
 *
 * @param expression - Dice expression like "1d20+5"
 * @param steps - Number of steps to move (positive = up, negative = down)
 * @param diceChain - The dice chain to use
 * @returns New expression with bumped die, or original if can't bump
 */
export declare function bumpDie(expression: string, steps: number, diceChain?: readonly number[]): string;
/**
 * Adjust the number of dice in an expression
 *
 * @param expression - Dice expression like "2d20+5"
 * @param adjustment - Number of dice to add (or remove if negative)
 * @param maxCount - Optional maximum number of dice
 * @returns New expression with adjusted count, or original if invalid
 */
export declare function bumpDieCount(expression: string, adjustment: number, maxCount?: number): string;
/**
 * Calculate the adjustment to critical range when die size changes
 *
 * For DCC's "strict critical hit" rules, when action die changes,
 * the crit range adjusts proportionally.
 *
 * @param original - Original dice expression
 * @param adjusted - New dice expression after chain adjustment
 * @returns Difference in die faces (for crit range adjustment)
 */
export declare function calculateCritAdjustment(original: string, adjusted: string): number;
/**
 * Calculate proportional critical range for strict crit rules
 *
 * When a character's action die changes size, their crit range
 * should scale proportionally. A warrior with 19-20 crit range on d20
 * should have equivalent odds on a d24.
 *
 * @param originalCritRange - Original minimum roll for crit (e.g., 19 for 19-20)
 * @param originalDieSize - Original die faces (e.g., 20)
 * @param newDieSize - New die faces (e.g., 24)
 * @returns New minimum roll for crit
 *
 * @example
 * // Warrior with 19-20 crit on d20, now rolling d24
 * calculateProportionalCritRange(19, 20, 24) // Returns 23 (23-24 range)
 */
export declare function calculateProportionalCritRange(originalCritRange: number, originalDieSize: number, newDieSize: number): number;
/**
 * Get the full dice chain
 *
 * @returns Copy of the default dice chain array
 */
export declare function getDiceChain(): number[];
/**
 * Check if a die face count is in the dice chain
 *
 * @param faces - Number of faces to check
 * @param diceChain - The dice chain to check against
 * @returns True if the die is in the chain
 */
export declare function isInDiceChain(faces: number, diceChain?: readonly number[]): boolean;
//# sourceMappingURL=dice-chain.d.ts.map