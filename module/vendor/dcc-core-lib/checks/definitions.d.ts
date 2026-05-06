/**
 * Built-in Skill Definitions
 *
 * Pre-defined SkillDefinitions for standard DCC checks:
 * - Ability checks (d20 + ability modifier)
 * - Saving throws (d20 + state.saves[id], where the stored value is
 *   already the full save total — class bonus + ability mod, see
 *   `character/saving-throws.ts#calculateSavingThrows`)
 *
 * All definitions are registered with namespaced IDs:
 * - "ability:str" for ability checks
 * - "save:reflex" for saving throws
 * - "skill:backstab" for thief skills (future)
 */
import type { SkillDefinition } from "../types/skills.js";
import type { AbilityId, SaveId, CheckNamespaceType } from "./constants.js";
/**
 * Ability check skill definitions (keyed by raw ability ID)
 */
export declare const ABILITY_CHECK_DEFINITIONS: Record<AbilityId, SkillDefinition>;
/**
 * Saving throw skill definitions (keyed by raw save ID)
 */
export declare const SAVE_DEFINITIONS: Record<SaveId, SkillDefinition>;
/**
 * Get a check definition by namespaced ID
 *
 * @example
 * getCheckDefinition("ability:str")  // Returns Strength Check definition
 * getCheckDefinition("save:reflex")  // Returns Reflex Save definition
 * getCheckDefinition("str")          // Returns undefined (must be namespaced)
 */
export declare function getCheckDefinition(id: string): SkillDefinition | undefined;
/**
 * Get a check definition by namespace and value
 *
 * @example
 * getCheckDefinitionByParts("ability", "str")  // Returns Strength Check definition
 */
export declare function getCheckDefinitionByParts(namespace: CheckNamespaceType, value: string): SkillDefinition | undefined;
/**
 * Register a custom check definition
 *
 * The definition's ID should be namespaced (e.g., "skill:backstab")
 */
export declare function registerCheckDefinition(definition: SkillDefinition): void;
/**
 * Check if a check definition exists
 */
export declare function hasCheckDefinition(id: string): boolean;
/**
 * Get all registered check IDs
 */
export declare function getRegisteredCheckIds(): string[];
/**
 * Get all registered check IDs for a specific namespace
 */
export declare function getCheckIdsByNamespace(namespace: CheckNamespaceType): string[];
//# sourceMappingURL=definitions.d.ts.map