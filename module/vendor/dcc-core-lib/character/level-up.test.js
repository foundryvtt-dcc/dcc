/**
 * Level Advancement Tests
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerXPThresholds, registerAllXPThresholds, clearXPThresholds, getXPThresholds, getXPForLevel, getXPForNextLevel, calculateLevelFromXP, canLevelUp, getXPNeeded, rollHPForLevel, levelUpFrom0, levelUp, addXP, } from "./level-up.js";
import { registerClassProgression, clearClassProgressions, } from "../data/classes/progression-utils.js";
import { createSeededRandomSource } from "../types/random.js";
// =============================================================================
// Test Data
// =============================================================================
/**
 * Sample warrior progression for testing
 */
const SAMPLE_WARRIOR_PROGRESSION = {
    classId: "warrior",
    name: "Warrior",
    skills: ["mighty-deed"],
    levels: {
        1: {
            attackBonus: "d3",
            criticalDie: "1d12",
            criticalTable: "III",
            actionDice: ["1d20"],
            hitDie: "d12",
            saves: { ref: 1, frt: 1, wil: 0 },
            critRange: 19,
            lawful: { title: "Squire", skills: {} },
            neutral: { title: "Brave", skills: {} },
            chaotic: { title: "Ruffian", skills: {} },
        },
        2: {
            attackBonus: "d3",
            criticalDie: "1d12",
            criticalTable: "III",
            actionDice: ["1d20"],
            hitDie: "d12",
            saves: { ref: 1, frt: 1, wil: 0 },
            critRange: 19,
            lawful: { title: "Champion", skills: {} },
            neutral: { title: "Warrior", skills: {} },
            chaotic: { title: "Bandit", skills: {} },
        },
        3: {
            attackBonus: "d4",
            criticalDie: "1d14",
            criticalTable: "III",
            actionDice: ["1d20"],
            hitDie: "d12",
            saves: { ref: 1, frt: 2, wil: 1 },
            critRange: 19,
            lawful: { title: "Knight", skills: {} },
            neutral: { title: "Veteran", skills: {} },
            chaotic: { title: "Berserker", skills: {} },
        },
    },
};
/**
 * Sample thief progression for testing
 */
const SAMPLE_THIEF_PROGRESSION = {
    classId: "thief",
    name: "Thief",
    skills: ["backstab", "sneak-silently", "hide-in-shadows"],
    levels: {
        1: {
            attackBonus: 0,
            criticalDie: "1d10",
            criticalTable: "II",
            actionDice: ["1d20"],
            hitDie: "d6",
            saves: { ref: 1, frt: 0, wil: 1 },
            luckDie: "d3",
            lawful: { title: "Apprentice", skills: { "backstab": 2 } },
            neutral: { title: "Cutpurse", skills: { "backstab": 2 } },
            chaotic: { title: "Thug", skills: { "backstab": 2 } },
        },
        2: {
            attackBonus: 1,
            criticalDie: "1d10",
            criticalTable: "II",
            actionDice: ["1d20"],
            hitDie: "d6",
            saves: { ref: 1, frt: 0, wil: 1 },
            luckDie: "d4",
            lawful: { title: "Rogue", skills: { "backstab": 2 } },
            neutral: { title: "Footpad", skills: { "backstab": 2 } },
            chaotic: { title: "Bravo", skills: { "backstab": 2 } },
        },
    },
};
/**
 * Sample cleric progression for testing
 */
const SAMPLE_CLERIC_PROGRESSION = {
    classId: "cleric",
    name: "Cleric",
    skills: ["turn-unholy", "lay-on-hands"],
    levels: {
        1: {
            attackBonus: 0,
            criticalDie: "1d8",
            criticalTable: "II",
            actionDice: ["1d20"],
            hitDie: "d8",
            saves: { ref: 0, frt: 1, wil: 1 },
            lawful: { title: "Acolyte", skills: {} },
            neutral: { title: "Witness", skills: {} },
            chaotic: { title: "Zealot", skills: {} },
        },
        2: {
            attackBonus: 1,
            criticalDie: "1d8",
            criticalTable: "II",
            actionDice: ["1d20"],
            hitDie: "d8",
            saves: { ref: 0, frt: 1, wil: 1 },
            lawful: { title: "Ordained", skills: {} },
            neutral: { title: "Seer", skills: {} },
            chaotic: { title: "Fanatic", skills: {} },
        },
    },
};
/**
 * Create a basic 0-level character for testing
 */
function createTestCharacter(options) {
    return {
        identity: {
            id: "test-char-1",
            name: "Test Character",
            occupation: "Farmer",
            alignment: options?.alignment ?? "n",
            birthAugur: {
                id: "test-augur",
                name: "Test Augur",
                effect: "Test effect",
                modifies: "test",
                multiplier: 1,
            },
            startingLuck: 10,
            languages: ["Common"],
        },
        state: {
            hp: { current: 4, max: 4, temp: 0 },
            abilities: {
                str: { current: 12, max: 12 },
                agl: { current: 14, max: 14 },
                sta: { current: 13, max: 13 },
                per: { current: 10, max: 10 },
                int: { current: 11, max: 11 },
                lck: { current: 10, max: 10 },
            },
            xp: { current: options?.xp ?? 0, nextLevel: 10 },
            saves: { reflex: 0, fortitude: 0, will: 0 },
            combat: {
                attackBonus: 0,
                actionDice: ["d20"],
                critDie: "d4",
                critTable: "I",
                threatRange: 20,
                ac: 10,
                speed: 30,
                initiative: 0,
            },
            currency: { pp: 0, ep: 0, gp: 0, sp: 0, cp: 0 },
            inventory: { items: [] },
            conditions: [],
        },
    };
}
/**
 * Create a level 1 character for testing
 */
function createLevel1Character(classId, options) {
    const base = createTestCharacter(options);
    return {
        ...base,
        classInfo: {
            classId,
            level: 1,
            title: "Test Title",
        },
        state: {
            ...base.state,
            xp: { current: options?.xp ?? 10, nextLevel: 50 },
        },
    };
}
/**
 * Helper to get the result character and assert success
 */
function expectSuccess(result) {
    expect(result.success).toBe(true);
    expect(result.character).toBeDefined();
    expect(result.changes).toBeDefined();
}
// =============================================================================
// Test Setup
// =============================================================================
describe("Level Advancement", () => {
    beforeEach(() => {
        // Register sample progressions before each test
        registerClassProgression(SAMPLE_WARRIOR_PROGRESSION);
        registerClassProgression(SAMPLE_THIEF_PROGRESSION);
        registerClassProgression(SAMPLE_CLERIC_PROGRESSION);
    });
    afterEach(() => {
        // Clean up after each test
        clearXPThresholds();
        clearClassProgressions();
    });
    // ===========================================================================
    // XP Threshold Registry Tests
    // ===========================================================================
    describe("XP Threshold Registry", () => {
        it("returns default thresholds when not registered", () => {
            const thresholds = getXPThresholds("unknown-class");
            expect(thresholds).toEqual([10, 50, 110, 190, 290, 410, 550, 710, 890, 1090]);
        });
        it("registers and retrieves custom thresholds", () => {
            registerXPThresholds({
                classId: "custom",
                thresholds: [15, 60, 120, 200, 300],
            });
            const thresholds = getXPThresholds("custom");
            expect(thresholds).toEqual([15, 60, 120, 200, 300]);
        });
        it("registers multiple thresholds at once", () => {
            registerAllXPThresholds([
                { classId: "class-a", thresholds: [10, 20, 30] },
                { classId: "class-b", thresholds: [15, 30, 45] },
            ]);
            expect(getXPThresholds("class-a")).toEqual([10, 20, 30]);
            expect(getXPThresholds("class-b")).toEqual([15, 30, 45]);
        });
        it("clears registered thresholds", () => {
            registerXPThresholds({ classId: "test", thresholds: [100] });
            clearXPThresholds();
            // Should return default after clearing
            const thresholds = getXPThresholds("test");
            expect(thresholds[0]).toBe(10); // Default first value
        });
    });
    // ===========================================================================
    // XP Calculation Tests
    // ===========================================================================
    describe("XP Calculations", () => {
        it("gets XP for specific level", () => {
            expect(getXPForLevel("warrior", 1)).toBe(10);
            expect(getXPForLevel("warrior", 2)).toBe(50);
            expect(getXPForLevel("warrior", 5)).toBe(290);
            expect(getXPForLevel("warrior", 10)).toBe(1090);
        });
        it("returns undefined for invalid levels", () => {
            expect(getXPForLevel("warrior", 0)).toBeUndefined();
            expect(getXPForLevel("warrior", 11)).toBeUndefined();
            expect(getXPForLevel("warrior", -1)).toBeUndefined();
        });
        it("gets XP for next level", () => {
            expect(getXPForNextLevel("warrior", 0)).toBe(10); // 0->1
            expect(getXPForNextLevel("warrior", 1)).toBe(50); // 1->2
            expect(getXPForNextLevel("warrior", 9)).toBe(1090); // 9->10
        });
        it("returns undefined at max level", () => {
            expect(getXPForNextLevel("warrior", 10)).toBeUndefined();
        });
        it("calculates level from XP", () => {
            expect(calculateLevelFromXP("warrior", 0)).toBe(0);
            expect(calculateLevelFromXP("warrior", 9)).toBe(0);
            expect(calculateLevelFromXP("warrior", 10)).toBe(1);
            expect(calculateLevelFromXP("warrior", 49)).toBe(1);
            expect(calculateLevelFromXP("warrior", 50)).toBe(2);
            expect(calculateLevelFromXP("warrior", 1090)).toBe(10);
            expect(calculateLevelFromXP("warrior", 2000)).toBe(10);
        });
        it("uses custom thresholds for calculations", () => {
            registerXPThresholds({
                classId: "elf",
                thresholds: [12, 60, 130], // Elf requires more XP
            });
            expect(getXPForLevel("elf", 1)).toBe(12);
            expect(calculateLevelFromXP("elf", 11)).toBe(0);
            expect(calculateLevelFromXP("elf", 12)).toBe(1);
        });
    });
    // ===========================================================================
    // canLevelUp Tests
    // ===========================================================================
    describe("canLevelUp", () => {
        it("0-level can level up with 10 XP", () => {
            const char = createTestCharacter({ xp: 10 });
            expect(canLevelUp(char)).toBe(true);
        });
        it("0-level cannot level up with 9 XP", () => {
            const char = createTestCharacter({ xp: 9 });
            expect(canLevelUp(char)).toBe(false);
        });
        it("level 1 can level up with enough XP", () => {
            const char = createLevel1Character("warrior", { xp: 50 });
            expect(canLevelUp(char)).toBe(true);
        });
        it("level 1 cannot level up without enough XP", () => {
            const char = createLevel1Character("warrior", { xp: 49 });
            expect(canLevelUp(char)).toBe(false);
        });
        it("level 10 cannot level up", () => {
            const char = createLevel1Character("warrior", { xp: 10000 });
            char.classInfo.level = 10;
            expect(canLevelUp(char)).toBe(false);
        });
    });
    // ===========================================================================
    // getXPNeeded Tests
    // ===========================================================================
    describe("getXPNeeded", () => {
        it("0-level needs 10 XP minus current", () => {
            expect(getXPNeeded(createTestCharacter({ xp: 0 }))).toBe(10);
            expect(getXPNeeded(createTestCharacter({ xp: 5 }))).toBe(5);
            expect(getXPNeeded(createTestCharacter({ xp: 10 }))).toBe(0);
            expect(getXPNeeded(createTestCharacter({ xp: 15 }))).toBe(0);
        });
        it("level 1 needs XP to level 2", () => {
            const char = createLevel1Character("warrior", { xp: 25 });
            expect(getXPNeeded(char)).toBe(25); // 50 - 25
        });
        it("returns undefined at max level", () => {
            const char = createLevel1Character("warrior", { xp: 10000 });
            char.classInfo.level = 10;
            expect(getXPNeeded(char)).toBeUndefined();
        });
    });
    // ===========================================================================
    // rollHPForLevel Tests
    // ===========================================================================
    describe("rollHPForLevel", () => {
        it("rolls HP with positive stamina modifier", () => {
            const random = createSeededRandomSource(12345);
            const result = rollHPForLevel("d12", 2, random);
            expect(result.rolled).toBeGreaterThanOrEqual(1);
            expect(result.rolled).toBeLessThanOrEqual(12);
            expect(result.gained).toBe(result.rolled + 2);
        });
        it("rolls HP with negative stamina modifier", () => {
            const random = createSeededRandomSource(12345);
            const result = rollHPForLevel("d6", -1, random);
            expect(result.rolled).toBeGreaterThanOrEqual(1);
            expect(result.rolled).toBeLessThanOrEqual(6);
            // Gained should be at least 1 even with negative modifier
            expect(result.gained).toBeGreaterThanOrEqual(1);
        });
        it("enforces minimum 1 HP gained", () => {
            // Use a seeded random that rolls low
            const random = createSeededRandomSource(1); // Try to get low roll
            const result = rollHPForLevel("d4", -5, random);
            // Even with -5 modifier and minimum roll, should get 1 HP
            expect(result.gained).toBe(1);
        });
    });
    // ===========================================================================
    // levelUpFrom0 Tests
    // ===========================================================================
    describe("levelUpFrom0", () => {
        it("levels up 0-level to warrior", () => {
            const char = createTestCharacter({ xp: 10 });
            const random = createSeededRandomSource(42);
            const result = levelUpFrom0(char, "warrior", random);
            expectSuccess(result);
            expect(result.character.classInfo?.classId).toBe("warrior");
            expect(result.character.classInfo?.level).toBe(1);
            expect(result.changes.previousLevel).toBe(0);
            expect(result.changes.newLevel).toBe(1);
        });
        it("fails without enough XP", () => {
            const char = createTestCharacter({ xp: 5 });
            const result = levelUpFrom0(char, "warrior");
            expect(result.success).toBe(false);
            expect(result.error).toContain("XP");
        });
        it("fails if character already has class", () => {
            const char = createLevel1Character("warrior");
            const result = levelUpFrom0(char, "warrior");
            expect(result.success).toBe(false);
            expect(result.error).toContain("already has a class");
        });
        it("fails if class progression not registered", () => {
            const char = createTestCharacter({ xp: 10 });
            const result = levelUpFrom0(char, "unknown-class");
            expect(result.success).toBe(false);
            expect(result.error).toContain("not registered");
        });
        it("increases HP on level up", () => {
            const char = createTestCharacter({ xp: 10 });
            const random = createSeededRandomSource(42);
            const result = levelUpFrom0(char, "warrior", random);
            expectSuccess(result);
            expect(result.character.state.hp.max).toBeGreaterThan(char.state.hp.max);
            expect(result.changes.hpGained).toBeGreaterThan(0);
        });
        it("updates saves based on class and abilities", () => {
            const char = createTestCharacter({ xp: 10 });
            const random = createSeededRandomSource(42);
            const result = levelUpFrom0(char, "warrior", random);
            expectSuccess(result);
            // Warrior level 1 saves: ref 1, frt 1, wil 0
            // Plus ability mods: agl +1, sta +1, per +0
            expect(result.character.state.saves.reflex).toBe(2); // 1 + 1
            expect(result.character.state.saves.fortitude).toBe(2); // 1 + 1
            expect(result.character.state.saves.will).toBe(0); // 0 + 0
        });
        it("sets alignment-specific title", () => {
            const lawfulChar = createTestCharacter({ xp: 10, alignment: "l" });
            const chaoticChar = createTestCharacter({ xp: 10, alignment: "c" });
            const random = createSeededRandomSource(42);
            const lawfulResult = levelUpFrom0(lawfulChar, "warrior", random);
            const chaoticResult = levelUpFrom0(chaoticChar, "warrior", random);
            expectSuccess(lawfulResult);
            expectSuccess(chaoticResult);
            expect(lawfulResult.character.classInfo?.title).toBe("Squire");
            expect(chaoticResult.character.classInfo?.title).toBe("Ruffian");
        });
        it("sets deed die for warriors", () => {
            const char = createTestCharacter({ xp: 10 });
            const random = createSeededRandomSource(42);
            const result = levelUpFrom0(char, "warrior", random);
            expectSuccess(result);
            expect(result.character.state.classState?.warrior?.deedDie).toBe("d3");
        });
        it("sets thief class state", () => {
            const char = createTestCharacter({ xp: 10 });
            const random = createSeededRandomSource(42);
            const result = levelUpFrom0(char, "thief", random);
            expectSuccess(result);
            expect(result.character.state.classState?.thief?.luckDie).toBe("d3");
            expect(result.character.state.classState?.thief?.backstabMultiplier).toBe(2);
        });
        it("sets cleric class state", () => {
            const char = createTestCharacter({ xp: 10 });
            const random = createSeededRandomSource(42);
            const result = levelUpFrom0(char, "cleric", random);
            expectSuccess(result);
            expect(result.character.state.classState?.cleric?.disapprovalRange).toBe(1);
        });
    });
    // ===========================================================================
    // levelUp Tests
    // ===========================================================================
    describe("levelUp", () => {
        it("levels up from 1 to 2", () => {
            const char = createLevel1Character("warrior", { xp: 50 });
            const random = createSeededRandomSource(42);
            const result = levelUp(char, random);
            expectSuccess(result);
            expect(result.character.classInfo?.level).toBe(2);
            expect(result.changes.previousLevel).toBe(1);
            expect(result.changes.newLevel).toBe(2);
        });
        it("fails without enough XP", () => {
            const char = createLevel1Character("warrior", { xp: 30 });
            const result = levelUp(char);
            expect(result.success).toBe(false);
            expect(result.error).toContain("XP");
        });
        it("fails for 0-level characters", () => {
            const char = createTestCharacter({ xp: 100 });
            const result = levelUp(char);
            expect(result.success).toBe(false);
            expect(result.error).toContain("levelUpFrom0");
        });
        it("fails at max level", () => {
            const char = createLevel1Character("warrior", { xp: 10000 });
            char.classInfo.level = 10;
            const result = levelUp(char);
            expect(result.success).toBe(false);
            expect(result.error).toContain("maximum level");
        });
        it("increases HP on level up", () => {
            const char = createLevel1Character("warrior", { xp: 50 });
            const originalHP = char.state.hp.max;
            const random = createSeededRandomSource(42);
            const result = levelUp(char, random);
            expectSuccess(result);
            expect(result.character.state.hp.max).toBeGreaterThan(originalHP);
        });
        it("updates saves on level up", () => {
            const char = createLevel1Character("warrior", { xp: 110 });
            char.classInfo.level = 2;
            const random = createSeededRandomSource(42);
            const result = levelUp(char, random);
            expectSuccess(result);
            // Level 3 warrior: ref 1, frt 2, wil 1
            expect(result.changes.newSaves.reflex).toBe(1);
            expect(result.changes.newSaves.fortitude).toBe(2);
            expect(result.changes.newSaves.will).toBe(1);
        });
        it("updates attack bonus/deed die on level up", () => {
            const char = createLevel1Character("warrior", { xp: 110 });
            char.classInfo.level = 2;
            const random = createSeededRandomSource(42);
            const result = levelUp(char, random);
            expectSuccess(result);
            // Level 3 warrior has d4 deed die
            expect(result.changes.newAttackBonus).toBe("d4");
        });
        it("updates title on level up", () => {
            const char = createLevel1Character("warrior", { xp: 50, alignment: "n" });
            const random = createSeededRandomSource(42);
            const result = levelUp(char, random);
            expectSuccess(result);
            expect(result.character.classInfo?.title).toBe("Warrior"); // Level 2 neutral title
        });
        it("updates thief luck die and backstab", () => {
            const char = createLevel1Character("thief", { xp: 50 });
            char.state.classState = { thief: { luckDie: "d3", backstabMultiplier: 2 } };
            const random = createSeededRandomSource(42);
            const result = levelUp(char, random);
            expectSuccess(result);
            expect(result.character.state.classState?.thief?.luckDie).toBe("d4");
        });
    });
    // ===========================================================================
    // addXP Tests
    // ===========================================================================
    describe("addXP", () => {
        it("adds XP to character", () => {
            const char = createTestCharacter({ xp: 5 });
            const updated = addXP(char, 10);
            expect(updated.state.xp.current).toBe(15);
        });
        it("does not mutate original character", () => {
            const char = createTestCharacter({ xp: 5 });
            addXP(char, 10);
            expect(char.state.xp.current).toBe(5);
        });
    });
    // ===========================================================================
    // Integration Tests
    // ===========================================================================
    describe("Integration: Full Level Progression", () => {
        it("can level a character from 0 to 3", () => {
            let char = createTestCharacter({ xp: 0 });
            const random = createSeededRandomSource(42);
            // Add XP for level 1
            char = addXP(char, 10);
            expect(canLevelUp(char)).toBe(true);
            // Level up to 1 as warrior
            let result = levelUpFrom0(char, "warrior", random);
            expectSuccess(result);
            char = result.character;
            expect(char.classInfo?.level).toBe(1);
            // Add XP for level 2
            char = addXP(char, 40); // Now at 50
            expect(canLevelUp(char)).toBe(true);
            // Level up to 2
            result = levelUp(char, random);
            expectSuccess(result);
            char = result.character;
            expect(char.classInfo?.level).toBe(2);
            // Add XP for level 3
            char = addXP(char, 60); // Now at 110
            expect(canLevelUp(char)).toBe(true);
            // Level up to 3
            result = levelUp(char, random);
            expectSuccess(result);
            char = result.character;
            expect(char.classInfo?.level).toBe(3);
            // Verify final stats
            expect(char.state.hp.max).toBeGreaterThan(4); // Started at 4
            expect(char.classInfo?.title).toBe("Veteran"); // Neutral level 3
        });
        it("tracks XP needed correctly through progression", () => {
            let char = createTestCharacter({ xp: 10 });
            const random = createSeededRandomSource(42);
            // Level up to 1
            const result = levelUpFrom0(char, "warrior", random);
            expectSuccess(result);
            char = result.character;
            // Check XP tracking
            expect(char.state.xp.current).toBe(10);
            expect(char.state.xp.nextLevel).toBe(50);
            expect(getXPNeeded(char)).toBe(40);
        });
    });
});
//# sourceMappingURL=level-up.test.js.map