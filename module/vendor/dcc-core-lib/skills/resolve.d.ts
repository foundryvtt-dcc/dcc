/**
 * Skill Resolution
 *
 * The core of the unified skill system. This module provides the
 * resolveSkillCheck function that handles all skill checks, from
 * thief skills to turn unholy to spell checks.
 */
import type { DieType, RollOptions } from "../types/dice.js";
import type { SkillCheckInput, SkillCheckResult, SkillEvents } from "../types/skills.js";
/**
 * Options for skill resolution
 */
export interface SkillResolveOptions extends RollOptions {
    /** Threat range for critical success (default: max on die) */
    threatRange?: number;
}
/**
 * Resolve a skill check
 *
 * This is the core function of the unified skill system. It handles
 * all types of skill checks by:
 * 1. Determining the die to roll
 * 2. Calculating all applicable modifiers
 * 3. Building and optionally evaluating the roll
 * 4. Firing events for integrations
 *
 * @param input - The skill check input
 * @param options - Roll options (mode, custom roller)
 * @param events - Optional event callbacks
 * @returns The skill check result
 */
export declare function resolveSkillCheck(input: SkillCheckInput, options?: SkillResolveOptions, events?: SkillEvents): SkillCheckResult;
/**
 * Quick skill check with minimal input
 *
 * Convenience function for simple skill checks.
 */
export declare function quickSkillCheck(skillId: string, die: DieType, abilityScore: number, abilityId: string, level: number, options?: SkillResolveOptions): SkillCheckResult;
/**
 * Create a simple ability check
 */
export declare function abilityCheck(abilityId: string, abilityScore: number, options?: SkillResolveOptions): SkillCheckResult;
/**
 * Create a saving throw check
 */
export declare function savingThrow(saveType: string, abilityId: string, abilityScore: number, saveBonus: number, options?: SkillResolveOptions): SkillCheckResult;
//# sourceMappingURL=resolve.d.ts.map