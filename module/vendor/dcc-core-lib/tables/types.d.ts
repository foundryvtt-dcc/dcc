/**
 * Table Lookup System Types
 *
 * Comprehensive system for DCC result tables including:
 * - Simple range tables (fumbles, turn unholy)
 * - Multi-column tables (crit tables with die-based columns)
 * - Tiered result tables (spells with lost/fail/success tiers)
 */
import type { DieType } from "../types/dice.js";
/**
 * Common metadata for all table types
 */
export interface TableMetadata {
    /** Unique identifier for this table */
    id: string;
    /** Display name */
    name: string;
    /** Description of what this table is for */
    description?: string;
    /** Source/reference (e.g., "DCC Core Rules p.82") */
    source?: string;
    /** Tags for categorization */
    tags?: string[];
}
/**
 * The type of table structure
 */
export type TableType = "simple" | "multi-column" | "tiered";
/**
 * A single entry in a simple range table.
 * Matched when roll >= min AND roll <= max.
 */
export interface SimpleTableEntry {
    /** Minimum roll value (inclusive) */
    min: number;
    /** Maximum roll value (inclusive) */
    max: number;
    /** The result text/description */
    text: string;
    /** Optional structured effect data */
    effect?: TableEffect;
}
/**
 * A simple range-based lookup table.
 * Used for: fumbles, turn unholy, lay on hands, etc.
 *
 * @example
 * // Turn Unholy table
 * {
 *   id: "turn-unholy",
 *   type: "simple",
 *   name: "Turn Unholy",
 *   entries: [
 *     { min: 1, max: 11, text: "Failure", effect: { type: "none" } },
 *     { min: 12, max: 13, text: "Turn 1d4 HD", effect: { type: "turn", dice: "1d4" } },
 *     ...
 *   ]
 * }
 */
export interface SimpleTable extends TableMetadata {
    type: "simple";
    /** The die to roll for this table (informational) */
    die?: DieType;
    /** Table entries sorted by min value */
    entries: SimpleTableEntry[];
}
/**
 * A single row in a multi-column table.
 * The row is selected by roll value, then a specific column is read.
 */
export interface MultiColumnRow {
    /** Minimum roll value (inclusive) */
    min: number;
    /** Maximum roll value (inclusive) */
    max: number;
    /** Results keyed by column ID */
    columns: Record<string, {
        text: string;
        effect?: TableEffect;
    }>;
}
/**
 * Definition of a column in a multi-column table
 */
export interface ColumnDefinition {
    /** Column identifier (e.g., "d4", "d6", "d8") */
    id: string;
    /** Display label */
    label: string;
    /** Optional description */
    description?: string;
}
/**
 * A multi-column lookup table.
 * Used for: crit tables (where column = crit die type)
 *
 * @example
 * // Crit Table III
 * {
 *   id: "crit-iii",
 *   type: "multi-column",
 *   name: "Crit Table III",
 *   columns: [
 *     { id: "d4", label: "d4" },
 *     { id: "d6", label: "d6" },
 *     ...
 *   ],
 *   rows: [
 *     {
 *       min: 1, max: 2,
 *       columns: {
 *         "d4": { text: "+1d3 damage", effect: { type: "damage", dice: "1d3" } },
 *         "d6": { text: "+1d4 damage", effect: { type: "damage", dice: "1d4" } },
 *         ...
 *       }
 *     },
 *     ...
 *   ]
 * }
 */
export interface MultiColumnTable extends TableMetadata {
    type: "multi-column";
    /** Column definitions */
    columns: ColumnDefinition[];
    /** Table rows */
    rows: MultiColumnRow[];
}
/**
 * Result tier for spell-like tables.
 * Spells have distinct outcome tiers based on check result.
 */
export type ResultTier = "lost" | "failure" | "success-minor" | "success" | "success-major" | "success-critical";
/**
 * A tiered result entry.
 * Each entry represents one possible outcome at a specific tier.
 */
export interface TieredEntry {
    /** Minimum check result for this entry */
    min: number;
    /** Maximum check result for this entry (optional, defaults to next entry's min - 1) */
    max?: number;
    /** The result tier */
    tier: ResultTier;
    /** Result text/description */
    text: string;
    /** Structured effect data */
    effect?: TableEffect;
    /** For spells: the spell level this result applies to */
    spellLevel?: number;
    /** Manifestation description (for spells) */
    manifestation?: string;
}
/**
 * A tiered result table (used for spells and similar effects).
 *
 * @example
 * // Magic Missile spell
 * {
 *   id: "spell-magic-missile",
 *   type: "tiered",
 *   name: "Magic Missile",
 *   spellLevel: 1,
 *   tiers: {
 *     lost: { min: 1, max: 1 },
 *     failure: { min: 2, max: 11 },
 *     "success-minor": { min: 12, max: 13 },
 *     success: { min: 14, max: 17 },
 *     ...
 *   },
 *   entries: [
 *     { min: 1, max: 1, tier: "lost", text: "Lost. Failure.", effect: { type: "lost" } },
 *     { min: 2, max: 11, tier: "failure", text: "Failure.", effect: { type: "none" } },
 *     { min: 12, max: 13, tier: "success-minor", text: "1 missile, 1d4 damage", ... },
 *     ...
 *   ]
 * }
 */
export interface TieredTable extends TableMetadata {
    type: "tiered";
    /** For spells: the spell level */
    spellLevel?: number;
    /** Tier thresholds (optional, for quick tier lookup) */
    tiers?: Partial<Record<ResultTier, {
        min: number;
        max: number;
    }>>;
    /** All entries */
    entries: TieredEntry[];
}
/**
 * Structured effect that can be parsed from a table result.
 * Allows programmatic handling of table outcomes.
 */
export interface TableEffect {
    /** Effect type identifier */
    type: string;
    /** For damage effects: the dice formula */
    dice?: string;
    /** For numeric effects: a value */
    value?: number;
    /** Duration of effect */
    duration?: string;
    /** Target of effect */
    target?: string;
    /** Additional structured data */
    data?: Record<string, unknown>;
}
/**
 * Any type of lookup table
 */
export type LookupTable = SimpleTable | MultiColumnTable | TieredTable;
/**
 * Result from a simple table lookup
 */
export interface SimpleLookupResult {
    tableType: "simple";
    tableId: string;
    tableName: string;
    roll: number;
    text: string;
    effect?: TableEffect;
    entry: SimpleTableEntry;
}
/**
 * Result from a multi-column table lookup
 */
export interface MultiColumnLookupResult {
    tableType: "multi-column";
    tableId: string;
    tableName: string;
    roll: number;
    column: string;
    text: string;
    effect?: TableEffect;
    row: MultiColumnRow;
}
/**
 * Result from a tiered table lookup
 */
export interface TieredLookupResult {
    tableType: "tiered";
    tableId: string;
    tableName: string;
    roll: number;
    tier: ResultTier;
    text: string;
    effect?: TableEffect;
    entry: TieredEntry;
    manifestation?: string;
}
/**
 * Union of all lookup result types
 */
export type LookupResult = SimpleLookupResult | MultiColumnLookupResult | TieredLookupResult;
/**
 * Reference to a table from a skill definition.
 * Specifies which table to use and how to determine the column (if applicable).
 */
export interface TableReference {
    /** Table ID to look up */
    tableId: string;
    /**
     * For multi-column tables: how to determine the column.
     * - "crit-die": Use the character's crit die
     * - "action-die": Use the action die
     * - A specific column ID
     */
    columnSource?: string;
    /**
     * Modifier to apply to the roll before lookup.
     * Can be a number or a reference like "luck" or "level".
     */
    rollModifier?: number | string;
}
//# sourceMappingURL=types.d.ts.map