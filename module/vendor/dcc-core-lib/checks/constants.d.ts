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
/**
 * Check type namespaces
 */
export declare const CheckNamespace: {
    readonly ABILITY: "ability";
    readonly SAVE: "save";
    readonly SKILL: "skill";
};
export type CheckNamespaceType = (typeof CheckNamespace)[keyof typeof CheckNamespace];
/**
 * Standard DCC ability check identifiers (namespaced)
 *
 * @example
 * rollCheck(Ability.STR, character);  // rolls "ability:str"
 */
export declare const Ability: {
    readonly STR: "ability:str";
    readonly AGL: "ability:agl";
    readonly STA: "ability:sta";
    readonly PER: "ability:per";
    readonly INT: "ability:int";
    readonly LCK: "ability:lck";
};
/**
 * Namespaced ability ID type
 */
export type AbilityCheckId = (typeof Ability)[keyof typeof Ability];
/**
 * Raw ability ID (without namespace)
 */
export type AbilityId = "str" | "agl" | "sta" | "per" | "int" | "lck";
/**
 * Standard DCC saving throw identifiers (namespaced)
 *
 * @example
 * rollCheck(Save.REF, character);  // rolls "save:reflex"
 */
export declare const Save: {
    readonly REF: "save:reflex";
    readonly FORT: "save:fortitude";
    readonly WIL: "save:will";
};
/**
 * Namespaced save ID type
 */
export type SaveCheckId = (typeof Save)[keyof typeof Save];
/**
 * Raw save ID (without namespace)
 */
export type SaveId = "reflex" | "fortitude" | "will";
/**
 * Map from save ID to the ability that modifies it
 */
export declare const SAVE_ABILITY_MAP: Record<SaveId, AbilityId>;
/**
 * Parsed check ID with namespace and value
 */
export interface ParsedCheckId {
    namespace: CheckNamespaceType | null;
    value: string;
    raw: string;
}
/**
 * Parse a namespaced check ID
 *
 * @example
 * parseCheckId("ability:str")  // { namespace: "ability", value: "str", raw: "ability:str" }
 * parseCheckId("str")          // { namespace: null, value: "str", raw: "str" }
 */
export declare function parseCheckId(id: string): ParsedCheckId;
/**
 * Create a namespaced check ID
 */
export declare function createCheckId(namespace: CheckNamespaceType, value: string): string;
/**
 * Check if a string is a namespaced ability check ID
 */
export declare function isAbilityCheckId(id: string): id is AbilityCheckId;
/**
 * Check if a string is a namespaced save check ID
 */
export declare function isSaveCheckId(id: string): id is SaveCheckId;
/**
 * Check if a raw string (no namespace) is a valid ability ID
 */
export declare function isAbilityId(id: string): id is AbilityId;
/**
 * Check if a raw string (no namespace) is a valid save ID
 */
export declare function isSaveId(id: string): id is SaveId;
//# sourceMappingURL=constants.d.ts.map