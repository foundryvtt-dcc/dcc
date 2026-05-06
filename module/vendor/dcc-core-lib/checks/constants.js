/**
 * Check Constants
 *
 * Namespaced identifiers for ability checks, saving throws, and skills.
 * The namespace prefix makes the check type explicit:
 *
 * - `ability:str` - Ability check using STR
 * - `save:reflex` - Reflex saving throw
 * - `skill:backstab` - Thief backstab skill
 *
 * @example
 * import { Ability, Save } from 'dcc-core-lib';
 *
 * rollCheck(Ability.STR, character);  // "ability:str"
 * rollCheck(Save.REF, character);     // "save:reflex"
 */
// =============================================================================
// Namespace Constants
// =============================================================================
/**
 * Check type namespaces
 */
export const CheckNamespace = {
    ABILITY: "ability",
    SAVE: "save",
    SKILL: "skill",
};
// =============================================================================
// Ability Constants
// =============================================================================
/**
 * Standard DCC ability check identifiers (namespaced)
 *
 * @example
 * rollCheck(Ability.STR, character);  // rolls "ability:str"
 */
export const Ability = {
    STR: "ability:str",
    AGL: "ability:agl",
    STA: "ability:sta",
    PER: "ability:per",
    INT: "ability:int",
    LCK: "ability:lck",
};
// =============================================================================
// Save Constants
// =============================================================================
/**
 * Standard DCC saving throw identifiers (namespaced)
 *
 * @example
 * rollCheck(Save.REF, character);  // rolls "save:reflex"
 */
export const Save = {
    REF: "save:reflex",
    FORT: "save:fortitude",
    WIL: "save:will",
};
/**
 * Map from save ID to the ability that modifies it
 */
export const SAVE_ABILITY_MAP = {
    reflex: "agl",
    fortitude: "sta",
    will: "per",
};
/**
 * Parse a namespaced check ID
 *
 * @example
 * parseCheckId("ability:str")  // { namespace: "ability", value: "str", raw: "ability:str" }
 * parseCheckId("str")          // { namespace: null, value: "str", raw: "str" }
 */
export function parseCheckId(id) {
    const colonIndex = id.indexOf(":");
    if (colonIndex === -1) {
        return { namespace: null, value: id, raw: id };
    }
    const namespace = id.slice(0, colonIndex);
    const value = id.slice(colonIndex + 1);
    // Validate namespace
    const validNamespaces = Object.values(CheckNamespace);
    if (validNamespaces.includes(namespace)) {
        return {
            namespace: namespace,
            value,
            raw: id,
        };
    }
    // Unknown namespace - treat as non-namespaced
    return { namespace: null, value: id, raw: id };
}
/**
 * Create a namespaced check ID
 */
export function createCheckId(namespace, value) {
    return `${namespace}:${value}`;
}
/**
 * Check if a string is a namespaced ability check ID
 */
export function isAbilityCheckId(id) {
    const parsed = parseCheckId(id);
    if (parsed.namespace !== "ability")
        return false;
    const validAbilities = ["str", "agl", "sta", "per", "int", "lck"];
    return validAbilities.includes(parsed.value);
}
/**
 * Check if a string is a namespaced save check ID
 */
export function isSaveCheckId(id) {
    const parsed = parseCheckId(id);
    if (parsed.namespace !== "save")
        return false;
    const validSaves = ["reflex", "fortitude", "will"];
    return validSaves.includes(parsed.value);
}
/**
 * Check if a raw string (no namespace) is a valid ability ID
 */
export function isAbilityId(id) {
    const validAbilities = ["str", "agl", "sta", "per", "int", "lck"];
    return validAbilities.includes(id);
}
/**
 * Check if a raw string (no namespace) is a valid save ID
 */
export function isSaveId(id) {
    const validSaves = ["reflex", "fortitude", "will"];
    return validSaves.includes(id);
}
//# sourceMappingURL=constants.js.map