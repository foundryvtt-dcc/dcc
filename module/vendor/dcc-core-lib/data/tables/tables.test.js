/**
 * Tests for Fan-Made Tables
 */
import { describe, it, expect, beforeEach } from "vitest";
import { TEST_TURN_UNHOLY_TABLE } from "./test-turn-unholy.js";
import { TEST_LAY_ON_HANDS_TABLE } from "./test-lay-on-hands.js";
import { lookupSimple, validateTable, getTableRange, registerTable, clearRegistry, getTable, lookup, } from "../../tables/index.js";
describe("Test Turn Unholy Table", () => {
    beforeEach(() => {
        clearRegistry();
    });
    describe("table structure", () => {
        it("has valid structure", () => {
            const validation = validateTable(TEST_TURN_UNHOLY_TABLE);
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });
        it("has correct metadata", () => {
            expect(TEST_TURN_UNHOLY_TABLE.id).toBe("test-turn-unholy");
            expect(TEST_TURN_UNHOLY_TABLE.type).toBe("simple");
            expect(TEST_TURN_UNHOLY_TABLE.die).toBe("d20");
            expect(TEST_TURN_UNHOLY_TABLE.tags).toContain("test");
            expect(TEST_TURN_UNHOLY_TABLE.tags).toContain("fan-made");
        });
        it("covers full d20 range and beyond", () => {
            const range = getTableRange(TEST_TURN_UNHOLY_TABLE);
            expect(range.min).toBe(1);
            expect(range.max).toBe(999); // High rolls supported
        });
    });
    describe("lookups", () => {
        it("returns failure for low rolls", () => {
            const result = lookupSimple(TEST_TURN_UNHOLY_TABLE, 5);
            expect(result).toBeDefined();
            expect(result?.effect?.type).toBe("none");
            expect(result?.text).toContain("Failure");
        });
        it("returns minor success for medium rolls", () => {
            const result = lookupSimple(TEST_TURN_UNHOLY_TABLE, 12);
            expect(result).toBeDefined();
            expect(result?.effect?.type).toBe("turn");
            expect(result?.effect?.dice).toBe("1d4");
        });
        it("returns success for good rolls", () => {
            const result = lookupSimple(TEST_TURN_UNHOLY_TABLE, 16);
            expect(result).toBeDefined();
            expect(result?.effect?.type).toBe("turn");
            expect(result?.effect?.dice).toBe("1d6+CL");
        });
        it("returns turn-destroy for great rolls", () => {
            const result = lookupSimple(TEST_TURN_UNHOLY_TABLE, 20);
            expect(result).toBeDefined();
            expect(result?.effect?.type).toBe("turn-destroy");
            expect(result?.effect?.data?.["destroyDice"]).toBe("1d4");
        });
        it("returns critical success for very high rolls", () => {
            const result = lookupSimple(TEST_TURN_UNHOLY_TABLE, 25);
            expect(result).toBeDefined();
            expect(result?.effect?.type).toBe("turn-destroy");
            expect(result?.effect?.data?.["destroyDice"]).toBe("1d6");
            expect(result?.effect?.data?.["fleeRounds"]).toBe("permanent");
        });
    });
    describe("registry integration", () => {
        it("can be registered and retrieved", () => {
            registerTable(TEST_TURN_UNHOLY_TABLE);
            const retrieved = getTable("test-turn-unholy");
            expect(retrieved).toBeDefined();
            expect(retrieved?.name).toBe("Turn Unholy (Test)");
        });
        it("works with generic lookup after registration", () => {
            registerTable(TEST_TURN_UNHOLY_TABLE);
            const table = getTable("test-turn-unholy");
            expect(table).toBeDefined();
            if (table) {
                const result = lookup(table, 15);
                expect(result?.tableType).toBe("simple");
                expect(result?.text).toContain("Turn");
            }
        });
    });
});
describe("Test Lay on Hands Table", () => {
    beforeEach(() => {
        clearRegistry();
    });
    describe("table structure", () => {
        it("has valid structure", () => {
            const validation = validateTable(TEST_LAY_ON_HANDS_TABLE);
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });
        it("has correct metadata", () => {
            expect(TEST_LAY_ON_HANDS_TABLE.id).toBe("test-lay-on-hands");
            expect(TEST_LAY_ON_HANDS_TABLE.type).toBe("lay-on-hands");
            expect(TEST_LAY_ON_HANDS_TABLE.tags).toContain("healing");
            expect(TEST_LAY_ON_HANDS_TABLE.tags).toContain("fan-made");
        });
        it("covers full d20 range and beyond", () => {
            const range = getTableRange(TEST_LAY_ON_HANDS_TABLE);
            expect(range.min).toBe(1);
            expect(range.max).toBe(999);
        });
        it("row dice counts are non-decreasing across rolls for each alignment", () => {
            const rows = TEST_LAY_ON_HANDS_TABLE.rows;
            for (let i = 1; i < rows.length; i++) {
                const prev = rows[i - 1];
                const curr = rows[i];
                if (!prev || !curr)
                    continue;
                for (const col of ["same", "adjacent", "opposed"]) {
                    expect(curr.dice[col]).toBeGreaterThanOrEqual(prev.dice[col]);
                }
            }
        });
        it("same ≥ adjacent ≥ opposed within each row", () => {
            for (const row of TEST_LAY_ON_HANDS_TABLE.rows) {
                expect(row.dice.same).toBeGreaterThanOrEqual(row.dice.adjacent);
                expect(row.dice.adjacent).toBeGreaterThanOrEqual(row.dice.opposed);
            }
        });
    });
    describe("registry integration", () => {
        it("can be registered and retrieved", () => {
            registerTable(TEST_LAY_ON_HANDS_TABLE);
            const retrieved = getTable("test-lay-on-hands");
            expect(retrieved).toBeDefined();
            expect(retrieved?.name).toBe("Lay on Hands (Test)");
        });
    });
});
describe("Both tables together", () => {
    beforeEach(() => {
        clearRegistry();
    });
    it("can register both tables without conflict", () => {
        registerTable(TEST_TURN_UNHOLY_TABLE);
        registerTable(TEST_LAY_ON_HANDS_TABLE);
        expect(getTable("test-turn-unholy")).toBeDefined();
        expect(getTable("test-lay-on-hands")).toBeDefined();
    });
    it("each table returns correct results", () => {
        registerTable(TEST_TURN_UNHOLY_TABLE);
        registerTable(TEST_LAY_ON_HANDS_TABLE);
        const turnTable = getTable("test-turn-unholy");
        const healTable = getTable("test-lay-on-hands");
        expect(turnTable).toBeDefined();
        expect(healTable).toBeDefined();
        if (turnTable && healTable) {
            const turnResult = lookup(turnTable, 15);
            expect(turnResult?.text).toContain("Turn");
            // Lay-on-hands tables aren't roll-indexed in isolation; they're
            // consumed by `layOnHands()` with an alignment column. Just confirm
            // the registered shape is intact.
            expect(healTable.type).toBe("lay-on-hands");
        }
    });
});
//# sourceMappingURL=tables.test.js.map