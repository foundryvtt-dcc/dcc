/**
 * Dice-related type definitions for DCC
 */
/**
 * Standard DCC dice chain - the progression of dice sizes
 * d3 → d4 → d5 → d6 → d7 → d8 → d10 → d12 → d14 → d16 → d20 → d24 → d30
 */
export declare const DEFAULT_DICE_CHAIN: readonly [3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30];
export type DiceChainFaces = (typeof DEFAULT_DICE_CHAIN)[number];
/**
 * A die type string like "d20" or "d16"
 */
export type DieType = `d${number}`;
/**
 * How a roll should be handled
 */
export type RollMode = 'formula' | 'evaluate';
/**
 * Function signature for custom dice rollers
 * Takes a dice expression (e.g., "1d20") and returns the result
 */
export type DiceRoller = (expression: string) => number;
/**
 * Options for roll evaluation
 */
export interface RollOptions {
    /** Whether to just build the formula or actually evaluate it */
    mode?: RollMode;
    /** Custom roller function - if provided, used instead of built-in RNG */
    roller?: DiceRoller;
}
/**
 * A modifier that contributes to a roll
 */
export interface RollModifier {
    /** Source of the modifier (e.g., "strength", "luck", "situational") */
    source: string;
    /** The modifier value */
    value: number;
    /** Optional label for display */
    label?: string;
}
/**
 * Result of a dice roll
 */
export interface RollResult {
    /** The complete formula (e.g., "1d20+5") */
    formula: string;
    /** Breakdown of all modifiers that contributed */
    modifiers: RollModifier[];
    /** The total result - only present if mode was 'evaluate' */
    total?: number;
    /** The natural die roll before modifiers - only present if mode was 'evaluate' */
    natural?: number;
    /** The die used for the roll (e.g., "d20") */
    die: DieType;
    /** Number of dice rolled */
    diceCount: number;
}
/**
 * A parsed dice expression
 */
export interface ParsedDiceExpression {
    /** Number of dice (e.g., 2 in "2d20") */
    count: number;
    /** Faces on each die (e.g., 20 in "2d20") */
    faces: number;
    /** Any suffix after the dice (e.g., "+5" in "1d20+5") */
    suffix: string;
    /** The original expression */
    original: string;
}
//# sourceMappingURL=dice.d.ts.map