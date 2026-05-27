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
import { bumpDie, getPrimaryDie } from "./../dice/dice-chain.js";
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
    return input.attackBonus + input.abilityModifier + computedBonuses.totalModifier;
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
 * Compute the two-weapon-fighting dice configuration for a given Agility
 * (Table 4-3, with halfling class overrides applied when `isHalfling`).
 *
 * Halflings use an effective Agility of `max(agility, 16)` for row
 * lookup; if their natural Agility is ≥18, the normal 18+ row applies.
 * Halflings also gain auto-crit/auto-hit on a natural max of the
 * reduced die (replacing the 16-17 "no auto-hit" rule), and only fumble
 * when both hands roll a natural 1.
 */
export function getTwoWeaponDice(agility, options) {
    const isHalfling = options?.isHalfling === true;
    const effectiveAgl = isHalfling ? Math.max(agility, 16) : agility;
    const halflingFumbleRequiresBoth1s = isHalfling;
    if (effectiveAgl <= 8) {
        return {
            primaryDieReduction: 3,
            offHandDieReduction: 4,
            primaryCanCrit: false,
            offHandCanCrit: false,
            primaryCritRequiresBeatAC: false,
            halflingAutoCritOnMax: false,
            halflingFumbleRequiresBoth1s,
        };
    }
    if (effectiveAgl <= 11) {
        return {
            primaryDieReduction: 2,
            offHandDieReduction: 3,
            primaryCanCrit: false,
            offHandCanCrit: false,
            primaryCritRequiresBeatAC: false,
            halflingAutoCritOnMax: false,
            halflingFumbleRequiresBoth1s,
        };
    }
    if (effectiveAgl <= 15) {
        return {
            primaryDieReduction: 1,
            offHandDieReduction: 2,
            primaryCanCrit: false,
            offHandCanCrit: false,
            primaryCritRequiresBeatAC: false,
            halflingAutoCritOnMax: false,
            halflingFumbleRequiresBoth1s,
        };
    }
    if (effectiveAgl <= 17) {
        return {
            primaryDieReduction: 1,
            offHandDieReduction: 1,
            primaryCanCrit: true,
            // Halflings can crit with either hand on natural max; non-halflings can only crit primary.
            offHandCanCrit: isHalfling,
            primaryCritRequiresBeatAC: !isHalfling,
            halflingAutoCritOnMax: isHalfling,
            halflingFumbleRequiresBoth1s,
        };
    }
    // 18+
    return {
        primaryDieReduction: 0,
        offHandDieReduction: 1,
        primaryCanCrit: true,
        offHandCanCrit: false,
        primaryCritRequiresBeatAC: false,
        halflingAutoCritOnMax: false,
        halflingFumbleRequiresBoth1s,
    };
}
/**
 * Step a die down the dice chain by `reduction` steps.
 * Falls back to the input die if the result would fall off the chain.
 */
function reduceActionDie(base, reduction) {
    if (reduction <= 0) {
        return base;
    }
    const reduced = bumpDie(`1${base}`, -reduction);
    return getPrimaryDie(reduced) ?? base;
}
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
export function rollTwoWeaponAttack(input, roller, events) {
    const config = getTwoWeaponDice(input.agility, { isHalfling: input.isHalfling });
    const primaryDie = reduceActionDie(input.baseActionDie, config.primaryDieReduction);
    const offHandDie = reduceActionDie(input.baseActionDie, config.offHandDieReduction);
    // Warriors lose their improved threat range when two-weapon fighting.
    const clampThreat = (tr) => Math.max(tr, 20);
    const primaryAttack = {
        ...input.primary,
        actionDie: primaryDie,
        threatRange: clampThreat(input.primary.threatRange),
    };
    const offHandAttack = {
        ...input.offHand,
        actionDie: offHandDie,
        threatRange: clampThreat(input.offHand.threatRange),
    };
    // Pass `events: undefined` so we can emit them after applying overrides.
    const primary = makeAttackRoll(primaryAttack, roller);
    const offHand = makeAttackRoll(offHandAttack, roller);
    applyHandOverrides(primary, config, "primary", primaryAttack.targetAC);
    applyHandOverrides(offHand, config, "offHand", offHandAttack.targetAC);
    applyHalflingFumbleRule(primary, offHand, config);
    emitTwoWeaponEvents(primary, events);
    emitTwoWeaponEvents(offHand, events);
    return { primary, offHand, config };
}
function applyHandOverrides(result, config, hand, targetAC) {
    const canCrit = hand === "primary" ? config.primaryCanCrit : config.offHandCanCrit;
    if (!canCrit && result.isCriticalThreat) {
        result.isCriticalThreat = false;
        result.critSource = undefined;
    }
    // Halfling override: natural max on reduced die = auto-hit + auto-crit
    // (overrides the 16-17 "no auto-hit" rule). Applies to either hand
    // when the rule is active and that hand is allowed to crit.
    if (config.halflingAutoCritOnMax &&
        canCrit &&
        isAutoHit(result.roll)) {
        result.isHit = true;
        result.isCriticalThreat = true;
        result.critSource = "natural-max";
        return;
    }
    // Non-halfling 16-17 row: primary crits only on natural max that
    // also beats AC. The natural max does NOT auto-hit. Off-hand cannot
    // crit (already handled by `canCrit`).
    if (config.primaryCritRequiresBeatAC &&
        hand === "primary" &&
        isAutoHit(result.roll)) {
        if (targetAC === undefined) {
            // Without an AC, we cannot judge "beats AC" — the result already
            // shows isHit undefined; leave the crit flag as-is for callers
            // that want to resolve it themselves.
            return;
        }
        const beatsAC = result.total >= targetAC;
        result.isHit = beatsAC;
        if (!beatsAC) {
            result.isCriticalThreat = false;
            result.critSource = undefined;
        }
        else {
            result.isCriticalThreat = true;
            result.critSource = "natural-max";
        }
    }
}
function applyHalflingFumbleRule(primary, offHand, config) {
    if (!config.halflingFumbleRequiresBoth1s) {
        return;
    }
    const bothFumbled = primary.isFumble && offHand.isFumble;
    if (!bothFumbled) {
        primary.isFumble = false;
        offHand.isFumble = false;
    }
}
function emitTwoWeaponEvents(result, events) {
    if (events === undefined) {
        return;
    }
    events.onAttackRoll?.(result);
    if (result.isCriticalThreat) {
        events.onCriticalThreat?.(result);
    }
    if (result.isFumble) {
        events.onFumbleRoll?.(result);
    }
    if (result.deedRoll !== undefined && result.deedSuccess !== undefined) {
        events.onDeedAttempt?.(result.deedRoll, result.deedSuccess);
    }
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