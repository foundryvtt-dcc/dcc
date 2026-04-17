/**
 * Divine Aid
 *
 * Pure functions for the cleric's Divine Aid ability.
 * Clerics can petition their deity for miraculous intervention,
 * requesting aid in times of great need.
 */
import { resolveSkillCheck } from "../skills/resolve.js";
import { lookupSimple } from "../tables/lookup.js";
import { getAbilityModifier } from "../data/ability-modifiers.js";
import { rollTriggersDisapproval, increaseDisapprovalRange, } from "../spells/disapproval.js";
// =============================================================================
// Divine Aid Skill Definition
// =============================================================================
/**
 * Divine Aid skill definition.
 * Clerics roll d20 + Personality modifier + level (spell check).
 */
export const DIVINE_AID_SKILL = {
    id: "divine-aid",
    name: "Divine Aid",
    description: "Petition your deity for miraculous intervention",
    type: "check",
    roll: {
        die: "d20",
        ability: "per",
        levelModifier: "full",
        allowLuck: true,
        luckMultiplier: 1,
    },
    resultTable: {
        tableId: "divine-aid",
    },
    tags: ["cleric", "divine", "prayer", "divine-aid"],
    classes: ["cleric"],
};
// =============================================================================
// Divine Aid Functions
// =============================================================================
/**
 * Perform a Divine Aid check.
 *
 * Divine Aid allows clerics to request miraculous intervention.
 * The spell check determines the level of aid the deity is willing to provide.
 * Rolling within the disapproval range triggers disapproval.
 *
 * @param input - Divine Aid input
 * @param aidTable - The Divine Aid result table
 * @param options - Roll options
 * @returns Divine Aid result
 */
export function divineAid(input, aidTable, options = {}) {
    // Build situational modifiers
    const modifiers = [...(input.situationalModifiers ?? [])];
    // Build skill check input
    const checkInput = {
        skill: DIVINE_AID_SKILL,
        abilities: { per: input.personality },
        level: input.level,
        classId: "cleric",
        situationalModifiers: modifiers,
    };
    if (input.luck !== undefined) {
        checkInput.luck = input.luck;
    }
    if (input.luckBurn !== undefined) {
        checkInput.luckBurn = input.luckBurn;
    }
    // Resolve the skill check
    const check = resolveSkillCheck(checkInput, options);
    // Get natural roll for disapproval check
    const natural = check.natural ?? 1;
    // Check for disapproval
    const disapprovalTriggered = rollTriggersDisapproval(natural, input.disapprovalRange);
    let newDisapprovalRange = input.disapprovalRange;
    if (disapprovalTriggered) {
        newDisapprovalRange = increaseDisapprovalRange(input.disapprovalRange);
    }
    // Look up the result in the aid table
    const total = check.total ?? 0;
    const tableResult = lookupSimple(aidTable, total);
    // Parse the effect
    const effect = parseTableEffect(tableResult?.effect, input.aidSpellLevel);
    const success = effect.type !== "none" && !disapprovalTriggered;
    return {
        check,
        success,
        natural,
        description: tableResult?.text ?? getDefaultDescription(total, disapprovalTriggered),
        effect,
        disapprovalTriggered,
        newDisapprovalRange,
        tableEffect: tableResult?.effect,
    };
}
/**
 * Calculate the Divine Aid modifier without rolling.
 * Useful for displaying to players before they commit to the action.
 *
 * @param level - Cleric level
 * @param personality - Personality score
 * @returns Total modifier
 */
export function getDivineAidModifier(level, personality) {
    return level + getAbilityModifier(personality);
}
/**
 * Get the die used for Divine Aid.
 * Always d20 for standard clerics.
 */
export function getDivineAidDie() {
    return "d20";
}
/**
 * Calculate the minimum check result needed for a given spell level equivalent.
 * In DCC, divine aid roughly maps to spell levels.
 *
 * @param spellLevel - Desired spell level equivalent (1-5)
 * @returns Minimum check result needed
 */
export function getMinimumCheckForSpellLevel(spellLevel) {
    // Based on DCC divine aid guidelines:
    // Spell level 1: 12+
    // Spell level 2: 14+
    // Spell level 3: 18+
    // Spell level 4: 22+
    // Spell level 5: 26+
    const thresholds = {
        1: 12,
        2: 14,
        3: 18,
        4: 22,
        5: 26,
    };
    return thresholds[spellLevel] ?? 12 + (spellLevel - 1) * 4;
}
/**
 * Estimate the spell level equivalent of aid for a given check result.
 *
 * @param checkResult - The total check result
 * @returns Estimated spell level equivalent
 */
export function estimateAidSpellLevel(checkResult) {
    if (checkResult < 12)
        return 0;
    if (checkResult < 14)
        return 1;
    if (checkResult < 18)
        return 2;
    if (checkResult < 22)
        return 3;
    if (checkResult < 26)
        return 4;
    return 5;
}
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Parse a table effect into a structured DivineAidEffect
 */
function parseTableEffect(effect, requestedSpellLevel) {
    if (!effect) {
        return { type: "none" };
    }
    const effectType = effect.type;
    const result = {
        type: effectType === "none" ? "none" : effectType,
    };
    // Extract spell level equivalent from data
    if (effect.data) {
        if (typeof effect.data["spellLevel"] === "number") {
            result.spellLevelEquivalent = effect.data["spellLevel"];
        }
        if (typeof effect.data["aidDescription"] === "string") {
            result.aidDescription = effect.data["aidDescription"];
        }
        // Check if request was granted (if spell level matches or exceeds request)
        if (requestedSpellLevel !== undefined && result.spellLevelEquivalent !== undefined) {
            result.requestGranted = result.spellLevelEquivalent >= requestedSpellLevel;
        }
    }
    // Extract duration
    if (effect.duration) {
        result.duration = effect.duration;
    }
    return result;
}
/**
 * Get a default description based on total and disapproval
 */
function getDefaultDescription(total, disapprovalTriggered) {
    if (disapprovalTriggered) {
        return "Your deity is displeased with your petition. Disapproval!";
    }
    if (total <= 11) {
        return "Your deity does not respond to your plea.";
    }
    if (total <= 13) {
        return "Your deity grants minor aid equivalent to a 1st-level spell.";
    }
    if (total <= 17) {
        return "Your deity grants moderate aid equivalent to a 2nd-level spell.";
    }
    if (total <= 21) {
        return "Your deity grants significant aid equivalent to a 3rd-level spell.";
    }
    if (total <= 25) {
        return "Your deity grants major aid equivalent to a 4th-level spell!";
    }
    return "Your deity grants miraculous aid equivalent to a 5th-level spell or greater!";
}
/**
 * Get a description of what type of aid might be available at a given modifier.
 * Useful for helping players understand their chances.
 *
 * @param modifier - The cleric's total modifier
 * @returns Description of potential aid levels
 */
export function describePotentialAid(modifier) {
    const minRoll = 1 + modifier;
    const avgRoll = 10 + modifier;
    const maxRoll = 20 + modifier;
    const minLevel = estimateAidSpellLevel(minRoll);
    const avgLevel = estimateAidSpellLevel(avgRoll);
    const maxLevel = estimateAidSpellLevel(maxRoll);
    if (maxLevel === 0) {
        return "Divine aid is unlikely at this level.";
    }
    if (minLevel === maxLevel) {
        return `You can reliably request aid equivalent to spell level ${String(minLevel)}.`;
    }
    return `Aid ranges from spell level ${String(Math.max(0, minLevel))} (minimum) to ${String(maxLevel)} (maximum), with level ${String(avgLevel)} most likely.`;
}
//# sourceMappingURL=divine-aid.js.map