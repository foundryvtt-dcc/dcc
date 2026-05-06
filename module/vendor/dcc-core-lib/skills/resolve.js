/**
 * Skill Resolution
 *
 * The core of the unified skill system. This module provides the
 * `resolveSkillCheck` function (and its async sibling
 * `resolveSkillCheckAsync`) that handles all skill checks — from
 * thief skills to turn unholy to spell checks.
 *
 * Modifier handling follows the tagged-union `RollModifier` design
 * in docs/MODIFIERS.md. See §3 for the canonical pipeline that
 * `resolveSkillCheck` implements.
 */
import { getAbilityModifier } from "../data/ability-modifiers.js";
import { evaluateRoll, evaluateRollAsync, selectDie, buildFormulaFromModifiers, applyMultipliers, resolveThreatRange, markApplied, } from "../dice/roll.js";
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
 * Calculate the level modifier value for a skill
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
 * Helper: construct an 'add' tagged-union RollModifier.
 */
function addMod(value, origin) {
    return { kind: 'add', value, origin };
}
/**
 * Build the complete modifier list for a skill check in the new
 * tagged-union shape.
 */
function buildModifiers(skill, input) {
    const modifiers = [];
    // Ability modifier
    const { mod: abilityMod, abilityId } = getAbilityMod(skill, input.abilities);
    if (abilityMod !== 0 && abilityId) {
        modifiers.push(addMod(abilityMod, {
            category: 'ability',
            id: abilityId,
            label: `${abilityId.toUpperCase()} modifier`,
        }));
    }
    // Level modifier
    const levelMod = getLevelModifier(skill, input.level, input.classId);
    if (levelMod !== 0) {
        modifiers.push(addMod(levelMod, { category: 'level', id: 'level', label: 'Level' }));
    }
    // Progression bonus (if any, separate from level modifier)
    const progression = getProgressionForLevel(skill, input.level);
    if (progression?.bonus && skill.roll?.levelModifier !== "custom") {
        modifiers.push(addMod(progression.bonus, {
            category: 'progression',
            id: 'class-bonus',
            label: 'Class bonus',
        }));
    }
    // Luck burn
    const { mod: luckMod } = getLuckMod(skill, input.luck, input.luckBurn);
    if (luckMod !== 0) {
        modifiers.push(addMod(luckMod, { category: 'luck-burn', id: 'lck', label: 'Luck' }));
    }
    // Situational modifiers (already in new shape — emitted by callers)
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
 * Shared internals: given a pre-rolled (total, natural) from either
 * the sync or async evaluator, classify the result and build the
 * SkillCheckResult. Factored out so the sync and async wrappers stay
 * thin and identical in behavior.
 */
function finalizeSkillCheck(skill, input, die, formula, modifiers, natural, rawTotal, threatRangeOption, events) {
    const result = {
        skillId: skill.id,
        die,
        formula,
        modifiers,
    };
    if (natural !== undefined) {
        result.natural = natural;
    }
    // Phase 4: multipliers (relevant for damage; pass-through for checks)
    let total = rawTotal;
    if (rawTotal !== undefined) {
        total = applyMultipliers(rawTotal, modifiers);
        result.total = total;
    }
    // Phase 5: threat resolution + critical/fumble classification
    if (natural !== undefined) {
        const faces = parseInt(die.slice(1), 10);
        const baseThreat = threatRangeOption ?? faces;
        const effectiveThreat = resolveThreatRange(baseThreat, faces, modifiers);
        result.critical = natural >= effectiveThreat;
        result.fumble = isFumble(natural);
        if (result.critical)
            events?.onCritical?.(result);
        if (result.fumble)
            events?.onFumble?.(result);
    }
    // Phase 6: flag which modifiers actually applied
    result.modifiers = markApplied(modifiers);
    // Phase 7: resources consumed + events
    const resourcesConsumed = [];
    const { burned } = getLuckMod(skill, input.luck, input.luckBurn);
    if (burned > 0) {
        resourcesConsumed.push({ resource: "luck", amount: burned });
        events?.onResourceConsumed?.("luck", burned);
    }
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
    events?.onSkillCheckComplete?.(result);
    return result;
}
/**
 * Resolve a skill check (sync).
 *
 * Implements the 7-phase modifier pipeline from docs/MODIFIERS.md §3:
 * 1. Die selection (set-die, bump-die)
 * 2. Formula construction (add, add-dice)
 * 3. Roll execution (evaluateRoll with optional custom roller)
 * 4. Multiplicative arithmetic (multiply)
 * 5. Threat range resolution (threat-shift) + crit/fumble classification
 * 6. Applied flagging on add / add-dice modifiers
 * 7. Resource tracking + event emission
 */
export function resolveSkillCheck(input, options = {}, events) {
    const { skill } = input;
    events?.onSkillCheckStart?.(input);
    const modifiers = buildModifiers(skill, input);
    // Phase 1: die selection
    const baseDie = getSkillDie(skill, input.level);
    const { die } = selectDie(baseDie, modifiers);
    // Phase 2: formula construction
    const formula = buildFormulaFromModifiers(die, modifiers);
    // Phase 3: roll
    const rollResult = evaluateRoll(formula, options);
    return finalizeSkillCheck(skill, input, die, formula, modifiers, rollResult.natural, rollResult.total, options.threatRange, events);
}
/**
 * Resolve a skill check (async). Same pipeline as the sync variant;
 * uses an async custom roller for the dice evaluation step.
 *
 * Use this when your roll machinery is Promise-based
 * (e.g. FoundryVTT's `Roll.evaluate()`).
 */
export async function resolveSkillCheckAsync(input, options, events) {
    const { skill } = input;
    events?.onSkillCheckStart?.(input);
    const modifiers = buildModifiers(skill, input);
    const baseDie = getSkillDie(skill, input.level);
    const { die } = selectDie(baseDie, modifiers);
    const formula = buildFormulaFromModifiers(die, modifiers);
    const rollResult = await evaluateRollAsync(formula, options);
    return finalizeSkillCheck(skill, input, die, formula, modifiers, rollResult.natural, rollResult.total, options.threatRange, events);
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
                kind: 'add',
                value: saveBonus,
                origin: {
                    category: 'other',
                    id: 'save-bonus',
                    label: 'Save bonus',
                },
            },
        ],
    };
    return resolveSkillCheck(input, options);
}
//# sourceMappingURL=resolve.js.map