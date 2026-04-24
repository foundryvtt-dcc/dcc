/**
 * Tests for Table Registry Functions
 */
import { describe, it, expect, beforeEach } from "vitest";
import { registerTable, registerTables, unregisterTable, clearRegistry, getTable, requireTable, getSimpleTable, getMultiColumnTable, getTieredTable, hasTable, getTableIds, getTablesByType, getTablesByTag, parseTable, loadTableFromJson, loadAndRegisterTable, loadTablesFromJson, } from "./registry.js";
// =============================================================================
// Test Fixtures
// =============================================================================
const simpleTable = {
    id: "test-simple",
    name: "Test Simple Table",
    type: "simple",
    tags: ["test", "simple"],
    entries: [
        { min: 1, max: 10, text: "Low" },
        { min: 11, max: 20, text: "High" },
    ],
};
const multiColumnTable = {
    id: "test-multi",
    name: "Test Multi-Column Table",
    type: "multi-column",
    tags: ["test", "crit"],
    columns: [
        { id: "d4", label: "d4" },
        { id: "d6", label: "d6" },
    ],
    rows: [
        {
            min: 1,
            max: 2,
            columns: {
                d4: { text: "Minor" },
                d6: { text: "Moderate" },
            },
        },
    ],
};
const tieredTable = {
    id: "test-tiered",
    name: "Test Tiered Table",
    type: "tiered",
    tags: ["test", "spell"],
    entries: [
        { min: 1, max: 5, tier: "failure", text: "Failure" },
        { min: 6, max: 10, tier: "success", text: "Success" },
    ],
};
// =============================================================================
// Setup
// =============================================================================
beforeEach(() => {
    clearRegistry();
});
// =============================================================================
// Registration Tests
// =============================================================================
describe("Table Registration", () => {
    describe("registerTable", () => {
        it("registers a simple table", () => {
            registerTable(simpleTable);
            expect(hasTable("test-simple")).toBe(true);
        });
        it("registers a multi-column table", () => {
            registerTable(multiColumnTable);
            expect(hasTable("test-multi")).toBe(true);
        });
        it("registers a tiered table", () => {
            registerTable(tieredTable);
            expect(hasTable("test-tiered")).toBe(true);
        });
        it("throws on duplicate ID by default", () => {
            registerTable(simpleTable);
            expect(() => {
                registerTable(simpleTable);
            }).toThrow('Table with ID "test-simple" already registered');
        });
        it("allows overwrite with option", () => {
            registerTable(simpleTable);
            const modified = { ...simpleTable, name: "Modified" };
            registerTable(modified, { overwrite: true });
            expect(getTable("test-simple")?.name).toBe("Modified");
        });
        it("validates table by default", () => {
            const invalidTable = {
                id: "invalid",
                name: "Invalid Table",
                type: "simple",
                entries: [
                    { min: 1, max: 10, text: "Low" },
                    { min: 5, max: 15, text: "Overlap" }, // Overlaps with previous
                ],
            };
            expect(() => {
                registerTable(invalidTable);
            }).toThrow("Invalid table");
        });
        it("skips validation with option", () => {
            const invalidTable = {
                id: "invalid",
                name: "Invalid Table",
                type: "simple",
                entries: [
                    { min: 1, max: 10, text: "Low" },
                    { min: 5, max: 15, text: "Overlap" },
                ],
            };
            registerTable(invalidTable, { validate: false });
            expect(hasTable("invalid")).toBe(true);
        });
    });
    describe("registerTables", () => {
        it("registers multiple tables", () => {
            registerTables([simpleTable, multiColumnTable, tieredTable]);
            expect(getTableIds()).toHaveLength(3);
        });
    });
    describe("unregisterTable", () => {
        it("removes a registered table", () => {
            registerTable(simpleTable);
            expect(unregisterTable("test-simple")).toBe(true);
            expect(hasTable("test-simple")).toBe(false);
        });
        it("returns false for non-existent table", () => {
            expect(unregisterTable("nonexistent")).toBe(false);
        });
    });
    describe("clearRegistry", () => {
        it("removes all tables", () => {
            registerTables([simpleTable, multiColumnTable, tieredTable]);
            clearRegistry();
            expect(getTableIds()).toHaveLength(0);
        });
    });
});
// =============================================================================
// Retrieval Tests
// =============================================================================
describe("Table Retrieval", () => {
    beforeEach(() => {
        registerTables([simpleTable, multiColumnTable, tieredTable]);
    });
    describe("getTable", () => {
        it("returns table by ID", () => {
            const table = getTable("test-simple");
            expect(table?.name).toBe("Test Simple Table");
        });
        it("returns undefined for non-existent table", () => {
            expect(getTable("nonexistent")).toBeUndefined();
        });
    });
    describe("requireTable", () => {
        it("returns table by ID", () => {
            const table = requireTable("test-simple");
            expect(table.name).toBe("Test Simple Table");
        });
        it("throws for non-existent table", () => {
            expect(() => requireTable("nonexistent")).toThrow('Table "nonexistent" not found');
        });
    });
    describe("getSimpleTable", () => {
        it("returns simple table by ID", () => {
            const table = getSimpleTable("test-simple");
            expect(table?.type).toBe("simple");
        });
        it("returns undefined for wrong type", () => {
            expect(getSimpleTable("test-multi")).toBeUndefined();
        });
        it("returns undefined for non-existent table", () => {
            expect(getSimpleTable("nonexistent")).toBeUndefined();
        });
    });
    describe("getMultiColumnTable", () => {
        it("returns multi-column table by ID", () => {
            const table = getMultiColumnTable("test-multi");
            expect(table?.type).toBe("multi-column");
        });
        it("returns undefined for wrong type", () => {
            expect(getMultiColumnTable("test-simple")).toBeUndefined();
        });
    });
    describe("getTieredTable", () => {
        it("returns tiered table by ID", () => {
            const table = getTieredTable("test-tiered");
            expect(table?.type).toBe("tiered");
        });
        it("returns undefined for wrong type", () => {
            expect(getTieredTable("test-simple")).toBeUndefined();
        });
    });
    describe("hasTable", () => {
        it("returns true for existing table", () => {
            expect(hasTable("test-simple")).toBe(true);
        });
        it("returns false for non-existent table", () => {
            expect(hasTable("nonexistent")).toBe(false);
        });
    });
    describe("getTableIds", () => {
        it("returns all registered IDs", () => {
            const ids = getTableIds();
            expect(ids).toContain("test-simple");
            expect(ids).toContain("test-multi");
            expect(ids).toContain("test-tiered");
        });
    });
    describe("getTablesByType", () => {
        it("returns all simple tables", () => {
            const tables = getTablesByType("simple");
            expect(tables).toHaveLength(1);
            expect(tables[0]?.id).toBe("test-simple");
        });
        it("returns all multi-column tables", () => {
            const tables = getTablesByType("multi-column");
            expect(tables).toHaveLength(1);
            expect(tables[0]?.id).toBe("test-multi");
        });
        it("returns all tiered tables", () => {
            const tables = getTablesByType("tiered");
            expect(tables).toHaveLength(1);
            expect(tables[0]?.id).toBe("test-tiered");
        });
    });
    describe("getTablesByTag", () => {
        it("returns tables with matching tag", () => {
            const testTables = getTablesByTag("test");
            expect(testTables).toHaveLength(3);
        });
        it("returns specific tag matches", () => {
            const critTables = getTablesByTag("crit");
            expect(critTables).toHaveLength(1);
            expect(critTables[0]?.id).toBe("test-multi");
        });
        it("returns empty array for non-existent tag", () => {
            expect(getTablesByTag("nonexistent")).toHaveLength(0);
        });
    });
});
// =============================================================================
// JSON Loading Tests
// =============================================================================
describe("JSON Loading", () => {
    describe("parseTable", () => {
        it("parses a valid simple table", () => {
            const result = parseTable(simpleTable);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.table.type).toBe("simple");
            }
        });
        it("parses a valid multi-column table", () => {
            const result = parseTable(multiColumnTable);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.table.type).toBe("multi-column");
            }
        });
        it("parses a valid tiered table", () => {
            const result = parseTable(tieredTable);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.table.type).toBe("tiered");
            }
        });
        it("fails for non-object data", () => {
            const result = parseTable("not an object");
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBe("Table data must be an object");
            }
        });
        it("fails for null data", () => {
            const result = parseTable(null);
            expect(result.success).toBe(false);
        });
        it("fails for missing id", () => {
            const result = parseTable({ name: "Test", type: "simple", entries: [] });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toContain("id");
            }
        });
        it("fails for missing name", () => {
            const result = parseTable({ id: "test", type: "simple", entries: [] });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toContain("name");
            }
        });
        it("fails for missing type", () => {
            const result = parseTable({ id: "test", name: "Test", entries: [] });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toContain("type");
            }
        });
        it("fails for unknown type", () => {
            const result = parseTable({ id: "test", name: "Test", type: "unknown", entries: [] });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toContain("Unknown table type");
            }
        });
    });
    describe("loadTableFromJson", () => {
        it("loads valid JSON", () => {
            const json = JSON.stringify(simpleTable);
            const result = loadTableFromJson(json);
            expect(result.success).toBe(true);
        });
        it("fails for invalid JSON", () => {
            const result = loadTableFromJson("not json");
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBe("Invalid JSON");
            }
        });
    });
    describe("loadAndRegisterTable", () => {
        it("loads and registers a table", () => {
            const json = JSON.stringify(simpleTable);
            const result = loadAndRegisterTable(json);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.tableId).toBe("test-simple");
            }
            expect(hasTable("test-simple")).toBe(true);
        });
        it("returns error for invalid JSON", () => {
            const result = loadAndRegisterTable("not json");
            expect(result.success).toBe(false);
        });
        it("returns error for duplicate ID", () => {
            const json = JSON.stringify(simpleTable);
            loadAndRegisterTable(json);
            const result = loadAndRegisterTable(json);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toContain("already registered");
            }
        });
    });
    describe("loadTablesFromJson", () => {
        it("loads multiple tables", () => {
            const json = JSON.stringify([simpleTable, tieredTable]);
            const result = loadTablesFromJson(json);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.tables).toHaveLength(2);
            }
        });
        it("fails for non-array JSON", () => {
            const json = JSON.stringify(simpleTable);
            const result = loadTablesFromJson(json);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toContain("array");
            }
        });
        it("fails for invalid table in array", () => {
            const json = JSON.stringify([simpleTable, { invalid: true }]);
            const result = loadTablesFromJson(json);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toContain("index 1");
            }
        });
        it("fails for invalid JSON", () => {
            const result = loadTablesFromJson("not json");
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBe("Invalid JSON");
            }
        });
    });
});
//# sourceMappingURL=registry.test.js.map