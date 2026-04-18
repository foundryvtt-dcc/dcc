/**
 * Lay on Hands
 *
 * Pure functions for the cleric's Lay on Hands ability.
 * Clerics can channel divine healing power to restore hit points
 * and cure ailments.
 */
import { resolveSkillCheck } from "../skills/resolve.js";
import { lookupSimple } from "../tables/lookup.js";
import { getAbilityModifier } from "../data/ability-modifiers.js";
// =============================================================================
// Lay on Hands Skill Definition
// =============================================================================
/**
 * Lay on Hands skill definition.
 * Clerics roll d20 + Personality modifier + level.
 */
export const LAY_ON_HANDS_SKILL = {
    id: "lay-on-hands",
    name: "Lay on Hands",
    description: "Channel divine healing power to restore hit points and cure ailments",
    type: "check",
    roll: {
        die: "d20",
        ability: "per",
        levelModifier: "full",
        allowLuck: true,
        luckMultiplier: 1,
    },
    resultTable: {
        tableId: "lay-on-hands",
    },
    tags: ["cleric", "divine", "healing", "lay-on-hands"],
    classes: ["cleric"],
};
// =============================================================================
// Lay on Hands Functions
// =============================================================================
/**
 * Perform a Lay on Hands check.
 *
 * @param input - Lay on Hands input
 * @param healTable - The Lay on Hands result table
 * @param options - Roll options
 * @returns Lay on Hands result
 */
export function layOnHands(input, healTable, options = {}) {
    // Build situational modifiers
    const modifiers = [...(input.situationalModifiers ?? [])];
    // Self-healing penalty (typically -4 in DCC)
    if (input.healingSelf) {
        modifiers.push({
            kind: "add",
            value: -4,
            origin: {
                category: "situational",
                id: "self-healing",
                label: "Healing self",
            },
        });
    }
    // Alignment modifiers
    if (input.alignmentMod) {
        if (input.alignmentMod.sameAlignment) {
            modifiers.push({
                kind: "add",
                value: 2,
                origin: {
                    category: "situational",
                    id: "alignment-same",
                    label: "Same alignment",
                },
            });
        }
        else if (input.alignmentMod.oppositeAlignment) {
            modifiers.push({
                kind: "add",
                value: -2,
                origin: {
                    category: "situational",
                    id: "alignment-opposite",
                    label: "Opposite alignment",
                },
            });
        }
    }
    // Build skill check input, only including optional properties when defined
    const checkInput = {
        skill: LAY_ON_HANDS_SKILL,
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
    // Look up the result in the heal table
    const total = check.total ?? 0;
    const tableResult = lookupSimple(healTable, total);
    // Parse the effect
    const effect = parseTableEffect(tableResult?.effect);
    const success = effect.type !== "none";
    // Calculate HP healed
    let hpHealed;
    if (effect.hpHealed) {
        hpHealed = calculateHPHealed(effect.hpHealed, input.level);
    }
    const result = {
        check,
        success,
        description: tableResult?.text ?? getDefaultDescription(total),
        effect,
        tableEffect: tableResult?.effect,
    };
    if (hpHealed !== undefined) {
        result.hpHealed = hpHealed;
    }
    return result;
}
/**
 * Calculate the Lay on Hands modifier without rolling.
 * Useful for displaying to players before they commit to the action.
 *
 * @param level - Cleric level
 * @param personality - Personality score
 * @param healingSelf - Whether healing self (-4)
 * @returns Total modifier
 */
export function getLayOnHandsModifier(level, personality, healingSelf = false) {
    let mod = level + getAbilityModifier(personality);
    if (healingSelf) {
        mod -= 4;
    }
    return mod;
}
/**
 * Get the die used for Lay on Hands.
 * Always d20 for standard clerics.
 */
export function getLayOnHandsDie() {
    return "d20";
}
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Parse a table effect into a structured HealEffect
 */
function parseTableEffect(effect) {
    if (!effect) {
        return { type: "none" };
    }
    const effectType = effect.type;
    const result = {
        type: effectType === "none" ? "none" : effectType,
    };
    // Extract HP healed from dice field
    if (effect.dice) {
        result.hpHealed = effect.dice;
    }
    // Extract additional data
    if (effect.data) {
        if (effect.data["cureDisease"] === true) {
            result.curesDisease = true;
        }
        if (effect.data["cureAllDiseases"] === true) {
            result.curesAllAilments = true;
        }
        if (effect.data["restoreLimb"] === true) {
            result.restoresLimb = true;
        }
        if (effect.data["neutralizePoison"] === true) {
            result.neutralizesPoison = true;
        }
    }
    return result;
}
/**
 * Get a default description based on total
 */
function getDefaultDescription(total) {
    if (total <= 10) {
        return "Divine healing does not flow through you.";
    }
    if (total <= 14) {
        return "A minor healing warmth passes through your hands.";
    }
    if (total <= 18) {
        return "Divine energy flows through you, mending wounds.";
    }
    if (total <= 22) {
        return "Powerful healing energy restores the target!";
    }
    return "Miraculous divine healing restores the target to full health!";
}
/**
 * Calculate HP healed from a dice/formula expression.
 *
 * @param expression - HP expression (e.g., "1*CL", "2*CL", "3d6")
 * @param level - Cleric level
 * @returns Calculated HP (using formula, not rolling)
 */
export function calculateHPHealed(expression, level) {
    // Handle CL multiplier format (e.g., "3*CL")
    const clMatch = /(\d+)\*CL/.exec(expression);
    if (clMatch) {
        const multiplier = parseInt(clMatch[1] ?? "1", 10);
        return multiplier * level;
    }
    // Handle dice expression (return average)
    const diceMatch = /(\d+)d(\d+)/.exec(expression);
    if (diceMatch) {
        const count = parseInt(diceMatch[1] ?? "1", 10);
        const sides = parseInt(diceMatch[2] ?? "6", 10);
        const modMatch = /[+-](\d+)$/.exec(expression);
        let average = count * ((sides + 1) / 2);
        if (modMatch) {
            const mod = parseInt(modMatch[1] ?? "0", 10);
            average += expression.includes("-") ? -mod : mod;
        }
        return Math.floor(average);
    }
    // Just a number
    const num = parseInt(expression, 10);
    if (!isNaN(num)) {
        return num;
    }
    return 0;
}
/**
 * Get the maximum possible healing for a given level.
 * Useful for displaying healing potential.
 *
 * @param level - Cleric level
 * @param maxMultiplier - Maximum HP multiplier from the table (default 8)
 * @returns Maximum HP that can be healed
 */
export function getMaxHealing(level, maxMultiplier = 8) {
    return level * maxMultiplier;
}
//# sourceMappingURL=lay-on-hands.js.map