/**
 * Spell Duel Table Types and Default Tables
 *
 * This module defines the interfaces for spell duel table data
 * and provides fan-made default tables for use when official
 * DCC tables are not available.
 *
 * Official DCC tables can be provided via the dcc-official-data package.
 */
import type { ComparisonDie, CounterspellPowerResult, PhlogistonDisturbanceResult } from "./spell-duel.js";
/**
 * Function type for looking up comparison die (Table 4-5)
 */
export type ComparisonDieLookup = (attackerCheck: number, defenderCheck: number) => ComparisonDie;
/**
 * Entry for Table 4-6: Counterspell Power
 */
export interface CounterspellPowerEntry {
    /** Minimum roll value for this entry (inclusive) */
    min: number;
    /** Maximum roll value for this entry (inclusive) */
    max: number;
    /** Effect description */
    effect: string;
    /** Whether attacker's spell takes effect */
    attackerSpellEffective: boolean;
    /** Whether defender's spell takes effect */
    defenderSpellEffective: boolean;
    /** Modifier to attacker's effective spell check */
    attackerCheckModifier: number;
    /** Modifier to defender's effective spell check */
    defenderCheckModifier: number;
    /** Whether both spells go off simultaneously */
    simultaneousEffect: boolean;
}
/**
 * Table 4-6 data structure
 */
export interface CounterspellPowerTable {
    /** Results for when attacker has higher spell check */
    attackerHigh: CounterspellPowerEntry[];
    /** Results for when defender has higher spell check */
    defenderHigh: CounterspellPowerEntry[];
}
/**
 * Entry for Table 4-7: Phlogiston Disturbance
 */
export interface PhlogistonDisturbanceEntry {
    /** Minimum roll value (inclusive) */
    min: number;
    /** Maximum roll value (inclusive) */
    max: number;
    /** Effect description */
    effect: string;
    /** Whether this affects the attacker */
    affectsAttacker: boolean;
    /** Whether this affects the defender */
    affectsDefender: boolean;
    /** Whether this affects bystanders */
    affectsBystanders: boolean;
    /** Damage dealt (if any) */
    damage?: string | undefined;
    /** Area of effect in feet (if any) */
    areaOfEffect?: number | undefined;
    /** Special effect type */
    specialEffect?: "corruption" | "patron-taint" | "deity-displeasure" | "supernatural-entity" | "dimensional-rift" | "time-distortion" | "magical-chaos" | undefined;
}
/**
 * Table 4-7 data structure
 */
export type PhlogistonDisturbanceTable = PhlogistonDisturbanceEntry[];
/**
 * All spell duel tables bundled together
 */
export interface SpellDuelTables {
    /** Comparison die lookup function (Table 4-5) */
    getComparisonDie: ComparisonDieLookup;
    /** Counterspell power results (Table 4-6) */
    counterspellPower: CounterspellPowerTable;
    /** Phlogiston disturbance results (Table 4-7) */
    phlogistonDisturbance: PhlogistonDisturbanceTable;
}
/**
 * Default comparison die lookup
 *
 * This is a fan-made interpretation of spell duel mechanics.
 * When spell checks are equal, a Phlogiston Disturbance occurs.
 * Otherwise, the difference determines the die size to roll.
 */
export declare function defaultGetComparisonDie(attackerCheck: number, defenderCheck: number): ComparisonDie;
/**
 * Default counterspell power table (fan-made)
 *
 * This provides a balanced set of outcomes for spell duels.
 * Lower results favor the defender, higher results favor the attacker.
 */
export declare const DEFAULT_COUNTERSPELL_POWER_TABLE: CounterspellPowerTable;
/**
 * Default phlogiston disturbance table (fan-made)
 *
 * When spell checks are equal, magical energies collide unpredictably.
 * Roll d20 to determine the effect.
 */
export declare const DEFAULT_PHLOGISTON_DISTURBANCE_TABLE: PhlogistonDisturbanceTable;
/**
 * Default spell duel tables (fan-made)
 *
 * Use these when official DCC tables are not available.
 */
export declare const DEFAULT_SPELL_DUEL_TABLES: SpellDuelTables;
/**
 * Look up a counterspell power entry by roll value
 */
export declare function lookupCounterspellPowerEntry(table: CounterspellPowerEntry[], roll: number): CounterspellPowerEntry;
/**
 * Look up a phlogiston disturbance entry by roll value
 */
export declare function lookupPhlogistonDisturbanceEntry(table: PhlogistonDisturbanceTable, roll: number): PhlogistonDisturbanceEntry;
/**
 * Convert a counterspell power entry to the full result format
 */
export declare function entryToCounterspellPowerResult(entry: CounterspellPowerEntry, roll: number, momentumModifier: number, modifiedResult: number): CounterspellPowerResult;
/**
 * Convert a phlogiston disturbance entry to the full result format
 */
export declare function entryToPhlogistonDisturbanceResult(entry: PhlogistonDisturbanceEntry, roll: number): PhlogistonDisturbanceResult;
//# sourceMappingURL=spell-duel-tables.d.ts.map