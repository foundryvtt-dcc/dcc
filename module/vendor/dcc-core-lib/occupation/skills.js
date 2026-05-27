/**
 * Occupation Skills
 *
 * Pure functions for occupation-based skill checks.
 * Handles:
 * - Trained weapon proficiency
 * - Trade skills (background knowledge)
 * - Limited thief skill access
 */
import { getAbilityModifier } from "../data/ability-modifiers.js";
import { evaluateRoll, buildFormula } from "../dice/roll.js";
// =============================================================================
// Constants
// =============================================================================
/**
 * Default die for trade skill checks.
 */
export const DEFAULT_TRADE_SKILL_DIE = "d20";
/**
 * Default die for limited thief skill checks.
 */
export const DEFAULT_THIEF_SKILL_DIE = "d20";
/**
 * Default attack bonus for trained weapon proficiency.
 */
export const DEFAULT_WEAPON_TRAINING_BONUS = 0;
/**
 * Minimum effective level for limited thief skills.
 */
export const MIN_EFFECTIVE_LEVEL = 0;
// =============================================================================
// Weapon Training
// =============================================================================
/**
 * Parse weapon training from an occupation's trained weapon string.
 *
 * @param trainedWeapon - The trained weapon string (e.g., "Hammer (as club)")
 * @returns Parsed weapon training data
 */
export function parseWeaponTraining(trainedWeapon) {
    // Check for "X (as Y)" pattern
    const asPattern = /^(.+?)\s*\(as\s+(.+?)\)$/i;
    const match = asPattern.exec(trainedWeapon);
    if (match) {
        const weaponName = match[1]?.trim() ?? trainedWeapon;
        const weaponType = match[2]?.trim().toLowerCase() ?? trainedWeapon.toLowerCase();
        return {
            weaponName,
            weaponType,
            attackBonus: DEFAULT_WEAPON_TRAINING_BONUS,
            damageBonus: 0,
            notes: trainedWeapon,
        };
    }
    // Simple weapon name
    return {
        weaponName: trainedWeapon,
        weaponType: trainedWeapon.toLowerCase(),
        attackBonus: DEFAULT_WEAPON_TRAINING_BONUS,
        damageBonus: 0,
    };
}
/**
 * Check if a weapon matches the character's trained weapon.
 *
 * @param weaponName - The weapon being used
 * @param training - The character's weapon training
 * @returns True if the weapon matches
 */
export function isTrainedWeapon(weaponName, training) {
    const normalizedWeapon = weaponName.toLowerCase().trim();
    return (normalizedWeapon === training.weaponType ||
        normalizedWeapon === training.weaponName.toLowerCase());
}
/**
 * Get attack bonus for using trained weapon.
 *
 * @param weaponName - The weapon being used
 * @param training - The character's weapon training
 * @returns Attack bonus (0 if not trained weapon)
 */
export function getTrainedWeaponBonus(weaponName, training) {
    return isTrainedWeapon(weaponName, training) ? training.attackBonus : 0;
}
// =============================================================================
// Limited Thief Skills
// =============================================================================
/**
 * Calculate effective level for a limited thief skill.
 *
 * @param characterLevel - The character's actual level
 * @param levelAdjustment - The skill's level adjustment (usually negative)
 * @returns Effective level (minimum 0)
 */
export function calculateEffectiveLevel(characterLevel, levelAdjustment = 0) {
    return Math.max(MIN_EFFECTIVE_LEVEL, characterLevel + levelAdjustment);
}
/**
 * Check if a character has access to a limited thief skill from their occupation.
 *
 * @param occupationSkills - Skills granted by the occupation
 * @param thiefSkillId - The thief skill to check
 * @returns The skill grant if available, undefined otherwise
 */
export function getOccupationThiefSkill(occupationSkills, thiefSkillId) {
    return occupationSkills.find((skill) => skill.category === "limited-thief" && skill.thiefSkillId === thiefSkillId);
}
/**
 * Check if an occupation grants a specific thief skill.
 *
 * @param occupationSkills - Skills granted by the occupation
 * @param thiefSkillId - The thief skill to check
 * @returns True if the occupation grants access to this skill
 */
export function hasOccupationThiefSkill(occupationSkills, thiefSkillId) {
    return getOccupationThiefSkill(occupationSkills, thiefSkillId) !== undefined;
}
// =============================================================================
// Skill Resolution
// =============================================================================
/**
 * Build modifiers for an occupation skill check.
 *
 * @param input - The skill check input
 * @returns Array of roll modifiers
 */
export function buildOccupationSkillModifiers(input) {
    const modifiers = [];
    const { skill, abilities, luckBurn } = input;
    // Ability modifier
    if (skill.abilityId) {
        const score = abilities[skill.abilityId];
        if (score !== undefined) {
            const mod = getAbilityModifier(score);
            if (mod !== 0) {
                modifiers.push({
                    source: skill.abilityId.toUpperCase(),
                    value: mod,
                });
            }
        }
    }
    // Skill bonus
    if (skill.bonus !== undefined && skill.bonus !== 0) {
        modifiers.push({
            source: "Skill Bonus",
            value: skill.bonus,
        });
    }
    // Luck burn
    if (luckBurn !== undefined && luckBurn > 0) {
        modifiers.push({
            source: "Luck",
            value: luckBurn,
        });
    }
    // Situational modifiers
    if (input.situationalModifiers) {
        for (const mod of input.situationalModifiers) {
            if (mod.value !== 0) {
                modifiers.push({
                    source: mod.source,
                    value: mod.value,
                });
            }
        }
    }
    return modifiers;
}
/**
 * Resolve an occupation skill check.
 *
 * @param input - The skill check input
 * @param options - Roll options
 * @param events - Event callbacks
 * @returns The skill check result
 */
export function resolveOccupationSkillCheck(input, options = {}, events) {
    // Emit start event
    events?.onCheckStart?.(input);
    const { skill } = input;
    // Determine die
    const die = skill.die ??
        (skill.category === "limited-thief"
            ? DEFAULT_THIEF_SKILL_DIE
            : DEFAULT_TRADE_SKILL_DIE);
    // Build modifiers
    const modifiers = buildOccupationSkillModifiers(input);
    // Build formula
    const formula = buildFormula(die, 1, modifiers);
    // Evaluate roll - always use evaluate mode to actually roll
    const rollResult = evaluateRoll(formula, { ...options, mode: "evaluate" });
    // Determine critical/fumble
    const dieMax = parseInt(die.slice(1), 10);
    const critical = rollResult.natural === dieMax;
    const fumble = rollResult.natural === 1;
    // Determine success for DC-based checks
    let success;
    if (skill.baseDC !== undefined && rollResult.total !== undefined) {
        success = rollResult.total >= skill.baseDC;
    }
    // Build result
    const result = {
        skillId: skill.id,
        die,
        formula,
        modifiers: modifiers.map((m) => ({ source: m.source, value: m.value })),
        luckBurned: input.luckBurn ?? 0,
    };
    // Add optional properties only if defined
    if (rollResult.natural !== undefined) {
        result.natural = rollResult.natural;
    }
    if (rollResult.total !== undefined) {
        result.total = rollResult.total;
    }
    if (critical) {
        result.critical = critical;
    }
    if (fumble) {
        result.fumble = fumble;
    }
    if (success !== undefined) {
        result.success = success;
    }
    // Emit events
    if (critical) {
        events?.onCritical?.(result);
    }
    if (fumble) {
        events?.onFumble?.(result);
    }
    events?.onCheckComplete?.(result);
    return result;
}
// =============================================================================
// Trade Skills
// =============================================================================
/**
 * Get all trade skills from occupation skills.
 *
 * @param occupationSkills - Skills granted by the occupation
 * @returns Array of trade skills
 */
export function getTradeSkills(occupationSkills) {
    return occupationSkills.filter((skill) => skill.category === "trade-skill" || skill.category === "craft");
}
/**
 * Get all knowledge skills from occupation skills.
 *
 * @param occupationSkills - Skills granted by the occupation
 * @returns Array of knowledge skills
 */
export function getKnowledgeSkills(occupationSkills) {
    return occupationSkills.filter((skill) => skill.category === "knowledge");
}
/**
 * Get all limited thief skills from occupation skills.
 *
 * @param occupationSkills - Skills granted by the occupation
 * @returns Array of limited thief skills
 */
export function getLimitedThiefSkills(occupationSkills) {
    return occupationSkills.filter((skill) => skill.category === "limited-thief");
}
// =============================================================================
// Result Helpers
// =============================================================================
/**
 * Check if an occupation skill check result was successful.
 *
 * @param result - The check result
 * @returns True if successful
 */
export function isOccupationSkillSuccess(result) {
    // Explicit success/failure for DC-based checks
    if (result.success !== undefined) {
        return result.success;
    }
    // Critical always succeeds
    if (result.critical) {
        return true;
    }
    // Fumble always fails
    if (result.fumble) {
        return false;
    }
    // Otherwise, can't determine without DC
    return false;
}
/**
 * Get a summary of the occupation skill check result.
 *
 * @param result - The check result
 * @returns Summary string
 */
export function getOccupationSkillSummary(result) {
    const parts = [];
    // Roll info
    if (result.natural !== undefined && result.total !== undefined) {
        parts.push(`Roll: ${String(result.natural)} → ${String(result.total)}`);
    }
    // Critical/Fumble
    if (result.critical) {
        parts.push("CRITICAL!");
    }
    if (result.fumble) {
        parts.push("FUMBLE!");
    }
    // Success/Failure
    if (result.success !== undefined) {
        parts.push(result.success ? "Success" : "Failure");
    }
    return parts.join(" | ");
}
//# sourceMappingURL=skills.js.map