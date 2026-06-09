/**
 * Tests for spellburn validation and application.
 *
 * Regression focus: a physical ability may be burned all the way to 0.
 * Per DCC RAW spellburn has no floor of 1 — burning Stamina to 0 is
 * lethal, and that lethality is an intentional rules feature. These
 * tests pin the floor-0 contract so it cannot silently regress to the
 * old "can't go below 1" behavior.
 */
import { describe, it, expect } from "vitest";
import { validateSpellburn, getMaxSpellburn, getTotalMaxSpellburn, applySpellburn, } from "./spellburn.js";
/** Build a full AbilityScores record with the three physical scores set. */
function abilities(str, agl, sta) {
    return {
        str: { current: str, max: str },
        agl: { current: agl, max: agl },
        sta: { current: sta, max: sta },
        per: { current: 10, max: 10 },
        int: { current: 10, max: 10 },
        lck: { current: 10, max: 10 },
    };
}
describe("validateSpellburn", () => {
    it("permits burning a physical ability all the way to 0", () => {
        const result = validateSpellburn(abilities(12, 12, 3), { str: 0, agl: 0, sta: 3 });
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });
    it("permits burning every physical ability to 0 at once", () => {
        const result = validateSpellburn(abilities(4, 5, 6), { str: 4, agl: 5, sta: 6 });
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });
    it("warns (but does not error) when a burn reduces a score to 0", () => {
        const result = validateSpellburn(abilities(12, 12, 3), { str: 0, agl: 0, sta: 3 });
        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes("0"))).toBe(true);
    });
    it("rejects a burn larger than the current score (cannot go below 0)", () => {
        const result = validateSpellburn(abilities(12, 12, 3), { str: 0, agl: 0, sta: 4 });
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });
    it("rejects a negative burn", () => {
        const result = validateSpellburn(abilities(12, 12, 12), { str: -1, agl: 0, sta: 0 });
        expect(result.valid).toBe(false);
    });
});
describe("getMaxSpellburn / getTotalMaxSpellburn", () => {
    it("reports the full current score as the max burn (floor 0)", () => {
        expect(getMaxSpellburn(abilities(12, 8, 3))).toEqual({ str: 12, agl: 8, sta: 3 });
    });
    it("totals the three physical scores", () => {
        expect(getTotalMaxSpellburn(abilities(12, 8, 3))).toBe(23);
    });
});
describe("applySpellburn", () => {
    it("reduces a physical ability to 0 when fully burned", () => {
        const after = applySpellburn(abilities(12, 12, 3), { str: 0, agl: 0, sta: 3 });
        expect(after.sta.current).toBe(0);
        expect(after.sta.max).toBe(3);
    });
    it("clamps at 0 rather than going negative on an oversized burn", () => {
        const after = applySpellburn(abilities(12, 12, 3), { str: 0, agl: 0, sta: 5 });
        expect(after.sta.current).toBe(0);
    });
    it("leaves untouched abilities unchanged", () => {
        const after = applySpellburn(abilities(12, 12, 3), { str: 0, agl: 0, sta: 3 });
        expect(after.str.current).toBe(12);
        expect(after.agl.current).toBe(12);
        expect(after.per.current).toBe(10);
    });
});
