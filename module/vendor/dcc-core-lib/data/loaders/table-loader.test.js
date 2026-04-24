import { describe, expect, it } from "vitest";
import { loadRollableTable, loadBirthAugurs, getBirthAugurModifier, } from "./table-loader.js";
describe("table-loader", () => {
    describe("loadRollableTable", () => {
        it("loads a simple table", () => {
            const raw = {
                _id: "test-table",
                name: "Test Table",
                description: "A test table",
                formula: "1d6",
                results: [
                    { range: [1, 2], description: "Low result" },
                    { range: [3, 4], description: "Medium result" },
                    { range: [5, 6], description: "High result" },
                ],
            };
            const table = loadRollableTable(raw);
            expect(table.id).toBe("test-table");
            expect(table.name).toBe("Test Table");
            expect(table.formula).toBe("1d6");
            expect(table.entries).toHaveLength(3);
            expect(table.entries[0]).toEqual({
                min: 1,
                max: 2,
                text: "Low result",
            });
        });
        it("sorts entries by min value", () => {
            const raw = {
                _id: "unsorted",
                name: "Unsorted",
                formula: "1d4",
                results: [
                    { range: [3, 4], description: "Third" },
                    { range: [1, 2], description: "First" },
                ],
            };
            const table = loadRollableTable(raw);
            expect(table.entries[0]?.min).toBe(1);
            expect(table.entries[1]?.min).toBe(3);
        });
    });
    describe("loadBirthAugurs", () => {
        it("parses birth augur descriptions", () => {
            const raw = {
                _id: "luck-table",
                name: "Table 1-2: Luck Score",
                formula: "1d30",
                results: [
                    { range: [1, 1], description: "Harsh winter: All attack rolls" },
                    { range: [2, 2], description: "The bull: Melee attack rolls" },
                    { range: [3, 3], description: "Fortunate date: Missile fire attack rolls" },
                ],
            };
            const augurs = loadBirthAugurs(raw);
            expect(augurs).toHaveLength(3);
            expect(augurs[0]).toEqual({
                roll: 1,
                name: "Harsh winter",
                affects: "All attack rolls",
                effectType: "attack-all",
            });
            expect(augurs[1]).toEqual({
                roll: 2,
                name: "The bull",
                affects: "Melee attack rolls",
                effectType: "attack-melee",
            });
            expect(augurs[2]).toEqual({
                roll: 3,
                name: "Fortunate date",
                affects: "Missile fire attack rolls",
                effectType: "attack-missile",
            });
        });
        it("parses various effect types", () => {
            const raw = {
                _id: "luck-table",
                name: "Table 1-2: Luck Score",
                formula: "1d30",
                results: [
                    { range: [10, 10], description: "Born under the loom: Skill checks (including thief skills)" },
                    { range: [13, 13], description: "Seventh son: Spell checks" },
                    { range: [17, 17], description: "Lucky sign: Saving throws" },
                    { range: [20, 20], description: "Struck by lightning: Reflex saving throws" },
                    { range: [23, 23], description: "Charmed house: Armor Class" },
                    { range: [24, 24], description: "Speed of the cobra: Initiative" },
                    { range: [25, 25], description: "Bountiful harvest: Hit points (applies at each level)" },
                ],
            };
            const augurs = loadBirthAugurs(raw);
            expect(augurs.find((a) => a.roll === 10)?.effectType).toBe("skill-check");
            expect(augurs.find((a) => a.roll === 13)?.effectType).toBe("spell-check");
            expect(augurs.find((a) => a.roll === 17)?.effectType).toBe("saving-throw-all");
            expect(augurs.find((a) => a.roll === 20)?.effectType).toBe("saving-throw-reflex");
            expect(augurs.find((a) => a.roll === 23)?.effectType).toBe("armor-class");
            expect(augurs.find((a) => a.roll === 24)?.effectType).toBe("initiative");
            expect(augurs.find((a) => a.roll === 25)?.effectType).toBe("hit-points");
        });
        it("sorts augurs by roll value", () => {
            const raw = {
                _id: "luck-table",
                name: "Luck",
                formula: "1d30",
                results: [
                    { range: [30, 30], description: "Last: Speed" },
                    { range: [1, 1], description: "First: All attack rolls" },
                    { range: [15, 15], description: "Middle: Turn unholy checks" },
                ],
            };
            const augurs = loadBirthAugurs(raw);
            expect(augurs[0]?.roll).toBe(1);
            expect(augurs[1]?.roll).toBe(15);
            expect(augurs[2]?.roll).toBe(30);
        });
        it("handles entries without colon separator", () => {
            const raw = {
                _id: "luck-table",
                name: "Luck",
                formula: "1d30",
                results: [
                    { range: [1, 1], description: "Harsh winter: All attack rolls" },
                    { range: [2, 2], description: "No colon here" }, // Invalid format
                ],
            };
            const augurs = loadBirthAugurs(raw);
            // Should skip the invalid entry
            expect(augurs).toHaveLength(1);
            expect(augurs[0]?.name).toBe("Harsh winter");
        });
    });
    describe("getBirthAugurModifier", () => {
        it("returns modifier with effect info", () => {
            const augur = {
                roll: 1,
                name: "Harsh winter",
                affects: "All attack rolls",
                effectType: "attack-all",
            };
            const result = getBirthAugurModifier(2, augur);
            expect(result).toEqual({
                modifier: 2,
                affects: "All attack rolls",
                effectType: "attack-all",
            });
        });
        it("works with negative modifiers", () => {
            const augur = {
                roll: 1,
                name: "Harsh winter",
                affects: "All attack rolls",
                effectType: "attack-all",
            };
            const result = getBirthAugurModifier(-2, augur);
            expect(result.modifier).toBe(-2);
        });
    });
});
//# sourceMappingURL=table-loader.test.js.map