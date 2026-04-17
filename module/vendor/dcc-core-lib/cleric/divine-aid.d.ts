/**
 * Divine Aid
 *
 * Pure functions for the cleric's Divine Aid ability.
 * Clerics can petition their deity for miraculous intervention,
 * requesting aid in times of great need.
 */
import type { DieType, RollModifier, RollOptions } from "../types/dice.js";
import type { SkillDefinition, SkillCheckResult } from "../types/skills.js";
import type { SimpleTable, TableEffect } from "../tables/types.js";
/**
 * Divine Aid skill definition.
 * Clerics roll d20 + Personality modifier + level (spell check).
 */
export declare const DIVINE_AID_SKILL: SkillDefinition;
/**
 * Type of aid being requested from the deity
 */
export type AidRequestType = "general" | "smite-enemy" | "heal-wounds" | "cure-affliction" | "protection" | "guidance" | "escape" | "miracle";
/**
 * Input for a Divine Aid check
 */
export interface DivineAidInput {
    /** Cleric's level */
    level: number;
    /** Cleric's Personality score */
    personality: number;
    /** Current disapproval range */
    disapprovalRange: number;
    /** Optional luck score (for burning) */
    luck?: number | undefined;
    /** Luck points to burn on this roll */
    luckBurn?: number | undefined;
    /** Situational modifiers */
    situationalModifiers?: RollModifier[] | undefined;
    /** Type of aid being requested */
    requestType?: AidRequestType | undefined;
    /** Specific description of requested aid */
    requestDescription?: string | undefined;
    /** Spell level equivalent of requested aid (affects DC) */
    aidSpellLevel?: number | undefined;
}
/**
 * Effect type for Divine Aid results
 */
export type DivineAidEffectType = "none" | "minor-aid" | "moderate-aid" | "major-aid" | "miraculous-aid";
/**
 * Structured Divine Aid effect data
 */
export interface DivineAidEffect {
    /** Type of aid granted */
    type: DivineAidEffectType;
    /** Equivalent spell level of aid granted */
    spellLevelEquivalent?: number | undefined;
    /** Duration of the aid effect */
    duration?: string | undefined;
    /** Whether the deity granted the specific request */
    requestGranted?: boolean | undefined;
    /** Description of the aid provided */
    aidDescription?: string | undefined;
}
/**
 * Result of a Divine Aid check
 */
export interface DivineAidResult {
    /** The skill check result */
    check: SkillCheckResult;
    /** Whether the divine aid was successful */
    success: boolean;
    /** The natural die roll (for disapproval check) */
    natural: number;
    /** Description of the result */
    description: string;
    /** Structured effect data */
    effect: DivineAidEffect;
    /** Whether disapproval was triggered */
    disapprovalTriggered: boolean;
    /** New disapproval range (if increased) */
    newDisapprovalRange: number;
    /** The raw table effect (if available) */
    tableEffect?: TableEffect | undefined;
}
/**
 * Perform a Divine Aid check.
 *
 * Divine Aid allows clerics to request miraculous intervention.
 * The spell check determines the level of aid the deity is willing to provide.
 * Rolling within the disapproval range triggers disapproval.
 *
 * @param input - Divine Aid input
 * @param aidTable - The Divine Aid result table
 * @param options - Roll options
 * @returns Divine Aid result
 */
export declare function divineAid(input: DivineAidInput, aidTable: SimpleTable, options?: RollOptions): DivineAidResult;
/**
 * Calculate the Divine Aid modifier without rolling.
 * Useful for displaying to players before they commit to the action.
 *
 * @param level - Cleric level
 * @param personality - Personality score
 * @returns Total modifier
 */
export declare function getDivineAidModifier(level: number, personality: number): number;
/**
 * Get the die used for Divine Aid.
 * Always d20 for standard clerics.
 */
export declare function getDivineAidDie(): DieType;
/**
 * Calculate the minimum check result needed for a given spell level equivalent.
 * In DCC, divine aid roughly maps to spell levels.
 *
 * @param spellLevel - Desired spell level equivalent (1-5)
 * @returns Minimum check result needed
 */
export declare function getMinimumCheckForSpellLevel(spellLevel: number): number;
/**
 * Estimate the spell level equivalent of aid for a given check result.
 *
 * @param checkResult - The total check result
 * @returns Estimated spell level equivalent
 */
export declare function estimateAidSpellLevel(checkResult: number): number;
/**
 * Get a description of what type of aid might be available at a given modifier.
 * Useful for helping players understand their chances.
 *
 * @param modifier - The cleric's total modifier
 * @returns Description of potential aid levels
 */
export declare function describePotentialAid(modifier: number): string;
//# sourceMappingURL=divine-aid.d.ts.map