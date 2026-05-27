/**
 * Table Registry
 *
 * Functions for registering, loading, and retrieving tables.
 * Tables can be loaded from JSON or registered programmatically.
 */
import { validateTable } from "./lookup.js";
// =============================================================================
// Table Registry State
// =============================================================================
/**
 * In-memory table storage.
 * In a real application, this might be loaded from files or a database.
 */
const tableRegistry = new Map();
// =============================================================================
// Registration Functions
// =============================================================================
/**
 * Register a table in the registry.
 *
 * @param table - The table to register
 * @param options - Registration options
 * @throws If table ID already exists and overwrite is false
 */
export function registerTable(table, options = {}) {
    const { overwrite = false, validate = true } = options;
    if (!overwrite && tableRegistry.has(table.id)) {
        throw new Error(`Table with ID "${table.id}" already registered`);
    }
    if (validate) {
        const validation = validateTable(table);
        if (!validation.valid) {
            throw new Error(`Invalid table "${table.id}": ${validation.errors.join(", ")}`);
        }
    }
    tableRegistry.set(table.id, table);
}
/**
 * Register multiple tables at once.
 */
export function registerTables(tables, options = {}) {
    for (const table of tables) {
        registerTable(table, options);
    }
}
/**
 * Unregister a table from the registry.
 */
export function unregisterTable(tableId) {
    return tableRegistry.delete(tableId);
}
/**
 * Clear all registered tables.
 */
export function clearRegistry() {
    tableRegistry.clear();
}
// =============================================================================
// Retrieval Functions
// =============================================================================
/**
 * Get a table by ID.
 */
export function getTable(tableId) {
    return tableRegistry.get(tableId);
}
/**
 * Get a table by ID, throwing if not found.
 */
export function requireTable(tableId) {
    const table = tableRegistry.get(tableId);
    if (!table) {
        throw new Error(`Table "${tableId}" not found in registry`);
    }
    return table;
}
/**
 * Get a simple table by ID.
 */
export function getSimpleTable(tableId) {
    const table = tableRegistry.get(tableId);
    if (table?.type === "simple") {
        return table;
    }
    return undefined;
}
/**
 * Get a multi-column table by ID.
 */
export function getMultiColumnTable(tableId) {
    const table = tableRegistry.get(tableId);
    if (table?.type === "multi-column") {
        return table;
    }
    return undefined;
}
/**
 * Get a tiered table by ID.
 */
export function getTieredTable(tableId) {
    const table = tableRegistry.get(tableId);
    if (table?.type === "tiered") {
        return table;
    }
    return undefined;
}
/**
 * Check if a table exists in the registry.
 */
export function hasTable(tableId) {
    return tableRegistry.has(tableId);
}
/**
 * Get all registered table IDs.
 */
export function getTableIds() {
    return Array.from(tableRegistry.keys());
}
/**
 * Get all tables of a specific type.
 */
export function getTablesByType(type) {
    return Array.from(tableRegistry.values()).filter((t) => t.type === type);
}
/**
 * Get all tables with a specific tag.
 */
export function getTablesByTag(tag) {
    return Array.from(tableRegistry.values()).filter((t) => t.tags?.includes(tag));
}
// =============================================================================
// JSON Loading
// =============================================================================
/**
 * Type guard for SimpleTable
 */
function isSimpleTable(data) {
    return (typeof data === "object" &&
        data !== null &&
        "type" in data &&
        data.type === "simple" &&
        "entries" in data &&
        Array.isArray(data.entries));
}
/**
 * Type guard for MultiColumnTable
 */
function isMultiColumnTable(data) {
    return (typeof data === "object" &&
        data !== null &&
        "type" in data &&
        data.type === "multi-column" &&
        "rows" in data &&
        Array.isArray(data.rows));
}
/**
 * Type guard for TieredTable
 */
function isTieredTable(data) {
    return (typeof data === "object" &&
        data !== null &&
        "type" in data &&
        data.type === "tiered" &&
        "entries" in data &&
        Array.isArray(data.entries));
}
/**
 * Parse a table from JSON data.
 *
 * @param data - Raw JSON data
 * @returns Parsed table or error
 */
export function parseTable(data) {
    if (typeof data !== "object" || data === null) {
        return { success: false, error: "Table data must be an object" };
    }
    const obj = data;
    if (!obj["id"] || typeof obj["id"] !== "string") {
        return { success: false, error: "Table must have a string 'id' field" };
    }
    if (!obj["name"] || typeof obj["name"] !== "string") {
        return { success: false, error: "Table must have a string 'name' field" };
    }
    if (!obj["type"] || typeof obj["type"] !== "string") {
        return { success: false, error: "Table must have a string 'type' field" };
    }
    if (isSimpleTable(data)) {
        return { success: true, table: data };
    }
    if (isMultiColumnTable(data)) {
        return { success: true, table: data };
    }
    if (isTieredTable(data)) {
        return { success: true, table: data };
    }
    return {
        success: false,
        error: `Unknown table type: ${obj["type"]}`,
    };
}
/**
 * Load a table from a JSON string.
 */
export function loadTableFromJson(json) {
    let data;
    try {
        data = JSON.parse(json);
    }
    catch {
        return { success: false, error: "Invalid JSON" };
    }
    return parseTable(data);
}
/**
 * Load and register a table from JSON.
 */
export function loadAndRegisterTable(json, options = {}) {
    const result = loadTableFromJson(json);
    if (!result.success) {
        return result;
    }
    try {
        registerTable(result.table, options);
        return { success: true, tableId: result.table.id };
    }
    catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : "Unknown error",
        };
    }
}
/**
 * Load multiple tables from a JSON array.
 */
export function loadTablesFromJson(json) {
    let data;
    try {
        data = JSON.parse(json);
    }
    catch {
        return { success: false, error: "Invalid JSON" };
    }
    if (!Array.isArray(data)) {
        return { success: false, error: "Expected an array of tables" };
    }
    const tables = [];
    for (let i = 0; i < data.length; i++) {
        const result = parseTable(data[i]);
        if (!result.success) {
            return {
                success: false,
                error: `Table at index ${String(i)}: ${result.error}`,
            };
        }
        tables.push(result.table);
    }
    return { success: true, tables };
}
//# sourceMappingURL=registry.js.map