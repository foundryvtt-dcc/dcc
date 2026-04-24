/**
 * NPC/Creature Stat Block Parser Types
 *
 * Types for parsing DCC RPG stat blocks from text format.
 */
import type { Alignment } from "../types/system.js";
import type { Creature, CreatureSaves, CreatureSpeed } from "../types/index.js";
export type { Creature, CreatureSaves, CreatureSpeed };
/**
 * Result of parsing a stat block
 */
export interface StatBlockParseResult {
    /** Whether parsing succeeded */
    success: boolean;
    /** Parsed creature data (if successful) */
    creature?: Creature | undefined;
    /** Error message (if failed) */
    error?: string | undefined;
    /** Warnings about potentially incorrect parsing */
    warnings?: string[] | undefined;
    /** The original stat block text */
    original: string;
}
/**
 * Intermediate parsed attack data before conversion
 */
export interface ParsedAttack {
    /** Attack name */
    name: string;
    /** Attack bonus as string (e.g., "+5", "-2") */
    toHit: string;
    /** Whether this is a melee attack */
    melee: boolean;
    /** Damage expression */
    damage: string;
    /** Range for missile attacks */
    range?: string | undefined;
    /** Whether this is a special attack (see below, spell, etc.) */
    isSpecial?: boolean | undefined;
}
/**
 * Intermediate parsed stat block data
 */
export interface ParsedStatBlock {
    /** Creature name */
    name: string;
    /** Initiative modifier */
    init: number;
    /** Parsed attacks */
    attacks: ParsedAttack[];
    /** Armor Class */
    ac: number;
    /** AC notes (e.g., "scale mail") */
    acNotes?: string | undefined;
    /** Hit Dice expression */
    hitDice: string;
    /** Movement speeds */
    speed: CreatureSpeed;
    /** Action dice expression */
    actionDice: string;
    /** Special abilities */
    special?: string | undefined;
    /** Saving throws */
    saves: CreatureSaves;
    /** Alignment */
    alignment: Alignment;
    /** Crit die (if specified) */
    critDie?: string | undefined;
    /** Crit table (if specified) */
    critTable?: string | undefined;
    /** Crit range (if specified, e.g., "19-20", "20-24") */
    critRange?: string | undefined;
}
/**
 * Options for stat block parsing
 */
export interface StatBlockParseOptions {
    /** Category to assign to parsed creature */
    category?: string | undefined;
    /** Custom ID to use (otherwise derived from name) */
    id?: string | undefined;
    /** Default HP if not calculable (uses average of HD) */
    defaultHp?: number | undefined;
    /** Default crit die if not specified in stat block */
    defaultCritDie?: string | undefined;
    /** Default crit table if not specified in stat block */
    defaultCritTable?: string | undefined;
}
//# sourceMappingURL=statblock-types.d.ts.map