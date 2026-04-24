/**
 * Saving Throws Calculation Tests
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { calculateSavingThrows, calculateSavesFromInput, calculateSavingThrowsWithBreakdown, calculateReflexSave, calculateFortitudeSave, calculateWillSave, recalculateSavingThrows, } from "./saving-throws.js";
import { registerClassProgression, clearClassProgressions, } from "../data/classes/progression-utils.js";
// =============================================================================
// Test Data
// =============================================================================
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
            lawful: { title: "Knight", skills: {} },
            neutral: { title: "Veteran", skills: {} },
            chaotic: { title: "Berserker", skills: {} },
        },
    },
};
const SAMPLE_CLERIC_PROGRESSION = {
    classId: "cleric",
    name: "Cleric",
    skills: ["turn-unholy"],
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
            saves: { ref: 0, frt: 2, wil: 2 },
            lawful: { title: "Ordained", skills: {} },
            neutral: { title: "Seer", skills: {} },
            chaotic: { title: "Fanatic", skills: {} },
        },
    },
};
/**
 * Create a test character with specified abilities and class
 */
function createTestCharacter(options) {
    const char = {
        identity: {
            id: "test-char-1",
            name: "Test Character",
            occupation: "Farmer",
            alignment: "n",
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
            hp: { current: 10, max: 10, temp: 0 },
            abilities: {
                str: { current: options?.str ?? 10, max: options?.str ?? 10 },
                agl: { current: options?.agl ?? 10, max: options?.agl ?? 10 },
                sta: { current: options?.sta ?? 10, max: options?.sta ?? 10 },
                per: { current: options?.per ?? 10, max: options?.per ?? 10 },
                int: { current: options?.int ?? 10, max: options?.int ?? 10 },
                lck: { current: options?.lck ?? 10, max: options?.lck ?? 10 },
            },
            xp: { current: 50, nextLevel: 110 },
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
    if (options?.classId) {
        char.classInfo = {
            classId: options.classId,
            level: options.level ?? 1,
            title: "Test Title",
        };
    }
    return char;
}
// =============================================================================
// Test Setup
// =============================================================================
describe("Saving Throws", () => {
    beforeEach(() => {
        registerClassProgression(SAMPLE_WARRIOR_PROGRESSION);
        registerClassProgression(SAMPLE_CLERIC_PROGRESSION);
    });
    afterEach(() => {
        clearClassProgressions();
    });
    // ===========================================================================
    // calculateSavingThrows Tests
    // ===========================================================================
    describe("calculateSavingThrows", () => {
        it("returns all zeros for 0-level with average abilities", () => {
            const char = createTestCharacter();
            const saves = calculateSavingThrows(char);
            expect(saves.reflex).toBe(0);
            expect(saves.fortitude).toBe(0);
            expect(saves.will).toBe(0);
        });
        it("includes ability modifiers for 0-level character", () => {
            const char = createTestCharacter({
                agl: 14, // +1
                sta: 16, // +2
                per: 8, // -1
            });
            const saves = calculateSavingThrows(char);
            expect(saves.reflex).toBe(1); // 0 + 1
            expect(saves.fortitude).toBe(2); // 0 + 2
            expect(saves.will).toBe(-1); // 0 - 1
        });
        it("includes class bonuses for level 1 warrior", () => {
            const char = createTestCharacter({
                classId: "warrior",
                level: 1,
                agl: 10, // +0
                sta: 10, // +0
                per: 10, // +0
            });
            const saves = calculateSavingThrows(char);
            // Warrior level 1: ref 1, frt 1, wil 0
            expect(saves.reflex).toBe(1);
            expect(saves.fortitude).toBe(1);
            expect(saves.will).toBe(0);
        });
        it("combines class and ability bonuses", () => {
            const char = createTestCharacter({
                classId: "warrior",
                level: 1,
                agl: 14, // +1
                sta: 16, // +2
                per: 8, // -1
            });
            const saves = calculateSavingThrows(char);
            // Warrior level 1: ref 1, frt 1, wil 0
            // Plus ability mods: +1, +2, -1
            expect(saves.reflex).toBe(2); // 1 + 1
            expect(saves.fortitude).toBe(3); // 1 + 2
            expect(saves.will).toBe(-1); // 0 - 1
        });
        it("uses higher bonuses at higher levels", () => {
            const char = createTestCharacter({
                classId: "warrior",
                level: 3,
                agl: 10,
                sta: 10,
                per: 10,
            });
            const saves = calculateSavingThrows(char);
            // Warrior level 3: ref 1, frt 2, wil 1
            expect(saves.reflex).toBe(1);
            expect(saves.fortitude).toBe(2);
            expect(saves.will).toBe(1);
        });
        it("calculates cleric saves correctly", () => {
            const char = createTestCharacter({
                classId: "cleric",
                level: 2,
                agl: 10, // +0
                sta: 12, // +0 (12 is still +0 in DCC)
                per: 14, // +1
            });
            const saves = calculateSavingThrows(char);
            // Cleric level 2: ref 0, frt 2, wil 2
            // Ability mods: +0, +0, +1
            expect(saves.reflex).toBe(0);
            expect(saves.fortitude).toBe(2);
            expect(saves.will).toBe(3);
        });
    });
    // ===========================================================================
    // calculateSavesFromInput Tests
    // ===========================================================================
    describe("calculateSavesFromInput", () => {
        it("calculates saves from raw input", () => {
            const input = {
                classId: "warrior",
                level: 1,
                abilities: {
                    str: { current: 10, max: 10 },
                    agl: { current: 14, max: 14 },
                    sta: { current: 10, max: 10 },
                    per: { current: 10, max: 10 },
                    int: { current: 10, max: 10 },
                    lck: { current: 10, max: 10 },
                },
            };
            const saves = calculateSavesFromInput(input);
            expect(saves.reflex).toBe(2); // 1 + 1
            expect(saves.fortitude).toBe(1); // 1 + 0
            expect(saves.will).toBe(0); // 0 + 0
        });
        it("handles undefined classId (0-level)", () => {
            const input = {
                level: 0,
                abilities: {
                    str: { current: 10, max: 10 },
                    agl: { current: 10, max: 10 },
                    sta: { current: 10, max: 10 },
                    per: { current: 10, max: 10 },
                    int: { current: 10, max: 10 },
                    lck: { current: 10, max: 10 },
                },
            };
            const saves = calculateSavesFromInput(input);
            expect(saves.reflex).toBe(0);
            expect(saves.fortitude).toBe(0);
            expect(saves.will).toBe(0);
        });
    });
    // ===========================================================================
    // calculateSavingThrowsWithBreakdown Tests
    // ===========================================================================
    describe("calculateSavingThrowsWithBreakdown", () => {
        it("provides detailed breakdown of each save", () => {
            const char = createTestCharacter({
                classId: "warrior",
                level: 1,
                agl: 14, // +1
                sta: 16, // +2
                per: 8, // -1
            });
            const breakdown = calculateSavingThrowsWithBreakdown(char);
            expect(breakdown.reflex.total).toBe(2);
            expect(breakdown.reflex.classBonus).toBe(1);
            expect(breakdown.reflex.abilityModifier).toBe(1);
            expect(breakdown.reflex.ability).toBe("agl");
            expect(breakdown.fortitude.total).toBe(3);
            expect(breakdown.fortitude.classBonus).toBe(1);
            expect(breakdown.fortitude.abilityModifier).toBe(2);
            expect(breakdown.fortitude.ability).toBe("sta");
            expect(breakdown.will.total).toBe(-1);
            expect(breakdown.will.classBonus).toBe(0);
            expect(breakdown.will.abilityModifier).toBe(-1);
            expect(breakdown.will.ability).toBe("per");
        });
        it("shows zero class bonus for 0-level", () => {
            const char = createTestCharacter({ agl: 14 });
            const breakdown = calculateSavingThrowsWithBreakdown(char);
            expect(breakdown.reflex.classBonus).toBe(0);
            expect(breakdown.reflex.abilityModifier).toBe(1);
            expect(breakdown.reflex.total).toBe(1);
        });
    });
    // ===========================================================================
    // Individual Save Function Tests
    // ===========================================================================
    describe("calculateReflexSave", () => {
        it("calculates reflex save correctly", () => {
            const char = createTestCharacter({
                classId: "warrior",
                level: 1,
                agl: 16, // +2
            });
            expect(calculateReflexSave(char)).toBe(3); // 1 + 2
        });
        it("uses current (not max) agility", () => {
            const char = createTestCharacter({ agl: 14 });
            char.state.abilities.agl.current = 8; // Damaged
            expect(calculateReflexSave(char)).toBe(-1); // 0 + (-1)
        });
    });
    describe("calculateFortitudeSave", () => {
        it("calculates fortitude save correctly", () => {
            const char = createTestCharacter({
                classId: "cleric",
                level: 2,
                sta: 16, // +2
            });
            expect(calculateFortitudeSave(char)).toBe(4); // 2 + 2
        });
    });
    describe("calculateWillSave", () => {
        it("calculates will save correctly", () => {
            const char = createTestCharacter({
                classId: "cleric",
                level: 2,
                per: 16, // +2
            });
            expect(calculateWillSave(char)).toBe(4); // 2 + 2
        });
    });
    // ===========================================================================
    // recalculateSavingThrows Tests
    // ===========================================================================
    describe("recalculateSavingThrows", () => {
        it("updates saves on character", () => {
            const char = createTestCharacter({
                classId: "warrior",
                level: 1,
                agl: 14,
                sta: 16,
                per: 8,
            });
            // Start with wrong saves
            char.state.saves = { reflex: 0, fortitude: 0, will: 0 };
            const updated = recalculateSavingThrows(char);
            expect(updated.state.saves.reflex).toBe(2);
            expect(updated.state.saves.fortitude).toBe(3);
            expect(updated.state.saves.will).toBe(-1);
        });
        it("does not mutate original character", () => {
            const char = createTestCharacter({
                classId: "warrior",
                level: 1,
                agl: 14,
            });
            char.state.saves = { reflex: 0, fortitude: 0, will: 0 };
            recalculateSavingThrows(char);
            expect(char.state.saves.reflex).toBe(0); // Unchanged
        });
        it("reflects current ability damage", () => {
            const char = createTestCharacter({
                classId: "warrior",
                level: 1,
                agl: 14, // +1
            });
            // Simulate spellburn damage to stamina
            char.state.abilities.sta.current = 6; // -1 mod
            const updated = recalculateSavingThrows(char);
            expect(updated.state.saves.fortitude).toBe(0); // 1 + (-1)
        });
    });
    // ===========================================================================
    // Edge Cases
    // ===========================================================================
    describe("Edge Cases", () => {
        it("handles unregistered class gracefully", () => {
            const char = createTestCharacter({ agl: 14 });
            char.classInfo = { classId: "unknown-class", level: 5, title: "Unknown" };
            // Should not throw, returns 0 for class bonus
            const saves = calculateSavingThrows(char);
            expect(saves.reflex).toBe(1); // 0 + 1 (ability mod only)
        });
        it("handles extreme ability scores", () => {
            const char = createTestCharacter({
                classId: "warrior",
                level: 1,
                agl: 3, // -3
                sta: 18, // +3
                per: 3, // -3
            });
            const saves = calculateSavingThrows(char);
            expect(saves.reflex).toBe(-2); // 1 + (-3)
            expect(saves.fortitude).toBe(4); // 1 + 3
            expect(saves.will).toBe(-3); // 0 + (-3)
        });
    });
});
//# sourceMappingURL=saving-throws.test.js.map