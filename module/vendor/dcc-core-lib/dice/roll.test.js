import { describe, expect, it, vi } from "vitest";
import { ensurePlus, getFirstDie, getFirstMod, buildFormula, parseFormula, evaluateRoll, createRoll, rollSimple, isNatural20, isNatural1, meetsThreatRange, adjustThreatRange, isAutoHit, } from "./roll.js";
describe("roll", () => {
    describe("ensurePlus", () => {
        it("adds + to positive numbers", () => {
            expect(ensurePlus("5")).toBe("+5");
            expect(ensurePlus("10")).toBe("+10");
        });
        it("keeps - on negative numbers", () => {
            expect(ensurePlus("-3")).toBe("-3");
            expect(ensurePlus("-10")).toBe("-10");
        });
        it("handles zero with includeZero=true", () => {
            expect(ensurePlus("0")).toBe("+0");
            expect(ensurePlus("0", true)).toBe("+0");
        });
        it("handles zero with includeZero=false", () => {
            expect(ensurePlus("0", false)).toBe("");
        });
        it("adds + to dice expressions", () => {
            expect(ensurePlus("d6")).toBe("+d6");
            expect(ensurePlus("d20")).toBe("+d20");
        });
        it("preserves existing + prefix", () => {
            expect(ensurePlus("+5")).toBe("+5");
        });
    });
    describe("getFirstDie", () => {
        it("extracts first die from formula", () => {
            expect(getFirstDie("1d20")).toBe("1d20");
            expect(getFirstDie("2d6+5")).toBe("2d6");
            expect(getFirstDie("1d20+1d6")).toBe("1d20");
        });
        it("handles formulas with modifiers", () => {
            expect(getFirstDie("1d20+5-2")).toBe("1d20");
        });
        it("returns empty for no dice", () => {
            expect(getFirstDie("5")).toBe("");
            expect(getFirstDie("+3")).toBe("");
            expect(getFirstDie("")).toBe("");
        });
    });
    describe("getFirstMod", () => {
        it("extracts first modifier from formula", () => {
            expect(getFirstMod("1d20+5")).toBe("+5");
            expect(getFirstMod("1d20-3")).toBe("-3");
        });
        it("handles multiple modifiers", () => {
            expect(getFirstMod("1d20+5-2")).toBe("+5");
        });
        it("returns empty for no modifiers", () => {
            expect(getFirstMod("1d20")).toBe("");
            expect(getFirstMod("")).toBe("");
        });
    });
    describe("buildFormula", () => {
        it("builds simple die formula", () => {
            expect(buildFormula("d20", 1, [])).toBe("1d20");
            expect(buildFormula("d6", 2, [])).toBe("2d6");
        });
        it("builds formula with modifiers", () => {
            const mods = [{ source: "str", value: 3 }];
            expect(buildFormula("d20", 1, mods)).toBe("1d20+3");
        });
        it("builds formula with negative modifiers", () => {
            const mods = [{ source: "penalty", value: -2 }];
            expect(buildFormula("d20", 1, mods)).toBe("1d20-2");
        });
        it("builds formula with multiple modifiers", () => {
            const mods = [
                { source: "str", value: 3 },
                { source: "luck", value: 1 },
                { source: "penalty", value: -2 },
            ];
            expect(buildFormula("d20", 1, mods)).toBe("1d20+3+1-2");
        });
        it("skips zero modifiers", () => {
            const mods = [
                { source: "str", value: 3 },
                { source: "nothing", value: 0 },
            ];
            expect(buildFormula("d20", 1, mods)).toBe("1d20+3");
        });
    });
    describe("parseFormula", () => {
        it("parses simple die formula", () => {
            const result = parseFormula("1d20");
            expect(result.dice).toEqual({
                count: 1,
                faces: 20,
                suffix: "",
                original: "1d20",
            });
            expect(result.totalModifier).toBe(0);
        });
        it("parses formula with positive modifier", () => {
            const result = parseFormula("1d20+5");
            expect(result.dice?.faces).toBe(20);
            expect(result.totalModifier).toBe(5);
        });
        it("parses formula with negative modifier", () => {
            const result = parseFormula("1d20-3");
            expect(result.totalModifier).toBe(-3);
        });
        it("parses formula with multiple modifiers", () => {
            const result = parseFormula("1d20+5-2+1");
            expect(result.totalModifier).toBe(4); // 5 - 2 + 1
        });
        it("parses formula with multiple dice", () => {
            const result = parseFormula("1d20+1d6");
            expect(result.dice?.faces).toBe(20);
            expect(result.additionalDice).toHaveLength(1);
            expect(result.additionalDice[0]?.faces).toBe(6);
        });
        it("normalizes whitespace", () => {
            const result = parseFormula("1d20 + 5");
            expect(result.normalized).toBe("1d20+5");
        });
    });
    describe("evaluateRoll", () => {
        it("returns formula without evaluating in formula mode", () => {
            const result = evaluateRoll("1d20+5", { mode: "formula" });
            expect(result.formula).toBe("1d20+5");
            expect(result.total).toBeUndefined();
            expect(result.natural).toBeUndefined();
        });
        it("evaluates roll with default roller", () => {
            const result = evaluateRoll("1d20+5", { mode: "evaluate" });
            expect(result.formula).toBe("1d20+5");
            expect(result.total).toBeDefined();
            expect(result.natural).toBeDefined();
            expect(result.natural).toBeGreaterThanOrEqual(1);
            expect(result.natural).toBeLessThanOrEqual(20);
            expect(result.total).toBe((result.natural ?? 0) + 5);
        });
        it("uses custom roller when provided", () => {
            const customRoller = vi.fn().mockReturnValue(15);
            const result = evaluateRoll("1d20+5", {
                mode: "evaluate",
                roller: customRoller,
            });
            expect(customRoller).toHaveBeenCalledWith("1d20");
            expect(result.natural).toBe(15);
            expect(result.total).toBe(20);
        });
        it("handles multiple dice with custom roller", () => {
            let callCount = 0;
            const customRoller = vi.fn().mockImplementation(() => {
                callCount++;
                return callCount === 1 ? 15 : 3; // First call returns 15, second returns 3
            });
            const result = evaluateRoll("1d20+1d6", {
                mode: "evaluate",
                roller: customRoller,
            });
            expect(result.natural).toBe(15); // Primary die
            expect(result.total).toBe(18); // 15 + 3
        });
        it("includes modifier breakdown", () => {
            const result = evaluateRoll("1d20+5");
            expect(result.modifiers).toHaveLength(1);
            expect(result.modifiers[0]).toEqual({
                source: "formula",
                value: 5,
            });
        });
        it("defaults to formula mode", () => {
            const result = evaluateRoll("1d20+5");
            expect(result.total).toBeUndefined();
        });
    });
    describe("createRoll", () => {
        it("creates roll from die and modifiers", () => {
            const mods = [{ source: "str", value: 3 }];
            const result = createRoll("d20", mods, { mode: "formula" });
            expect(result.formula).toBe("1d20+3");
            expect(result.modifiers).toEqual(mods);
        });
        it("evaluates when mode is evaluate", () => {
            const customRoller = vi.fn().mockReturnValue(10);
            const mods = [{ source: "str", value: 3 }];
            const result = createRoll("d20", mods, {
                mode: "evaluate",
                roller: customRoller,
            });
            expect(result.total).toBe(13);
        });
        it("filters out zero modifiers from result", () => {
            const mods = [
                { source: "str", value: 3 },
                { source: "nothing", value: 0 },
            ];
            const result = createRoll("d20", mods);
            expect(result.modifiers).toHaveLength(1);
        });
    });
    describe("rollSimple", () => {
        it("rolls and evaluates a simple die", () => {
            const customRoller = vi.fn().mockReturnValue(15);
            const result = rollSimple("d20", 0, { roller: customRoller });
            expect(result.total).toBe(15);
            expect(result.natural).toBe(15);
        });
        it("adds modifier to roll", () => {
            const customRoller = vi.fn().mockReturnValue(10);
            const result = rollSimple("d20", 5, { roller: customRoller });
            expect(result.total).toBe(15);
        });
    });
    describe("isNatural20", () => {
        it("returns true for natural max on die", () => {
            expect(isNatural20({ natural: 20, die: "d20" })).toBe(true);
            expect(isNatural20({ natural: 24, die: "d24" })).toBe(true);
            expect(isNatural20({ natural: 6, die: "d6" })).toBe(true);
        });
        it("returns false for non-max rolls", () => {
            expect(isNatural20({ natural: 19, die: "d20" })).toBe(false);
            expect(isNatural20({ natural: 1, die: "d20" })).toBe(false);
        });
        it("returns false for unevaluated rolls", () => {
            expect(isNatural20({ die: "d20" })).toBe(false);
        });
    });
    describe("isNatural1", () => {
        it("returns true for natural 1", () => {
            expect(isNatural1({ natural: 1 })).toBe(true);
        });
        it("returns false for other rolls", () => {
            expect(isNatural1({ natural: 2 })).toBe(false);
            expect(isNatural1({ natural: 20 })).toBe(false);
        });
        it("returns false for unevaluated rolls", () => {
            expect(isNatural1({})).toBe(false);
        });
    });
    describe("adjustThreatRange", () => {
        it("keeps threat range same for d20", () => {
            expect(adjustThreatRange(20, 20)).toBe(20);
            expect(adjustThreatRange(19, 20)).toBe(19);
            expect(adjustThreatRange(18, 20)).toBe(18);
        });
        it("adjusts threat range for d24", () => {
            // d24: threat 20 on d20 becomes 24 (top 1 value)
            expect(adjustThreatRange(20, 24)).toBe(24);
            // d24: threat 19-20 on d20 becomes 23-24 (top 2 values)
            expect(adjustThreatRange(19, 24)).toBe(23);
            // d24: threat 18-20 on d20 becomes 22-24 (top 3 values)
            expect(adjustThreatRange(18, 24)).toBe(22);
        });
        it("adjusts threat range for d30", () => {
            expect(adjustThreatRange(20, 30)).toBe(30);
            expect(adjustThreatRange(19, 30)).toBe(29);
        });
        it("adjusts threat range for smaller dice", () => {
            // d16: threat 20 becomes 16
            expect(adjustThreatRange(20, 16)).toBe(16);
            // d16: threat 19 becomes 15 (top 2 values: 15-16)
            expect(adjustThreatRange(19, 16)).toBe(15);
        });
        it("handles edge cases correctly", () => {
            // d10 with threat 20 → max value only
            expect(adjustThreatRange(20, 10)).toBe(10);
            // d10 with threat 19 → 9-10 (top 2 values)
            expect(adjustThreatRange(19, 10)).toBe(9);
        });
    });
    describe("meetsThreatRange", () => {
        it("returns true when natural meets threat range on d20", () => {
            expect(meetsThreatRange({ natural: 20, die: "d20" }, 20)).toBe(true);
            expect(meetsThreatRange({ natural: 19, die: "d20" }, 19)).toBe(true);
            expect(meetsThreatRange({ natural: 20, die: "d20" }, 19)).toBe(true);
            expect(meetsThreatRange({ natural: 18, die: "d20" }, 18)).toBe(true);
        });
        it("returns false when natural is below threat range on d20", () => {
            expect(meetsThreatRange({ natural: 18, die: "d20" }, 19)).toBe(false);
            expect(meetsThreatRange({ natural: 10, die: "d20" }, 20)).toBe(false);
        });
        it("adjusts threat range for d24", () => {
            // Threat 20 on d20 → 24 on d24
            expect(meetsThreatRange({ natural: 24, die: "d24" }, 20)).toBe(true);
            expect(meetsThreatRange({ natural: 23, die: "d24" }, 20)).toBe(false);
            // Threat 19-20 on d20 → 23-24 on d24
            expect(meetsThreatRange({ natural: 24, die: "d24" }, 19)).toBe(true);
            expect(meetsThreatRange({ natural: 23, die: "d24" }, 19)).toBe(true);
            expect(meetsThreatRange({ natural: 22, die: "d24" }, 19)).toBe(false);
        });
        it("returns false for unevaluated rolls", () => {
            expect(meetsThreatRange({ die: "d20" }, 20)).toBe(false);
        });
    });
    describe("isAutoHit", () => {
        it("returns true for natural max on die", () => {
            expect(isAutoHit({ natural: 20, die: "d20" })).toBe(true);
            expect(isAutoHit({ natural: 24, die: "d24" })).toBe(true);
            expect(isAutoHit({ natural: 6, die: "d6" })).toBe(true);
        });
        it("returns false for non-max rolls", () => {
            expect(isAutoHit({ natural: 19, die: "d20" })).toBe(false);
            expect(isAutoHit({ natural: 23, die: "d24" })).toBe(false);
            expect(isAutoHit({ natural: 1, die: "d20" })).toBe(false);
        });
        it("returns false for unevaluated rolls", () => {
            expect(isAutoHit({ die: "d20" })).toBe(false);
        });
    });
});
//# sourceMappingURL=roll.test.js.map