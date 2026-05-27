/**
 * Tests for Luck Check (Roll-Under)
 */
import { describe, it, expect } from "vitest";
import { rollLuckCheck, rollLuckCheckSimple } from "./luck-check.js";
// Mock character for testing
const mockCharacter = {
    identity: {
        id: "test-char",
        name: "Test Character",
        occupation: "Farmer",
        alignment: "n",
        birthAugur: {
            id: "harsh-winter",
            name: "Harsh Winter",
            effect: "All attack rolls",
            modifies: "attack",
            multiplier: 1,
        },
        startingLuck: 12,
        languages: ["Common"],
    },
    classInfo: {
        classId: "warrior",
        level: 1,
        title: "Squire",
    },
    state: {
        hp: { current: 10, max: 10, temp: 0 },
        abilities: {
            str: { current: 14, max: 14 },
            agl: { current: 12, max: 12 },
            sta: { current: 13, max: 13 },
            per: { current: 10, max: 10 },
            int: { current: 11, max: 11 },
            lck: { current: 12, max: 12 },
        },
        xp: { current: 0, nextLevel: 50 },
        saves: { reflex: 1, fortitude: 1, will: 0 },
        combat: {
            attackBonus: 1,
            actionDice: ["d20"],
            critDie: "d12",
            critTable: "III",
            threatRange: 20,
            ac: 14,
            speed: 30,
            initiative: 1,
        },
        currency: { pp: 0, ep: 0, gp: 5, sp: 10, cp: 20 },
        inventory: { items: [] },
        conditions: [],
        classState: {},
    },
};
describe("Luck Check", () => {
    describe("rollLuckCheckSimple", () => {
        it("should succeed when roll is less than luck score", () => {
            const roller = () => 5;
            const result = rollLuckCheckSimple(12, roller);
            expect(result.roll).toBe(5);
            expect(result.target).toBe(12);
            expect(result.success).toBe(true);
        });
        it("should succeed when roll equals luck score", () => {
            const roller = () => 12;
            const result = rollLuckCheckSimple(12, roller);
            expect(result.roll).toBe(12);
            expect(result.target).toBe(12);
            expect(result.success).toBe(true);
        });
        it("should fail when roll exceeds luck score", () => {
            const roller = () => 15;
            const result = rollLuckCheckSimple(12, roller);
            expect(result.roll).toBe(15);
            expect(result.target).toBe(12);
            expect(result.success).toBe(false);
        });
        it("should handle extreme low luck", () => {
            const roller = () => 1;
            const result = rollLuckCheckSimple(3, roller);
            expect(result.success).toBe(true);
        });
        it("should handle rolling a natural 1 (always success if luck >= 1)", () => {
            const roller = () => 1;
            const result = rollLuckCheckSimple(1, roller);
            expect(result.success).toBe(true);
        });
        it("should handle rolling a natural 20 against max luck", () => {
            const roller = () => 20;
            const result = rollLuckCheckSimple(18, roller);
            expect(result.success).toBe(false);
        });
        it("should use custom label", () => {
            const roller = () => 10;
            const result = rollLuckCheckSimple(12, roller, "Body Recovery");
            expect(result.label).toBe("Body Recovery");
        });
        it("should use default label when not specified", () => {
            const roller = () => 10;
            const result = rollLuckCheckSimple(12, roller);
            expect(result.label).toBe("Luck Check");
        });
    });
    describe("rollLuckCheck", () => {
        it("should extract luck from character", () => {
            const roller = () => 10;
            const result = rollLuckCheck(mockCharacter, { roller });
            expect(result.target).toBe(12); // Character's luck score
            expect(result.roll).toBe(10);
            expect(result.success).toBe(true);
        });
        it("should succeed when roll <= character luck", () => {
            const roller = () => 8;
            const result = rollLuckCheck(mockCharacter, { roller });
            expect(result.success).toBe(true);
        });
        it("should fail when roll > character luck", () => {
            const roller = () => 15;
            const result = rollLuckCheck(mockCharacter, { roller });
            expect(result.success).toBe(false);
        });
        it("should use custom label", () => {
            const roller = () => 10;
            const result = rollLuckCheck(mockCharacter, {
                roller,
                label: "Torch Survival",
            });
            expect(result.label).toBe("Torch Survival");
        });
        it("should work with modified luck", () => {
            const modifiedCharacter = {
                ...mockCharacter,
                state: {
                    ...mockCharacter.state,
                    abilities: {
                        ...mockCharacter.state.abilities,
                        lck: { current: 5, max: 12 }, // Luck has been burned
                    },
                },
            };
            const roller = () => 6;
            const result = rollLuckCheck(modifiedCharacter, { roller });
            expect(result.target).toBe(5); // Current luck, not max
            expect(result.success).toBe(false); // 6 > 5
        });
    });
});
//# sourceMappingURL=luck-check.test.js.map