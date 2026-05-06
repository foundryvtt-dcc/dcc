/**
 * Hit Points Calculation Tests
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { calculateMaxHP, recalculateHP, estimateMaxHP, calculateMinimumHP, calculateMaximumHP, createHPRollRecord, addHPRollToHistory, getTotalHPFromHistory, } from "./hit-points.js";
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
    },
};
const SAMPLE_THIEF_PROGRESSION = {
    classId: "thief",
    name: "Thief",
    skills: ["backstab"],
    levels: {
        1: {
            attackBonus: 0,
            criticalDie: "1d10",
            criticalTable: "II",
            actionDice: ["1d20"],
            hitDie: "d6",
            saves: { ref: 1, frt: 0, wil: 1 },
            lawful: { title: "Apprentice", skills: {} },
            neutral: { title: "Cutpurse", skills: {} },
            chaotic: { title: "Thug", skills: {} },
        },
    },
};
/**
 * Create a test character with specified HP history
 */
function createCharacterWithHistory(history, options) {
    const totalHP = getTotalHPFromHistory(history);
    return {
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
        classInfo: {
            classId: "warrior",
            level: history.length,
            title: "Warrior",
        },
        state: {
            hp: {
                current: options?.currentHP ?? totalHP,
                max: options?.maxHP ?? totalHP,
                temp: 0,
                history,
            },
            abilities: {
                str: { current: 12, max: 12 },
                agl: { current: 14, max: 14 },
                sta: { current: options?.currentStamina ?? 13, max: 14 },
                per: { current: 10, max: 10 },
                int: { current: 11, max: 11 },
                lck: { current: 10, max: 10 },
            },
            xp: { current: 50, nextLevel: 110 },
            saves: { reflex: 2, fortitude: 2, will: 0 },
            combat: {
                attackBonus: 0,
                actionDice: ["d20"],
                critDie: "d12",
                critTable: "III",
                threatRange: 19,
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
// =============================================================================
// Test Setup
// =============================================================================
describe("Hit Points", () => {
    beforeEach(() => {
        registerClassProgression(SAMPLE_WARRIOR_PROGRESSION);
        registerClassProgression(SAMPLE_THIEF_PROGRESSION);
    });
    afterEach(() => {
        clearClassProgressions();
    });
    // ===========================================================================
    // HP Roll Record Tests
    // ===========================================================================
    describe("createHPRollRecord", () => {
        it("creates a valid HP roll record", () => {
            const record = createHPRollRecord(1, "d12", 8, 1);
            expect(record.level).toBe(1);
            expect(record.die).toBe("d12");
            expect(record.rolled).toBe(8);
            expect(record.staminaModifier).toBe(1);
            expect(record.gained).toBe(9); // 8 + 1
        });
        it("enforces minimum 1 HP gained", () => {
            const record = createHPRollRecord(1, "d4", 1, -3);
            expect(record.rolled).toBe(1);
            expect(record.staminaModifier).toBe(-3);
            expect(record.gained).toBe(1); // Min 1, not -2
        });
        it("handles zero stamina modifier", () => {
            const record = createHPRollRecord(0, "d4", 3, 0);
            expect(record.gained).toBe(3);
        });
    });
    // ===========================================================================
    // HP History Management Tests
    // ===========================================================================
    describe("addHPRollToHistory", () => {
        it("adds first HP roll to empty history", () => {
            const char = createCharacterWithHistory([]);
            const record = createHPRollRecord(0, "d4", 3, 1);
            const updated = addHPRollToHistory(char, record);
            expect(updated.state.hp.history).toHaveLength(1);
            expect(updated.state.hp.history?.[0]).toEqual(record);
        });
        it("appends to existing history", () => {
            const existingRecord = createHPRollRecord(0, "d4", 3, 1);
            const char = createCharacterWithHistory([existingRecord]);
            const newRecord = createHPRollRecord(1, "d12", 8, 1);
            const updated = addHPRollToHistory(char, newRecord);
            expect(updated.state.hp.history).toHaveLength(2);
            expect(updated.state.hp.history?.[0]).toEqual(existingRecord);
            expect(updated.state.hp.history?.[1]).toEqual(newRecord);
        });
        it("does not mutate original character", () => {
            const char = createCharacterWithHistory([]);
            const record = createHPRollRecord(0, "d4", 3, 1);
            addHPRollToHistory(char, record);
            expect(char.state.hp.history).toEqual([]);
        });
    });
    describe("getTotalHPFromHistory", () => {
        it("returns 0 for empty history", () => {
            expect(getTotalHPFromHistory([])).toBe(0);
        });
        it("sums HP from all records", () => {
            const history = [
                createHPRollRecord(0, "d4", 3, 1), // 4 HP
                createHPRollRecord(1, "d12", 8, 1), // 9 HP
                createHPRollRecord(2, "d12", 6, 1), // 7 HP
            ];
            expect(getTotalHPFromHistory(history)).toBe(20);
        });
        it("respects minimum 1 HP per level in records", () => {
            const history = [
                createHPRollRecord(0, "d4", 1, -3), // 1 HP (min)
                createHPRollRecord(1, "d12", 2, -3), // 1 HP (min)
            ];
            expect(getTotalHPFromHistory(history)).toBe(2);
        });
    });
    // ===========================================================================
    // calculateMaxHP Tests
    // ===========================================================================
    describe("calculateMaxHP", () => {
        it("returns current max when no history", () => {
            const char = createCharacterWithHistory([], { maxHP: 15 });
            char.state.hp.history = undefined;
            expect(calculateMaxHP(char)).toBe(15);
        });
        it("returns current max when history is empty", () => {
            const char = createCharacterWithHistory([], { maxHP: 15 });
            expect(calculateMaxHP(char)).toBe(15);
        });
        it("calculates max HP from history with current stamina", () => {
            const history = [
                createHPRollRecord(0, "d4", 3, 1), // rolled 3
                createHPRollRecord(1, "d12", 8, 1), // rolled 8
            ];
            // Current STA 13 = +1 modifier
            const char = createCharacterWithHistory(history, { currentStamina: 13 });
            // With +1 STA mod: 3+1=4, 8+1=9, total = 13
            expect(calculateMaxHP(char)).toBe(13);
        });
        it("recalculates with changed stamina modifier", () => {
            const history = [
                createHPRollRecord(0, "d4", 3, 2), // Was +2 when rolled
                createHPRollRecord(1, "d12", 8, 2), // Was +2 when rolled
            ];
            // Now STA 8 = -1 modifier (spellburn damage)
            const char = createCharacterWithHistory(history, { currentStamina: 8 });
            // With -1 STA mod: 3-1=2, 8-1=7, total = 9
            expect(calculateMaxHP(char)).toBe(9);
        });
        it("enforces minimum 1 HP per level", () => {
            const history = [
                createHPRollRecord(0, "d4", 1, 0), // rolled 1
                createHPRollRecord(1, "d12", 1, 0), // rolled 1
            ];
            // Now STA 3 = -3 modifier
            const char = createCharacterWithHistory(history, { currentStamina: 3 });
            // With -3 STA mod: max(1, 1-3)=1, max(1, 1-3)=1, total = 2
            expect(calculateMaxHP(char)).toBe(2);
        });
    });
    // ===========================================================================
    // recalculateHP Tests
    // ===========================================================================
    describe("recalculateHP", () => {
        it("returns character unchanged when no history", () => {
            const char = createCharacterWithHistory([], { maxHP: 15 });
            char.state.hp.history = undefined;
            const result = recalculateHP(char);
            expect(result).toBe(char); // Same reference
        });
        it("returns character unchanged when HP unchanged", () => {
            const history = [
                createHPRollRecord(0, "d4", 3, 1),
                createHPRollRecord(1, "d12", 8, 1),
            ];
            const char = createCharacterWithHistory(history, {
                currentStamina: 13, // +1 mod (same as history)
                currentHP: 13,
                maxHP: 13,
            });
            const result = recalculateHP(char);
            expect(result).toBe(char);
        });
        it("increases HP when stamina increases", () => {
            const history = [
                createHPRollRecord(0, "d4", 3, 0), // Was +0 when rolled
                createHPRollRecord(1, "d12", 8, 0), // Was +0 when rolled
            ];
            const char = createCharacterWithHistory(history, {
                currentStamina: 14, // Now +1 mod
                currentHP: 11,
                maxHP: 11,
            });
            const result = recalculateHP(char);
            // New max: 3+1 + 8+1 = 13 (was 11, diff +2)
            expect(result.state.hp.max).toBe(13);
            expect(result.state.hp.current).toBe(13); // Current goes up by 2
        });
        it("decreases HP when stamina decreases", () => {
            const history = [
                createHPRollRecord(0, "d4", 3, 2), // Was +2 when rolled
                createHPRollRecord(1, "d12", 8, 2), // Was +2 when rolled
            ];
            const char = createCharacterWithHistory(history, {
                currentStamina: 10, // Now +0 mod
                currentHP: 15,
                maxHP: 15, // Was 5+10=15 with +2 mod
            });
            const result = recalculateHP(char);
            // New max: 3+0 + 8+0 = 11 (was 15, diff -4)
            expect(result.state.hp.max).toBe(11);
            expect(result.state.hp.current).toBe(11); // Current goes down by 4
        });
        it("does not reduce current HP below 1", () => {
            const history = [
                createHPRollRecord(0, "d4", 3, 2),
            ];
            const char = createCharacterWithHistory(history, {
                currentStamina: 3, // Now -3 mod
                currentHP: 2,
                maxHP: 5,
            });
            const result = recalculateHP(char);
            expect(result.state.hp.max).toBe(1); // 3-3=0, min 1
            expect(result.state.hp.current).toBe(1); // Min 1
        });
        it("caps current HP at new max when damaged", () => {
            const history = [
                createHPRollRecord(0, "d4", 3, 2),
                createHPRollRecord(1, "d12", 8, 2),
            ];
            const char = createCharacterWithHistory(history, {
                currentStamina: 10, // Now +0 mod
                currentHP: 8, // Already damaged
                maxHP: 15,
            });
            const result = recalculateHP(char);
            // New max: 11, current was 8, diff is -4, but 8-4=4 is below new max, so stays at 4
            expect(result.state.hp.max).toBe(11);
            expect(result.state.hp.current).toBe(4); // 8 - 4 = 4
        });
    });
    // ===========================================================================
    // estimateMaxHP Tests
    // ===========================================================================
    describe("estimateMaxHP", () => {
        it("estimates 0-level HP", () => {
            // 0-level: d4 avg (2.5) + 0 = 2.5, rounds to 2
            const hp = estimateMaxHP(undefined, 0, 0);
            expect(hp).toBe(2); // floor(2.5)
        });
        it("estimates level 1 warrior HP", () => {
            // 0-level: 2.5 + 1 = 3.5
            // Level 1: d12 avg (6.5) + 1 = 7.5
            // Total: 11
            const hp = estimateMaxHP("warrior", 1, 1);
            expect(hp).toBe(11);
        });
        it("estimates level 3 thief HP", () => {
            // 0-level: 2.5 + 0 = 2.5
            // Level 1-3: d6 avg (3.5) + 0 = 3.5 each = 10.5
            // Total: 13
            const hp = estimateMaxHP("thief", 3, 0);
            expect(hp).toBe(13);
        });
        it("handles negative stamina modifier", () => {
            // 0-level: max(1, 2.5-2) = 1
            // Level 1: max(1, 6.5-2) = 4.5
            // Total: 5.5 = 5
            const hp = estimateMaxHP("warrior", 1, -2);
            expect(hp).toBe(5);
        });
        it("uses d4 for unknown class (getHitDie default)", () => {
            // getHitDie() returns "d4" for unregistered classes
            // 0-level: d4 avg (2.5) + 0 = 2.5
            // Level 1: d4 avg (2.5) + 0 = 2.5
            // Total: floor(5.0) = 5
            const hp = estimateMaxHP("unknown-class", 1, 0);
            expect(hp).toBe(5);
        });
    });
    // ===========================================================================
    // calculateMinimumHP Tests
    // ===========================================================================
    describe("calculateMinimumHP", () => {
        it("returns 1 for 0-level", () => {
            expect(calculateMinimumHP(0)).toBe(1);
        });
        it("returns level + 1 for any level", () => {
            expect(calculateMinimumHP(1)).toBe(2);
            expect(calculateMinimumHP(5)).toBe(6);
            expect(calculateMinimumHP(10)).toBe(11);
        });
    });
    // ===========================================================================
    // calculateMaximumHP Tests
    // ===========================================================================
    describe("calculateMaximumHP", () => {
        it("calculates max possible 0-level HP", () => {
            // Max d4 (4) + 2 = 6
            expect(calculateMaximumHP(undefined, 0, 2)).toBe(6);
        });
        it("calculates max possible warrior HP", () => {
            // 0-level: 4 + 1 = 5
            // Level 1: max d12 (12) + 1 = 13
            // Total: 18
            expect(calculateMaximumHP("warrior", 1, 1)).toBe(18);
        });
        it("calculates max possible thief HP", () => {
            // 0-level: 4 + 0 = 4
            // Level 1-3: max d6 (6) + 0 = 6 each = 18
            // Total: 22
            expect(calculateMaximumHP("thief", 3, 0)).toBe(22);
        });
        it("enforces minimum 1 HP per level even with negative modifier", () => {
            // 0-level: max(1, 4-5) = 1
            // Level 1: max(1, 12-5) = 7
            // Total: 8
            expect(calculateMaximumHP("warrior", 1, -5)).toBe(8);
        });
    });
    // ===========================================================================
    // Integration: Level-Up HP History
    // ===========================================================================
    describe("Integration: Level-Up HP History", () => {
        it("level-up stores HP history", async () => {
            // Import level-up functions dynamically to test integration
            const { levelUpFrom0, clearXPThresholds } = await import("./level-up.js");
            const { createSeededRandomSource } = await import("../types/random.js");
            const random = createSeededRandomSource(12345);
            // Create 0-level character
            let char = {
                identity: {
                    id: "test",
                    name: "Test",
                    occupation: "Farmer",
                    alignment: "n",
                    birthAugur: { id: "test", name: "Test", effect: "Test", modifies: "test", multiplier: 1 },
                    startingLuck: 10,
                    languages: ["Common"],
                },
                state: {
                    hp: { current: 4, max: 4, temp: 0 },
                    abilities: {
                        str: { current: 12, max: 12 },
                        agl: { current: 14, max: 14 },
                        sta: { current: 14, max: 14 }, // +1 mod
                        per: { current: 10, max: 10 },
                        int: { current: 11, max: 11 },
                        lck: { current: 10, max: 10 },
                    },
                    xp: { current: 50, nextLevel: 10 },
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
            // Level up to 1
            const result = levelUpFrom0(char, "warrior", random);
            expect(result.success).toBe(true);
            if (result.success && result.character) {
                char = result.character;
                // Should have HP history with level 1 record
                expect(char.state.hp.history).toBeDefined();
                expect(char.state.hp.history).toHaveLength(1);
                expect(char.state.hp.history?.[0]?.level).toBe(1);
                expect(char.state.hp.history?.[0]?.die).toBe("d12");
                expect(char.state.hp.history?.[0]?.staminaModifier).toBe(1);
                // HP max should include gained HP
                const gained = char.state.hp.history?.[0]?.gained ?? 0;
                expect(char.state.hp.max).toBe(4 + gained);
            }
            clearXPThresholds();
        });
    });
});
//# sourceMappingURL=hit-points.test.js.map