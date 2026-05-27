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
import type { DieType } from "../types/dice.js";
import type { ArmorType, ArmorStats, ShieldStats } from "../types/combat.js";
export { BASE_AC, ARMOR_AC_BONUS, SHIELD_AC_BONUS } from "../types/combat.js";
/**
 * Simple AC bonus for spell effects, magic items, etc.
 *
 * This is a simplified type compared to RollBonus since AC
 * bonuses are always flat modifiers.
 */
export interface ACBonus {
    /** Numeric value to add to AC */
    value: number;
    /** Source information for display */
    source?: {
        /** Source name (e.g., "Mage Armor", "Ring of Protection") */
        name: string;
        /** Optional category (for UI grouping) */
        category?: string;
    };
}
/**
 * Input for calculating armor class
 */
export interface ACInput {
    /** Agility modifier */
    agilityModifier: number;
    /** Equipped armor (optional - unarmored if not provided) */
    armor?: ArmorStats | undefined;
    /** Equipped shield (optional) */
    shield?: ShieldStats | undefined;
    /** Additional bonuses (spells, magic items, etc.) */
    bonuses?: ACBonus[] | undefined;
}
/**
 * Result of AC calculation with breakdown
 */
export interface ACResult {
    /** Final AC value */
    total: number;
    /** Base AC (10) */
    base: number;
    /** Agility modifier contribution */
    agilityBonus: number;
    /** Armor contribution (if any) */
    armorBonus: number;
    /** Shield contribution (if any) */
    shieldBonus: number;
    /** Other bonuses (magic, spells, etc.) */
    otherBonuses: number;
    /** Breakdown of all components */
    breakdown: ACBreakdown[];
}
/**
 * Single component of AC calculation
 */
export interface ACBreakdown {
    /** Source of the bonus */
    source: string;
    /** Value contributed */
    value: number;
}
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
export declare function calculateAC(input: ACInput): ACResult;
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
export declare function calculateSimpleAC(agilityModifier: number, armorType?: ArmorType, hasShield?: boolean): number;
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
export declare function createArmorStats(type: ArmorType, name?: string): ArmorStats;
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
export declare function createMagicArmorStats(type: ArmorType, magicBonus: number, name?: string): ArmorStats;
/**
 * Create shield stats
 *
 * @param name - Shield name
 * @param magicBonus - Optional magic bonus
 * @returns ShieldStats
 */
export declare function createShieldStats(name?: string, magicBonus?: number): ShieldStats;
/**
 * Get AC bonus for armor type
 *
 * @param type - Armor type
 * @returns AC bonus
 */
export declare function getArmorACBonus(type: ArmorType): number;
/**
 * Get all armor stats for an armor type
 *
 * @param type - Armor type
 * @returns Object with all armor-related values
 */
export declare function getArmorDetails(type: ArmorType): {
    acBonus: number;
    checkPenalty: number;
    speedPenalty: number;
    fumbleDie: DieType;
};
/**
 * List all armor types with their stats
 */
export declare function getAllArmorStats(): {
    type: ArmorType;
    name: string;
    acBonus: number;
    checkPenalty: number;
    speedPenalty: number;
    fumbleDie: DieType;
}[];
//# sourceMappingURL=armor-class.d.ts.map