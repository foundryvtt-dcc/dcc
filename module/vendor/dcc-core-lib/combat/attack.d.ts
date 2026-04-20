/**
 * Attack Roll System
 *
 * Handles attack roll calculations including:
 * - Melee and missile attacks
 * - Deed die for warriors/dwarves
 * - Critical threat detection
 * - Fumble detection
 * - Bonus aggregation from multiple sources
 */
import type { DiceRoller } from "../types/dice.js";
import type { AttackInput, AttackResult, CombatEvents, TwoWeaponDiceConfig, TwoWeaponAttackInput, TwoWeaponAttackResult } from "../types/combat.js";
import type { RollBonus } from "../types/bonuses.js";
/**
 * Make an attack roll
 *
 * @param input - Attack input parameters
 * @param roller - Optional custom dice roller
 * @param events - Optional event callbacks
 * @returns Attack result
 *
 * @example
 * // Simple melee attack
 * const result = makeAttackRoll({
 *   attackType: "melee",
 *   attackBonus: 2,
 *   actionDie: "d20",
 *   threatRange: 20,
 *   abilityModifier: 2, // STR
 * });
 *
 * @example
 * // Warrior attack with deed die
 * const result = makeAttackRoll({
 *   attackType: "melee",
 *   attackBonus: 3,
 *   actionDie: "d20",
 *   threatRange: 19,
 *   abilityModifier: 3,
 *   deedDie: "d4",
 *   targetAC: 15,
 * });
 *
 * @example
 * // Thief backstab: caller precomputes the Table 1-9 bonus and passes
 * // it via `bonuses` (a full `RollBonus`, not the legacy shape);
 * // `isBackstab: true` only drives the auto-crit.
 * const backstabBonus = getBackstabAttackBonus(progression, 3, "chaotic"); // +7
 * const result = makeAttackRoll({
 *   attackType: "melee",
 *   attackBonus: 2,
 *   actionDie: "d20",
 *   threatRange: 20,
 *   abilityModifier: 1,
 *   targetAC: 13,
 *   isBackstab: true,
 *   bonuses: [{
 *     id: "class:backstab",
 *     label: "Backstab (Table 1-9)",
 *     source: { type: "class", id: "thief" },
 *     category: "inherent",
 *     effect: { type: "modifier", value: backstabBonus },
 *   }],
 * });
 */
export declare function makeAttackRoll(input: AttackInput, roller?: DiceRoller, events?: CombatEvents): AttackResult;
/**
 * Calculate attack bonus from character data
 *
 * @param baseAttackBonus - Class/level attack bonus
 * @param abilityModifier - Relevant ability modifier
 * @param bonuses - Additional bonuses
 * @returns Total attack bonus
 */
export declare function calculateAttackBonus(baseAttackBonus: number, abilityModifier: number, bonuses?: RollBonus[]): number;
/**
 * Check if an attack hits a target
 *
 * Note: Only natural max (20 on d20, 24 on d24) is an automatic hit.
 * Rolls in the threat range that don't beat AC do NOT hit.
 *
 * @param attackTotal - Total attack roll result
 * @param targetAC - Target's armor class
 * @param isNaturalOne - Whether the roll was a natural 1 (auto-miss)
 * @param isNaturalMax - Whether the roll was the die's maximum value (auto-hit)
 * @returns Whether the attack hits
 */
export declare function doesAttackHit(attackTotal: number, targetAC: number, isNaturalOne: boolean, isNaturalMax: boolean): boolean;
/**
 * Get the attack ability for an attack type
 *
 * @param attackType - Type of attack
 * @returns The ability ID to use
 */
export declare function getAttackAbility(attackType: "melee" | "missile" | "special"): "str" | "agl";
/**
 * Compute the two-weapon-fighting dice configuration for a given Agility
 * (Table 4-3, with halfling class overrides applied when `isHalfling`).
 *
 * Halflings use an effective Agility of `max(agility, 16)` for row
 * lookup; if their natural Agility is ≥18, the normal 18+ row applies.
 * Halflings also gain auto-crit/auto-hit on a natural max of the
 * reduced die (replacing the 16-17 "no auto-hit" rule), and only fumble
 * when both hands roll a natural 1.
 */
export declare function getTwoWeaponDice(agility: number, options?: {
    isHalfling?: boolean | undefined;
}): TwoWeaponDiceConfig;
/**
 * Roll a full two-weapon attack round (both hands).
 *
 * Computes each hand's reduced action die from `baseActionDie` per
 * Table 4-3, clamps any improved threat range to 20 (warriors lose
 * their improved threat range when two-weapon fighting), then rolls
 * each hand and applies the two-weapon-specific overrides:
 *  - non-crittable rows strip any threatened crit;
 *  - the Agl-16-17 row (non-halfling) requires the natural max to
 *    actually beat AC to count as a hit/crit (no auto-hit);
 *  - the halfling 16-17 override restores auto-hit + auto-crit on
 *    the reduced die's natural max for either hand;
 *  - the halfling fumble rule clears `isFumble` unless both hands
 *    rolled a natural 1.
 *
 * Combat events (`onAttackRoll`, `onCriticalThreat`, `onFumbleRoll`,
 * `onDeedAttempt`) are emitted for each hand AFTER overrides are
 * applied, so listeners observe the post-RAW state.
 */
export declare function rollTwoWeaponAttack(input: TwoWeaponAttackInput, roller?: DiceRoller, events?: CombatEvents): TwoWeaponAttackResult;
/**
 * Check if a deed die roll is successful
 *
 * A deed is successful if the deed die shows 3 or higher.
 *
 * @param deedRoll - The deed die roll result
 * @returns Whether the deed succeeded
 */
export declare function isDeedSuccessful(deedRoll: number): boolean;
//# sourceMappingURL=attack.d.ts.map