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
import { computeBonuses } from "../types/bonuses.js";
import { evaluateRoll, meetsThreatRange, isNatural1, isAutoHit } from "../dice/roll.js";
// =============================================================================
// Attack Roll Functions
// =============================================================================
/**
 * Build modifiers list from attack input
 */
function buildAttackModifiers(input, computedBonuses) {
    const modifiers = [];
    // Base attack bonus
    if (input.attackBonus !== 0) {
        modifiers.push({
            source: "attack bonus",
            value: input.attackBonus,
        });
    }
    // Ability modifier
    if (input.abilityModifier !== 0) {
        modifiers.push({
            source: input.attackType === "melee" ? "Strength" : "Agility",
            value: input.abilityModifier,
        });
    }
    // Two-weapon fighting penalty
    if (input.twoWeaponPenalty !== undefined && input.twoWeaponPenalty !== 0) {
        modifiers.push({
            source: "two-weapon fighting",
            value: input.twoWeaponPenalty,
        });
    }
    // Bonuses from equipment, spells, luck, etc.
    if (computedBonuses.totalModifier !== 0) {
        modifiers.push({
            source: "bonuses",
            value: computedBonuses.totalModifier,
        });
    }
    return modifiers;
}
/**
 * Calculate total attack modifier
 */
function calculateTotalBonus(input, computedBonuses) {
    let total = input.attackBonus + input.abilityModifier;
    // Two-weapon penalty
    if (input.twoWeaponPenalty !== undefined) {
        total += input.twoWeaponPenalty;
    }
    // Computed bonuses
    total += computedBonuses.totalModifier;
    return total;
}
/**
 * Roll a deed die for warriors/dwarves
 */
function rollDeedDie(deedDie, roller) {
    const formula = `1${deedDie}`;
    const options = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    return evaluateRoll(formula, options);
}
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
export function makeAttackRoll(input, roller, events) {
    // Compute bonuses
    const bonusCondition = input.attackType === "melee" ? "melee-attack" : "missile-attack";
    const computedBonuses = computeBonuses(input.bonuses ?? [], bonusCondition);
    // Build modifiers for display
    const appliedModifiers = buildAttackModifiers(input, computedBonuses);
    // Calculate total bonus
    const totalBonus = calculateTotalBonus(input, computedBonuses);
    // Roll the attack
    const formula = `1${input.actionDie}`;
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    const roll = evaluateRoll(formula, rollOptions);
    // Roll deed die if applicable
    let deedRoll;
    let deedSuccess;
    if (input.deedDie !== undefined) {
        deedRoll = rollDeedDie(input.deedDie, roller);
        // Deed is successful if roll is 3+
        deedSuccess = (deedRoll.natural ?? 0) >= 3;
        // Add deed die result to modifiers
        if (deedRoll.natural !== undefined) {
            appliedModifiers.push({
                source: "deed die",
                value: deedRoll.natural,
            });
        }
    }
    // Calculate total
    const deedValue = deedRoll?.natural ?? 0;
    const total = (roll.total ?? 0) + totalBonus + deedValue;
    // Check for fumble (natural 1)
    const isFumble = isNatural1(roll);
    // Check if roll is in threat range (but this alone doesn't mean crit!)
    const meetsRange = meetsThreatRange(roll, input.threatRange);
    // Check for automatic hit (natural max on die - e.g., 20 on d20, 24 on d24)
    const autoHit = isAutoHit(roll);
    // Determine hit (if AC provided)
    // Per DCC rules: only natural max is auto-hit, NOT threat range
    // A warrior with 19-20 threat range rolling 19 that doesn't beat AC misses
    let isHit;
    if (input.targetAC !== undefined) {
        if (isFumble) {
            // Natural 1 always misses
            isHit = false;
        }
        else if (autoHit) {
            // Natural max (20 on d20, 24 on d24) always hits
            isHit = true;
        }
        else {
            // Otherwise compare total to AC
            isHit = total >= input.targetAC;
        }
    }
    // Critical threat requires both a roll in the threat range AND a
    // hit — a threat-range roll that misses is NOT a crit. A backstab
    // hit auto-crits regardless of the natural roll (DCC core rules).
    // A natural 1 is always a fumble and can never be a backstab crit,
    // even when targetAC is omitted (isHit === undefined).
    const isHitting = isHit === undefined || isHit;
    const backstabAutoCrit = input.isBackstab === true && isHitting && !isFumble;
    const threatRangeCrit = meetsRange && isHitting;
    const isCriticalThreat = threatRangeCrit || backstabAutoCrit;
    // Determine which cause fired. Threat-range wins if both are true
    // (the attacker would roll on their class's normal crit table in
    // that case; backstab-auto only applies when a threat didn't
    // otherwise occur, and downstream selects Crit Table II).
    let critSource;
    if (threatRangeCrit) {
        critSource = autoHit ? "natural-max" : "threat-range";
    }
    else if (backstabAutoCrit) {
        critSource = "backstab-auto";
    }
    const result = {
        roll,
        deedRoll,
        totalBonus: totalBonus + deedValue,
        total,
        isCriticalThreat,
        critSource,
        isFumble,
        isHit,
        appliedModifiers,
        deedSuccess,
    };
    // Emit events
    events?.onAttackRoll?.(result);
    if (isCriticalThreat) {
        events?.onCriticalThreat?.(result);
    }
    if (isFumble) {
        events?.onFumbleRoll?.(result);
    }
    if (deedRoll !== undefined && deedSuccess !== undefined) {
        events?.onDeedAttempt?.(deedRoll, deedSuccess);
    }
    return result;
}
/**
 * Calculate attack bonus from character data
 *
 * @param baseAttackBonus - Class/level attack bonus
 * @param abilityModifier - Relevant ability modifier
 * @param bonuses - Additional bonuses
 * @returns Total attack bonus
 */
export function calculateAttackBonus(baseAttackBonus, abilityModifier, bonuses = []) {
    const computed = computeBonuses(bonuses);
    return baseAttackBonus + abilityModifier + computed.totalModifier;
}
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
export function doesAttackHit(attackTotal, targetAC, isNaturalOne, isNaturalMax) {
    // Natural 1 always misses
    if (isNaturalOne) {
        return false;
    }
    // Natural max (20 on d20, 24 on d24) always hits
    if (isNaturalMax) {
        return true;
    }
    // Otherwise compare to AC
    return attackTotal >= targetAC;
}
/**
 * Get the attack ability for an attack type
 *
 * @param attackType - Type of attack
 * @returns The ability ID to use
 */
export function getAttackAbility(attackType) {
    return attackType === "missile" ? "agl" : "str";
}
/**
 * Calculate two-weapon fighting penalty
 *
 * In DCC, two-weapon fighting typically has a -2 penalty to each attack,
 * except for halflings who have a reduced penalty.
 *
 * @param isHalfling - Whether the attacker is a halfling
 * @returns The attack penalty
 */
export function getTwoWeaponPenalty(isHalfling) {
    return isHalfling ? -1 : -2;
}
/**
 * Check if a deed die roll is successful
 *
 * A deed is successful if the deed die shows 3 or higher.
 *
 * @param deedRoll - The deed die roll result
 * @returns Whether the deed succeeded
 */
export function isDeedSuccessful(deedRoll) {
    return deedRoll >= 3;
}
//# sourceMappingURL=attack.js.map