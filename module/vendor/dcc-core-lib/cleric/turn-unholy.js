/**
 * Turn Unholy
 *
 * Pure functions for the cleric's Turn Unholy ability.
 * Clerics can channel their deity's power to turn away or destroy
 * unholy creatures (undead, demons, etc.).
 */
import { resolveSkillCheck } from "../skills/resolve.js";
import { lookupSimple } from "../tables/lookup.js";
import { getAbilityModifier } from "../data/ability-modifiers.js";
// =============================================================================
// Turn Unholy Skill Definition
// =============================================================================
/**
 * Turn Unholy skill definition.
 * Clerics roll d20 + Personality modifier + level.
 */
export const TURN_UNHOLY_SKILL = {
    id: "turn-unholy",
    name: "Turn Unholy",
    description: "Channel divine power to turn away or destroy unholy creatures",
    type: "check",
    roll: {
        die: "d20",
        ability: "per",
        levelModifier: "full",
        allowLuck: true,
        luckMultiplier: 1,
    },
    resultTable: {
        tableId: "turn-unholy",
    },
    tags: ["cleric", "divine", "turn-unholy"],
    classes: ["cleric"],
};
// =============================================================================
// Turn Unholy Functions
// =============================================================================
/**
 * Perform a Turn Unholy check.
 *
 * @param input - Turn Unholy input
 * @param turnTable - The Turn Unholy result table
 * @param options - Roll options
 * @returns Turn Unholy result
 */
export function turnUnholy(input, turnTable, options = {}) {
    // Build skill check input, only including optional properties when defined
    const checkInput = {
        skill: TURN_UNHOLY_SKILL,
        abilities: { per: input.personality },
        level: input.level,
        classId: "cleric",
    };
    if (input.luck !== undefined) {
        checkInput.luck = input.luck;
    }
    if (input.luckBurn !== undefined) {
        checkInput.luckBurn = input.luckBurn;
    }
    if (input.situationalModifiers !== undefined) {
        checkInput.situationalModifiers = input.situationalModifiers;
    }
    // Resolve the skill check
    const check = resolveSkillCheck(checkInput, options);
    // Look up the result in the turn table
    const total = check.total ?? 0;
    const tableResult = lookupSimple(turnTable, total);
    // Parse the effect
    const effect = parseTableEffect(tableResult?.effect);
    const success = effect.type !== "none";
    return {
        check,
        success,
        description: tableResult?.text ?? getDefaultDescription(total),
        effect,
        tableEffect: tableResult?.effect,
    };
}
/**
 * Calculate the Turn Unholy modifier without rolling.
 * Useful for displaying to players before they commit to the action.
 *
 * @param level - Cleric level
 * @param personality - Personality score
 * @returns Total modifier
 */
export function getTurnUnholyModifier(level, personality) {
    return level + getAbilityModifier(personality);
}
/**
 * Get the die used for Turn Unholy.
 * Always d20 for standard clerics.
 */
export function getTurnUnholyDie() {
    return "d20";
}
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Parse a table effect into a structured TurnEffect
 */
function parseTableEffect(effect) {
    if (!effect) {
        return { type: "none" };
    }
    const effectType = effect.type;
    const result = {
        type: effectType === "none" ? "none" : effectType,
    };
    // Extract HD affected from dice field
    if (effect.dice) {
        result.hdAffected = effect.dice;
    }
    // Extract additional data
    if (effect.data) {
        if (typeof effect.data["destroyDice"] === "string") {
            result.hdDestroyed = effect.data["destroyDice"];
        }
        if (typeof effect.data["fleeRounds"] === "string") {
            result.duration = effect.data["fleeRounds"];
            result.flee = true;
        }
        if (effect.data["command"] === true) {
            result.command = true;
        }
    }
    return result;
}
/**
 * Get a default description based on total
 */
function getDefaultDescription(total) {
    if (total <= 10) {
        return "The unholy creatures are unaffected by your divine power.";
    }
    if (total <= 14) {
        return "You manage to turn away some of the weaker unholy creatures.";
    }
    if (total <= 18) {
        return "Your divine power forces the unholy creatures to flee!";
    }
    if (total <= 22) {
        return "The unholy creatures are turned, and the weakest are destroyed!";
    }
    return "Your divine power obliterates the unholy creatures!";
}
// =============================================================================
// HD Calculation Helpers
// =============================================================================
/**
 * Calculate the HD affected by a turn result.
 * Replaces "CL" in dice expressions with the cleric's level.
 *
 * @param hdExpression - The HD expression (e.g., "1d6+CL")
 * @param level - Cleric level
 * @returns Resolved expression (e.g., "1d6+5" for level 5)
 */
export function resolveHDExpression(hdExpression, level) {
    return hdExpression.replace(/CL/g, String(level));
}
/**
 * Calculate average HD for an expression.
 * Useful for quick estimates.
 *
 * @param hdExpression - Resolved HD expression (e.g., "1d6+5")
 * @returns Average HD value
 */
export function calculateAverageHD(hdExpression) {
    // Parse dice expression: NdX+M or just N
    const diceMatch = /(\d+)d(\d+)/.exec(hdExpression);
    const modMatch = /[+-](\d+)$/.exec(hdExpression);
    let average = 0;
    if (diceMatch) {
        const count = parseInt(diceMatch[1] ?? "1", 10);
        const sides = parseInt(diceMatch[2] ?? "6", 10);
        average = count * ((sides + 1) / 2);
    }
    else {
        // Just a number
        const num = parseInt(hdExpression, 10);
        if (!isNaN(num)) {
            average = num;
        }
    }
    if (modMatch) {
        const mod = parseInt(modMatch[1] ?? "0", 10);
        average += hdExpression.includes("-") ? -mod : mod;
    }
    return average;
}
//# sourceMappingURL=turn-unholy.js.map