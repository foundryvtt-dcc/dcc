import { describe, expect, it } from "vitest";
import { parseDiceExpression, getPrimaryDie, getPrimaryDieFaces, countDice, getDieRank, rankDiceExpression, bumpDie, bumpDieCount, calculateCritAdjustment, calculateProportionalCritRange, getDiceChain, isInDiceChain, } from "./dice-chain.js";
import { DEFAULT_DICE_CHAIN } from "../types/dice.js";
describe("dice-chain", () => {
    describe("parseDiceExpression", () => {
        it("parses simple dice expressions", () => {
            expect(parseDiceExpression("1d20")).toEqual({
                count: 1,
                faces: 20,
                suffix: "",
                original: "1d20",
            });
            expect(parseDiceExpression("2d6")).toEqual({
                count: 2,
                faces: 6,
                suffix: "",
                original: "2d6",
            });
        });
        it("parses expressions with modifiers", () => {
            expect(parseDiceExpression("1d20+5")).toEqual({
                count: 1,
                faces: 20,
                suffix: "+5",
                original: "1d20+5",
            });
            expect(parseDiceExpression("2d6-2")).toEqual({
                count: 2,
                faces: 6,
                suffix: "-2",
                original: "2d6-2",
            });
        });
        it("returns null for invalid expressions", () => {
            expect(parseDiceExpression("invalid")).toBeNull();
            expect(parseDiceExpression("d20")).toBeNull(); // missing count
            expect(parseDiceExpression("20")).toBeNull();
        });
    });
    describe("getPrimaryDie", () => {
        it("extracts die type from expression", () => {
            expect(getPrimaryDie("1d20")).toBe("d20");
            expect(getPrimaryDie("2d6+5")).toBe("d6");
            expect(getPrimaryDie("1d24")).toBe("d24");
        });
        it("returns d20 for expressions without dice", () => {
            expect(getPrimaryDie("5")).toBe("d20");
            expect(getPrimaryDie("+3")).toBe("d20");
        });
        it("returns null for completely invalid expressions", () => {
            expect(getPrimaryDie("invalid")).toBeNull();
        });
    });
    describe("getPrimaryDieFaces", () => {
        it("extracts face count from expression", () => {
            expect(getPrimaryDieFaces("1d20")).toBe(20);
            expect(getPrimaryDieFaces("2d6+5")).toBe(6);
            expect(getPrimaryDieFaces("1d24")).toBe(24);
        });
        it("returns 20 for expressions without dice", () => {
            expect(getPrimaryDieFaces("5")).toBe(20);
        });
    });
    describe("countDice", () => {
        it("counts dice in expression", () => {
            expect(countDice("1d20")).toBe(1);
            expect(countDice("2d6")).toBe(2);
            expect(countDice("3d8+5")).toBe(3);
        });
        it("returns 0 for invalid expressions", () => {
            expect(countDice("invalid")).toBe(0);
        });
    });
    describe("getDieRank", () => {
        it("returns correct rank in dice chain", () => {
            expect(getDieRank(3)).toBe(0);
            expect(getDieRank(20)).toBe(10);
            expect(getDieRank(30)).toBe(12);
        });
        it("returns -1 for dice not in chain", () => {
            expect(getDieRank(2)).toBe(-1);
            expect(getDieRank(100)).toBe(-1);
        });
    });
    describe("rankDiceExpression", () => {
        it("returns rank of primary die", () => {
            expect(rankDiceExpression("1d20")).toBe(10);
            expect(rankDiceExpression("1d3")).toBe(0);
            expect(rankDiceExpression("2d30+5")).toBe(12);
        });
    });
    describe("bumpDie", () => {
        it("bumps die up the chain", () => {
            expect(bumpDie("1d20", 1)).toBe("1d24");
            expect(bumpDie("1d20", 2)).toBe("1d30");
            expect(bumpDie("1d4", 1)).toBe("1d5");
        });
        it("bumps die down the chain", () => {
            expect(bumpDie("1d20", -1)).toBe("1d16");
            expect(bumpDie("1d20", -2)).toBe("1d14");
            expect(bumpDie("1d5", -1)).toBe("1d4");
        });
        it("preserves modifiers", () => {
            expect(bumpDie("1d20+5", 1)).toBe("1d24+5");
            expect(bumpDie("2d16-2", -1)).toBe("2d14-2");
        });
        it("preserves dice count", () => {
            expect(bumpDie("2d20", 1)).toBe("2d24");
            expect(bumpDie("3d6", 1)).toBe("3d7");
        });
        it("returns unchanged if would go off chain", () => {
            expect(bumpDie("1d30", 1)).toBe("1d30"); // already at top
            expect(bumpDie("1d3", -1)).toBe("1d3"); // already at bottom
        });
        it("returns unchanged for dice not in chain", () => {
            expect(bumpDie("1d2", 1)).toBe("1d2");
            expect(bumpDie("1d100", 1)).toBe("1d100");
        });
        it("returns unchanged for invalid expressions", () => {
            expect(bumpDie("invalid", 1)).toBe("invalid");
        });
    });
    describe("bumpDieCount", () => {
        it("increases dice count", () => {
            expect(bumpDieCount("1d20", 1)).toBe("2d20");
            expect(bumpDieCount("2d6", 2)).toBe("4d6");
        });
        it("decreases dice count", () => {
            expect(bumpDieCount("3d20", -1)).toBe("2d20");
            expect(bumpDieCount("4d6", -2)).toBe("2d6");
        });
        it("preserves modifiers", () => {
            expect(bumpDieCount("1d20+5", 1)).toBe("2d20+5");
            expect(bumpDieCount("2d6-2", -1)).toBe("1d6-2");
        });
        it("respects maxCount", () => {
            expect(bumpDieCount("3d20", 5, 4)).toBe("4d20");
            expect(bumpDieCount("1d6", 10, 3)).toBe("3d6");
        });
        it("returns unchanged if would go below 1", () => {
            expect(bumpDieCount("1d20", -1)).toBe("1d20");
            expect(bumpDieCount("1d6", -5)).toBe("1d6");
        });
    });
    describe("calculateCritAdjustment", () => {
        it("calculates adjustment for die size increases", () => {
            expect(calculateCritAdjustment("1d20", "1d24")).toBe(4);
            expect(calculateCritAdjustment("1d20", "1d16")).toBe(-4);
            expect(calculateCritAdjustment("1d20", "1d20")).toBe(0);
        });
        it("handles complex formulas", () => {
            expect(calculateCritAdjustment("1d20+5", "1d24+5")).toBe(4);
            expect(calculateCritAdjustment("2d16+3", "2d20+3")).toBe(4);
        });
        it("returns 0 for invalid formulas", () => {
            expect(calculateCritAdjustment("invalid", "1d20")).toBe(0);
            expect(calculateCritAdjustment("1d20", "invalid")).toBe(0);
        });
    });
    describe("calculateProportionalCritRange", () => {
        it("calculates proportional crit range for normal 20 crit", () => {
            // Normal d20: crit on 20 (1 number)
            // On d24: should crit on 24 (1 number)
            expect(calculateProportionalCritRange(20, 20, 24)).toBe(24);
            // On d16: should crit on 16 (1 number)
            expect(calculateProportionalCritRange(20, 20, 16)).toBe(16);
        });
        it("calculates proportional crit range for warrior 18-20 crit", () => {
            // Warrior d20: crit on 18-20 (3 numbers)
            // On d24: should crit on 22-24 (3 numbers)
            expect(calculateProportionalCritRange(18, 20, 24)).toBe(22);
            // On d16: should crit on 14-16 (3 numbers)
            expect(calculateProportionalCritRange(18, 20, 16)).toBe(14);
        });
        it("calculates proportional crit range for extended crit ranges", () => {
            // Hypothetical 16-20 crit range (5 numbers)
            // On d24: should crit on 20-24 (5 numbers)
            expect(calculateProportionalCritRange(16, 20, 24)).toBe(20);
            // On d30: should crit on 26-30 (5 numbers)
            expect(calculateProportionalCritRange(16, 20, 30)).toBe(26);
        });
        it("handles edge cases correctly", () => {
            // Crit on everything (crit range 1 = crit on 1-20, 20 numbers)
            // On d24: should crit on 5-24 (20 numbers)
            expect(calculateProportionalCritRange(1, 20, 24)).toBe(5);
            // Only crit on max (same as normal)
            expect(calculateProportionalCritRange(20, 20, 20)).toBe(20);
        });
    });
    describe("getDiceChain", () => {
        it("returns a copy of the dice chain", () => {
            const chain = getDiceChain();
            expect(chain).toEqual([...DEFAULT_DICE_CHAIN]);
            // Verify it's a copy, not the original
            chain.push(100);
            expect(getDiceChain()).not.toContain(100);
        });
    });
    describe("isInDiceChain", () => {
        it("returns true for dice in the chain", () => {
            expect(isInDiceChain(3)).toBe(true);
            expect(isInDiceChain(20)).toBe(true);
            expect(isInDiceChain(7)).toBe(true);
            expect(isInDiceChain(14)).toBe(true);
        });
        it("returns false for dice not in the chain", () => {
            expect(isInDiceChain(2)).toBe(false);
            expect(isInDiceChain(9)).toBe(false);
            expect(isInDiceChain(100)).toBe(false);
        });
    });
    describe("custom dice chain", () => {
        it("supports custom dice chains", () => {
            const customChain = [4, 6, 8, 10, 12, 20];
            expect(getDieRank(6, customChain)).toBe(1);
            expect(getDieRank(7, customChain)).toBe(-1); // d7 not in custom chain
            expect(bumpDie("1d6", 1, customChain)).toBe("1d8");
            expect(bumpDie("1d6", 1)).toBe("1d7"); // default chain has d7
        });
    });
});
//# sourceMappingURL=dice-chain.test.js.map