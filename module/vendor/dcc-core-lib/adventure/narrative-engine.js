/**
 * Narrative Encounter Engine
 *
 * Pure functions for creating and resolving narrative encounters.
 */
import { getRandomTemplate, getTemplateById } from "./narrative-templates.js";
/**
 * Default dice roller using Math.random
 */
function defaultRoller(sides) {
    return Math.floor(Math.random() * sides) + 1;
}
/**
 * Get ability modifier from ability score
 */
function getAbilityModifier(score) {
    if (score <= 3)
        return -3;
    if (score <= 5)
        return -2;
    if (score <= 8)
        return -1;
    if (score <= 12)
        return 0;
    if (score <= 15)
        return 1;
    if (score <= 17)
        return 2;
    return 3;
}
/**
 * Get ability score from character
 */
function getAbilityScore(character, ability) {
    const abilityObj = character.state.abilities[ability];
    return abilityObj.current;
}
/**
 * Create a new narrative encounter from a template.
 */
export function createNarrativeEncounter(template) {
    return {
        encounterId: crypto.randomUUID(),
        type: "narrative",
        phase: "awaiting-choice",
        templateId: template.id,
        situation: template.situation,
        options: [...template.options],
    };
}
/**
 * Create a narrative encounter from a category (random template).
 */
export function createNarrativeEncounterFromCategory(category) {
    const template = getRandomTemplate(category);
    if (!template) {
        return null;
    }
    return createNarrativeEncounter(template);
}
/**
 * Create a narrative encounter from a template ID.
 */
export function createNarrativeEncounterFromId(templateId) {
    const template = getTemplateById(templateId);
    if (!template) {
        return null;
    }
    return createNarrativeEncounter(template);
}
/**
 * Choose an option in a narrative encounter.
 * If the option requires a skill check, it will be rolled.
 */
export function chooseOption(encounter, optionId, character, playerInfo, roller = defaultRoller) {
    // Validate encounter is in correct phase
    if (encounter.phase !== "awaiting-choice") {
        return null;
    }
    // Find the option
    const option = encounter.options.find((o) => o.id === optionId);
    if (!option) {
        return null;
    }
    let success = true;
    let outcomeText = option.successOutcome;
    let checkResult;
    // Roll skill check if required
    if (option.skillCheck) {
        const { ability, dc } = option.skillCheck;
        const abilityScore = getAbilityScore(character, ability);
        const modifier = getAbilityModifier(abilityScore);
        const roll = roller(20);
        const total = roll + modifier;
        success = total >= dc;
        checkResult = {
            playerId: playerInfo.playerId,
            playerName: playerInfo.playerName,
            ability,
            dc,
            roll,
            modifier,
            total,
            passed: success,
        };
        if (!success && option.failureOutcome) {
            outcomeText = option.failureOutcome;
        }
    }
    // Update encounter state
    const updatedEncounter = {
        ...encounter,
        phase: "resolved",
        chosenOptionId: optionId,
        outcome: outcomeText,
    };
    // Add check results if applicable
    if (checkResult) {
        updatedEncounter.checkResults = [checkResult];
    }
    // Build result - handle checkResult conditionally for exactOptionalPropertyTypes
    const result = {
        encounter: updatedEncounter,
        option,
        requiredCheck: !!option.skillCheck,
        success,
        outcomeText,
    };
    if (checkResult) {
        result.checkResult = checkResult;
    }
    return result;
}
/**
 * Get the available options for an encounter.
 */
export function getAvailableOptions(encounter) {
    if (encounter.phase !== "awaiting-choice") {
        return [];
    }
    return encounter.options;
}
/**
 * Check if an encounter is resolved.
 */
export function isEncounterResolved(encounter) {
    return encounter.phase === "resolved";
}
/**
 * Ability ID to display name mapping
 */
const ABILITY_SHORT_NAMES = {
    str: "STR",
    agl: "AGL",
    sta: "STA",
    per: "PER",
    int: "INT",
    lck: "LCK",
};
/**
 * Ability ID to full name mapping
 */
const ABILITY_FULL_NAMES = {
    str: "Strength",
    agl: "Agility",
    sta: "Stamina",
    per: "Personality",
    int: "Intelligence",
    lck: "Luck",
};
/**
 * Format an option for display, including skill check info.
 */
export function formatOptionDisplay(option) {
    let display = option.text;
    if (option.skillCheck) {
        const abilityName = ABILITY_SHORT_NAMES[option.skillCheck.ability];
        display += ` [${abilityName} DC ${String(option.skillCheck.dc)}]`;
    }
    return display;
}
/**
 * Format a skill check result for display.
 */
export function formatCheckResult(result) {
    const modStr = result.modifier >= 0 ? `+${String(result.modifier)}` : String(result.modifier);
    const passedStr = result.passed ? "**Success!**" : "**Failure!**";
    return `${result.playerName} rolls ${ABILITY_FULL_NAMES[result.ability]}: ${String(result.roll)} ${modStr} = **${String(result.total)}** vs DC ${String(result.dc)} - ${passedStr}`;
}
//# sourceMappingURL=narrative-engine.js.map