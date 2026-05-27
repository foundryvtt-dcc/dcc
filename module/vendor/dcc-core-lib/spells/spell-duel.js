/**
 * Spell Duel System
 *
 * Implements DCC spell duel rules for wizard vs wizard (or cleric) magical combat.
 *
 * Key mechanics:
 * - Momentum tracking (starts at 10, winner increments by 1)
 * - Spell check comparison (Table 4-5)
 * - Counterspell power resolution (Table 4-6)
 * - Phlogiston disturbance on ties (Table 4-7)
 * - Same patron invocations cancel each other
 *
 * Initiative rules:
 * - Casters later in initiative can counterspell earlier casters
 * - Counterspelling uses their action for the round
 * - Combat pauses for spell duel resolution
 *
 * Table Data:
 * - Default fan-made tables are provided for basic functionality
 * - Official DCC tables can be injected via the dcc-official-data package
 */
import { evaluateRoll } from "../dice/roll.js";
import { DEFAULT_SPELL_DUEL_TABLES, lookupCounterspellPowerEntry, lookupPhlogistonDisturbanceEntry, entryToCounterspellPowerResult, entryToPhlogistonDisturbanceResult, } from "./spell-duel-tables.js";
export { DEFAULT_SPELL_DUEL_TABLES, DEFAULT_COUNTERSPELL_POWER_TABLE, DEFAULT_PHLOGISTON_DISTURBANCE_TABLE, defaultGetComparisonDie, lookupCounterspellPowerEntry, lookupPhlogistonDisturbanceEntry, entryToCounterspellPowerResult, entryToPhlogistonDisturbanceResult, } from "./spell-duel-tables.js";
// =============================================================================
// Constants
// =============================================================================
/**
 * Starting momentum for all duel participants
 */
export const STARTING_MOMENTUM = 10;
/**
 * Minimum spell check thresholds by spell level
 */
export const SPELL_CHECK_THRESHOLDS = {
    1: 12,
    2: 14,
    3: 16,
    4: 18,
    5: 20,
};
/**
 * Default spells and what they can counter
 */
export const COUNTERSPELL_RELATIONSHIPS = {
    "fire-resistance": ["fireball", "scorching-ray"],
    "magic-shield": ["magic-missile", "fireball", "scorching-ray", "lightning-bolt"],
    "dispel-magic": ["*"], // Counters any spell
};
// =============================================================================
// Table 4-5: Spell Duel Check Comparison
// =============================================================================
/**
 * Table 4-5 lookup - returns the die to roll based on attacker and defender checks
 *
 * The table is symmetric around the diagonal (where checks are equal = PD)
 * Distance from diagonal determines the die size
 *
 * @param attackerCheck - Attacker's spell check total
 * @param defenderCheck - Defender's spell check total
 * @param lookupFn - Optional custom lookup function (for official tables)
 */
export function getComparisonDie(attackerCheck, defenderCheck, lookupFn) {
    const lookup = lookupFn ?? DEFAULT_SPELL_DUEL_TABLES.getComparisonDie;
    return lookup(attackerCheck, defenderCheck);
}
/**
 * Compare spell checks and determine the die to roll
 *
 * @param attackerCheck - Attacker's spell check total
 * @param defenderCheck - Defender's spell check total
 * @param lookupFn - Optional custom lookup function (for official tables)
 */
export function compareSpellChecks(attackerCheck, defenderCheck, lookupFn) {
    const comparisonDie = getComparisonDie(attackerCheck, defenderCheck, lookupFn);
    return {
        attackerCheck,
        defenderCheck,
        attackerHigh: attackerCheck > defenderCheck,
        comparisonDie,
        isPhlogistonDisturbance: comparisonDie === "PD",
    };
}
// =============================================================================
// Table 4-6: Counterspell Power
// =============================================================================
/**
 * Table 4-6: Counterspell Power results
 *
 * Roll is modified by the difference between momentum trackers
 * If attacker high, use "Attacker High" column
 * If defender high, use "Defender High" column
 *
 * @param comparisonDie - The die to roll (from Table 4-5)
 * @param attackerHigh - Whether the attacker had the higher spell check
 * @param momentumDifference - Absolute difference between momentum trackers
 * @param roller - Optional dice roller
 * @param table - Optional custom table data (for official tables)
 */
export function rollCounterspellPower(comparisonDie, attackerHigh, momentumDifference, roller, table) {
    if (comparisonDie === "PD") {
        throw new Error("Cannot roll counterspell power on Phlogiston Disturbance");
    }
    const tableData = table ?? DEFAULT_SPELL_DUEL_TABLES.counterspellPower;
    // Roll the comparison die
    const dieFormula = `1${comparisonDie}`;
    const rollResult = roller
        ? evaluateRoll(dieFormula, { mode: "evaluate", roller })
        : evaluateRoll(dieFormula, { mode: "evaluate" });
    const roll = rollResult.total ?? 1;
    const momentumModifier = attackerHigh ? momentumDifference : -momentumDifference;
    const modifiedResult = Math.max(1, roll + momentumModifier);
    // Look up the entry from the appropriate column
    const column = attackerHigh ? tableData.attackerHigh : tableData.defenderHigh;
    const entry = lookupCounterspellPowerEntry(column, modifiedResult);
    return entryToCounterspellPowerResult(entry, roll, momentumModifier, modifiedResult);
}
// =============================================================================
// Table 4-7: Phlogiston Disturbance
// =============================================================================
/**
 * Roll on Table 4-7: Phlogiston Disturbance
 *
 * This occurs when both spell checks are identical
 * Dangerous magical effects can occur
 *
 * @param roller - Optional dice roller
 * @param table - Optional custom table data (for official tables)
 */
export function rollPhlogistonDisturbance(roller, table) {
    const tableData = table ?? DEFAULT_SPELL_DUEL_TABLES.phlogistonDisturbance;
    // Roll d20 for phlogiston disturbance
    const rollResult = roller
        ? evaluateRoll("1d20", { mode: "evaluate", roller })
        : evaluateRoll("1d20", { mode: "evaluate" });
    const roll = rollResult.total ?? 10;
    const entry = lookupPhlogistonDisturbanceEntry(tableData, roll);
    return entryToPhlogistonDisturbanceResult(entry, roll);
}
// =============================================================================
// Spell Duel State Management
// =============================================================================
/**
 * Create initial spell duel state
 */
export function createSpellDuelState(participants) {
    return {
        participants: participants.map((p) => ({
            ...p,
            momentum: STARTING_MOMENTUM,
        })),
        exchanges: [],
        active: true,
    };
}
/**
 * Create a spell duel participant
 */
export function createSpellDuelParticipant(id, name, casterType, initiative, patron) {
    return {
        id,
        name,
        casterType,
        momentum: STARTING_MOMENTUM,
        initiative,
        patron,
    };
}
/**
 * Get the minimum spell check threshold for a spell level
 */
export function getSpellCheckThreshold(spellLevel) {
    return SPELL_CHECK_THRESHOLDS[spellLevel] ?? 12 + (spellLevel - 1) * 2;
}
/**
 * Check if a spell check succeeded (met minimum threshold)
 */
export function didSpellCheckSucceed(total, spellLevel) {
    const threshold = getSpellCheckThreshold(spellLevel);
    return total >= threshold;
}
/**
 * Determine if a spell is lost based on the initial check (spell duel context)
 */
export function checkSpellLostInDuel(_naturalRoll, total, spellLevel) {
    // Spell is only lost if initial, unmodified check is below threshold
    // If the check summoned enough power to start the duel, spell is not lost
    const threshold = getSpellCheckThreshold(spellLevel);
    return total < threshold;
}
// =============================================================================
// Counterspell Validation
// =============================================================================
/**
 * Check if a defending spell can counter an attacking spell
 */
export function canCounter(attackSpell, counterSpell) {
    // Dispel magic can counter anything
    if (counterSpell.category === "dispel-magic") {
        return true;
    }
    // Same spell can always counter itself
    if (counterSpell.category === "same-spell") {
        return attackSpell.name.toLowerCase() === counterSpell.name.toLowerCase();
    }
    // Invoke patron vs invoke patron
    if (attackSpell.category === "invoke-patron" && counterSpell.category === "invoke-patron") {
        return true;
    }
    // Check specific counter relationships
    if (counterSpell.counters) {
        const attackName = attackSpell.name.toLowerCase();
        return counterSpell.counters.some((c) => c === "*" || c.toLowerCase() === attackName);
    }
    // Check default relationships
    const counterKey = counterSpell.name.toLowerCase().replace(/\s+/g, "-");
    const defaults = COUNTERSPELL_RELATIONSHIPS[counterKey];
    if (defaults) {
        if (defaults.includes("*"))
            return true;
        const attackName = attackSpell.name.toLowerCase().replace(/\s+/g, "-");
        return defaults.includes(attackName);
    }
    return false;
}
/**
 * Check if two invoke patron spells are for the same patron (auto-cancel)
 */
export function isSamePatronInvocation(attackSpell, counterSpell) {
    if (attackSpell.category !== "invoke-patron" || counterSpell.category !== "invoke-patron") {
        return false;
    }
    if (!attackSpell.patron || !counterSpell.patron) {
        return false;
    }
    return attackSpell.patron.toLowerCase() === counterSpell.patron.toLowerCase();
}
// =============================================================================
// Spell Duel Resolution
// =============================================================================
/**
 * Make a spell check for a duel participant
 */
export function makeSpellDuelCheck(spell, casterId, spellCheckBonus, roller) {
    const rollResult = roller
        ? evaluateRoll("1d20", { mode: "evaluate", roller })
        : evaluateRoll("1d20", { mode: "evaluate" });
    const naturalRoll = rollResult.natural ?? rollResult.total ?? 10;
    const total = naturalRoll + spellCheckBonus;
    const succeeded = didSpellCheckSucceed(total, spell.level);
    const spellLost = checkSpellLostInDuel(naturalRoll, total, spell.level);
    return {
        casterId,
        spell,
        naturalRoll,
        total,
        succeeded,
        spellLost,
    };
}
/**
 * Resolve a counterspell exchange between attacker and defender
 *
 * @param state - Current spell duel state
 * @param attackerId - ID of the attacking caster
 * @param defenderId - ID of the defending caster
 * @param attackerCheck - Attacker's spell check result
 * @param defenderCheck - Defender's spell check result
 * @param rollerOrOptions - Either a dice roller or options object
 */
export function resolveCounterspellExchange(state, attackerId, defenderId, attackerCheck, defenderCheck, rollerOrOptions) {
    // Handle both old signature (roller) and new signature (options)
    const options = typeof rollerOrOptions === "function"
        ? { roller: rollerOrOptions }
        : rollerOrOptions ?? {};
    const { roller, tables } = options;
    const attacker = state.participants.find((p) => p.id === attackerId);
    const defender = state.participants.find((p) => p.id === defenderId);
    if (!attacker || !defender) {
        throw new Error("Attacker or defender not found in spell duel state");
    }
    // Check for same-patron cancellation
    if (isSamePatronInvocation(attackerCheck.spell, defenderCheck.spell)) {
        return {
            attackerCheck,
            defenderCheck,
            comparison: {
                attackerCheck: attackerCheck.total,
                defenderCheck: defenderCheck.total,
                attackerHigh: false,
                comparisonDie: "PD",
                isPhlogistonDisturbance: false,
            },
            newAttackerMomentum: attacker.momentum,
            newDefenderMomentum: defender.momentum,
            samePatronCancellation: true,
        };
    }
    // Both checks must succeed
    if (!attackerCheck.succeeded || !defenderCheck.succeeded) {
        // Failed checks don't progress the duel meaningfully
        return {
            attackerCheck,
            defenderCheck,
            comparison: {
                attackerCheck: attackerCheck.total,
                defenderCheck: defenderCheck.total,
                attackerHigh: attackerCheck.total > defenderCheck.total,
                comparisonDie: "d3",
                isPhlogistonDisturbance: false,
            },
            newAttackerMomentum: attacker.momentum,
            newDefenderMomentum: defender.momentum,
            samePatronCancellation: false,
        };
    }
    // Compare spell checks
    const comparison = compareSpellChecks(attackerCheck.total, defenderCheck.total, tables?.getComparisonDie);
    // Update momentum - winner increments by 1
    let newAttackerMomentum = attacker.momentum;
    let newDefenderMomentum = defender.momentum;
    if (comparison.attackerHigh) {
        newAttackerMomentum += 1;
    }
    else if (!comparison.isPhlogistonDisturbance) {
        newDefenderMomentum += 1;
    }
    // Calculate momentum difference for table modifier
    const momentumDifference = Math.abs(newAttackerMomentum - newDefenderMomentum);
    // Resolve based on comparison result
    if (comparison.isPhlogistonDisturbance) {
        const phlogistonDisturbance = rollPhlogistonDisturbance(roller, tables?.phlogistonDisturbance);
        return {
            attackerCheck,
            defenderCheck,
            comparison,
            phlogistonDisturbance,
            newAttackerMomentum,
            newDefenderMomentum,
            samePatronCancellation: false,
        };
    }
    else {
        const counterspellPower = rollCounterspellPower(comparison.comparisonDie, comparison.attackerHigh, momentumDifference, roller, tables?.counterspellPower);
        return {
            attackerCheck,
            defenderCheck,
            comparison,
            counterspellPower,
            newAttackerMomentum,
            newDefenderMomentum,
            samePatronCancellation: false,
        };
    }
}
/**
 * Apply a counterspell exchange result to update the duel state
 */
export function applyExchangeResult(state, result) {
    const newParticipants = state.participants.map((p) => {
        if (p.id === result.attackerCheck.casterId) {
            return { ...p, momentum: result.newAttackerMomentum };
        }
        if (p.id === result.defenderCheck.casterId) {
            return { ...p, momentum: result.newDefenderMomentum };
        }
        return p;
    });
    return {
        ...state,
        participants: newParticipants,
        exchanges: [...state.exchanges, result],
    };
}
/**
 * Get participants sorted by initiative (highest first)
 */
export function getInitiativeOrder(state) {
    return [...state.participants].sort((a, b) => b.initiative - a.initiative);
}
/**
 * Check if a participant can counterspell based on initiative
 * A caster can only counterspell someone with higher initiative
 */
export function canCounterspellByInitiative(state, attackerId, defenderId) {
    const attacker = state.participants.find((p) => p.id === attackerId);
    const defender = state.participants.find((p) => p.id === defenderId);
    if (!attacker || !defender) {
        return false;
    }
    // Defender must have lower initiative to counterspell
    return defender.initiative < attacker.initiative;
}
// =============================================================================
// Formatting
// =============================================================================
/**
 * Format a spell duel check result for display
 */
export function formatSpellDuelCheck(check) {
    const successStr = check.succeeded ? "SUCCESS" : "FAILED";
    const lostStr = check.spellLost ? " (spell lost)" : "";
    return `${check.spell.name}: rolled ${String(check.naturalRoll)}, total ${String(check.total)} - ${successStr}${lostStr}`;
}
/**
 * Format a counterspell exchange result for display
 */
export function formatExchangeResult(result, attackerName, defenderName) {
    const lines = [];
    lines.push(`=== Spell Duel Exchange ===`);
    lines.push(`${attackerName}: ${formatSpellDuelCheck(result.attackerCheck)}`);
    lines.push(`${defenderName}: ${formatSpellDuelCheck(result.defenderCheck)}`);
    if (result.samePatronCancellation) {
        lines.push(`SAME PATRON - Both spells automatically cancelled!`);
        return lines.join("\n");
    }
    const winner = result.comparison.attackerHigh ? attackerName : defenderName;
    lines.push(`${winner} wins the exchange!`);
    lines.push(`Momentum: ${attackerName} ${String(result.newAttackerMomentum)}, ${defenderName} ${String(result.newDefenderMomentum)}`);
    if (result.phlogistonDisturbance) {
        lines.push(`PHLOGISTON DISTURBANCE!`);
        lines.push(`Roll: ${String(result.phlogistonDisturbance.roll)}`);
        lines.push(`Effect: ${result.phlogistonDisturbance.effect}`);
    }
    else if (result.counterspellPower) {
        const cp = result.counterspellPower;
        lines.push(`Comparison die: ${result.comparison.comparisonDie}`);
        lines.push(`Roll: ${String(cp.roll)} + ${String(cp.momentumModifier)} momentum = ${String(cp.modifiedResult)}`);
        lines.push(`Effect: ${cp.effect}`);
        if (cp.attackerSpellEffective) {
            const mod = cp.attackerCheckModifier !== 0
                ? ` (${cp.attackerCheckModifier >= 0 ? "+" : ""}${String(cp.attackerCheckModifier)} to check)`
                : "";
            lines.push(`${attackerName}'s spell takes effect${mod}`);
        }
        else {
            lines.push(`${attackerName}'s spell is negated`);
        }
        if (cp.defenderSpellEffective) {
            const mod = cp.defenderCheckModifier !== 0
                ? ` (${cp.defenderCheckModifier >= 0 ? "+" : ""}${String(cp.defenderCheckModifier)} to check)`
                : "";
            lines.push(`${defenderName}'s spell takes effect${mod}`);
        }
        else {
            lines.push(`${defenderName}'s spell is negated`);
        }
    }
    return lines.join("\n");
}
/**
 * Format the current state of a spell duel
 */
export function formatSpellDuelState(state) {
    const lines = [];
    lines.push(`=== Spell Duel Status ===`);
    lines.push(`Active: ${state.active ? "Yes" : "No"}`);
    lines.push(`Exchanges: ${String(state.exchanges.length)}`);
    lines.push(``);
    lines.push(`Participants (by initiative):`);
    const ordered = getInitiativeOrder(state);
    for (const p of ordered) {
        lines.push(`  ${p.name} (${p.casterType}) - Init: ${String(p.initiative)}, Momentum: ${String(p.momentum)}`);
    }
    return lines.join("\n");
}
//# sourceMappingURL=spell-duel.js.map