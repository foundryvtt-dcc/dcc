/**
 * Damage Calculation System
 *
 * Handles damage roll calculations including:
 * - Base weapon damage
 * - Strength modifier
 * - Deed die bonus damage (warriors/dwarves)
 * - Magic weapon bonuses
 */
import { computeBonuses } from "../types/bonuses.js";
import { evaluateRoll } from "../dice/roll.js";
// =============================================================================
// Damage Roll Functions
// =============================================================================
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
export function rollDamage(input, roller, events) {
    const diceCount = input.diceCount ?? 1;
    // Roll the base damage
    const formula = `${String(diceCount)}${input.damageDie}`;
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    const roll = evaluateRoll(formula, rollOptions);
    const baseDamage = roll.natural ?? 0;
    // Build breakdown
    const breakdown = [
        { source: "weapon", amount: baseDamage },
    ];
    // Calculate modifier damage
    let modifierDamage = 0;
    // Strength modifier
    if (input.strengthModifier !== 0) {
        modifierDamage += input.strengthModifier;
        breakdown.push({ source: "Strength", amount: input.strengthModifier });
    }
    // Deed die result (added to damage for warriors)
    if (input.deedDieResult !== undefined && input.deedDieResult > 0) {
        modifierDamage += input.deedDieResult;
        breakdown.push({ source: "deed", amount: input.deedDieResult });
    }
    // Magic bonus
    if (input.magicBonus !== undefined && input.magicBonus > 0) {
        modifierDamage += input.magicBonus;
        breakdown.push({ source: "magic", amount: input.magicBonus });
    }
    // Compute additional bonuses
    if (input.bonuses !== undefined && input.bonuses.length > 0) {
        const computed = computeBonuses(input.bonuses);
        if (computed.totalModifier !== 0) {
            modifierDamage += computed.totalModifier;
            breakdown.push({ source: "bonuses", amount: computed.totalModifier });
        }
    }
    const total = Math.max(1, baseDamage + modifierDamage); // Minimum 1 damage
    const result = {
        roll,
        baseDamage,
        modifierDamage,
        total,
        breakdown,
    };
    events?.onDamageRoll?.(result);
    return result;
}
/**
 * Calculate damage modifier from all sources
 *
 * @param strengthModifier - Strength modifier
 * @param deedDieResult - Deed die result (if applicable)
 * @param magicBonus - Magic weapon bonus
 * @param bonuses - Additional bonuses
 * @returns Total damage modifier
 */
export function calculateDamageModifier(strengthModifier, deedDieResult, magicBonus, bonuses = []) {
    let total = strengthModifier;
    if (deedDieResult !== undefined) {
        total += deedDieResult;
    }
    if (magicBonus !== undefined) {
        total += magicBonus;
    }
    const computed = computeBonuses(bonuses);
    total += computed.totalModifier;
    return total;
}
/**
 * Select the damage die and dice count to roll for a weapon attack,
 * substituting `weapon.backstabDamage` when `isBackstab` is true
 * (DCC Table 3-1 footnote). The caller is responsible for gating the
 * thief-class requirement via `canBackstab(...)` before setting the flag.
 */
export function getWeaponDamage(weapon, isBackstab) {
    if (isBackstab && weapon.backstabDamage) {
        return {
            damageDie: weapon.backstabDamage.damageDie,
            diceCount: weapon.backstabDamage.diceCount ?? 1,
        };
    }
    return {
        damageDie: weapon.damageDie,
        diceCount: weapon.diceCount ?? 1,
    };
}
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
export function getTwoHandedDamageDie(baseDamageDie, twoHandedDamageDie, isTwoHanding) {
    if (isTwoHanding && twoHandedDamageDie !== undefined) {
        return twoHandedDamageDie;
    }
    return baseDamageDie;
}
/**
 * Build damage formula string for display
 *
 * @param damageDie - Base damage die
 * @param diceCount - Number of dice
 * @param modifiers - Modifiers to include
 * @returns Formatted damage string
 */
export function buildDamageFormula(damageDie, diceCount, modifiers) {
    let formula = `${String(diceCount)}${damageDie}`;
    const totalMod = modifiers.reduce((sum, m) => sum + m.value, 0);
    if (totalMod > 0) {
        formula += `+${String(totalMod)}`;
    }
    else if (totalMod < 0) {
        formula += String(totalMod);
    }
    return formula;
}
/**
 * Calculate minimum damage
 *
 * In DCC, damage is typically minimum 1 (you can't heal by attacking).
 *
 * @param damageTotal - Calculated damage total
 * @returns Damage, minimum 1
 */
export function applyMinimumDamage(damageTotal) {
    return Math.max(1, damageTotal);
}
//# sourceMappingURL=damage.js.map