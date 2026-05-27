/**
 * Damage Calculation System
 *
 * Handles damage roll calculations including:
 * - Base weapon damage
 * - Strength modifier
 * - Deed die bonus damage (warriors/dwarves)
 * - Magic weapon bonuses
 */
import type { DieType, LegacyRollModifier, DiceRoller } from "../types/dice.js";
import type { DamageInput, DamageResult, CombatEvents, WeaponStats } from "../types/combat.js";
import type { RollBonus } from "../types/bonuses.js";
/**
 * Roll weapon damage
 *
 * @param input - Damage input parameters
 * @param roller - Optional custom dice roller
 * @param events - Optional event callbacks
 * @returns Damage result
 *
 * @example
 * // Simple damage roll
 * const result = rollDamage({
 *   damageDie: "d8",
 *   strengthModifier: 2,
 * });
 *
 * @example
 * // Warrior damage with deed die
 * const result = rollDamage({
 *   damageDie: "d8",
 *   strengthModifier: 3,
 *   deedDieResult: 4,
 *   magicBonus: 1,
 * });
 */
export declare function rollDamage(input: DamageInput, roller?: DiceRoller, events?: CombatEvents): DamageResult;
/**
 * Calculate damage modifier from all sources
 *
 * @param strengthModifier - Strength modifier
 * @param deedDieResult - Deed die result (if applicable)
 * @param magicBonus - Magic weapon bonus
 * @param bonuses - Additional bonuses
 * @returns Total damage modifier
 */
export declare function calculateDamageModifier(strengthModifier: number, deedDieResult?: number, magicBonus?: number, bonuses?: RollBonus[]): number;
/**
 * Select the damage die and dice count to roll for a weapon attack,
 * substituting `weapon.backstabDamage` when `isBackstab` is true
 * (DCC Table 3-1 footnote). The caller is responsible for gating the
 * thief-class requirement via `canBackstab(...)` before setting the flag.
 */
export declare function getWeaponDamage(weapon: WeaponStats, isBackstab: boolean): {
    damageDie: DieType;
    diceCount: number;
};
/**
 * Calculate two-handed weapon damage bonus
 *
 * Some weapons deal extra damage when wielded two-handed.
 * In DCC, this is typically built into the weapon's damage die
 * (e.g., two-handed sword is d10 vs longsword d8).
 *
 * @param baseDamageDie - Normal damage die
 * @param twoHandedDamageDie - Two-handed damage die (if different)
 * @param isTwoHanding - Whether wielding two-handed
 * @returns Damage die to use
 */
export declare function getTwoHandedDamageDie(baseDamageDie: DieType, twoHandedDamageDie: DieType | undefined, isTwoHanding: boolean): DieType;
/**
 * Build damage formula string for display
 *
 * @param damageDie - Base damage die
 * @param diceCount - Number of dice
 * @param modifiers - Modifiers to include
 * @returns Formatted damage string
 */
export declare function buildDamageFormula(damageDie: DieType, diceCount: number, modifiers: LegacyRollModifier[]): string;
/**
 * Calculate minimum damage
 *
 * In DCC, damage is typically minimum 1 (you can't heal by attacking).
 *
 * @param damageTotal - Calculated damage total
 * @returns Damage, minimum 1
 */
export declare function applyMinimumDamage(damageTotal: number): number;
//# sourceMappingURL=damage.d.ts.map