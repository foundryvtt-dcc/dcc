/**
 * Skill Resolution
 *
 * The core of the unified skill system. This module provides the
 * `resolveSkillCheck` function (and its async sibling
 * `resolveSkillCheckAsync`) that handles all skill checks — from
 * thief skills to turn unholy to spell checks.
 *
 * Modifier handling follows the tagged-union `RollModifier` design
 * in docs/MODIFIERS.md. See §3 for the canonical pipeline that
 * `resolveSkillCheck` implements.
 */
import type { DieType, RollOptions, RollOptionsAsync } from "../types/dice.js";
import type { SkillCheckInput, SkillCheckResult, SkillEvents } from "../types/skills.js";
/**
 * Options for skill resolution (sync)
 */
export interface SkillResolveOptions extends RollOptions {
    /** Threat range for critical success (default: max on die) */
    threatRange?: number;
}
/**
 * Options for skill resolution (async)
 */
export interface SkillResolveOptionsAsync extends RollOptionsAsync {
    /** Threat range for critical success (default: max on die) */
    threatRange?: number;
}
/**
 * Resolve a skill check (sync).
 *
 * Implements the 7-phase modifier pipeline from docs/MODIFIERS.md §3:
 * 1. Die selection (set-die, bump-die)
 * 2. Formula construction (add, add-dice)
 * 3. Roll execution (evaluateRoll with optional custom roller)
 * 4. Multiplicative arithmetic (multiply)
 * 5. Threat range resolution (threat-shift) + crit/fumble classification
 * 6. Applied flagging on add / add-dice modifiers
 * 7. Resource tracking + event emission
 */
export declare function resolveSkillCheck(input: SkillCheckInput, options?: SkillResolveOptions, events?: SkillEvents): SkillCheckResult;
/**
 * Resolve a skill check (async). Same pipeline as the sync variant;
 * uses an async custom roller for the dice evaluation step.
 *
 * Use this when your roll machinery is Promise-based
 * (e.g. FoundryVTT's `Roll.evaluate()`).
 */
export declare function resolveSkillCheckAsync(input: SkillCheckInput, options: SkillResolveOptionsAsync, events?: SkillEvents): Promise<SkillCheckResult>;
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