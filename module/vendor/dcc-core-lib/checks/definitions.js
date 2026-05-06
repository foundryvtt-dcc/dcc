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
import { CheckNamespace, createCheckId, } from "./constants.js";
// =============================================================================
// Ability Check Definitions
// =============================================================================
/**
 * Create an ability check definition
 */
function createAbilityCheckDefinition(abilityId, name) {
    return {
        id: createCheckId(CheckNamespace.ABILITY, abilityId),
        name: `${name} Check`,
        type: "check",
        roll: {
            die: "d20",
            ability: abilityId,
            levelModifier: "none",
        },
        tags: ["ability-check"],
    };
}
/**
 * Ability check skill definitions (keyed by raw ability ID)
 */
export const ABILITY_CHECK_DEFINITIONS = {
    str: createAbilityCheckDefinition("str", "Strength"),
    agl: createAbilityCheckDefinition("agl", "Agility"),
    sta: createAbilityCheckDefinition("sta", "Stamina"),
    per: createAbilityCheckDefinition("per", "Personality"),
    int: createAbilityCheckDefinition("int", "Intelligence"),
    lck: createAbilityCheckDefinition("lck", "Luck"),
};
// =============================================================================
// Saving Throw Definitions
// =============================================================================
/**
 * Create a saving throw definition.
 *
 * Note: deliberately does NOT set `roll.ability`. The save bonus
 * surfaced via `accessors.getSaveBonus()` (which reads
 * `state.saves[saveId]`) is the FULL effective bonus per
 * `calculateSavingThrows` — class bonus + ability modifier already
 * combined. If we also set `roll.ability` here, the resolver would add
 * the governing ability modifier a second time (see
 * `skills/resolve.ts#getAbilityMod`), double-counting it.
 */
function createSaveDefinition(saveId, name) {
    return {
        id: createCheckId(CheckNamespace.SAVE, saveId),
        name: `${name} Save`,
        type: "check",
        roll: {
            die: "d20",
            levelModifier: "none",
        },
        tags: ["saving-throw"],
    };
}
/**
 * Saving throw skill definitions (keyed by raw save ID)
 */
export const SAVE_DEFINITIONS = {
    reflex: createSaveDefinition("reflex", "Reflex"),
    fortitude: createSaveDefinition("fortitude", "Fortitude"),
    will: createSaveDefinition("will", "Will"),
};
// =============================================================================
// Registry
// =============================================================================
/**
 * Registry of all check definitions, keyed by namespaced ID
 *
 * Structure:
 * - "ability:str" → Strength Check definition
 * - "ability:agl" → Agility Check definition
 * - "save:reflex" → Reflex Save definition
 * - "skill:backstab" → Backstab definition (when registered)
 */
const CHECK_REGISTRY = new Map();
// Initialize registry with ability checks (namespaced)
for (const abilityId of Object.keys(ABILITY_CHECK_DEFINITIONS)) {
    const def = ABILITY_CHECK_DEFINITIONS[abilityId];
    CHECK_REGISTRY.set(def.id, def);
}
// Add saves to registry (namespaced)
for (const saveId of Object.keys(SAVE_DEFINITIONS)) {
    const def = SAVE_DEFINITIONS[saveId];
    CHECK_REGISTRY.set(def.id, def);
}
/**
 * Get a check definition by namespaced ID
 *
 * @example
 * getCheckDefinition("ability:str")  // Returns Strength Check definition
 * getCheckDefinition("save:reflex")  // Returns Reflex Save definition
 * getCheckDefinition("str")          // Returns undefined (must be namespaced)
 */
export function getCheckDefinition(id) {
    return CHECK_REGISTRY.get(id);
}
/**
 * Get a check definition by namespace and value
 *
 * @example
 * getCheckDefinitionByParts("ability", "str")  // Returns Strength Check definition
 */
export function getCheckDefinitionByParts(namespace, value) {
    return CHECK_REGISTRY.get(createCheckId(namespace, value));
}
/**
 * Register a custom check definition
 *
 * The definition's ID should be namespaced (e.g., "skill:backstab")
 */
export function registerCheckDefinition(definition) {
    CHECK_REGISTRY.set(definition.id, definition);
}
/**
 * Check if a check definition exists
 */
export function hasCheckDefinition(id) {
    return CHECK_REGISTRY.has(id);
}
/**
 * Get all registered check IDs
 */
export function getRegisteredCheckIds() {
    return Array.from(CHECK_REGISTRY.keys());
}
/**
 * Get all registered check IDs for a specific namespace
 */
export function getCheckIdsByNamespace(namespace) {
    const prefix = `${namespace}:`;
    return Array.from(CHECK_REGISTRY.keys()).filter((id) => id.startsWith(prefix));
}
//# sourceMappingURL=definitions.js.map