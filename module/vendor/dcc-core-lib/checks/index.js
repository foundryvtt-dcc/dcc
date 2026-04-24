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
// Constants and namespace utilities
export { 
// Namespace constants
CheckNamespace, 
// Ability constants
Ability, 
// Save constants
Save, SAVE_ABILITY_MAP, parseCheckId, createCheckId, isAbilityCheckId, isSaveCheckId, isAbilityId, isSaveId, } from "./constants.js";
// Accessors - how IDs map to character data
export { DEFAULT_ACCESSORS, extractAbilityScores, } from "./accessors.js";
// Definitions
export { ABILITY_CHECK_DEFINITIONS, SAVE_DEFINITIONS, getCheckDefinition, getCheckDefinitionByParts, registerCheckDefinition, hasCheckDefinition, getRegisteredCheckIds, getCheckIdsByNamespace, } from "./definitions.js";
// Roll API (sync)
export { rollCheck, rollAbilityCheck, rollSavingThrow, } from "./roll.js";
// Roll API (async siblings — for Promise-based roll machinery)
export { rollCheckAsync, rollAbilityCheckAsync, rollSavingThrowAsync, } from "./roll.js";
// Luck Check (roll-under)
export { rollLuckCheck, rollLuckCheckSimple, } from "./luck-check.js";
//# sourceMappingURL=index.js.map