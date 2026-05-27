/**
 * Table Registry
 *
 * Functions for registering, loading, and retrieving tables.
 * Tables can be loaded from JSON or registered programmatically.
 */
import type { LookupTable, SimpleTable, MultiColumnTable, TieredTable, TableType } from "./types.js";
/**
 * Register a table in the registry.
 *
 * @param table - The table to register
 * @param options - Registration options
 * @throws If table ID already exists and overwrite is false
 */
export declare function registerTable(table: LookupTable, options?: {
    overwrite?: boolean;
    validate?: boolean;
}): void;
/**
 * Register multiple tables at once.
 */
export declare function registerTables(tables: LookupTable[], options?: {
    overwrite?: boolean;
    validate?: boolean;
}): void;
/**
 * Unregister a table from the registry.
 */
export declare function unregisterTable(tableId: string): boolean;
/**
 * Clear all registered tables.
 */
export declare function clearRegistry(): void;
/**
 * Get a table by ID.
 */
export declare function getTable(tableId: string): LookupTable | undefined;
/**
 * Get a table by ID, throwing if not found.
 */
export declare function requireTable(tableId: string): LookupTable;
/**
 * Get a simple table by ID.
 */
export declare function getSimpleTable(tableId: string): SimpleTable | undefined;
/**
 * Get a multi-column table by ID.
 */
export declare function getMultiColumnTable(tableId: string): MultiColumnTable | undefined;
/**
 * Get a tiered table by ID.
 */
export declare function getTieredTable(tableId: string): TieredTable | undefined;
/**
 * Check if a table exists in the registry.
 */
export declare function hasTable(tableId: string): boolean;
/**
 * Get all registered table IDs.
 */
export declare function getTableIds(): string[];
/**
 * Get all tables of a specific type.
 */
export declare function getTablesByType(type: TableType): LookupTable[];
/**
 * Get all tables with a specific tag.
 */
export declare function getTablesByTag(tag: string): LookupTable[];
/**
 * Parse a table from JSON data.
 *
 * @param data - Raw JSON data
 * @returns Parsed table or error
 */
export declare function parseTable(data: unknown): {
    success: true;
    table: LookupTable;
} | {
    success: false;
    error: string;
};
/**
 * Load a table from a JSON string.
 */
export declare function loadTableFromJson(json: string): {
    success: true;
    table: LookupTable;
} | {
    success: false;
    error: string;
};
/**
 * Load and register a table from JSON.
 */
export declare function loadAndRegisterTable(json: string, options?: {
    overwrite?: boolean;
    validate?: boolean;
}): {
    success: true;
    tableId: string;
} | {
    success: false;
    error: string;
};
/**
 * Load multiple tables from a JSON array.
 */
export declare function loadTablesFromJson(json: string): {
    success: true;
    tables: LookupTable[];
} | {
    success: false;
    error: string;
};
//# sourceMappingURL=registry.d.ts.map