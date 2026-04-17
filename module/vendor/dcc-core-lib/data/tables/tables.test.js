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
            expect(TEST_LAY_ON_HANDS_TABLE.type).toBe("simple");
            expect(TEST_LAY_ON_HANDS_TABLE.die).toBe("d20");
            expect(TEST_LAY_ON_HANDS_TABLE.tags).toContain("healing");
            expect(TEST_LAY_ON_HANDS_TABLE.tags).toContain("fan-made");
        });
        it("covers full d20 range and beyond", () => {
            const range = getTableRange(TEST_LAY_ON_HANDS_TABLE);
            expect(range.min).toBe(1);
            expect(range.max).toBe(999);
        });
    });
    describe("lookups", () => {
        it("returns failure for low rolls", () => {
            const result = lookupSimple(TEST_LAY_ON_HANDS_TABLE, 5);
            expect(result).toBeDefined();
            expect(result?.effect?.type).toBe("none");
            expect(result?.text).toContain("Failure");
        });
        it("returns minor healing for medium rolls", () => {
            const result = lookupSimple(TEST_LAY_ON_HANDS_TABLE, 12);
            expect(result).toBeDefined();
            expect(result?.effect?.type).toBe("heal");
            expect(result?.effect?.dice).toBe("1*CL");
        });
        it("returns standard healing for good rolls", () => {
            const result = lookupSimple(TEST_LAY_ON_HANDS_TABLE, 16);
            expect(result).toBeDefined();
            expect(result?.effect?.type).toBe("heal");
            expect(result?.effect?.dice).toBe("2*CL");
        });
        it("returns greater healing for great rolls", () => {
            const result = lookupSimple(TEST_LAY_ON_HANDS_TABLE, 20);
            expect(result).toBeDefined();
            expect(result?.effect?.type).toBe("heal");
            expect(result?.effect?.dice).toBe("3*CL");
        });
        it("returns miraculous healing with cure for high rolls", () => {
            const result = lookupSimple(TEST_LAY_ON_HANDS_TABLE, 24);
            expect(result).toBeDefined();
            expect(result?.effect?.type).toBe("heal-cure");
            expect(result?.effect?.dice).toBe("5*CL");
            expect(result?.effect?.data?.["cureDisease"]).toBe(true);
        });
        it("returns divine intervention for critical rolls", () => {
            const result = lookupSimple(TEST_LAY_ON_HANDS_TABLE, 30);
            expect(result).toBeDefined();
            expect(result?.effect?.type).toBe("heal-restore");
            expect(result?.effect?.dice).toBe("8*CL");
            expect(result?.effect?.data?.["restoreLimb"]).toBe(true);
        });
    });
    describe("healing progression", () => {
        it("healing increases with roll result", () => {
            const roll11 = lookupSimple(TEST_LAY_ON_HANDS_TABLE, 11);
            const roll15 = lookupSimple(TEST_LAY_ON_HANDS_TABLE, 15);
            const roll19 = lookupSimple(TEST_LAY_ON_HANDS_TABLE, 19);
            const roll27 = lookupSimple(TEST_LAY_ON_HANDS_TABLE, 27);
            expect(roll11?.effect?.dice).toBe("1*CL");
            expect(roll15?.effect?.dice).toBe("2*CL");
            expect(roll19?.effect?.dice).toBe("3*CL");
            expect(roll27?.effect?.dice).toBe("8*CL");
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
            const healResult = lookup(healTable, 15);
            expect(turnResult?.text).toContain("Turn");
            expect(healResult?.text).toContain("Restore");
        }
    });
});
//# sourceMappingURL=tables.test.js.map