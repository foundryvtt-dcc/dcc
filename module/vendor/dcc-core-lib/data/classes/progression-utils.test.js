/**
 * Class Progression Utilities Tests
 *
 * Tests use sample class progression data to verify utility functions.
 * These tests do NOT use official DCC data - that data is in dcc-official-data.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { registerClassProgression, registerClassProgressions, clearClassProgressions, getClassProgression, getRegisteredClassIds, getSaveBonus, getSavingThrows, getAttackBonus, getActionDice, getCriticalHitData, getTitle, hasDeedDie, getHitDie, } from "./progression-utils.js";
/**
 * Sample warrior progression for testing (fan-made, not official data)
 */
const SAMPLE_WARRIOR = {
    classId: "warrior",
    name: "Warrior",
    skills: ["mighty-deed"],
    levels: {
        1: {
            attackBonus: "d3",
            criticalDie: "1d12",
            criticalTable: "III",
            critRange: 19,
            actionDice: ["1d20"],
            hitDie: "d12",
            saves: { ref: 1, frt: 1, wil: 0 },
            lawful: { title: "Squire", skills: {} },
            neutral: { title: "Wildling", skills: {} },
            chaotic: { title: "Bandit", skills: {} },
        },
        5: {
            attackBonus: "d7",
            criticalDie: "1d24",
            criticalTable: "V",
            critRange: 18,
            actionDice: ["1d20", "1d14"],
            hitDie: "d12",
            saves: { ref: 2, frt: 3, wil: 1 },
        },
        10: {
            attackBonus: "d10",
            criticalDie: "1d30+6",
            criticalTable: "V",
            critRange: 16,
            actionDice: ["1d20", "1d20", "1d14"],
            hitDie: "d12",
            saves: { ref: 4, frt: 6, wil: 4 },
        },
    },
};
/**
 * Sample thief progression for testing (fan-made, not official data)
 */
const SAMPLE_THIEF = {
    classId: "thief",
    name: "Thief",
    skills: ["backstab", "sneak-silently"],
    levels: {
        1: {
            attackBonus: 0,
            criticalDie: "1d10",
            criticalTable: "II",
            actionDice: ["1d20"],
            hitDie: "d6",
            saves: { ref: 1, frt: 1, wil: 0 },
            lawful: { title: "Bravo", skills: { backstab: 1 } },
            neutral: { title: "Beggar", skills: { backstab: 0 } },
            chaotic: { title: "Thug", skills: { backstab: 3 } },
        },
        3: {
            attackBonus: 2,
            criticalDie: "1d14",
            criticalTable: "II",
            actionDice: ["1d20"],
            hitDie: "d6",
            saves: { ref: 2, frt: 1, wil: 1 },
        },
        5: {
            attackBonus: 3,
            criticalDie: "1d20",
            criticalTable: "II",
            actionDice: ["1d20"],
            hitDie: "d6",
            saves: { ref: 3, frt: 2, wil: 1 },
        },
    },
};
/**
 * Sample wizard progression for testing (fan-made, not official data)
 */
const SAMPLE_WIZARD = {
    classId: "wizard",
    name: "Wizard",
    skills: ["spellcasting"],
    levels: {
        1: {
            attackBonus: 0,
            criticalDie: "1d6",
            criticalTable: "I",
            actionDice: ["1d20"],
            hitDie: "d4",
            saves: { ref: 0, frt: 0, wil: 1 },
        },
        5: {
            attackBonus: 2,
            criticalDie: "1d10",
            criticalTable: "I",
            actionDice: ["1d20", "1d14"],
            hitDie: "d4",
            saves: { ref: 1, frt: 1, wil: 3 },
        },
    },
};
/**
 * Sample dwarf progression for testing (fan-made, not official data)
 */
const SAMPLE_DWARF = {
    classId: "dwarf",
    name: "Dwarf",
    skills: ["shield-bash"],
    levels: {
        1: {
            attackBonus: "d3",
            criticalDie: "1d10",
            criticalTable: "III",
            actionDice: ["1d20"],
            hitDie: "d10",
            saves: { ref: 1, frt: 1, wil: 1 },
        },
        5: {
            attackBonus: "d7",
            criticalDie: "1d20",
            criticalTable: "III",
            actionDice: ["1d20", "1d14"],
            hitDie: "d10",
            saves: { ref: 2, frt: 3, wil: 2 },
        },
    },
};
describe("Class Progression Utilities", () => {
    beforeEach(() => {
        // Clear registry before each test
        clearClassProgressions();
    });
    describe("Registry functions", () => {
        it("registers a single class progression", () => {
            registerClassProgression(SAMPLE_WARRIOR);
            expect(getClassProgression("warrior")).toBe(SAMPLE_WARRIOR);
        });
        it("registers multiple class progressions", () => {
            registerClassProgressions([SAMPLE_WARRIOR, SAMPLE_THIEF, SAMPLE_WIZARD]);
            expect(getRegisteredClassIds()).toHaveLength(3);
            expect(getRegisteredClassIds()).toContain("warrior");
            expect(getRegisteredClassIds()).toContain("thief");
            expect(getRegisteredClassIds()).toContain("wizard");
        });
        it("clears all registered progressions", () => {
            registerClassProgressions([SAMPLE_WARRIOR, SAMPLE_THIEF]);
            clearClassProgressions();
            expect(getRegisteredClassIds()).toHaveLength(0);
        });
        it("returns undefined for unregistered class", () => {
            expect(getClassProgression("unknown")).toBeUndefined();
        });
    });
    describe("getSaveBonus", () => {
        beforeEach(() => {
            registerClassProgressions([SAMPLE_WARRIOR, SAMPLE_WIZARD, SAMPLE_THIEF]);
        });
        it("returns correct save bonus for warrior", () => {
            expect(getSaveBonus("warrior", 1, "frt")).toBe(1);
            expect(getSaveBonus("warrior", 5, "frt")).toBe(3);
            expect(getSaveBonus("warrior", 10, "frt")).toBe(6);
        });
        it("returns correct save bonus for wizard", () => {
            expect(getSaveBonus("wizard", 1, "wil")).toBe(1);
            expect(getSaveBonus("wizard", 5, "wil")).toBe(3);
        });
        it("returns 0 for unknown class", () => {
            expect(getSaveBonus("unknown", 1, "frt")).toBe(0);
        });
        it("returns 0 for invalid level", () => {
            expect(getSaveBonus("warrior", 0, "frt")).toBe(0);
            expect(getSaveBonus("warrior", 99, "frt")).toBe(0);
        });
    });
    describe("getSavingThrows", () => {
        beforeEach(() => {
            registerClassProgressions([SAMPLE_WARRIOR, SAMPLE_THIEF]);
        });
        it("returns all saves for warrior level 5", () => {
            const saves = getSavingThrows("warrior", 5);
            expect(saves).toEqual({ reflex: 2, fortitude: 3, will: 1 });
        });
        it("returns all saves for thief level 3", () => {
            const saves = getSavingThrows("thief", 3);
            expect(saves).toEqual({ reflex: 2, fortitude: 1, will: 1 });
        });
        it("returns zeros for unknown class", () => {
            const saves = getSavingThrows("unknown", 5);
            expect(saves).toEqual({ reflex: 0, fortitude: 0, will: 0 });
        });
    });
    describe("getAttackBonus", () => {
        beforeEach(() => {
            registerClassProgressions([SAMPLE_WARRIOR, SAMPLE_DWARF, SAMPLE_THIEF, SAMPLE_WIZARD]);
        });
        it("returns deed die for warrior", () => {
            expect(getAttackBonus("warrior", 1)).toBe("d3");
            expect(getAttackBonus("warrior", 5)).toBe("d7");
            expect(getAttackBonus("warrior", 10)).toBe("d10");
        });
        it("returns deed die for dwarf", () => {
            expect(getAttackBonus("dwarf", 1)).toBe("d3");
            expect(getAttackBonus("dwarf", 5)).toBe("d7");
        });
        it("returns number for other classes", () => {
            expect(getAttackBonus("thief", 1)).toBe(0);
            expect(getAttackBonus("thief", 5)).toBe(3);
            expect(getAttackBonus("wizard", 5)).toBe(2);
        });
        it("returns 0 for unknown class", () => {
            expect(getAttackBonus("unknown", 5)).toBe(0);
        });
    });
    describe("getActionDice", () => {
        beforeEach(() => {
            registerClassProgressions([SAMPLE_WARRIOR, SAMPLE_THIEF, SAMPLE_WIZARD]);
        });
        it("returns single d20 at level 1 for all classes", () => {
            expect(getActionDice("warrior", 1)).toEqual(["1d20"]);
            expect(getActionDice("thief", 1)).toEqual(["1d20"]);
            expect(getActionDice("wizard", 1)).toEqual(["1d20"]);
        });
        it("returns multiple dice at higher levels", () => {
            expect(getActionDice("warrior", 5)).toEqual(["1d20", "1d14"]);
            expect(getActionDice("warrior", 10)).toEqual(["1d20", "1d20", "1d14"]);
        });
        it("returns default for unknown class", () => {
            expect(getActionDice("unknown", 5)).toEqual(["1d20"]);
        });
    });
    describe("getCriticalHitData", () => {
        beforeEach(() => {
            registerClassProgressions([SAMPLE_WARRIOR, SAMPLE_THIEF]);
        });
        it("returns warrior crit data with threat range", () => {
            const crit = getCriticalHitData("warrior", 5);
            expect(crit.die).toBe("1d24");
            expect(crit.table).toBe("V");
            expect(crit.range).toBe(18);
        });
        it("returns thief crit data", () => {
            const crit = getCriticalHitData("thief", 3);
            expect(crit.die).toBe("1d14");
            expect(crit.table).toBe("II");
        });
        it("returns default for unknown class", () => {
            const crit = getCriticalHitData("unknown", 5);
            expect(crit.die).toBe("1d4");
            expect(crit.table).toBe("I");
        });
    });
    describe("getTitle", () => {
        beforeEach(() => {
            registerClassProgressions([SAMPLE_WARRIOR, SAMPLE_THIEF]);
        });
        it("returns warrior titles by alignment", () => {
            expect(getTitle("warrior", 1, "lawful")).toBe("Squire");
            expect(getTitle("warrior", 1, "neutral")).toBe("Wildling");
            expect(getTitle("warrior", 1, "chaotic")).toBe("Bandit");
        });
        it("returns thief titles by alignment", () => {
            expect(getTitle("thief", 1, "lawful")).toBe("Bravo");
            expect(getTitle("thief", 1, "neutral")).toBe("Beggar");
            expect(getTitle("thief", 1, "chaotic")).toBe("Thug");
        });
        it("returns undefined for levels without titles", () => {
            expect(getTitle("warrior", 5, "lawful")).toBeUndefined();
        });
        it("returns undefined for unknown class", () => {
            expect(getTitle("unknown", 1, "lawful")).toBeUndefined();
        });
    });
    describe("hasDeedDie", () => {
        it("returns true for warrior and dwarf", () => {
            expect(hasDeedDie("warrior")).toBe(true);
            expect(hasDeedDie("dwarf")).toBe(true);
        });
        it("returns false for other classes", () => {
            expect(hasDeedDie("thief")).toBe(false);
            expect(hasDeedDie("wizard")).toBe(false);
            expect(hasDeedDie("cleric")).toBe(false);
            expect(hasDeedDie("elf")).toBe(false);
            expect(hasDeedDie("halfling")).toBe(false);
        });
    });
    describe("getHitDie", () => {
        beforeEach(() => {
            registerClassProgressions([SAMPLE_WARRIOR, SAMPLE_DWARF, SAMPLE_THIEF, SAMPLE_WIZARD]);
        });
        it("returns correct hit dice for each registered class", () => {
            expect(getHitDie("warrior")).toBe("d12");
            expect(getHitDie("dwarf")).toBe("d10");
            expect(getHitDie("thief")).toBe("d6");
            expect(getHitDie("wizard")).toBe("d4");
        });
        it("returns default for unknown class", () => {
            expect(getHitDie("unknown")).toBe("d4");
        });
    });
});
//# sourceMappingURL=progression-utils.test.js.map