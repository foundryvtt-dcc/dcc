/**
 * Initiative System
 *
 * Handles initiative roll calculations including:
 * - Base initiative rolls
 * - Agility modifier
 * - Class-based initiative dice (warriors use different dice by level)
 * - Two-weapon fighting bonus (halflings)
 */
import { computeBonuses } from "../types/bonuses.js";
import { evaluateRoll } from "../dice/roll.js";
// =============================================================================
// Initiative Die by Class
// =============================================================================
/**
 * Warrior initiative die progression by level
 * Warriors roll higher dice as they level up
 */
export const WARRIOR_INITIATIVE_DIE = {
    1: "d16",
    2: "d16",
    3: "d16",
    4: "d16",
    5: "d20",
    6: "d20",
    7: "d20",
    8: "d24",
    9: "d24",
    10: "d24",
};
/**
 * Default initiative die for most classes
 */
export const DEFAULT_INITIATIVE_DIE = "d16";
/**
 * Get initiative die for a class at a level
 *
 * @param classId - Class identifier
 * @param level - Character level
 * @returns Initiative die type
 */
export function getInitiativeDie(classId, level) {
    const lowerClass = classId.toLowerCase();
    // Warriors get better initiative dice
    if (lowerClass === "warrior") {
        return WARRIOR_INITIATIVE_DIE[Math.min(level, 10)] ?? "d16";
    }
    // Dwarves also use warrior-style initiative
    if (lowerClass === "dwarf") {
        return WARRIOR_INITIATIVE_DIE[Math.min(level, 10)] ?? "d16";
    }
    // All other classes use d16
    return DEFAULT_INITIATIVE_DIE;
}
// =============================================================================
// Initiative Roll Functions
// =============================================================================
/**
 * Roll initiative
 *
 * @param input - Initiative input parameters
 * @param roller - Optional custom dice roller
 * @param events - Optional event callbacks
 * @returns Initiative result
 *
 * @example
 * // Standard initiative roll
 * const result = rollInitiative({
 *   initiativeDie: "d16",
 *   agilityModifier: 2,
 * });
 *
 * @example
 * // Halfling with two-weapon fighting
 * const result = rollInitiative({
 *   initiativeDie: "d16",
 *   agilityModifier: 1,
 *   twoWeaponBonus: 1,
 * });
 *
 * @example
 * // Warrior with improved initiative die
 * const result = rollInitiative({
 *   initiativeDie: "d20",
 *   agilityModifier: 0,
 *   classModifier: 0,
 * });
 */
export function rollInitiative(input, roller, events) {
    // Roll the initiative die
    const formula = `1${input.initiativeDie}`;
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    const roll = evaluateRoll(formula, rollOptions);
    // Build modifiers
    const modifiers = [];
    let total = roll.natural ?? 0;
    // Agility modifier
    if (input.agilityModifier !== 0) {
        modifiers.push({ source: "Agility", value: input.agilityModifier });
        total += input.agilityModifier;
    }
    // Class modifier (if any)
    if (input.classModifier !== undefined && input.classModifier !== 0) {
        modifiers.push({ source: "class", value: input.classModifier });
        total += input.classModifier;
    }
    // Two-weapon fighting bonus
    if (input.twoWeaponBonus !== undefined && input.twoWeaponBonus !== 0) {
        modifiers.push({ source: "two-weapon", value: input.twoWeaponBonus });
        total += input.twoWeaponBonus;
    }
    // Additional bonuses
    if (input.bonuses !== undefined && input.bonuses.length > 0) {
        const computed = computeBonuses(input.bonuses);
        if (computed.totalModifier !== 0) {
            modifiers.push({ source: "bonuses", value: computed.totalModifier });
            total += computed.totalModifier;
        }
    }
    const result = {
        roll: {
            ...roll,
            modifiers,
        },
        total,
        modifiers,
    };
    events?.onInitiativeRoll?.(result);
    return result;
}
/**
 * Calculate total initiative modifier
 *
 * @param agilityModifier - Agility modifier
 * @param classModifier - Class-based modifier (if any)
 * @param twoWeaponBonus - Two-weapon fighting bonus (if any)
 * @param bonuses - Additional bonuses
 * @returns Total initiative modifier
 */
export function calculateInitiativeModifier(agilityModifier, classModifier, twoWeaponBonus, bonuses = []) {
    let total = agilityModifier;
    if (classModifier !== undefined) {
        total += classModifier;
    }
    if (twoWeaponBonus !== undefined) {
        total += twoWeaponBonus;
    }
    const computed = computeBonuses(bonuses);
    total += computed.totalModifier;
    return total;
}
/**
 * Build initiative formula string for display
 *
 * @param initiativeDie - Initiative die type
 * @param agilityModifier - Agility modifier
 * @param otherModifiers - Other modifiers
 * @returns Formatted initiative formula
 */
export function buildInitiativeFormula(initiativeDie, agilityModifier, otherModifiers = 0) {
    let formula = `1${initiativeDie}`;
    const totalMod = agilityModifier + otherModifiers;
    if (totalMod > 0) {
        formula += `+${String(totalMod)}`;
    }
    else if (totalMod < 0) {
        formula += String(totalMod);
    }
    return formula;
}
/**
 * Sort combatants by initiative (highest first)
 *
 * @param initiatives - Array of initiative results with identifiers
 * @returns Sorted array (highest initiative first)
 */
export function sortByInitiative(combatants) {
    return [...combatants].sort((a, b) => b.initiative - a.initiative);
}
/**
 * Check for tied initiatives
 *
 * @param a - First initiative result
 * @param b - Second initiative result
 * @returns True if the initiatives are tied
 */
export function isInitiativeTied(a, b) {
    return a.total === b.total;
}
/**
 * Get two-weapon initiative bonus
 *
 * Halflings get +1 to initiative when fighting with two weapons.
 *
 * @param isHalfling - Whether the character is a halfling
 * @param isTwoWeaponFighting - Whether fighting with two weapons
 * @returns Initiative bonus
 */
export function getTwoWeaponInitiativeBonus(isHalfling, isTwoWeaponFighting) {
    if (isHalfling && isTwoWeaponFighting) {
        return 1;
    }
    return 0;
}
//# sourceMappingURL=initiative.js.map