/**
 * Lay on Hands
 *
 * Pure functions for the cleric's Lay on Hands ability.
 * Clerics can channel divine healing power to restore hit points
 * and cure ailments.
 */
import type { DieType, RollModifier, RollOptions } from "../types/dice.js";
import type { SkillDefinition, SkillCheckResult } from "../types/skills.js";
import type { SimpleTable, TableEffect } from "../tables/types.js";
/**
 * Lay on Hands skill definition.
 * Clerics roll d20 + Personality modifier + level.
 */
export declare const LAY_ON_HANDS_SKILL: SkillDefinition;
/**
 * Alignment modifier for Lay on Hands
 */
export interface LayOnHandsAlignmentMod {
    /** Is the target the same alignment as the cleric? */
    sameAlignment: boolean;
    /** Is the target the opposite alignment? */
    oppositeAlignment: boolean;
}
/**
 * Input for a Lay on Hands check
 */
export interface LayOnHandsInput {
    /** Cleric's level */
    level: number;
    /** Cleric's Personality score */
    personality: number;
    /** Optional luck score (for burning) */
    luck?: number | undefined;
    /** Luck points to burn on this roll */
    luckBurn?: number | undefined;
    /** Situational modifiers */
    situationalModifiers?: RollModifier[] | undefined;
    /** Whether the cleric is healing themselves */
    healingSelf?: boolean | undefined;
    /** Alignment relationship to target */
    alignmentMod?: LayOnHandsAlignmentMod | undefined;
}
/**
 * Effect type for Lay on Hands results
 */
export type HealEffectType = "none" | "heal" | "heal-cure" | "heal-restore";
/**
 * Structured Lay on Hands effect data
 */
export interface HealEffect {
    /** Type of healing effect */
    type: HealEffectType;
    /** HP healed (dice expression or formula) */
    hpHealed?: string | undefined;
    /** Whether diseases are cured */
    curesDisease?: boolean | undefined;
    /** Whether all ailments are cured */
    curesAllAilments?: boolean | undefined;
    /** Whether a lost limb is restored */
    restoresLimb?: boolean | undefined;
    /** Whether poison is neutralized */
    neutralizesPoison?: boolean | undefined;
}
/**
 * Result of a Lay on Hands check
 */
export interface LayOnHandsResult {
    /** The skill check result */
    check: SkillCheckResult;
    /** Whether the healing was successful */
    success: boolean;
    /** Description of the result */
    description: string;
    /** Structured effect data */
    effect: HealEffect;
    /** Calculated HP healed (if applicable) */
    hpHealed?: number | undefined;
    /** The raw table effect (if available) */
    tableEffect?: TableEffect | undefined;
}
/**
 * Perform a Lay on Hands check.
 *
 * @param input - Lay on Hands input
 * @param healTable - The Lay on Hands result table
 * @param options - Roll options
 * @returns Lay on Hands result
 */
export declare function layOnHands(input: LayOnHandsInput, healTable: SimpleTable, options?: RollOptions): LayOnHandsResult;
/**
 * Calculate the Lay on Hands modifier without rolling.
 * Useful for displaying to players before they commit to the action.
 *
 * @param level - Cleric level
 * @param personality - Personality score
 * @param healingSelf - Whether healing self (-4)
 * @returns Total modifier
 */
export declare function getLayOnHandsModifier(level: number, personality: number, healingSelf?: boolean): number;
/**
 * Get the die used for Lay on Hands.
 * Always d20 for standard clerics.
 */
export declare function getLayOnHandsDie(): DieType;
/**
 * Calculate HP healed from a dice/formula expression.
 *
 * @param expression - HP expression (e.g., "1*CL", "2*CL", "3d6")
 * @param level - Cleric level
 * @returns Calculated HP (using formula, not rolling)
 */
export declare function calculateHPHealed(expression: string, level: number): number;
/**
 * Get the maximum possible healing for a given level.
 * Useful for displaying healing potential.
 *
 * @param level - Cleric level
 * @param maxMultiplier - Maximum HP multiplier from the table (default 8)
 * @returns Maximum HP that can be healed
 */
export declare function getMaxHealing(level: number, maxMultiplier?: number): number;
//# sourceMappingURL=lay-on-hands.d.ts.map