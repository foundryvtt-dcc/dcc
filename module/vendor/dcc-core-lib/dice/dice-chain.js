/**
 * DCC Dice Chain utilities
 *
 * The dice chain is DCC's unique dice progression system:
 * d3 → d4 → d5 → d6 → d7 → d8 → d10 → d12 → d14 → d16 → d20 → d24 → d30
 *
 * Characters can move up or down the chain based on various modifiers.
 */
import { DEFAULT_DICE_CHAIN, } from "../types/dice.js";
/** Regex to parse dice expressions like "2d20+5" */
const DICE_REGEX = /^(\d+)d(\d+)(.*)$/;
/**
 * Parse a dice expression into its components
 *
 * @param expression - Dice expression like "1d20+5" or "2d6"
 * @returns Parsed components, or null if invalid
 */
export function parseDiceExpression(expression) {
    const match = DICE_REGEX.exec(expression);
    if (!match) {
        return null;
    }
    const count = match[1];
    const faces = match[2];
    if (count === undefined || faces === undefined) {
        return null;
    }
    return {
        count: parseInt(count, 10),
        faces: parseInt(faces, 10),
        suffix: match[3] ?? "",
        original: expression,
    };
}
/**
 * Get the primary die type from an expression
 *
 * @param expression - Dice expression like "1d20+5"
 * @returns The die type (e.g., "d20"), or null if no die found
 */
export function getPrimaryDie(expression) {
    const parsed = parseDiceExpression(expression);
    if (!parsed) {
        // If no die in expression, default to d20
        if (!expression.includes("d")) {
            return "d20";
        }
        return null;
    }
    return `d${String(parsed.faces)}`;
}
/**
 * Get the number of faces on the primary die
 *
 * @param expression - Dice expression like "1d20+5"
 * @returns Number of faces, or 20 if no die found
 */
export function getPrimaryDieFaces(expression) {
    const parsed = parseDiceExpression(expression);
    if (!parsed) {
        return 20;
    }
    return parsed.faces;
}
/**
 * Count the number of dice in an expression
 *
 * @param expression - Dice expression like "2d20+5"
 * @returns Number of dice, or 0 if invalid
 */
export function countDice(expression) {
    const parsed = parseDiceExpression(expression);
    return parsed?.count ?? 0;
}
/**
 * Get the rank (index) of a die in the dice chain
 *
 * @param faces - Number of faces on the die
 * @param diceChain - The dice chain to use (defaults to standard DCC chain)
 * @returns Index in the chain, or -1 if not found
 */
export function getDieRank(faces, diceChain = DEFAULT_DICE_CHAIN) {
    return diceChain.indexOf(faces);
}
/**
 * Get the rank of the primary die in an expression
 *
 * @param expression - Dice expression like "1d20+5"
 * @param diceChain - The dice chain to use
 * @returns Rank in the chain, or -1 if not in chain
 */
export function rankDiceExpression(expression, diceChain = DEFAULT_DICE_CHAIN) {
    const faces = getPrimaryDieFaces(expression);
    return getDieRank(faces, diceChain);
}
/**
 * Bump a die up or down the dice chain
 *
 * @param expression - Dice expression like "1d20+5"
 * @param steps - Number of steps to move (positive = up, negative = down)
 * @param diceChain - The dice chain to use
 * @returns New expression with bumped die, or original if can't bump
 */
export function bumpDie(expression, steps, diceChain = DEFAULT_DICE_CHAIN) {
    const parsed = parseDiceExpression(expression);
    if (!parsed) {
        return expression;
    }
    const currentRank = getDieRank(parsed.faces, diceChain);
    if (currentRank < 0) {
        // Die not in chain, return unchanged
        return expression;
    }
    const newRank = currentRank + steps;
    if (newRank < 0 || newRank >= diceChain.length) {
        // Would go off the chain, return unchanged
        return expression;
    }
    const newFaces = diceChain[newRank];
    if (newFaces === undefined) {
        return expression;
    }
    return `${String(parsed.count)}d${String(newFaces)}${parsed.suffix}`;
}
/**
 * Adjust the number of dice in an expression
 *
 * @param expression - Dice expression like "2d20+5"
 * @param adjustment - Number of dice to add (or remove if negative)
 * @param maxCount - Optional maximum number of dice
 * @returns New expression with adjusted count, or original if invalid
 */
export function bumpDieCount(expression, adjustment, maxCount) {
    const parsed = parseDiceExpression(expression);
    if (!parsed) {
        return expression;
    }
    let newCount = parsed.count + adjustment;
    if (maxCount !== undefined && newCount > maxCount) {
        newCount = maxCount;
    }
    if (newCount < 1) {
        // Can't have less than 1 die
        return expression;
    }
    return `${String(newCount)}d${String(parsed.faces)}${parsed.suffix}`;
}
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
export function calculateCritAdjustment(original, adjusted) {
    const originalParsed = parseDiceExpression(original);
    const adjustedParsed = parseDiceExpression(adjusted);
    if (!originalParsed || !adjustedParsed) {
        return 0;
    }
    return adjustedParsed.faces - originalParsed.faces;
}
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
export function calculateProportionalCritRange(originalCritRange, originalDieSize, newDieSize) {
    // How many numbers are in the original crit range?
    // For 19-20 on d20: 20 - 19 + 1 = 2 numbers
    const critCount = originalDieSize - originalCritRange + 1;
    // New range starts at: newDieSize - critCount + 1
    // For d24 with 2 crit numbers: 24 - 2 + 1 = 23
    return newDieSize - critCount + 1;
}
/**
 * Get the full dice chain
 *
 * @returns Copy of the default dice chain array
 */
export function getDiceChain() {
    return [...DEFAULT_DICE_CHAIN];
}
/**
 * Check if a die face count is in the dice chain
 *
 * @param faces - Number of faces to check
 * @param diceChain - The dice chain to check against
 * @returns True if the die is in the chain
 */
export function isInDiceChain(faces, diceChain = DEFAULT_DICE_CHAIN) {
    return diceChain.includes(faces);
}
//# sourceMappingURL=dice-chain.js.map