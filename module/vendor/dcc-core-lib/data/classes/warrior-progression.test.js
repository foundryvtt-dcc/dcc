/**
 * Warrior Class Progression Tests
 */
import { describe, expect, it } from "vitest";
import { WARRIOR_PROGRESSION, getWarriorDeedDieBonus } from "./warrior-progression.js";
describe("Warrior Class Progression", () => {
    describe("basic structure", () => {
        it("has correct class metadata", () => {
            expect(WARRIOR_PROGRESSION.classId).toBe("warrior");
            expect(WARRIOR_PROGRESSION.name).toBe("Warrior");
            expect(WARRIOR_PROGRESSION.skills).toContain("mighty-deed");
        });
        it("has all 10 levels", () => {
            expect(Object.keys(WARRIOR_PROGRESSION.levels)).toHaveLength(10);
            for (let level = 1; level <= 10; level++) {
                expect(WARRIOR_PROGRESSION.levels[level]).toBeDefined();
            }
        });
    });
    describe("level 1 stats", () => {
        const level1 = WARRIOR_PROGRESSION.levels[1];
        it("has correct base stats", () => {
            expect(level1?.attackBonus).toBe("d3");
            expect(level1?.criticalDie).toBe("1d12");
            expect(level1?.criticalTable).toBe("III");
            expect(level1?.critRange).toBe(19);
            expect(level1?.hitDie).toBe("d12");
            expect(level1?.actionDice).toEqual(["1d20"]);
        });
        it("has correct saves", () => {
            expect(level1?.saves).toEqual({ ref: 1, frt: 1, wil: 0 });
        });
        it("has alignment titles", () => {
            expect(level1?.lawful?.title).toBe("Squire");
            expect(level1?.neutral?.title).toBe("Wildling");
            expect(level1?.chaotic?.title).toBe("Bandit");
        });
    });
    describe("deed die progression", () => {
        it("increases deed die with level", () => {
            expect(WARRIOR_PROGRESSION.levels[1]?.attackBonus).toBe("d3");
            expect(WARRIOR_PROGRESSION.levels[2]?.attackBonus).toBe("d4");
            expect(WARRIOR_PROGRESSION.levels[3]?.attackBonus).toBe("d5");
            expect(WARRIOR_PROGRESSION.levels[4]?.attackBonus).toBe("d6");
            expect(WARRIOR_PROGRESSION.levels[5]?.attackBonus).toBe("d7");
            expect(WARRIOR_PROGRESSION.levels[6]?.attackBonus).toBe("d8");
            expect(WARRIOR_PROGRESSION.levels[7]?.attackBonus).toBe("d10");
            expect(WARRIOR_PROGRESSION.levels[8]?.attackBonus).toBe("d10");
            expect(WARRIOR_PROGRESSION.levels[9]?.attackBonus).toBe("d10");
            expect(WARRIOR_PROGRESSION.levels[10]?.attackBonus).toBe("d10");
        });
    });
    describe("threat range progression", () => {
        it("expands threat range at higher levels", () => {
            expect(WARRIOR_PROGRESSION.levels[1]?.critRange).toBe(19);
            expect(WARRIOR_PROGRESSION.levels[4]?.critRange).toBe(19);
            expect(WARRIOR_PROGRESSION.levels[5]?.critRange).toBe(18);
            expect(WARRIOR_PROGRESSION.levels[8]?.critRange).toBe(18);
            expect(WARRIOR_PROGRESSION.levels[9]?.critRange).toBe(17);
            expect(WARRIOR_PROGRESSION.levels[10]?.critRange).toBe(17);
        });
    });
    describe("critical hit progression", () => {
        it("increases crit die and table with level", () => {
            expect(WARRIOR_PROGRESSION.levels[1]?.criticalDie).toBe("1d12");
            expect(WARRIOR_PROGRESSION.levels[1]?.criticalTable).toBe("III");
            expect(WARRIOR_PROGRESSION.levels[3]?.criticalDie).toBe("1d16");
            expect(WARRIOR_PROGRESSION.levels[3]?.criticalTable).toBe("IV");
            expect(WARRIOR_PROGRESSION.levels[5]?.criticalDie).toBe("1d24");
            expect(WARRIOR_PROGRESSION.levels[5]?.criticalTable).toBe("V");
            expect(WARRIOR_PROGRESSION.levels[8]?.criticalDie).toBe("2d20");
            expect(WARRIOR_PROGRESSION.levels[10]?.criticalDie).toBe("2d20");
        });
    });
    describe("action dice progression", () => {
        it("gains additional action dice at higher levels", () => {
            expect(WARRIOR_PROGRESSION.levels[1]?.actionDice).toEqual(["1d20"]);
            expect(WARRIOR_PROGRESSION.levels[4]?.actionDice).toEqual(["1d20"]);
            expect(WARRIOR_PROGRESSION.levels[5]?.actionDice).toEqual(["1d20", "1d14"]);
            expect(WARRIOR_PROGRESSION.levels[6]?.actionDice).toEqual(["1d20", "1d16"]);
            expect(WARRIOR_PROGRESSION.levels[7]?.actionDice).toEqual(["1d20", "1d20"]);
            expect(WARRIOR_PROGRESSION.levels[10]?.actionDice).toEqual(["1d20", "1d20", "1d14"]);
        });
    });
    describe("saving throw progression", () => {
        it("improves saves with level", () => {
            // Level 1
            expect(WARRIOR_PROGRESSION.levels[1]?.saves).toEqual({ ref: 1, frt: 1, wil: 0 });
            // Level 5
            expect(WARRIOR_PROGRESSION.levels[5]?.saves).toEqual({ ref: 2, frt: 3, wil: 1 });
            // Level 10
            expect(WARRIOR_PROGRESSION.levels[10]?.saves).toEqual({ ref: 4, frt: 6, wil: 3 });
        });
        it("fortitude is highest save", () => {
            for (let level = 1; level <= 10; level++) {
                const saves = WARRIOR_PROGRESSION.levels[level]?.saves;
                expect(saves?.frt).toBeGreaterThanOrEqual(saves?.ref ?? 0);
                expect(saves?.frt).toBeGreaterThanOrEqual(saves?.wil ?? 0);
            }
        });
    });
    describe("getWarriorDeedDieBonus", () => {
        it("returns 0 for levels 1-6", () => {
            for (let level = 1; level <= 6; level++) {
                expect(getWarriorDeedDieBonus(level)).toBe(0);
            }
        });
        it("returns correct bonus for levels 7+", () => {
            expect(getWarriorDeedDieBonus(7)).toBe(1);
            expect(getWarriorDeedDieBonus(8)).toBe(2);
            expect(getWarriorDeedDieBonus(9)).toBe(3);
            expect(getWarriorDeedDieBonus(10)).toBe(4);
        });
        it("handles levels above 10", () => {
            expect(getWarriorDeedDieBonus(11)).toBe(4);
            expect(getWarriorDeedDieBonus(15)).toBe(4);
        });
        it("handles levels below 1", () => {
            expect(getWarriorDeedDieBonus(0)).toBe(0);
            expect(getWarriorDeedDieBonus(-1)).toBe(0);
        });
    });
    describe("alignment titles", () => {
        it("has titles for levels 1-5", () => {
            for (let level = 1; level <= 5; level++) {
                const levelData = WARRIOR_PROGRESSION.levels[level];
                expect(levelData?.lawful?.title).toBeTruthy();
                expect(levelData?.neutral?.title).toBeTruthy();
                expect(levelData?.chaotic?.title).toBeTruthy();
            }
        });
        it("does not have alignment data at level 6+", () => {
            for (let level = 6; level <= 10; level++) {
                const levelData = WARRIOR_PROGRESSION.levels[level];
                expect(levelData?.lawful).toBeUndefined();
                expect(levelData?.neutral).toBeUndefined();
                expect(levelData?.chaotic).toBeUndefined();
            }
        });
    });
});
//# sourceMappingURL=warrior-progression.test.js.map