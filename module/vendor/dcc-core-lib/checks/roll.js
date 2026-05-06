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
import { resolveSkillCheck, resolveSkillCheckAsync, } from "../skills/resolve.js";
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
/**
 * Shared input builder for rollCheck / rollCheckAsync. Given a check
 * identifier and a character, produces the SkillCheckInput the
 * resolve layer expects.
 */
function buildCheckInput(check, character, options) {
    const accessors = options.accessors ?? DEFAULT_ACCESSORS;
    let skill;
    const additionalModifiers = [];
    if (isSkillDefinition(check)) {
        skill = check;
    }
    else if (isInlineConfig(check)) {
        skill = inlineToDefinition(check);
    }
    else {
        const parsed = parseCheckId(check);
        const definition = getCheckDefinition(check);
        if (!definition) {
            throw new Error(`Unknown check ID: ${check}`);
        }
        skill = definition;
        if (parsed.namespace === CheckNamespace.SAVE) {
            const saveBonus = accessors.getSaveBonus(character, parsed.value);
            if (saveBonus !== 0) {
                additionalModifiers.push({
                    kind: "add",
                    value: saveBonus,
                    origin: {
                        category: "other",
                        id: "save-bonus",
                        label: "Save bonus",
                    },
                });
            }
        }
    }
    const abilityIds = ["str", "agl", "sta", "per", "int", "lck"];
    if (options.additionalAbilities) {
        abilityIds.push(...options.additionalAbilities);
    }
    if (skill.roll?.ability && !abilityIds.includes(skill.roll.ability)) {
        abilityIds.push(skill.roll.ability);
    }
    const abilities = extractAbilityScores(character, accessors, abilityIds);
    const level = accessors.getLevel(character);
    const classId = accessors.getClassId(character);
    const luck = accessors.getLuck(character);
    const situationalModifiers = [
        ...additionalModifiers,
        ...(options.modifiers ?? []),
    ];
    const input = {
        skill,
        abilities,
        level,
        luck,
    };
    if (classId !== undefined) {
        input.classId = classId;
    }
    if (options.luckBurn !== undefined) {
        input.luckBurn = options.luckBurn;
    }
    if (situationalModifiers.length > 0) {
        input.situationalModifiers = situationalModifiers;
    }
    return input;
}
export function rollCheck(check, character, options = {}) {
    const input = buildCheckInput(check, character, options);
    return resolveSkillCheck(input, options, options.events);
}
/**
 * Roll a check for a character (async).
 *
 * Same semantics as `rollCheck`, but the dice evaluation is performed
 * via an async custom roller (see `RollCheckOptionsAsync.roller`). Use
 * this when integrating with Promise-based roll machinery like
 * FoundryVTT's `Roll.evaluate()`.
 */
export async function rollCheckAsync(check, character, options) {
    const input = buildCheckInput(check, character, options);
    return resolveSkillCheckAsync(input, options, options.events);
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
/**
 * Roll an ability check for a character (async).
 */
export async function rollAbilityCheckAsync(abilityId, character, options) {
    const parsed = parseCheckId(abilityId);
    if (parsed.namespace === null) {
        return rollCheckAsync({ ability: abilityId }, character, options);
    }
    return rollCheckAsync(abilityId, character, options);
}
/**
 * Roll a saving throw for a character (async).
 */
export async function rollSavingThrowAsync(saveId, character, options) {
    const parsed = parseCheckId(saveId);
    if (parsed.namespace === null) {
        const namespacedId = createCheckId(CheckNamespace.SAVE, saveId);
        return rollCheckAsync(namespacedId, character, options);
    }
    return rollCheckAsync(saveId, character, options);
}
//# sourceMappingURL=roll.js.map