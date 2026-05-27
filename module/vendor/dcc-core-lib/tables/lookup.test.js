/**
 * Tests for Table Lookup Functions
 */
import { describe, it, expect } from "vitest";
import { findSimpleEntry, lookupSimple, findMultiColumnRow, lookupMultiColumn, getTableColumns, findTieredEntry, determineTier, lookupTiered, getEntriesForTier, lookup, getTableRange, validateTable, tableCoversRoll, } from "./lookup.js";
// =============================================================================
// Test Fixtures
// =============================================================================
const simpleTable = {
    id: "test-simple",
    name: "Test Simple Table",
    type: "simple",
    die: "d20",
    entries: [
        { min: 1, max: 5, text: "Failure", effect: { type: "none" } },
        { min: 6, max: 10, text: "Partial success" },
        { min: 11, max: 15, text: "Success", effect: { type: "success" } },
        { min: 16, max: 20, text: "Critical success", effect: { type: "critical", value: 2 } },
    ],
};
const multiColumnTable = {
    id: "test-crit",
    name: "Test Crit Table",
    type: "multi-column",
    columns: [
        { id: "d4", label: "d4" },
        { id: "d6", label: "d6" },
        { id: "d8", label: "d8" },
    ],
    rows: [
        {
            min: 1,
            max: 2,
            columns: {
                d4: { text: "+1 damage", effect: { type: "damage", value: 1 } },
                d6: { text: "+2 damage", effect: { type: "damage", value: 2 } },
                d8: { text: "+3 damage", effect: { type: "damage", value: 3 } },
            },
        },
        {
            min: 3,
            max: 4,
            columns: {
                d4: { text: "+1d4 damage", effect: { type: "damage", dice: "1d4" } },
                d6: { text: "+1d6 damage", effect: { type: "damage", dice: "1d6" } },
                d8: { text: "+1d8 damage", effect: { type: "damage", dice: "1d8" } },
            },
        },
    ],
};
const tieredTable = {
    id: "test-spell",
    name: "Test Spell",
    type: "tiered",
    spellLevel: 1,
    tiers: {
        lost: { min: 1, max: 1 },
        failure: { min: 2, max: 11 },
        "success-minor": { min: 12, max: 15 },
        success: { min: 16, max: 19 },
        "success-major": { min: 20, max: 25 },
    },
    entries: [
        { min: 1, max: 1, tier: "lost", text: "Lost. Failure.", effect: { type: "lost" } },
        { min: 2, max: 11, tier: "failure", text: "Failure." },
        { min: 12, max: 15, tier: "success-minor", text: "Minor effect", effect: { type: "damage", dice: "1d4" } },
        { min: 16, max: 19, tier: "success", text: "Standard effect", effect: { type: "damage", dice: "1d6" } },
        { min: 20, max: 25, tier: "success-major", text: "Major effect", effect: { type: "damage", dice: "2d6" }, manifestation: "Flames erupt" },
    ],
};
// =============================================================================
// Simple Table Tests
// =============================================================================
describe("Simple Table Lookup", () => {
    describe("findSimpleEntry", () => {
        it("finds entry at minimum value", () => {
            const entry = findSimpleEntry(simpleTable, 1);
            expect(entry?.text).toBe("Failure");
        });
        it("finds entry at maximum value", () => {
            const entry = findSimpleEntry(simpleTable, 5);
            expect(entry?.text).toBe("Failure");
        });
        it("finds entry in middle of range", () => {
            const entry = findSimpleEntry(simpleTable, 13);
            expect(entry?.text).toBe("Success");
        });
        it("returns undefined for value below range", () => {
            const entry = findSimpleEntry(simpleTable, 0);
            expect(entry).toBeUndefined();
        });
        it("returns undefined for value above range", () => {
            const entry = findSimpleEntry(simpleTable, 21);
            expect(entry).toBeUndefined();
        });
    });
    describe("lookupSimple", () => {
        it("returns complete result for valid roll", () => {
            const result = lookupSimple(simpleTable, 15);
            expect(result).toBeDefined();
            expect(result?.tableType).toBe("simple");
            expect(result?.tableId).toBe("test-simple");
            expect(result?.tableName).toBe("Test Simple Table");
            expect(result?.roll).toBe(15);
            expect(result?.text).toBe("Success");
            expect(result?.effect?.type).toBe("success");
        });
        it("includes entry in result", () => {
            const result = lookupSimple(simpleTable, 18);
            expect(result?.entry.min).toBe(16);
            expect(result?.entry.max).toBe(20);
        });
        it("returns undefined for invalid roll", () => {
            const result = lookupSimple(simpleTable, 25);
            expect(result).toBeUndefined();
        });
        it("handles entry without effect", () => {
            const result = lookupSimple(simpleTable, 8);
            expect(result?.text).toBe("Partial success");
            expect(result?.effect).toBeUndefined();
        });
    });
});
// =============================================================================
// Multi-Column Table Tests
// =============================================================================
describe("Multi-Column Table Lookup", () => {
    describe("findMultiColumnRow", () => {
        it("finds row for roll", () => {
            const row = findMultiColumnRow(multiColumnTable, 1);
            expect(row).toBeDefined();
            expect(row?.min).toBe(1);
            expect(row?.max).toBe(2);
        });
        it("returns undefined for value outside range", () => {
            const row = findMultiColumnRow(multiColumnTable, 10);
            expect(row).toBeUndefined();
        });
    });
    describe("lookupMultiColumn", () => {
        it("returns result for valid roll and column", () => {
            const result = lookupMultiColumn(multiColumnTable, 1, "d6");
            expect(result).toBeDefined();
            expect(result?.tableType).toBe("multi-column");
            expect(result?.tableId).toBe("test-crit");
            expect(result?.column).toBe("d6");
            expect(result?.text).toBe("+2 damage");
            expect(result?.effect?.value).toBe(2);
        });
        it("returns different results for different columns", () => {
            const d4Result = lookupMultiColumn(multiColumnTable, 3, "d4");
            const d8Result = lookupMultiColumn(multiColumnTable, 3, "d8");
            expect(d4Result?.text).toBe("+1d4 damage");
            expect(d8Result?.text).toBe("+1d8 damage");
        });
        it("returns undefined for invalid column", () => {
            const result = lookupMultiColumn(multiColumnTable, 1, "d12");
            expect(result).toBeUndefined();
        });
        it("returns undefined for roll outside range", () => {
            const result = lookupMultiColumn(multiColumnTable, 10, "d6");
            expect(result).toBeUndefined();
        });
        it("includes row in result", () => {
            const result = lookupMultiColumn(multiColumnTable, 4, "d6");
            expect(result?.row.min).toBe(3);
            expect(result?.row.max).toBe(4);
        });
    });
    describe("getTableColumns", () => {
        it("returns all column IDs", () => {
            const columns = getTableColumns(multiColumnTable);
            expect(columns).toEqual(["d4", "d6", "d8"]);
        });
    });
});
// =============================================================================
// Tiered Table Tests
// =============================================================================
describe("Tiered Table Lookup", () => {
    describe("findTieredEntry", () => {
        it("finds entry for roll", () => {
            const entry = findTieredEntry(tieredTable, 14);
            expect(entry?.tier).toBe("success-minor");
        });
        it("handles entry with explicit max", () => {
            const entry = findTieredEntry(tieredTable, 1);
            expect(entry?.tier).toBe("lost");
        });
        it("returns undefined for roll outside range", () => {
            const entry = findTieredEntry(tieredTable, 30);
            expect(entry).toBeUndefined();
        });
    });
    describe("determineTier", () => {
        it("determines tier from tiers definition", () => {
            expect(determineTier(tieredTable, 1)).toBe("lost");
            expect(determineTier(tieredTable, 5)).toBe("failure");
            expect(determineTier(tieredTable, 14)).toBe("success-minor");
            expect(determineTier(tieredTable, 18)).toBe("success");
            expect(determineTier(tieredTable, 22)).toBe("success-major");
        });
        it("falls back to entry tier when not in tiers definition", () => {
            const tableWithoutTiers = {
                id: "no-tiers",
                name: "No Tiers Table",
                type: "tiered",
                entries: [
                    { min: 1, max: 10, tier: "failure", text: "Fail" },
                    { min: 11, max: 20, tier: "success", text: "Success" },
                ],
            };
            expect(determineTier(tableWithoutTiers, 5)).toBe("failure");
            expect(determineTier(tableWithoutTiers, 15)).toBe("success");
        });
        it("returns undefined for roll outside all ranges", () => {
            expect(determineTier(tieredTable, 50)).toBeUndefined();
        });
    });
    describe("lookupTiered", () => {
        it("returns complete result for valid roll", () => {
            const result = lookupTiered(tieredTable, 17);
            expect(result).toBeDefined();
            expect(result?.tableType).toBe("tiered");
            expect(result?.tableId).toBe("test-spell");
            expect(result?.roll).toBe(17);
            expect(result?.tier).toBe("success");
            expect(result?.text).toBe("Standard effect");
            expect(result?.effect?.dice).toBe("1d6");
        });
        it("includes manifestation when present", () => {
            const result = lookupTiered(tieredTable, 22);
            expect(result?.manifestation).toBe("Flames erupt");
        });
        it("returns undefined for roll outside range", () => {
            const result = lookupTiered(tieredTable, 30);
            expect(result).toBeUndefined();
        });
        it("includes entry in result", () => {
            const result = lookupTiered(tieredTable, 1);
            expect(result?.entry.tier).toBe("lost");
        });
    });
    describe("getEntriesForTier", () => {
        it("returns all entries for a tier", () => {
            const entries = getEntriesForTier(tieredTable, "failure");
            expect(entries).toHaveLength(1);
            expect(entries[0]?.text).toBe("Failure.");
        });
        it("returns empty array for tier with no entries", () => {
            const entries = getEntriesForTier(tieredTable, "success-critical");
            expect(entries).toHaveLength(0);
        });
    });
});
// =============================================================================
// Generic Lookup Tests
// =============================================================================
describe("Generic lookup function", () => {
    it("handles simple tables", () => {
        const result = lookup(simpleTable, 15);
        expect(result?.tableType).toBe("simple");
        expect(result?.text).toBe("Success");
    });
    it("handles multi-column tables with column", () => {
        const result = lookup(multiColumnTable, 2, "d8");
        expect(result?.tableType).toBe("multi-column");
        if (result?.tableType === "multi-column") {
            expect(result.column).toBe("d8");
        }
    });
    it("throws for multi-column table without column", () => {
        expect(() => lookup(multiColumnTable, 2)).toThrow('Multi-column table "test-crit" requires a column parameter');
    });
    it("handles tiered tables", () => {
        const result = lookup(tieredTable, 14);
        expect(result?.tableType).toBe("tiered");
        if (result?.tableType === "tiered") {
            expect(result.tier).toBe("success-minor");
        }
    });
});
// =============================================================================
// Utility Function Tests
// =============================================================================
describe("getTableRange", () => {
    it("returns range for simple table", () => {
        const range = getTableRange(simpleTable);
        expect(range.min).toBe(1);
        expect(range.max).toBe(20);
    });
    it("returns range for multi-column table", () => {
        const range = getTableRange(multiColumnTable);
        expect(range.min).toBe(1);
        expect(range.max).toBe(4);
    });
    it("returns range for tiered table", () => {
        const range = getTableRange(tieredTable);
        expect(range.min).toBe(1);
        expect(range.max).toBe(25);
    });
});
describe("validateTable", () => {
    it("validates a well-formed table", () => {
        const result = validateTable(simpleTable);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });
    it("detects gaps in ranges", () => {
        const tableWithGap = {
            id: "gap-table",
            name: "Table with Gap",
            type: "simple",
            entries: [
                { min: 1, max: 5, text: "Low" },
                { min: 10, max: 15, text: "High" }, // Gap: 6-9 missing
            ],
        };
        const result = validateTable(tableWithGap);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain("Gap detected");
    });
    it("detects overlapping ranges", () => {
        const tableWithOverlap = {
            id: "overlap-table",
            name: "Table with Overlap",
            type: "simple",
            entries: [
                { min: 1, max: 10, text: "Low" },
                { min: 8, max: 15, text: "High" }, // Overlap: 8-10
            ],
        };
        const result = validateTable(tableWithOverlap);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain("Overlap detected");
    });
    it("validates multi-column tables", () => {
        const result = validateTable(multiColumnTable);
        expect(result.valid).toBe(true);
    });
    it("validates tiered tables", () => {
        const result = validateTable(tieredTable);
        expect(result.valid).toBe(true);
    });
});
describe("tableCoversRoll", () => {
    it("returns true for covered roll in simple table", () => {
        expect(tableCoversRoll(simpleTable, 10)).toBe(true);
        expect(tableCoversRoll(simpleTable, 1)).toBe(true);
        expect(tableCoversRoll(simpleTable, 20)).toBe(true);
    });
    it("returns false for uncovered roll", () => {
        expect(tableCoversRoll(simpleTable, 0)).toBe(false);
        expect(tableCoversRoll(simpleTable, 25)).toBe(false);
    });
    it("works with multi-column tables", () => {
        expect(tableCoversRoll(multiColumnTable, 2)).toBe(true);
        expect(tableCoversRoll(multiColumnTable, 10)).toBe(false);
    });
    it("works with tiered tables", () => {
        expect(tableCoversRoll(tieredTable, 15)).toBe(true);
        expect(tableCoversRoll(tieredTable, 30)).toBe(false);
    });
});
//# sourceMappingURL=lookup.test.js.map