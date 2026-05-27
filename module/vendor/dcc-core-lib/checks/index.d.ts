/**
 * Character-Level Check API
 *
 * High-level API for rolling ability checks, saving throws,
 * and skills against a character using namespaced IDs.
 *
 * ## Namespaced IDs
 *
 * All check IDs are namespaced to make the check type explicit:
 * - `ability:str` - Ability check
 * - `save:reflex` - Saving throw
 * - `skill:backstab` - Skill check
 *
 * @example
 * import { Ability, Save, rollCheck } from 'dcc-core-lib';
 *
 * // Roll a strength check (Ability.STR = "ability:str")
 * const result = rollCheck(Ability.STR, character);
 *
 * // Roll a reflex save (Save.REF = "save:reflex")
 * const result = rollCheck(Save.REF, character);
 *
 * // Roll with custom modifier
 * const result = rollCheck(Ability.AGL, character, {
 *   modifiers: [{ source: 'bless', value: 1, label: 'Bless' }]
 * });
 *
 * // Custom accessors for different character structures
 * const result = rollCheck(Ability.STR, character, {
 *   accessors: myCustomAccessors
 * });
 */
export { CheckNamespace, type CheckNamespaceType, Ability, type AbilityCheckId, type AbilityId, Save, type SaveCheckId, type SaveId, SAVE_ABILITY_MAP, type ParsedCheckId, parseCheckId, createCheckId, isAbilityCheckId, isSaveCheckId, isAbilityId, isSaveId, } from "./constants.js";
export { type CharacterAccessors, DEFAULT_ACCESSORS, extractAbilityScores, } from "./accessors.js";
export { ABILITY_CHECK_DEFINITIONS, SAVE_DEFINITIONS, getCheckDefinition, getCheckDefinitionByParts, registerCheckDefinition, hasCheckDefinition, getRegisteredCheckIds, getCheckIdsByNamespace, } from "./definitions.js";
export { rollCheck, rollAbilityCheck, rollSavingThrow, type CheckInput, type InlineCheckConfig, type RollCheckOptions, } from "./roll.js";
export { rollCheckAsync, rollAbilityCheckAsync, rollSavingThrowAsync, type RollCheckOptionsAsync, } from "./roll.js";
export { rollLuckCheck, rollLuckCheckSimple, type LuckCheckResult, type RollLuckCheckOptions, } from "./luck-check.js";
//# sourceMappingURL=index.d.ts.map