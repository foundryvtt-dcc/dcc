import { describe, expect, it } from "vitest";
import { ABILITY_MODIFIERS, getAbilityModifier, formatAbilityModifier, MIN_ABILITY_SCORE, MAX_ABILITY_SCORE, } from "./ability-modifiers.js";
describe("ability-modifiers", () => {
    describe("ABILITY_MODIFIERS table", () => {
        it("has entries for scores 0-24", () => {
            for (let score = 0; score <= 24; score++) {
                expect(ABILITY_MODIFIERS[score]).toBeDefined();
            }
        });
        it("has correct boundary values", () => {
            expect(ABILITY_MODIFIERS[0]).toBe(-4);
            expect(ABILITY_MODIFIERS[3]).toBe(-3);
            expect(ABILITY_MODIFIERS[9]).toBe(0);
            expect(ABILITY_MODIFIERS[18]).toBe(3);
            expect(ABILITY_MODIFIERS[24]).toBe(6);
        });
    });
    describe("getAbilityModifier", () => {
        it("returns correct modifiers for standard scores", () => {
            expect(getAbilityModifier(3)).toBe(-3);
            expect(getAbilityModifier(8)).toBe(-1);
            expect(getAbilityModifier(10)).toBe(0);
            expect(getAbilityModifier(14)).toBe(1);
            expect(getAbilityModifier(18)).toBe(3);
        });
        it("clamps scores below minimum", () => {
            expect(getAbilityModifier(-5)).toBe(-4);
            expect(getAbilityModifier(-1)).toBe(-4);
        });
        it("clamps scores above maximum", () => {
            expect(getAbilityModifier(25)).toBe(6);
            expect(getAbilityModifier(100)).toBe(6);
        });
    });
    describe("formatAbilityModifier", () => {
        it("adds plus sign for positive modifiers", () => {
            expect(formatAbilityModifier(14)).toBe("+1");
            expect(formatAbilityModifier(18)).toBe("+3");
        });
        it("keeps minus sign for negative modifiers", () => {
            expect(formatAbilityModifier(3)).toBe("-3");
            expect(formatAbilityModifier(7)).toBe("-1");
        });
        it("returns 0 without sign", () => {
            expect(formatAbilityModifier(10)).toBe("0");
            expect(formatAbilityModifier(12)).toBe("0");
        });
    });
    describe("constants", () => {
        it("has correct min/max scores", () => {
            expect(MIN_ABILITY_SCORE).toBe(0);
            expect(MAX_ABILITY_SCORE).toBe(24);
        });
    });
});
//# sourceMappingURL=ability-modifiers.test.js.map