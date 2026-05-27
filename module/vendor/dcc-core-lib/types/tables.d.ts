/**
 * Table Types
 *
 * Types for rollable tables (luck, crits, fumbles, etc.)
 */
/**
 * A single entry in a rollable table
 */
export interface TableEntry {
    /** Minimum roll value for this entry */
    min: number;
    /** Maximum roll value for this entry */
    max: number;
    /** The result text/description */
    text: string;
    /** Optional structured data parsed from the text */
    data?: Record<string, unknown>;
}
/**
 * A complete rollable table
 */
export interface RollableTable {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Description of the table */
    description?: string;
    /** The die formula to roll (e.g., "1d30") */
    formula: string;
    /** Table entries sorted by range */
    entries: TableEntry[];
}
/**
 * Birth augur (luck) table entry with parsed data
 */
export interface BirthAugurEntry {
    /** Roll value (1-30) */
    roll: number;
    /** Name of the birth augur (e.g., "Harsh winter") */
    name: string;
    /** What the luck modifier affects (e.g., "All attack rolls") */
    affects: string;
    /** Parsed effect type for programmatic use */
    effectType?: BirthAugurEffectType;
}
/**
 * Types of effects birth augurs can have
 */
export type BirthAugurEffectType = "attack-all" | "attack-melee" | "attack-missile" | "attack-unarmed" | "attack-mounted" | "damage-all" | "damage-melee" | "damage-missile" | "skill-check" | "find-trap" | "find-secret-door" | "spell-check" | "spell-damage" | "turn-unholy" | "magical-healing" | "saving-throw-all" | "saving-throw-trap" | "saving-throw-poison" | "saving-throw-reflex" | "saving-throw-fortitude" | "saving-throw-will" | "armor-class" | "initiative" | "hit-points" | "critical-table" | "fumble-table" | "corruption" | "languages" | "speed" | "starting-weapon" | "unknown";
/**
 * Look up a result in a table by roll value
 */
export declare function lookupTableResult(table: RollableTable, roll: number): TableEntry | undefined;
/**
 * Look up a birth augur by roll value
 */
export declare function lookupBirthAugurEntry(augurs: BirthAugurEntry[], roll: number): BirthAugurEntry | undefined;
//# sourceMappingURL=tables.d.ts.map