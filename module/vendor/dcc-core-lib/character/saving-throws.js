/**
 * Saving Throw Calculation System
 *
 * Functions for calculating saving throws based on class, level, and abilities.
 * Saves are computed as: class bonus + ability modifier
 *
 * - Reflex = class ref bonus + Agility modifier
 * - Fortitude = class frt bonus + Stamina modifier
 * - Will = class wil bonus + Personality modifier
 *
 * @example
 * ```typescript
 * // Calculate saves for a character
 * const saves = calculateSavingThrows(character);
 *
 * // Get individual save
 * const reflexSave = calculateReflexSave(character);
 * ```
 */
import { getAbilityModifier } from "../data/ability-modifiers.js";
import { getSavingThrows as getClassSaves } from "../data/classes/progression-utils.js";
// =============================================================================
// Main Calculation Functions
// =============================================================================
/**
 * Calculate all saving throws for a character
 *
 * @param character - Character to calculate saves for
 * @returns All three saving throw values
 *
 * @example
 * ```typescript
 * const saves = calculateSavingThrows(character);
 * console.log(saves.reflex, saves.fortitude, saves.will);
 * ```
 */
export function calculateSavingThrows(character) {
    const input = characterToSaveInput(character);
    return calculateSavesFromInput(input);
}
/**
 * Calculate saving throws from raw input
 *
 * @param input - Save calculation input
 * @returns All three saving throw values
 */
export function calculateSavesFromInput(input) {
    const classBonuses = getClassBonuses(input.classId, input.level);
    const abilityMods = getAbilityModifiers(input.abilities);
    return {
        reflex: classBonuses.reflex + abilityMods.agl,
        fortitude: classBonuses.fortitude + abilityMods.sta,
        will: classBonuses.will + abilityMods.per,
    };
}
/**
 * Calculate saving throws with detailed breakdown
 *
 * @param character - Character to calculate saves for
 * @returns Breakdown of each save's components
 *
 * @example
 * ```typescript
 * const breakdown = calculateSavingThrowsWithBreakdown(character);
 * console.log(`Reflex: ${breakdown.reflex.classBonus} + ${breakdown.reflex.abilityModifier}`);
 * ```
 */
export function calculateSavingThrowsWithBreakdown(character) {
    const input = characterToSaveInput(character);
    const classBonuses = getClassBonuses(input.classId, input.level);
    const abilityMods = getAbilityModifiers(input.abilities);
    return {
        reflex: {
            total: classBonuses.reflex + abilityMods.agl,
            classBonus: classBonuses.reflex,
            abilityModifier: abilityMods.agl,
            ability: "agl",
        },
        fortitude: {
            total: classBonuses.fortitude + abilityMods.sta,
            classBonus: classBonuses.fortitude,
            abilityModifier: abilityMods.sta,
            ability: "sta",
        },
        will: {
            total: classBonuses.will + abilityMods.per,
            classBonus: classBonuses.will,
            abilityModifier: abilityMods.per,
            ability: "per",
        },
    };
}
// =============================================================================
// Individual Save Functions
// =============================================================================
/**
 * Calculate Reflex save (Agility-based)
 */
export function calculateReflexSave(character) {
    const input = characterToSaveInput(character);
    const classBonuses = getClassBonuses(input.classId, input.level);
    const aglMod = getAbilityModifier(input.abilities.agl.current);
    return classBonuses.reflex + aglMod;
}
/**
 * Calculate Fortitude save (Stamina-based)
 */
export function calculateFortitudeSave(character) {
    const input = characterToSaveInput(character);
    const classBonuses = getClassBonuses(input.classId, input.level);
    const staMod = getAbilityModifier(input.abilities.sta.current);
    return classBonuses.fortitude + staMod;
}
/**
 * Calculate Will save (Personality-based)
 */
export function calculateWillSave(character) {
    const input = characterToSaveInput(character);
    const classBonuses = getClassBonuses(input.classId, input.level);
    const perMod = getAbilityModifier(input.abilities.per.current);
    return classBonuses.will + perMod;
}
// =============================================================================
// Update Functions
// =============================================================================
/**
 * Recalculate and update a character's saving throws
 *
 * Returns a new character with updated save values.
 * Use this after abilities change (spellburn, curse, etc.)
 *
 * @param character - Character to update
 * @returns New character with recalculated saves
 */
export function recalculateSavingThrows(character) {
    const newSaves = calculateSavingThrows(character);
    return {
        ...character,
        state: {
            ...character.state,
            saves: newSaves,
        },
    };
}
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Convert character to save calculation input
 */
function characterToSaveInput(character) {
    return {
        classId: character.classInfo?.classId,
        level: character.classInfo?.level ?? 0,
        abilities: character.state.abilities,
    };
}
/**
 * Get class save bonuses (or 0 for 0-level)
 */
function getClassBonuses(classId, level) {
    if (!classId || level === 0) {
        return { reflex: 0, fortitude: 0, will: 0 };
    }
    const classSaves = getClassSaves(classId, level);
    return {
        reflex: classSaves.reflex,
        fortitude: classSaves.fortitude,
        will: classSaves.will,
    };
}
/**
 * Get ability modifiers for all save-relevant abilities
 */
function getAbilityModifiers(abilities) {
    return {
        agl: getAbilityModifier(abilities.agl.current),
        sta: getAbilityModifier(abilities.sta.current),
        per: getAbilityModifier(abilities.per.current),
    };
}
//# sourceMappingURL=saving-throws.js.map