/**
 * Fumble System
 *
 * Handles fumble roll calculations including:
 * - Fumble die determination by armor type
 * - Luck modifier application (lower is worse!)
 * - Fumble table lookups
 */
import { evaluateRoll } from "../dice/roll.js";
// Re-export FUMBLE_DICE from types for convenience
export { FUMBLE_DICE } from "../types/combat.js";
// =============================================================================
// Armor Check Penalties
// =============================================================================
/**
 * Armor check penalty by armor type (DCC core rules Table 3-3)
 * This penalty applies to certain skill checks.
 */
export const ARMOR_CHECK_PENALTY = {
    unarmored: 0,
    padded: 0,
    leather: -1,
    "studded-leather": -2,
    hide: -3,
    scale: -4,
    chainmail: -5,
    banded: -6,
    "half-plate": -7,
    "full-plate": -8,
};
/**
 * Speed reduction by armor type, in feet (DCC core rules Table 3-3).
 */
export const ARMOR_SPEED_PENALTY = {
    unarmored: 0,
    padded: 0,
    leather: 0,
    "studded-leather": 0,
    hide: 0,
    scale: -5,
    chainmail: -5,
    banded: -5,
    "half-plate": -10,
    "full-plate": -10,
};
// =============================================================================
// Fumble Die Functions
// =============================================================================
/**
 * Get the fumble die for an armor type
 *
 * @param armorType - Type of armor worn
 * @returns Fumble die type
 */
export function getFumbleDie(armorType) {
    const FUMBLE_DICE_MAP = {
        unarmored: "d4",
        padded: "d8",
        leather: "d8",
        "studded-leather": "d8",
        hide: "d12",
        scale: "d12",
        chainmail: "d12",
        banded: "d16",
        "half-plate": "d16",
        "full-plate": "d16",
    };
    return FUMBLE_DICE_MAP[armorType];
}
/**
 * Get armor type from armor name
 *
 * @param armorName - Name of the armor
 * @returns Armor type, defaulting to unarmored
 */
export function getArmorType(armorName) {
    const lower = armorName.toLowerCase();
    if (lower.includes("full plate") || lower.includes("plate mail")) {
        return "full-plate";
    }
    if (lower.includes("half-plate") || lower.includes("half plate")) {
        return "half-plate";
    }
    if (lower.includes("banded")) {
        return "banded";
    }
    if (lower.includes("chain") || lower.includes("mail")) {
        return "chainmail";
    }
    if (lower.includes("scale")) {
        return "scale";
    }
    if (lower.includes("hide")) {
        return "hide";
    }
    // "studded" must be checked before "leather" — "studded leather" contains "leather".
    if (lower.includes("studded")) {
        return "studded-leather";
    }
    if (lower.includes("leather")) {
        return "leather";
    }
    if (lower.includes("padded")) {
        return "padded";
    }
    return "unarmored";
}
// =============================================================================
// Fumble Roll Functions
// =============================================================================
/**
 * Roll a fumble
 *
 * In DCC, fumbles use a die based on armor worn. Heavier armor
 * means a larger fumble die, which means worse fumble results.
 * Luck modifier is SUBTRACTED from the roll (lower is better for
 * the fumbler, but the roll itself - lower luck = worse fumbles).
 *
 * Actually, in DCC, luck modifier is subtracted from the fumble roll,
 * meaning HIGHER luck results in LOWER fumble results (which are better).
 *
 * @param input - Fumble input parameters
 * @param roller - Optional custom dice roller
 * @param events - Optional event callbacks
 * @returns Fumble result
 *
 * @example
 * // Fumble in chainmail with good luck
 * const result = rollFumble({
 *   armorType: "chainmail",
 *   luckModifier: 2, // Subtracts from roll, so lower result
 * });
 *
 * @example
 * // Fumble unarmored with bad luck
 * const result = rollFumble({
 *   armorType: "unarmored",
 *   luckModifier: -1, // Adds to roll (since subtracted), so higher result
 * });
 */
export function rollFumble(input, roller, events) {
    // Determine fumble die
    const fumbleDie = input.fumbleDieOverride ?? getFumbleDie(input.armorType);
    // Roll the fumble die
    const formula = `1${fumbleDie}`;
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    const roll = evaluateRoll(formula, rollOptions);
    // Calculate total (subtract luck modifier - positive luck = lower result)
    // Lower results on the fumble table are generally better
    const modifiers = [];
    let total = roll.natural ?? 0;
    if (input.luckModifier !== 0) {
        // Luck is subtracted from fumble rolls
        modifiers.push({ source: "Luck", value: -input.luckModifier });
        total -= input.luckModifier;
    }
    // Minimum fumble result is 0 (no effect)
    total = Math.max(0, total);
    const result = {
        roll: {
            ...roll,
            modifiers,
        },
        total,
        fumbleDie,
    };
    events?.onFumbleResult?.(result);
    return result;
}
/**
 * Calculate fumble modifier (for preview)
 *
 * @param luckModifier - Luck modifier
 * @returns Net modifier to fumble roll (negative luck = positive modifier)
 */
export function calculateFumbleModifier(luckModifier) {
    // Luck is subtracted, so negate it for the modifier
    return -luckModifier;
}
/**
 * Build fumble formula string for display
 *
 * @param fumbleDie - Fumble die type
 * @param luckModifier - Luck modifier
 * @returns Formatted fumble formula
 */
export function buildFumbleFormula(fumbleDie, luckModifier) {
    let formula = `1${fumbleDie}`;
    // Luck is subtracted
    if (luckModifier > 0) {
        formula += `-${String(luckModifier)}`;
    }
    else if (luckModifier < 0) {
        formula += `+${String(-luckModifier)}`;
    }
    return formula;
}
/**
 * Check if a natural roll is a fumble
 *
 * @param naturalRoll - The natural die result
 * @returns True if the roll is a fumble (natural 1)
 */
export function isFumble(naturalRoll) {
    return naturalRoll === 1;
}
/**
 * Get armor check penalty for an armor type
 *
 * @param armorType - Type of armor
 * @returns Check penalty (negative number)
 */
export function getArmorCheckPenalty(armorType) {
    return ARMOR_CHECK_PENALTY[armorType];
}
/**
 * Get speed penalty for an armor type
 *
 * @param armorType - Type of armor
 * @returns Speed reduction in feet
 */
export function getArmorSpeedPenalty(armorType) {
    return ARMOR_SPEED_PENALTY[armorType];
}
//# sourceMappingURL=fumbles.js.map