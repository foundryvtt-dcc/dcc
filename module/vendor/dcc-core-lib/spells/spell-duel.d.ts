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
import type { DiceRoller } from "../types/dice.js";
import { type SpellDuelTables, type CounterspellPowerTable, type PhlogistonDisturbanceTable, type ComparisonDieLookup } from "./spell-duel-tables.js";
export type { SpellDuelTables, CounterspellPowerTable, PhlogistonDisturbanceTable, ComparisonDieLookup, CounterspellPowerEntry, PhlogistonDisturbanceEntry, } from "./spell-duel-tables.js";
export { DEFAULT_SPELL_DUEL_TABLES, DEFAULT_COUNTERSPELL_POWER_TABLE, DEFAULT_PHLOGISTON_DISTURBANCE_TABLE, defaultGetComparisonDie, lookupCounterspellPowerEntry, lookupPhlogistonDisturbanceEntry, entryToCounterspellPowerResult, entryToPhlogistonDisturbanceResult, } from "./spell-duel-tables.js";
/**
 * Types of casters that can participate in spell duels
 */
export type SpellDuelCasterType = "wizard" | "cleric" | "other";
/**
 * A participant in a spell duel
 */
export interface SpellDuelParticipant {
    /** Unique identifier for the participant */
    id: string;
    /** Display name */
    name: string;
    /** Type of caster */
    casterType: SpellDuelCasterType;
    /** Current momentum (starts at 10) */
    momentum: number;
    /** Initiative roll for ordering */
    initiative: number;
    /** Patron name if invoking patron (for same-patron cancellation) */
    patron?: string | undefined;
}
/**
 * Categories of spells that can counter each other
 */
export type CounterspellCategory = "fire-resistance" | "magic-shield" | "dispel-magic" | "invoke-patron" | "same-spell";
/**
 * A spell being cast or used to counter
 */
export interface SpellDuelSpell {
    /** Name of the spell */
    name: string;
    /** Spell level (affects minimum spell check threshold) */
    level: number;
    /** Category for counterspell matching */
    category: CounterspellCategory;
    /** Specific spells this can counter (for defensive spells) */
    counters?: string[] | undefined;
    /** The patron being invoked (if invoke patron) */
    patron?: string | undefined;
}
/**
 * Result of a spell check in the duel
 */
export interface SpellDuelCheck {
    /** The caster making the check */
    casterId: string;
    /** The spell being cast */
    spell: SpellDuelSpell;
    /** Natural roll on the die */
    naturalRoll: number;
    /** Total spell check result */
    total: number;
    /** Whether the check succeeded (met minimum threshold) */
    succeeded: boolean;
    /** Whether the spell is lost for the day */
    spellLost: boolean;
}
/**
 * Comparison die from Table 4-5
 */
export type ComparisonDie = "d3" | "d4" | "d5" | "d6" | "d7" | "d8" | "d10" | "d12" | "d14" | "d16" | "PD";
/**
 * Result of comparing spell checks (Table 4-5)
 */
export interface SpellCheckComparison {
    /** Attacker's spell check total */
    attackerCheck: number;
    /** Defender's spell check total */
    defenderCheck: number;
    /** Whether attacker had higher check */
    attackerHigh: boolean;
    /** Die to roll on Table 4-6, or "PD" for phlogiston disturbance */
    comparisonDie: ComparisonDie;
    /** Whether this triggers phlogiston disturbance */
    isPhlogistonDisturbance: boolean;
}
/**
 * Result from Table 4-6: Counterspell Power
 */
export interface CounterspellPowerResult {
    /** Roll on the comparison die */
    roll: number;
    /** Momentum modifier applied */
    momentumModifier: number;
    /** Final modified result */
    modifiedResult: number;
    /** Effect description */
    effect: string;
    /** Whether attacker's spell takes effect */
    attackerSpellEffective: boolean;
    /** Whether defender's spell takes effect */
    defenderSpellEffective: boolean;
    /** Modifier to attacker's effective spell check (can reduce it) */
    attackerCheckModifier: number;
    /** Modifier to defender's effective spell check (can reduce it) */
    defenderCheckModifier: number;
    /** Whether both spells go off simultaneously */
    simultaneousEffect: boolean;
}
/**
 * Result from Table 4-7: Phlogiston Disturbance
 */
export interface PhlogistonDisturbanceResult {
    /** Roll on the table */
    roll: number;
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
 * Result of a single counterspell exchange
 */
export interface CounterspellExchangeResult {
    /** The attacking caster's check */
    attackerCheck: SpellDuelCheck;
    /** The defending caster's check */
    defenderCheck: SpellDuelCheck;
    /** Comparison result */
    comparison: SpellCheckComparison;
    /** Counterspell power result (if not phlogiston disturbance) */
    counterspellPower?: CounterspellPowerResult | undefined;
    /** Phlogiston disturbance result (if checks were equal) */
    phlogistonDisturbance?: PhlogistonDisturbanceResult | undefined;
    /** Updated attacker momentum */
    newAttackerMomentum: number;
    /** Updated defender momentum */
    newDefenderMomentum: number;
    /** Whether same-patron cancellation occurred */
    samePatronCancellation: boolean;
}
/**
 * State of an ongoing spell duel
 */
export interface SpellDuelState {
    /** All participants in the duel */
    participants: SpellDuelParticipant[];
    /** History of exchanges */
    exchanges: CounterspellExchangeResult[];
    /** Whether the duel is still active */
    active: boolean;
    /** ID of the current attacker */
    currentAttackerId?: string | undefined;
    /** The spell being attacked with */
    currentAttackSpell?: SpellDuelSpell | undefined;
}
/**
 * Starting momentum for all duel participants
 */
export declare const STARTING_MOMENTUM = 10;
/**
 * Minimum spell check thresholds by spell level
 */
export declare const SPELL_CHECK_THRESHOLDS: Record<number, number>;
/**
 * Default spells and what they can counter
 */
export declare const COUNTERSPELL_RELATIONSHIPS: Record<string, string[]>;
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
export declare function getComparisonDie(attackerCheck: number, defenderCheck: number, lookupFn?: ComparisonDieLookup): ComparisonDie;
/**
 * Compare spell checks and determine the die to roll
 *
 * @param attackerCheck - Attacker's spell check total
 * @param defenderCheck - Defender's spell check total
 * @param lookupFn - Optional custom lookup function (for official tables)
 */
export declare function compareSpellChecks(attackerCheck: number, defenderCheck: number, lookupFn?: ComparisonDieLookup): SpellCheckComparison;
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
export declare function rollCounterspellPower(comparisonDie: ComparisonDie, attackerHigh: boolean, momentumDifference: number, roller?: DiceRoller, table?: CounterspellPowerTable): CounterspellPowerResult;
/**
 * Roll on Table 4-7: Phlogiston Disturbance
 *
 * This occurs when both spell checks are identical
 * Dangerous magical effects can occur
 *
 * @param roller - Optional dice roller
 * @param table - Optional custom table data (for official tables)
 */
export declare function rollPhlogistonDisturbance(roller?: DiceRoller, table?: PhlogistonDisturbanceTable): PhlogistonDisturbanceResult;
/**
 * Create initial spell duel state
 */
export declare function createSpellDuelState(participants: {
    id: string;
    name: string;
    casterType: SpellDuelCasterType;
    initiative: number;
    patron?: string | undefined;
}[]): SpellDuelState;
/**
 * Create a spell duel participant
 */
export declare function createSpellDuelParticipant(id: string, name: string, casterType: SpellDuelCasterType, initiative: number, patron?: string): SpellDuelParticipant;
/**
 * Get the minimum spell check threshold for a spell level
 */
export declare function getSpellCheckThreshold(spellLevel: number): number;
/**
 * Check if a spell check succeeded (met minimum threshold)
 */
export declare function didSpellCheckSucceed(total: number, spellLevel: number): boolean;
/**
 * Determine if a spell is lost based on the initial check (spell duel context)
 */
export declare function checkSpellLostInDuel(_naturalRoll: number, total: number, spellLevel: number): boolean;
/**
 * Check if a defending spell can counter an attacking spell
 */
export declare function canCounter(attackSpell: SpellDuelSpell, counterSpell: SpellDuelSpell): boolean;
/**
 * Check if two invoke patron spells are for the same patron (auto-cancel)
 */
export declare function isSamePatronInvocation(attackSpell: SpellDuelSpell, counterSpell: SpellDuelSpell): boolean;
/**
 * Make a spell check for a duel participant
 */
export declare function makeSpellDuelCheck(spell: SpellDuelSpell, casterId: string, spellCheckBonus: number, roller?: DiceRoller): SpellDuelCheck;
/**
 * Options for resolving a counterspell exchange
 */
export interface ResolveExchangeOptions {
    /** Optional dice roller */
    roller?: DiceRoller;
    /** Optional custom tables (for official tables) */
    tables?: SpellDuelTables;
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
export declare function resolveCounterspellExchange(state: SpellDuelState, attackerId: string, defenderId: string, attackerCheck: SpellDuelCheck, defenderCheck: SpellDuelCheck, rollerOrOptions?: DiceRoller | ResolveExchangeOptions): CounterspellExchangeResult;
/**
 * Apply a counterspell exchange result to update the duel state
 */
export declare function applyExchangeResult(state: SpellDuelState, result: CounterspellExchangeResult): SpellDuelState;
/**
 * Get participants sorted by initiative (highest first)
 */
export declare function getInitiativeOrder(state: SpellDuelState): SpellDuelParticipant[];
/**
 * Check if a participant can counterspell based on initiative
 * A caster can only counterspell someone with higher initiative
 */
export declare function canCounterspellByInitiative(state: SpellDuelState, attackerId: string, defenderId: string): boolean;
/**
 * Format a spell duel check result for display
 */
export declare function formatSpellDuelCheck(check: SpellDuelCheck): string;
/**
 * Format a counterspell exchange result for display
 */
export declare function formatExchangeResult(result: CounterspellExchangeResult, attackerName: string, defenderName: string): string;
/**
 * Format the current state of a spell duel
 */
export declare function formatSpellDuelState(state: SpellDuelState): string;
//# sourceMappingURL=spell-duel.d.ts.map