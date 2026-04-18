/**
 * Character-Level Check API
 *
 * High-level API for rolling checks against a character.
 * Uses namespaced IDs to identify check types:
 *
 * - "ability:str" - Ability check
 * - "save:reflex" - Saving throw
 * - "skill:backstab" - Skill check
 *
 * @see {@link CharacterAccessors} for how IDs map to character data
 */
import type { Character } from "../types/index.js";
import type { SkillDefinition, SkillCheckResult, SkillEvents } from "../types/skills.js";
import type { RollModifier, DieType } from "../types/dice.js";
import { type SkillResolveOptions, type SkillResolveOptionsAsync } from "../skills/resolve.js";
import { type CharacterAccessors } from "./accessors.js";
/**
 * Inline check configuration for custom/ad-hoc checks
 */
export interface InlineCheckConfig {
    /** Ability to use for the modifier (raw ID like 'str', not namespaced) */
    ability: string;
    /** Die to roll (default: d20) */
    die?: DieType;
    /** Display name for the check */
    name?: string;
}
/**
 * What can be passed as a check identifier
 */
export type CheckInput = string | SkillDefinition | InlineCheckConfig;
/**
 * Options for rollCheck (sync)
 */
export interface RollCheckOptions extends SkillResolveOptions {
    /** Additional situational modifiers */
    modifiers?: RollModifier[];
    /** Luck to burn on this roll */
    luckBurn?: number;
    /** Event callbacks */
    events?: SkillEvents;
    /**
     * Custom accessors for extracting data from the character.
     * Override to support different character structures.
     *
     * @see {@link CharacterAccessors} for the interface
     * @see {@link DEFAULT_ACCESSORS} for the default implementation
     */
    accessors?: CharacterAccessors;
    /**
     * Additional ability IDs to extract from the character.
     * Use this when your skill references a custom ability.
     * Standard DCC abilities (str, agl, sta, per, int, lck) are always included.
     */
    additionalAbilities?: string[];
}
/**
 * Options for rollCheckAsync. Uses an async custom roller — required
 * when the underlying roll machinery is Promise-based (e.g. FoundryVTT's
 * `Roll.evaluate()`).
 */
export interface RollCheckOptionsAsync extends SkillResolveOptionsAsync {
    modifiers?: RollModifier[];
    luckBurn?: number;
    events?: SkillEvents;
    accessors?: CharacterAccessors;
    additionalAbilities?: string[];
}
export declare function rollCheck(check: CheckInput, character: Character, options?: RollCheckOptions): SkillCheckResult;
/**
 * Roll a check for a character (async).
 *
 * Same semantics as `rollCheck`, but the dice evaluation is performed
 * via an async custom roller (see `RollCheckOptionsAsync.roller`). Use
 * this when integrating with Promise-based roll machinery like
 * FoundryVTT's `Roll.evaluate()`.
 */
export declare function rollCheckAsync(check: CheckInput, character: Character, options: RollCheckOptionsAsync): Promise<SkillCheckResult>;
/**
 * Roll an ability check for a character
 *
 * Convenience function that's more explicit than rollCheck.
 *
 * @param abilityId - The ability to check (namespaced like "ability:str" or raw like "str")
 * @param character - The character making the check
 * @param options - Roll options
 */
export declare function rollAbilityCheck(abilityId: string, character: Character, options?: RollCheckOptions): SkillCheckResult;
/**
 * Roll a saving throw for a character
 *
 * Convenience function that's more explicit than rollCheck.
 *
 * @param saveId - The save type (namespaced like "save:reflex" or raw like "reflex")
 * @param character - The character making the save
 * @param options - Roll options
 */
export declare function rollSavingThrow(saveId: string, character: Character, options?: RollCheckOptions): SkillCheckResult;
/**
 * Roll an ability check for a character (async).
 */
export declare function rollAbilityCheckAsync(abilityId: string, character: Character, options: RollCheckOptionsAsync): Promise<SkillCheckResult>;
/**
 * Roll a saving throw for a character (async).
 */
export declare function rollSavingThrowAsync(saveId: string, character: Character, options: RollCheckOptionsAsync): Promise<SkillCheckResult>;
//# sourceMappingURL=roll.d.ts.map