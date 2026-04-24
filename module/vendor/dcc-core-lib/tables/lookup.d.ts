/**
 * Table Lookup Functions
 *
 * Functions for looking up results in DCC tables.
 */
import type { LookupTable, SimpleTable, MultiColumnTable, TieredTable, LookupResult, SimpleLookupResult, MultiColumnLookupResult, TieredLookupResult, SimpleTableEntry, MultiColumnRow, TieredEntry, ResultTier } from "./types.js";
/**
 * Find the matching entry in a simple table for a given roll.
 */
export declare function findSimpleEntry(table: SimpleTable, roll: number): SimpleTableEntry | undefined;
/**
 * Look up a result in a simple range table.
 *
 * @param table - The simple table to search
 * @param roll - The roll result to look up
 * @returns The lookup result, or undefined if no match
 */
export declare function lookupSimple(table: SimpleTable, roll: number): SimpleLookupResult | undefined;
/**
 * Find the matching row in a multi-column table for a given roll.
 */
export declare function findMultiColumnRow(table: MultiColumnTable, roll: number): MultiColumnRow | undefined;
/**
 * Look up a result in a multi-column table.
 *
 * @param table - The multi-column table to search
 * @param roll - The roll result to look up
 * @param column - The column ID to read
 * @returns The lookup result, or undefined if no match
 */
export declare function lookupMultiColumn(table: MultiColumnTable, roll: number, column: string): MultiColumnLookupResult | undefined;
/**
 * Get available column IDs for a multi-column table.
 */
export declare function getTableColumns(table: MultiColumnTable): string[];
/**
 * Find the matching entry in a tiered table for a given roll.
 */
export declare function findTieredEntry(table: TieredTable, roll: number): TieredEntry | undefined;
/**
 * Determine the result tier for a roll in a tiered table.
 */
export declare function determineTier(table: TieredTable, roll: number): ResultTier | undefined;
/**
 * Look up a result in a tiered table.
 *
 * @param table - The tiered table to search
 * @param roll - The roll result to look up
 * @returns The lookup result, or undefined if no match
 */
export declare function lookupTiered(table: TieredTable, roll: number): TieredLookupResult | undefined;
/**
 * Get all entries for a specific tier.
 */
export declare function getEntriesForTier(table: TieredTable, tier: ResultTier): TieredEntry[];
/**
 * Look up a result in any table type.
 *
 * @param table - Any lookup table
 * @param roll - The roll result to look up
 * @param column - Column ID (required for multi-column tables)
 * @returns The lookup result, or undefined if no match
 */
export declare function lookup(table: LookupTable, roll: number, column?: string): LookupResult | undefined;
/**
 * Get the valid roll range for a table.
 */
export declare function getTableRange(table: LookupTable): {
    min: number;
    max: number;
};
/**
 * Validate that a table has no gaps or overlaps in its ranges.
 */
export declare function validateTable(table: LookupTable): {
    valid: boolean;
    errors: string[];
};
/**
 * Check if a table covers a specific roll value.
 */
export declare function tableCoversRoll(table: LookupTable, roll: number): boolean;
//# sourceMappingURL=lookup.d.ts.map