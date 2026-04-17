/**
 * Table Lookup Functions
 *
 * Functions for looking up results in DCC tables.
 */
// =============================================================================
// Simple Table Lookup
// =============================================================================
/**
 * Find the matching entry in a simple table for a given roll.
 */
export function findSimpleEntry(table, roll) {
    return table.entries.find((e) => roll >= e.min && roll <= e.max);
}
/**
 * Look up a result in a simple range table.
 *
 * @param table - The simple table to search
 * @param roll - The roll result to look up
 * @returns The lookup result, or undefined if no match
 */
export function lookupSimple(table, roll) {
    const entry = findSimpleEntry(table, roll);
    if (!entry) {
        return undefined;
    }
    return {
        tableType: "simple",
        tableId: table.id,
        tableName: table.name,
        roll,
        text: entry.text,
        ...(entry.effect !== undefined && { effect: entry.effect }),
        entry,
    };
}
// =============================================================================
// Multi-Column Table Lookup
// =============================================================================
/**
 * Find the matching row in a multi-column table for a given roll.
 */
export function findMultiColumnRow(table, roll) {
    return table.rows.find((r) => roll >= r.min && roll <= r.max);
}
/**
 * Look up a result in a multi-column table.
 *
 * @param table - The multi-column table to search
 * @param roll - The roll result to look up
 * @param column - The column ID to read
 * @returns The lookup result, or undefined if no match
 */
export function lookupMultiColumn(table, roll, column) {
    const row = findMultiColumnRow(table, roll);
    if (!row) {
        return undefined;
    }
    const columnData = row.columns[column];
    if (!columnData) {
        // Column not found - try to find a default or closest column
        return undefined;
    }
    return {
        tableType: "multi-column",
        tableId: table.id,
        tableName: table.name,
        roll,
        column,
        text: columnData.text,
        ...(columnData.effect !== undefined && { effect: columnData.effect }),
        row,
    };
}
/**
 * Get available column IDs for a multi-column table.
 */
export function getTableColumns(table) {
    return table.columns.map((c) => c.id);
}
// =============================================================================
// Tiered Table Lookup
// =============================================================================
/**
 * Find the matching entry in a tiered table for a given roll.
 */
export function findTieredEntry(table, roll) {
    // Entries should be sorted, but search all to be safe
    for (const entry of table.entries) {
        const max = entry.max ?? entry.min;
        if (roll >= entry.min && roll <= max) {
            return entry;
        }
    }
    return undefined;
}
/**
 * Determine the result tier for a roll in a tiered table.
 */
export function determineTier(table, roll) {
    // First check the tier thresholds if defined
    if (table.tiers) {
        for (const [tier, range] of Object.entries(table.tiers)) {
            if (roll >= range.min && roll <= range.max) {
                return tier;
            }
        }
    }
    // Fall back to finding the entry
    const entry = findTieredEntry(table, roll);
    return entry?.tier;
}
/**
 * Look up a result in a tiered table.
 *
 * @param table - The tiered table to search
 * @param roll - The roll result to look up
 * @returns The lookup result, or undefined if no match
 */
export function lookupTiered(table, roll) {
    const entry = findTieredEntry(table, roll);
    if (!entry) {
        return undefined;
    }
    return {
        tableType: "tiered",
        tableId: table.id,
        tableName: table.name,
        roll,
        tier: entry.tier,
        text: entry.text,
        ...(entry.effect !== undefined && { effect: entry.effect }),
        entry,
        ...(entry.manifestation !== undefined && { manifestation: entry.manifestation }),
    };
}
/**
 * Get all entries for a specific tier.
 */
export function getEntriesForTier(table, tier) {
    return table.entries.filter((e) => e.tier === tier);
}
// =============================================================================
// Generic Lookup
// =============================================================================
/**
 * Look up a result in any table type.
 *
 * @param table - Any lookup table
 * @param roll - The roll result to look up
 * @param column - Column ID (required for multi-column tables)
 * @returns The lookup result, or undefined if no match
 */
export function lookup(table, roll, column) {
    switch (table.type) {
        case "simple":
            return lookupSimple(table, roll);
        case "multi-column":
            if (!column) {
                throw new Error(`Multi-column table "${table.id}" requires a column parameter`);
            }
            return lookupMultiColumn(table, roll, column);
        case "tiered":
            return lookupTiered(table, roll);
    }
}
// =============================================================================
// Utility Functions
// =============================================================================
/**
 * Get the valid roll range for a table.
 */
export function getTableRange(table) {
    switch (table.type) {
        case "simple": {
            const mins = table.entries.map((e) => e.min);
            const maxs = table.entries.map((e) => e.max);
            return {
                min: Math.min(...mins),
                max: Math.max(...maxs),
            };
        }
        case "multi-column": {
            const mins = table.rows.map((r) => r.min);
            const maxs = table.rows.map((r) => r.max);
            return {
                min: Math.min(...mins),
                max: Math.max(...maxs),
            };
        }
        case "tiered": {
            const mins = table.entries.map((e) => e.min);
            const maxs = table.entries.map((e) => e.max ?? e.min);
            return {
                min: Math.min(...mins),
                max: Math.max(...maxs),
            };
        }
    }
}
/**
 * Validate that a table has no gaps or overlaps in its ranges.
 */
export function validateTable(table) {
    const errors = [];
    const ranges = table.type === "multi-column"
        ? table.rows.map((r) => ({ min: r.min, max: r.max }))
        : table.type === "tiered"
            ? table.entries.map((e) => ({ min: e.min, max: e.max ?? e.min }))
            : table.entries.map((e) => ({ min: e.min, max: e.max }));
    // Sort by min
    const sorted = [...ranges].sort((a, b) => a.min - b.min);
    // Check for gaps and overlaps
    for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        if (!current || !next)
            continue;
        if (current.max >= next.min) {
            errors.push(`Overlap detected: ${String(current.min)}-${String(current.max)} overlaps with ${String(next.min)}-${String(next.max)}`);
        }
        else if (current.max + 1 < next.min) {
            errors.push(`Gap detected: no coverage between ${String(current.max)} and ${String(next.min)}`);
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
/**
 * Check if a table covers a specific roll value.
 */
export function tableCoversRoll(table, roll) {
    return lookup(table, roll, table.type === "multi-column" ? table.columns[0]?.id : undefined) !== undefined;
}
//# sourceMappingURL=lookup.js.map