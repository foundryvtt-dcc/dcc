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
import { type SkillResolveOptions } from "../skills/resolve.js";
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
 * Options for rollCheck
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
 * Roll a check for a character
 *
 * This is the main entry point for the character-level check API.
 * It accepts namespaced check IDs:
 *
 * - `rollCheck(Ability.STR, character)` → "ability:str"
 * - `rollCheck(Save.REF, character)` → "save:reflex"
 * - `rollCheck("skill:backstab", character)` → registered skill
 * - `rollCheck(customSkill, character)` → SkillDefinition
 * - `rollCheck({ ability: 'str' }, character)` → inline config
 *
 * ## How namespaced IDs work
 *
 * | Input              | Namespace | Value    | Character Path                    |
 * |--------------------|-----------|----------|-----------------------------------|
 * | "ability:str"      | ability   | str      | state.abilities.str.current       |
 * | "save:reflex"      | save      | reflex   | state.saves.reflex + agl modifier |
 * | "skill:backstab"   | skill     | backstab | (from skill definition)           |
 *
 * @param check - The check to roll (namespaced ID, definition, or inline config)
 * @param character - The character making the check
 * @param options - Roll options (modifiers, luck burn, accessors, etc.)
 * @returns The skill check result
 *
 * @example
 * import { Ability, Save, rollCheck } from 'dcc-core-lib';
 *
 * // Ability check
 * const result = rollCheck(Ability.STR, character);
 *
 * // Saving throw
 * const result = rollCheck(Save.REF, character);
 *
 * // Custom ability with custom accessors
 * rollCheck({ ability: 'psy' }, character, {
 *   accessors: mccAccessors,
 *   additionalAbilities: ['psy'],
 * });
 */
export declare function rollCheck(check: CheckInput, character: Character, options?: RollCheckOptions): SkillCheckResult;
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
//# sourceMappingURL=roll.d.ts.map