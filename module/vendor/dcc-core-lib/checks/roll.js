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
import { resolveSkillCheck } from "../skills/resolve.js";
import { parseCheckId, CheckNamespace, createCheckId, } from "./constants.js";
import { getCheckDefinition } from "./definitions.js";
import { DEFAULT_ACCESSORS, extractAbilityScores, } from "./accessors.js";
/**
 * Check if input is an inline config
 */
function isInlineConfig(input) {
    return (typeof input === "object" &&
        "ability" in input &&
        !("type" in input) // SkillDefinition has 'type'
    );
}
/**
 * Check if input is a SkillDefinition
 */
function isSkillDefinition(input) {
    return typeof input === "object" && "type" in input && "id" in input;
}
/**
 * Convert inline config to SkillDefinition
 */
function inlineToDefinition(config) {
    const id = createCheckId(CheckNamespace.ABILITY, config.ability);
    return {
        id,
        name: config.name ?? `${config.ability.toUpperCase()} Check`,
        type: "check",
        roll: {
            die: config.die ?? "d20",
            ability: config.ability,
            levelModifier: "none",
        },
    };
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
export function rollCheck(check, character, options = {}) {
    const accessors = options.accessors ?? DEFAULT_ACCESSORS;
    // Resolve the check to a SkillDefinition
    let skill;
    const additionalModifiers = [];
    if (isSkillDefinition(check)) {
        skill = check;
    }
    else if (isInlineConfig(check)) {
        skill = inlineToDefinition(check);
    }
    else {
        // String ID - parse namespace and look up in registry
        const parsed = parseCheckId(check);
        const definition = getCheckDefinition(check);
        if (!definition) {
            throw new Error(`Unknown check ID: ${check}`);
        }
        skill = definition;
        // If it's a save, add the save bonus from the character
        if (parsed.namespace === CheckNamespace.SAVE) {
            const saveBonus = accessors.getSaveBonus(character, parsed.value);
            if (saveBonus !== 0) {
                additionalModifiers.push({
                    source: "save-bonus",
                    value: saveBonus,
                    label: "Save bonus",
                });
            }
        }
    }
    // Determine which abilities to extract
    const abilityIds = ["str", "agl", "sta", "per", "int", "lck"];
    if (options.additionalAbilities) {
        abilityIds.push(...options.additionalAbilities);
    }
    // Also include the skill's ability if specified
    if (skill.roll?.ability && !abilityIds.includes(skill.roll.ability)) {
        abilityIds.push(skill.roll.ability);
    }
    // Extract character data using accessors
    const abilities = extractAbilityScores(character, accessors, abilityIds);
    const level = accessors.getLevel(character);
    const classId = accessors.getClassId(character);
    const luck = accessors.getLuck(character);
    // Combine modifiers
    const situationalModifiers = [
        ...additionalModifiers,
        ...(options.modifiers ?? []),
    ];
    // Build input - only include optional properties when defined
    const input = {
        skill,
        abilities,
        level,
        luck,
    };
    // Add optional properties only if they have values (exactOptionalPropertyTypes)
    if (classId !== undefined) {
        input.classId = classId;
    }
    if (options.luckBurn !== undefined) {
        input.luckBurn = options.luckBurn;
    }
    if (situationalModifiers.length > 0) {
        input.situationalModifiers = situationalModifiers;
    }
    // Resolve the check
    return resolveSkillCheck(input, options, options.events);
}
/**
 * Roll an ability check for a character
 *
 * Convenience function that's more explicit than rollCheck.
 *
 * @param abilityId - The ability to check (namespaced like "ability:str" or raw like "str")
 * @param character - The character making the check
 * @param options - Roll options
 */
export function rollAbilityCheck(abilityId, character, options = {}) {
    // If it's not namespaced, namespace it
    const parsed = parseCheckId(abilityId);
    if (parsed.namespace === null) {
        // Raw ability ID - convert to inline config
        return rollCheck({ ability: abilityId }, character, options);
    }
    // Already namespaced
    return rollCheck(abilityId, character, options);
}
/**
 * Roll a saving throw for a character
 *
 * Convenience function that's more explicit than rollCheck.
 *
 * @param saveId - The save type (namespaced like "save:reflex" or raw like "reflex")
 * @param character - The character making the save
 * @param options - Roll options
 */
export function rollSavingThrow(saveId, character, options = {}) {
    // If it's not namespaced, namespace it
    const parsed = parseCheckId(saveId);
    if (parsed.namespace === null) {
        const namespacedId = createCheckId(CheckNamespace.SAVE, saveId);
        return rollCheck(namespacedId, character, options);
    }
    // Already namespaced
    return rollCheck(saveId, character, options);
}
//# sourceMappingURL=roll.js.map