/**
 * Turn Unholy
 *
 * Pure functions for the cleric's Turn Unholy ability.
 * Clerics can channel their deity's power to turn away or destroy
 * unholy creatures (undead, demons, etc.).
 */
import type { DieType, RollModifier, RollOptions } from "../types/dice.js";
import type { SkillDefinition, SkillCheckResult } from "../types/skills.js";
import type { SimpleTable, TableEffect } from "../tables/types.js";
/**
 * Turn Unholy skill definition.
 * Clerics roll d20 + Personality modifier + level.
 */
export declare const TURN_UNHOLY_SKILL: SkillDefinition;
/**
 * Input for a Turn Unholy check
 */
export interface TurnUnholyInput {
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
    /** HD of the highest-HD unholy creature being turned */
    targetHD?: number | undefined;
}
/**
 * Effect type for Turn Unholy results
 */
export type TurnEffectType = "none" | "turn" | "turn-destroy" | "destroy" | "command";
/**
 * Structured Turn Unholy effect data
 */
export interface TurnEffect {
    /** Type of turning effect */
    type: TurnEffectType;
    /** HD of creatures affected (dice expression or number) */
    hdAffected?: string | undefined;
    /** HD of creatures destroyed (if any) */
    hdDestroyed?: string | undefined;
    /** Duration of the turning effect */
    duration?: string | undefined;
    /** Whether turned creatures flee */
    flee?: boolean | undefined;
    /** Whether the cleric can command the creatures */
    command?: boolean | undefined;
}
/**
 * Result of a Turn Unholy check
 */
export interface TurnUnholyResult {
    /** The skill check result */
    check: SkillCheckResult;
    /** Whether the turning was successful */
    success: boolean;
    /** Description of the result */
    description: string;
    /** Structured effect data */
    effect: TurnEffect;
    /** The raw table effect (if available) */
    tableEffect?: TableEffect | undefined;
}
/**
 * Perform a Turn Unholy check.
 *
 * @param input - Turn Unholy input
 * @param turnTable - The Turn Unholy result table
 * @param options - Roll options
 * @returns Turn Unholy result
 */
export declare function turnUnholy(input: TurnUnholyInput, turnTable: SimpleTable, options?: RollOptions): TurnUnholyResult;
/**
 * Calculate the Turn Unholy modifier without rolling.
 * Useful for displaying to players before they commit to the action.
 *
 * @param level - Cleric level
 * @param personality - Personality score
 * @returns Total modifier
 */
export declare function getTurnUnholyModifier(level: number, personality: number): number;
/**
 * Get the die used for Turn Unholy.
 * Always d20 for standard clerics.
 */
export declare function getTurnUnholyDie(): DieType;
/**
 * Calculate the HD affected by a turn result.
 * Replaces "CL" in dice expressions with the cleric's level.
 *
 * @param hdExpression - The HD expression (e.g., "1d6+CL")
 * @param level - Cleric level
 * @returns Resolved expression (e.g., "1d6+5" for level 5)
 */
export declare function resolveHDExpression(hdExpression: string, level: number): string;
/**
 * Calculate average HD for an expression.
 * Useful for quick estimates.
 *
 * @param hdExpression - Resolved HD expression (e.g., "1d6+5")
 * @returns Average HD value
 */
export declare function calculateAverageHD(hdExpression: string): number;
//# sourceMappingURL=turn-unholy.d.ts.map