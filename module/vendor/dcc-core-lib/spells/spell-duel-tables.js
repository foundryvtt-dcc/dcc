/**
 * Spell Duel Table Types and Default Tables
 *
 * This module defines the interfaces for spell duel table data
 * and provides fan-made default tables for use when official
 * DCC tables are not available.
 *
 * Official DCC tables can be provided via the dcc-official-data package.
 */
// =============================================================================
// Default Fan-Made Table 4-5: Spell Duel Check Comparison
// =============================================================================
/**
 * Default comparison die lookup
 *
 * This is a fan-made interpretation of spell duel mechanics.
 * When spell checks are equal, a Phlogiston Disturbance occurs.
 * Otherwise, the difference determines the die size to roll.
 */
export function defaultGetComparisonDie(attackerCheck, defenderCheck) {
    // Both checks must be at least 12 to be on the table
    const clampedAttacker = Math.max(12, Math.min(28, attackerCheck));
    const clampedDefender = Math.max(12, Math.min(28, defenderCheck));
    // If equal, it's a Phlogiston Disturbance
    if (clampedAttacker === clampedDefender) {
        return "PD";
    }
    // Calculate the difference - this determines die size
    const diff = Math.abs(clampedAttacker - clampedDefender);
    // Map difference to die (fan-made progression)
    if (diff === 1)
        return "d3";
    if (diff === 2)
        return "d4";
    if (diff <= 4)
        return "d5";
    if (diff <= 6)
        return "d6";
    if (diff <= 8)
        return "d7";
    if (diff <= 10)
        return "d8";
    if (diff <= 12)
        return "d10";
    if (diff <= 14)
        return "d12";
    if (diff <= 16)
        return "d14";
    return "d16";
}
// =============================================================================
// Default Fan-Made Table 4-6: Counterspell Power
// =============================================================================
/**
 * Default counterspell power table (fan-made)
 *
 * This provides a balanced set of outcomes for spell duels.
 * Lower results favor the defender, higher results favor the attacker.
 */
export const DEFAULT_COUNTERSPELL_POWER_TABLE = {
    attackerHigh: [
        {
            min: 1,
            max: 2,
            effect: "The attacker's spell is partially blocked. Both spells take effect at reduced power.",
            attackerSpellEffective: true,
            defenderSpellEffective: true,
            attackerCheckModifier: -4,
            defenderCheckModifier: -2,
            simultaneousEffect: true,
        },
        {
            min: 3,
            max: 4,
            effect: "The attacker's spell is mostly blocked. The defender's counter takes partial effect.",
            attackerSpellEffective: true,
            defenderSpellEffective: true,
            attackerCheckModifier: -2,
            defenderCheckModifier: 0,
            simultaneousEffect: true,
        },
        {
            min: 5,
            max: 6,
            effect: "The spells clash! Both take effect simultaneously.",
            attackerSpellEffective: true,
            defenderSpellEffective: true,
            attackerCheckModifier: 0,
            defenderCheckModifier: 0,
            simultaneousEffect: true,
        },
        {
            min: 7,
            max: 8,
            effect: "The attacker overpowers the counter. The attacker's spell takes full effect, the defender's is diminished.",
            attackerSpellEffective: true,
            defenderSpellEffective: true,
            attackerCheckModifier: 0,
            defenderCheckModifier: -4,
            simultaneousEffect: true,
        },
        {
            min: 9,
            max: 10,
            effect: "The attacker dominates! Their spell takes full effect, the counter is negated.",
            attackerSpellEffective: true,
            defenderSpellEffective: false,
            attackerCheckModifier: 0,
            defenderCheckModifier: 0,
            simultaneousEffect: false,
        },
        {
            min: 11,
            max: 12,
            effect: "The attacker crushes the opposition! Full effect with bonus power.",
            attackerSpellEffective: true,
            defenderSpellEffective: false,
            attackerCheckModifier: 2,
            defenderCheckModifier: 0,
            simultaneousEffect: false,
        },
        {
            min: 13,
            max: 100, // Catch-all for high rolls
            effect: "Total magical dominance! The attacker's spell is enhanced, the defender reels from backlash.",
            attackerSpellEffective: true,
            defenderSpellEffective: false,
            attackerCheckModifier: 4,
            defenderCheckModifier: 0,
            simultaneousEffect: false,
        },
    ],
    defenderHigh: [
        {
            min: 1,
            max: 2,
            effect: "The counter overwhelms! The attacker's spell is negated, the counter takes full effect.",
            attackerSpellEffective: false,
            defenderSpellEffective: true,
            attackerCheckModifier: 0,
            defenderCheckModifier: 2,
            simultaneousEffect: false,
        },
        {
            min: 3,
            max: 4,
            effect: "Strong counter! The attacker's spell is mostly blocked.",
            attackerSpellEffective: true,
            defenderSpellEffective: true,
            attackerCheckModifier: -4,
            defenderCheckModifier: 0,
            simultaneousEffect: true,
        },
        {
            min: 5,
            max: 6,
            effect: "The spells clash! Both take effect simultaneously.",
            attackerSpellEffective: true,
            defenderSpellEffective: true,
            attackerCheckModifier: 0,
            defenderCheckModifier: 0,
            simultaneousEffect: true,
        },
        {
            min: 7,
            max: 8,
            effect: "The counter is partially successful. Both spells are diminished.",
            attackerSpellEffective: true,
            defenderSpellEffective: true,
            attackerCheckModifier: -2,
            defenderCheckModifier: -2,
            simultaneousEffect: true,
        },
        {
            min: 9,
            max: 10,
            effect: "The counter is weakened. The attacker's spell takes effect at reduced power.",
            attackerSpellEffective: true,
            defenderSpellEffective: false,
            attackerCheckModifier: -2,
            defenderCheckModifier: 0,
            simultaneousEffect: false,
        },
        {
            min: 11,
            max: 12,
            effect: "The counter fails! The attacker's spell takes full effect.",
            attackerSpellEffective: true,
            defenderSpellEffective: false,
            attackerCheckModifier: 0,
            defenderCheckModifier: 0,
            simultaneousEffect: false,
        },
        {
            min: 13,
            max: 100, // Catch-all for high rolls
            effect: "The counter backfires! The attacker's spell is enhanced by the failed magical interference.",
            attackerSpellEffective: true,
            defenderSpellEffective: false,
            attackerCheckModifier: 2,
            defenderCheckModifier: 0,
            simultaneousEffect: false,
        },
    ],
};
// =============================================================================
// Default Fan-Made Table 4-7: Phlogiston Disturbance
// =============================================================================
/**
 * Default phlogiston disturbance table (fan-made)
 *
 * When spell checks are equal, magical energies collide unpredictably.
 * Roll d20 to determine the effect.
 */
export const DEFAULT_PHLOGISTON_DISTURBANCE_TABLE = [
    {
        min: 1,
        max: 2,
        effect: "Magical energies cancel completely. Both spells fizzle with no effect.",
        affectsAttacker: true,
        affectsDefender: true,
        affectsBystanders: false,
    },
    {
        min: 3,
        max: 4,
        effect: "Eldritch feedback! Both casters take 1d6 damage from magical backlash.",
        affectsAttacker: true,
        affectsDefender: true,
        affectsBystanders: false,
        damage: "1d6",
    },
    {
        min: 5,
        max: 6,
        effect: "Spell energies scatter! Both spells go off but target random creatures within 30'.",
        affectsAttacker: true,
        affectsDefender: true,
        affectsBystanders: true,
        areaOfEffect: 30,
    },
    {
        min: 7,
        max: 8,
        effect: "Minor corruption! Both casters must make a DC 12 Fort save or gain a minor corruption.",
        affectsAttacker: true,
        affectsDefender: true,
        affectsBystanders: false,
        specialEffect: "corruption",
    },
    {
        min: 9,
        max: 10,
        effect: "Patron notice! Both casters' patrons (or deities) take notice of this magical collision.",
        affectsAttacker: true,
        affectsDefender: true,
        affectsBystanders: false,
        specialEffect: "patron-taint",
    },
    {
        min: 11,
        max: 12,
        effect: "Magical explosion! 2d6 damage to all within 20' (Ref DC 14 for half).",
        affectsAttacker: true,
        affectsDefender: true,
        affectsBystanders: true,
        damage: "2d6",
        areaOfEffect: 20,
    },
    {
        min: 13,
        max: 14,
        effect: "Reality shudder! Time seems to skip - all participants lose their next action.",
        affectsAttacker: true,
        affectsDefender: true,
        affectsBystanders: true,
        specialEffect: "time-distortion",
    },
    {
        min: 15,
        max: 16,
        effect: "Supernatural attention! A minor supernatural entity notices the magical collision and may intervene.",
        affectsAttacker: true,
        affectsDefender: true,
        affectsBystanders: true,
        specialEffect: "supernatural-entity",
    },
    {
        min: 17,
        max: 18,
        effect: "Major corruption! Both casters automatically gain a minor corruption (no save).",
        affectsAttacker: true,
        affectsDefender: true,
        affectsBystanders: false,
        specialEffect: "corruption",
    },
    {
        min: 19,
        max: 19,
        effect: "Dimensional rift! A small tear in reality opens nearby. Effects at judge's discretion.",
        affectsAttacker: true,
        affectsDefender: true,
        affectsBystanders: true,
        specialEffect: "dimensional-rift",
    },
    {
        min: 20,
        max: 20,
        effect: "Magical chaos! Both spells combine into something entirely unexpected. Roll twice on spell misfire table.",
        affectsAttacker: true,
        affectsDefender: true,
        affectsBystanders: true,
        specialEffect: "magical-chaos",
    },
];
// =============================================================================
// Default Tables Bundle
// =============================================================================
/**
 * Default spell duel tables (fan-made)
 *
 * Use these when official DCC tables are not available.
 */
export const DEFAULT_SPELL_DUEL_TABLES = {
    getComparisonDie: defaultGetComparisonDie,
    counterspellPower: DEFAULT_COUNTERSPELL_POWER_TABLE,
    phlogistonDisturbance: DEFAULT_PHLOGISTON_DISTURBANCE_TABLE,
};
// =============================================================================
// Table Lookup Helpers
// =============================================================================
/**
 * Look up a counterspell power entry by roll value
 */
export function lookupCounterspellPowerEntry(table, roll) {
    for (const entry of table) {
        if (roll >= entry.min && roll <= entry.max) {
            return entry;
        }
    }
    // Fallback to last entry if roll exceeds table range
    const lastEntry = table[table.length - 1];
    if (!lastEntry) {
        throw new Error("Counterspell power table is empty");
    }
    return lastEntry;
}
/**
 * Look up a phlogiston disturbance entry by roll value
 */
export function lookupPhlogistonDisturbanceEntry(table, roll) {
    for (const entry of table) {
        if (roll >= entry.min && roll <= entry.max) {
            return entry;
        }
    }
    // Fallback to last entry if roll exceeds table range
    const lastEntry = table[table.length - 1];
    if (!lastEntry) {
        throw new Error("Phlogiston disturbance table is empty");
    }
    return lastEntry;
}
/**
 * Convert a counterspell power entry to the full result format
 */
export function entryToCounterspellPowerResult(entry, roll, momentumModifier, modifiedResult) {
    return {
        roll,
        momentumModifier,
        modifiedResult,
        effect: entry.effect,
        attackerSpellEffective: entry.attackerSpellEffective,
        defenderSpellEffective: entry.defenderSpellEffective,
        attackerCheckModifier: entry.attackerCheckModifier,
        defenderCheckModifier: entry.defenderCheckModifier,
        simultaneousEffect: entry.simultaneousEffect,
    };
}
/**
 * Convert a phlogiston disturbance entry to the full result format
 */
export function entryToPhlogistonDisturbanceResult(entry, roll) {
    return {
        roll,
        effect: entry.effect,
        affectsAttacker: entry.affectsAttacker,
        affectsDefender: entry.affectsDefender,
        affectsBystanders: entry.affectsBystanders,
        damage: entry.damage,
        areaOfEffect: entry.areaOfEffect,
        specialEffect: entry.specialEffect,
    };
}
//# sourceMappingURL=spell-duel-tables.js.map