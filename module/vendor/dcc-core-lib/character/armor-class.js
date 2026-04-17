/**
 * Armor Class Calculations
 *
 * Functions for calculating armor class in DCC:
 * - Base AC (10)
 * - Agility modifier
 * - Armor bonus
 * - Shield bonus
 * - Magic item bonuses
 * - Other situational bonuses
 */
import { BASE_AC, ARMOR_AC_BONUS, SHIELD_AC_BONUS, FUMBLE_DICE, } from "../types/combat.js";
import { ARMOR_CHECK_PENALTY, ARMOR_SPEED_PENALTY, } from "../combat/fumbles.js";
// Re-export constants for convenience
export { BASE_AC, ARMOR_AC_BONUS, SHIELD_AC_BONUS } from "../types/combat.js";
// =============================================================================
// AC Calculation Functions
// =============================================================================
/**
 * Calculate total armor class
 *
 * AC = Base (10) + Agility Mod + Armor Bonus + Shield Bonus + Other Bonuses
 *
 * @param input - AC calculation input
 * @returns AC result with breakdown
 *
 * @example
 * // Unarmored with good agility
 * const ac = calculateAC({ agilityModifier: 2 });
 * // ac.total = 12 (10 + 2)
 *
 * @example
 * // Chainmail and shield with average agility
 * const ac = calculateAC({
 *   agilityModifier: 0,
 *   armor: createArmorStats("chainmail"),
 *   shield: { name: "Shield", acBonus: 1 },
 * });
 * // ac.total = 16 (10 + 0 + 5 + 1)
 *
 * @example
 * // Magic armor with penalties
 * const ac = calculateAC({
 *   agilityModifier: -1,
 *   armor: {
 *     ...createArmorStats("leather"),
 *     magicBonus: 2, // +2 leather armor
 *   },
 * });
 * // ac.total = 13 (10 - 1 + 2 + 2)
 */
export function calculateAC(input) {
    const breakdown = [];
    // Base AC
    breakdown.push({ source: "Base", value: BASE_AC });
    // Agility modifier
    if (input.agilityModifier !== 0) {
        breakdown.push({ source: "Agility", value: input.agilityModifier });
    }
    // Armor bonus
    let armorBonus = 0;
    if (input.armor) {
        armorBonus = input.armor.acBonus;
        breakdown.push({ source: input.armor.name, value: armorBonus });
        // Magic armor bonus
        if (input.armor.magicBonus !== undefined && input.armor.magicBonus > 0) {
            breakdown.push({
                source: `${input.armor.name} (magic)`,
                value: input.armor.magicBonus,
            });
            armorBonus += input.armor.magicBonus;
        }
    }
    // Shield bonus
    let shieldBonus = 0;
    if (input.shield) {
        shieldBonus = input.shield.acBonus;
        breakdown.push({ source: input.shield.name, value: shieldBonus });
        // Magic shield bonus
        if (input.shield.magicBonus !== undefined && input.shield.magicBonus > 0) {
            breakdown.push({
                source: `${input.shield.name} (magic)`,
                value: input.shield.magicBonus,
            });
            shieldBonus += input.shield.magicBonus;
        }
    }
    // Other bonuses (spells, deflection, etc.)
    let otherBonuses = 0;
    if (input.bonuses && input.bonuses.length > 0) {
        for (const bonus of input.bonuses) {
            otherBonuses += bonus.value;
            // Add to breakdown (include zero values for transparency)
            breakdown.push({
                source: bonus.source?.name ?? "Unknown",
                value: bonus.value,
            });
        }
    }
    // Calculate total
    const total = BASE_AC + input.agilityModifier + armorBonus + shieldBonus + otherBonuses;
    return {
        total,
        base: BASE_AC,
        agilityBonus: input.agilityModifier,
        armorBonus,
        shieldBonus,
        otherBonuses,
        breakdown,
    };
}
/**
 * Calculate AC with just the basics (no bonus system)
 *
 * Simple version for quick calculations.
 *
 * @param agilityModifier - Agility modifier
 * @param armorType - Type of armor worn
 * @param hasShield - Whether carrying a shield
 * @returns Total AC
 *
 * @example
 * const ac = calculateSimpleAC(2, "leather", true);
 * // ac = 15 (10 + 2 + 2 + 1)
 */
export function calculateSimpleAC(agilityModifier, armorType = "unarmored", hasShield = false) {
    return (BASE_AC +
        agilityModifier +
        ARMOR_AC_BONUS[armorType] +
        (hasShield ? SHIELD_AC_BONUS : 0));
}
// =============================================================================
// Armor Stats Factory Functions
// =============================================================================
/**
 * Create armor stats from armor type
 *
 * @param type - Armor type
 * @param name - Optional custom name
 * @returns ArmorStats with all derived values
 *
 * @example
 * const chainmail = createArmorStats("chainmail");
 * // Returns: { name: "Chainmail", type: "chainmail", acBonus: 5, ... }
 */
export function createArmorStats(type, name) {
    const defaultName = getArmorDefaultName(type);
    return {
        name: name ?? defaultName,
        type,
        acBonus: ARMOR_AC_BONUS[type],
        checkPenalty: ARMOR_CHECK_PENALTY[type],
        speedPenalty: ARMOR_SPEED_PENALTY[type],
        fumbleDie: FUMBLE_DICE[type],
    };
}
/**
 * Create magic armor stats
 *
 * @param type - Base armor type
 * @param magicBonus - Magic bonus (e.g., +1, +2)
 * @param name - Optional custom name
 * @returns ArmorStats with magic bonus
 *
 * @example
 * const magicChainmail = createMagicArmorStats("chainmail", 2);
 * // +2 chainmail with reduced penalties
 */
export function createMagicArmorStats(type, magicBonus, name) {
    const base = createArmorStats(type, name);
    // Magic armor reduces check penalty (minimum 0)
    const reducedPenalty = Math.min(0, base.checkPenalty + magicBonus);
    return {
        ...base,
        name: name ?? `+${String(magicBonus)} ${base.name}`,
        magicBonus,
        checkPenalty: reducedPenalty,
    };
}
/**
 * Create shield stats
 *
 * @param name - Shield name
 * @param magicBonus - Optional magic bonus
 * @returns ShieldStats
 */
export function createShieldStats(name = "Shield", magicBonus) {
    const shield = {
        name: magicBonus !== undefined ? `+${String(magicBonus)} ${name}` : name,
        acBonus: SHIELD_AC_BONUS,
    };
    if (magicBonus !== undefined) {
        shield.magicBonus = magicBonus;
    }
    return shield;
}
// =============================================================================
// Armor Lookup Helpers
// =============================================================================
/**
 * Get default display name for armor type
 */
function getArmorDefaultName(type) {
    const names = {
        unarmored: "Unarmored",
        padded: "Padded Armor",
        leather: "Leather Armor",
        hide: "Hide Armor",
        scale: "Scale Mail",
        chainmail: "Chainmail",
        banded: "Banded Mail",
        "half-plate": "Half-Plate",
        "full-plate": "Full Plate",
    };
    return names[type];
}
/**
 * Get AC bonus for armor type
 *
 * @param type - Armor type
 * @returns AC bonus
 */
export function getArmorACBonus(type) {
    return ARMOR_AC_BONUS[type];
}
/**
 * Get all armor stats for an armor type
 *
 * @param type - Armor type
 * @returns Object with all armor-related values
 */
export function getArmorDetails(type) {
    return {
        acBonus: ARMOR_AC_BONUS[type],
        checkPenalty: ARMOR_CHECK_PENALTY[type],
        speedPenalty: ARMOR_SPEED_PENALTY[type],
        fumbleDie: FUMBLE_DICE[type],
    };
}
/**
 * List all armor types with their stats
 */
export function getAllArmorStats() {
    const types = [
        "unarmored",
        "padded",
        "leather",
        "hide",
        "scale",
        "chainmail",
        "banded",
        "half-plate",
        "full-plate",
    ];
    return types.map((type) => ({
        type,
        name: getArmorDefaultName(type),
        ...getArmorDetails(type),
    }));
}
//# sourceMappingURL=armor-class.js.map