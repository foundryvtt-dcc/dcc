/**
 * Skill Resolution
 *
 * The core of the unified skill system. This module provides the
 * resolveSkillCheck function that handles all skill checks, from
 * thief skills to turn unholy to spell checks.
 */
import { getAbilityModifier } from "../data/ability-modifiers.js";
import { evaluateRoll, buildFormula } from "../dice/roll.js";
/**
 * Get the skill progression data for a given level
 */
function getProgressionForLevel(skill, level) {
    if (!skill.progression) {
        return undefined;
    }
    // Find the highest level entry at or below the current level
    let result;
    for (let l = level; l >= 1; l--) {
        const prog = skill.progression[l];
        if (prog) {
            result = prog;
            break;
        }
    }
    return result;
}
/**
 * Calculate the die to use for a skill check
 */
function getSkillDie(skill, level) {
    // Check progression for level-specific die
    const progression = getProgressionForLevel(skill, level);
    if (progression?.die) {
        return progression.die;
    }
    // Fall back to skill's base die
    return skill.roll?.die ?? "d20";
}
/**
 * Calculate the level modifier for a skill
 */
function getLevelModifier(skill, level, _classId) {
    const levelModType = skill.roll?.levelModifier ?? "none";
    switch (levelModType) {
        case "none":
            return 0;
        case "full":
            return level;
        case "half":
            return Math.floor(level / 2);
        case "class-level":
            // For multiclass support, would need class-specific level
            // For now, just use full level
            return level;
        case "caster-level":
            // Same as class-level for now
            return level;
        case "custom": {
            // Check progression for custom bonus
            const progression = getProgressionForLevel(skill, level);
            return progression?.bonus ?? 0;
        }
        default:
            return 0;
    }
}
/**
 * Calculate the ability modifier for a skill
 */
function getAbilityMod(skill, abilities) {
    const abilityId = skill.roll?.ability;
    if (!abilityId) {
        return { mod: 0, abilityId: null };
    }
    const score = abilities[abilityId];
    if (score === undefined) {
        return { mod: 0, abilityId };
    }
    return { mod: getAbilityModifier(score), abilityId };
}
/**
 * Calculate luck modifier if applicable
 */
function getLuckMod(skill, luck, luckBurn) {
    if (!skill.roll?.allowLuck) {
        return { mod: 0, burned: 0 };
    }
    const burned = luckBurn ?? 0;
    if (burned <= 0 || luck === undefined) {
        return { mod: 0, burned: 0 };
    }
    const multiplier = skill.roll.luckMultiplier ?? 1;
    return { mod: burned * multiplier, burned };
}
/**
 * Build the complete modifier list for a skill check
 */
function buildModifiers(skill, input) {
    const modifiers = [];
    // Ability modifier
    const { mod: abilityMod, abilityId } = getAbilityMod(skill, input.abilities);
    if (abilityMod !== 0 && abilityId) {
        modifiers.push({
            source: abilityId,
            value: abilityMod,
            label: `${abilityId.toUpperCase()} modifier`,
        });
    }
    // Level modifier
    const levelMod = getLevelModifier(skill, input.level, input.classId);
    if (levelMod !== 0) {
        modifiers.push({
            source: "level",
            value: levelMod,
            label: "Level",
        });
    }
    // Progression bonus (if any, separate from level modifier)
    const progression = getProgressionForLevel(skill, input.level);
    if (progression?.bonus && skill.roll?.levelModifier !== "custom") {
        modifiers.push({
            source: "progression",
            value: progression.bonus,
            label: "Class bonus",
        });
    }
    // Luck burn
    const { mod: luckMod } = getLuckMod(skill, input.luck, input.luckBurn);
    if (luckMod !== 0) {
        modifiers.push({
            source: "luck",
            value: luckMod,
            label: "Luck",
        });
    }
    // Situational modifiers
    if (input.situationalModifiers) {
        modifiers.push(...input.situationalModifiers);
    }
    return modifiers;
}
/**
 * Determine if a roll is a fumble
 */
function isFumble(natural) {
    return natural === 1;
}
/**
 * Resolve a skill check
 *
 * This is the core function of the unified skill system. It handles
 * all types of skill checks by:
 * 1. Determining the die to roll
 * 2. Calculating all applicable modifiers
 * 3. Building and optionally evaluating the roll
 * 4. Firing events for integrations
 *
 * @param input - The skill check input
 * @param options - Roll options (mode, custom roller)
 * @param events - Optional event callbacks
 * @returns The skill check result
 */
export function resolveSkillCheck(input, options = {}, events) {
    const { skill } = input;
    // Fire start event
    events?.onSkillCheckStart?.(input);
    // Determine die and modifiers
    const die = getSkillDie(skill, input.level);
    const modifiers = buildModifiers(skill, input);
    // Build formula
    const formula = buildFormula(die, 1, modifiers);
    // Evaluate roll
    const rollResult = evaluateRoll(formula, options);
    // Build result
    const result = {
        skillId: skill.id,
        die,
        formula,
        modifiers,
    };
    // Conditionally assign optional properties (exactOptionalPropertyTypes)
    if (rollResult.natural !== undefined) {
        result.natural = rollResult.natural;
    }
    if (rollResult.total !== undefined) {
        result.total = rollResult.total;
    }
    // Determine critical/fumble if evaluated
    if (rollResult.natural !== undefined) {
        const threatRange = options.threatRange ?? parseInt(die.slice(1), 10);
        result.critical = rollResult.natural >= threatRange;
        result.fumble = isFumble(rollResult.natural);
        // Fire critical/fumble events
        if (result.critical) {
            events?.onCritical?.(result);
        }
        if (result.fumble) {
            events?.onFumble?.(result);
        }
    }
    // Track resources consumed
    const resourcesConsumed = [];
    // Luck burn
    const { burned } = getLuckMod(skill, input.luck, input.luckBurn);
    if (burned > 0) {
        resourcesConsumed.push({ resource: "luck", amount: burned });
        events?.onResourceConsumed?.("luck", burned);
    }
    // Skill cost (e.g., disapproval for clerics)
    if (skill.cost && result.fumble) {
        const costAmount = typeof skill.cost.amount === "number"
            ? skill.cost.amount
            : parseInt(skill.cost.amount, 10) || 1;
        if (skill.cost.timing === "after-failure" || !skill.cost.timing) {
            resourcesConsumed.push({
                resource: skill.cost.resource,
                amount: costAmount,
            });
            events?.onResourceConsumed?.(skill.cost.resource, costAmount);
        }
    }
    if (resourcesConsumed.length > 0) {
        result.resourcesConsumed = resourcesConsumed;
    }
    // Fire complete event
    events?.onSkillCheckComplete?.(result);
    return result;
}
/**
 * Quick skill check with minimal input
 *
 * Convenience function for simple skill checks.
 */
export function quickSkillCheck(skillId, die, abilityScore, abilityId, level, options = {}) {
    const skill = {
        id: skillId,
        name: skillId,
        type: "check",
        roll: {
            die,
            ability: abilityId,
            levelModifier: "full",
        },
    };
    const input = {
        skill,
        abilities: { [abilityId]: abilityScore },
        level,
    };
    return resolveSkillCheck(input, options);
}
/**
 * Create a simple ability check
 */
export function abilityCheck(abilityId, abilityScore, options = {}) {
    const skill = {
        id: `${abilityId}-check`,
        name: `${abilityId.toUpperCase()} Check`,
        type: "check",
        roll: {
            die: "d20",
            ability: abilityId,
            levelModifier: "none",
        },
    };
    const input = {
        skill,
        abilities: { [abilityId]: abilityScore },
        level: 1,
    };
    return resolveSkillCheck(input, options);
}
/**
 * Create a saving throw check
 */
export function savingThrow(saveType, abilityId, abilityScore, saveBonus, options = {}) {
    const skill = {
        id: `save-${saveType}`,
        name: `${saveType} Save`,
        type: "check",
        roll: {
            die: "d20",
            ability: abilityId,
            levelModifier: "none",
        },
    };
    const input = {
        skill,
        abilities: { [abilityId]: abilityScore },
        level: 1,
        situationalModifiers: [
            {
                source: "save-bonus",
                value: saveBonus,
                label: "Save bonus",
            },
        ],
    };
    return resolveSkillCheck(input, options);
}
//# sourceMappingURL=resolve.js.map