/**
 * Tests for Cleric Abilities
 */
import { describe, it, expect, vi } from "vitest";
import { turnUnholy, getTurnUnholyModifier, getTurnUnholyDie, resolveHDExpression, calculateAverageHD, TURN_UNHOLY_SKILL, } from "./turn-unholy.js";
import { layOnHands, getLayOnHandsModifier, getLayOnHandsDie, LAY_ON_HANDS_SKILL, } from "./lay-on-hands.js";
import { divineAid, getDivineAidModifier, getDivineAidDie, getMinimumCheckForSpellLevel, estimateAidSpellLevel, describePotentialAid, DIVINE_AID_SKILL, } from "./divine-aid.js";
import { TEST_TURN_UNHOLY_TABLE } from "../data/tables/test-turn-unholy.js";
import { TEST_LAY_ON_HANDS_TABLE } from "../data/tables/test-lay-on-hands.js";
import { TEST_DIVINE_AID_TABLE } from "../data/tables/test-divine-aid.js";
/** Create a mock roller that returns a fixed value */
function mockRoller(value) {
    return vi.fn().mockReturnValue(value);
}
// =============================================================================
// Turn Unholy Tests
// =============================================================================
describe("Turn Unholy", () => {
    describe("TURN_UNHOLY_SKILL definition", () => {
        it("has correct id and type", () => {
            expect(TURN_UNHOLY_SKILL.id).toBe("turn-unholy");
            expect(TURN_UNHOLY_SKILL.type).toBe("check");
        });
        it("uses d20 with Personality", () => {
            expect(TURN_UNHOLY_SKILL.roll?.die).toBe("d20");
            expect(TURN_UNHOLY_SKILL.roll?.ability).toBe("per");
        });
        it("adds full level to roll", () => {
            expect(TURN_UNHOLY_SKILL.roll?.levelModifier).toBe("full");
        });
        it("allows luck", () => {
            expect(TURN_UNHOLY_SKILL.roll?.allowLuck).toBe(true);
        });
    });
    describe("turnUnholy", () => {
        it("performs a skill check with level and personality", () => {
            const result = turnUnholy({ level: 3, personality: 16 }, TEST_TURN_UNHOLY_TABLE, { mode: "evaluate", roller: mockRoller(10) });
            // With d20=10, level=3, PER 16 (+2), total = 15
            expect(result.check.total).toBe(15);
            expect(result.check.modifiers).toHaveLength(2);
        });
        it("returns failure for low rolls", () => {
            const result = turnUnholy({ level: 1, personality: 10 }, TEST_TURN_UNHOLY_TABLE, { mode: "evaluate", roller: mockRoller(5) });
            // With d20=5, level=1, PER 10 (+0), total = 6
            expect(result.check.total).toBe(6);
            expect(result.success).toBe(false);
            expect(result.effect.type).toBe("none");
        });
        it("returns success for moderate rolls", () => {
            const result = turnUnholy({ level: 3, personality: 14 }, TEST_TURN_UNHOLY_TABLE, { mode: "evaluate", roller: mockRoller(10) });
            // With d20=10, level=3, PER 14 (+1), total = 14
            expect(result.check.total).toBe(14);
            expect(result.success).toBe(true);
            expect(result.effect.type).toBe("turn");
        });
        it("returns destroy effect for high rolls", () => {
            const result = turnUnholy({ level: 5, personality: 18 }, TEST_TURN_UNHOLY_TABLE, { mode: "evaluate", roller: mockRoller(15) });
            // With d20=15, level=5, PER 18 (+3), total = 23
            expect(result.check.total).toBe(23);
            expect(result.success).toBe(true);
            expect(result.effect.type).toBe("turn-destroy");
        });
        it("includes HD affected in effect", () => {
            const result = turnUnholy({ level: 3, personality: 16 }, TEST_TURN_UNHOLY_TABLE, { mode: "evaluate", roller: mockRoller(10) });
            expect(result.effect.hdAffected).toBeDefined();
        });
        it("applies luck burn", () => {
            const result = turnUnholy({ level: 1, personality: 10, luck: 14, luckBurn: 2 }, TEST_TURN_UNHOLY_TABLE, { mode: "evaluate", roller: mockRoller(10) });
            // With d20=10, level=1, PER 10 (+0), luck burn 2, total = 13
            expect(result.check.total).toBe(13);
            expect(result.check.modifiers.some((m) => m.origin.category === "luck-burn")).toBe(true);
        });
    });
    describe("getTurnUnholyModifier", () => {
        it("returns level plus personality modifier", () => {
            expect(getTurnUnholyModifier(3, 16)).toBe(5); // 3 + 2
            expect(getTurnUnholyModifier(5, 10)).toBe(5); // 5 + 0
            expect(getTurnUnholyModifier(1, 8)).toBe(0); // 1 + (-1)
        });
    });
    describe("getTurnUnholyDie", () => {
        it("returns d20", () => {
            expect(getTurnUnholyDie()).toBe("d20");
        });
    });
    describe("resolveHDExpression", () => {
        it("replaces CL with level", () => {
            expect(resolveHDExpression("1d6+CL", 5)).toBe("1d6+5");
            expect(resolveHDExpression("1d8+CL", 3)).toBe("1d8+3");
            expect(resolveHDExpression("CL", 7)).toBe("7");
        });
        it("handles expressions without CL", () => {
            expect(resolveHDExpression("1d4", 5)).toBe("1d4");
            expect(resolveHDExpression("2d6", 3)).toBe("2d6");
        });
    });
    describe("calculateAverageHD", () => {
        it("calculates average for dice expressions", () => {
            expect(calculateAverageHD("1d6")).toBe(3.5);
            expect(calculateAverageHD("2d6")).toBe(7);
            expect(calculateAverageHD("1d8")).toBe(4.5);
        });
        it("handles modifiers", () => {
            expect(calculateAverageHD("1d6+3")).toBe(6.5);
            expect(calculateAverageHD("1d8+5")).toBe(9.5);
        });
        it("handles plain numbers", () => {
            expect(calculateAverageHD("5")).toBe(5);
            expect(calculateAverageHD("10")).toBe(10);
        });
    });
});
// =============================================================================
// Lay on Hands Tests
// =============================================================================
describe("Lay on Hands", () => {
    describe("LAY_ON_HANDS_SKILL definition", () => {
        it("has correct id and type", () => {
            expect(LAY_ON_HANDS_SKILL.id).toBe("lay-on-hands");
            expect(LAY_ON_HANDS_SKILL.type).toBe("check");
        });
        it("uses d20 with Personality", () => {
            expect(LAY_ON_HANDS_SKILL.roll?.die).toBe("d20");
            expect(LAY_ON_HANDS_SKILL.roll?.ability).toBe("per");
        });
        it("adds full level to roll", () => {
            expect(LAY_ON_HANDS_SKILL.roll?.levelModifier).toBe("full");
        });
        it("allows luck", () => {
            expect(LAY_ON_HANDS_SKILL.roll?.allowLuck).toBe(true);
        });
    });
    describe("layOnHands", () => {
        // A thief target: d6 HD, 3rd level (HD cap = 3).
        const TARGET_THIEF_3 = { hitDie: "d6", hitDice: 3 };
        // A 1st-level warrior: d12 HD, HD cap = 1.
        const TARGET_WARRIOR_1 = { hitDie: "d12", hitDice: 1 };
        it("performs the spell check without alignment on the roll", () => {
            const result = layOnHands({ level: 3, personality: 16, alignment: "same", target: TARGET_THIEF_3 }, TEST_LAY_ON_HANDS_TABLE, { mode: "evaluate", roller: mockRoller(10) });
            // d20=10, level=3, PER 16 (+2), NO alignment bonus → total = 15
            expect(result.check.total).toBe(15);
            expect(result.check.modifiers.some((m) => m.origin.id.startsWith("alignment"))).toBe(false);
        });
        it("returns failure for low rolls", () => {
            const result = layOnHands({ level: 1, personality: 10, alignment: "same", target: TARGET_THIEF_3 }, TEST_LAY_ON_HANDS_TABLE, { mode: "evaluate", roller: mockRoller(5) });
            // d20=5, level=1, PER 10 (+0) → total = 6 (below the first healing row)
            expect(result.check.total).toBe(6);
            expect(result.success).toBe(false);
            expect(result.rawDiceCount).toBe(0);
        });
        it("picks the correct column by alignment", () => {
            // Roll lands in the 13–18 row → same=3, adjacent=2, opposed=1.
            const same = layOnHands({ level: 3, personality: 14, alignment: "same", target: TARGET_THIEF_3 }, TEST_LAY_ON_HANDS_TABLE, { mode: "evaluate", roller: mockRoller(10) });
            const adjacent = layOnHands({ level: 3, personality: 14, alignment: "adjacent", target: TARGET_THIEF_3 }, TEST_LAY_ON_HANDS_TABLE, { mode: "evaluate", roller: mockRoller(10) });
            const opposed = layOnHands({ level: 3, personality: 14, alignment: "opposed", target: TARGET_THIEF_3 }, TEST_LAY_ON_HANDS_TABLE, { mode: "evaluate", roller: mockRoller(10) });
            expect(same.rawDiceCount).toBe(3);
            expect(adjacent.rawDiceCount).toBe(2);
            expect(opposed.rawDiceCount).toBe(1);
        });
        it("caps dice at target's hit dice / class level", () => {
            // Check total 15 → same column = 3 dice, but target has HD 1 → capped to 1.
            const result = layOnHands({ level: 3, personality: 16, alignment: "same", target: TARGET_WARRIOR_1 }, TEST_LAY_ON_HANDS_TABLE, { mode: "evaluate", roller: mockRoller(10) });
            expect(result.rawDiceCount).toBe(3);
            expect(result.diceCount).toBe(1);
            expect(result.hpHealed).toBeDefined();
        });
        it("rolls healing with the target's hit die", () => {
            // Force the healing roll to hit the max of a 3d6 (hitDice=3, cap=3, hitDie=d6).
            // The healing roller is the SAME roller instance; it first satisfies the
            // d20 spell check, then the healing formula.
            const roller = vi
                .fn()
                .mockReturnValueOnce(10) // spell check d20
                .mockReturnValueOnce(18); // healing 3d6 (max)
            const result = layOnHands({ level: 3, personality: 16, alignment: "same", target: TARGET_THIEF_3 }, TEST_LAY_ON_HANDS_TABLE, { mode: "evaluate", roller });
            expect(result.diceCount).toBe(3);
            expect(result.hpHealed).toBe(18);
        });
        it("heals a condition without HP when threshold is met", () => {
            const result = layOnHands({
                level: 3,
                personality: 16,
                alignment: "same",
                target: TARGET_THIEF_3,
                healingCondition: "disease",
            }, TEST_LAY_ON_HANDS_TABLE, { mode: "evaluate", roller: mockRoller(10) });
            expect(result.rawDiceCount).toBe(3);
            expect(result.condition).toEqual({ id: "disease", cured: true, threshold: 2 });
            expect(result.hpHealed).toBeUndefined();
        });
        it("fails a condition when threshold is not met", () => {
            const result = layOnHands({
                level: 1,
                personality: 10,
                alignment: "opposed",
                target: TARGET_THIEF_3,
                healingCondition: "blindness",
            }, TEST_LAY_ON_HANDS_TABLE, { mode: "evaluate", roller: mockRoller(12) } // total 13, opposed col = 1, blindness needs 4
            );
            expect(result.rawDiceCount).toBe(1);
            expect(result.condition).toEqual({ id: "blindness", cured: false, threshold: 4 });
        });
        it("applies self-healing penalty to the check (judge discretion)", () => {
            const result = layOnHands({
                level: 3,
                personality: 16,
                alignment: "same",
                target: TARGET_THIEF_3,
                healingSelf: true,
            }, TEST_LAY_ON_HANDS_TABLE, { mode: "evaluate", roller: mockRoller(10) });
            // d20=10, level=3, PER 16 (+2), self-heal -4 → total = 11
            expect(result.check.total).toBe(11);
            expect(result.check.modifiers.some((m) => m.origin.id === "self-healing")).toBe(true);
        });
        it("applies luck burn to the check", () => {
            const result = layOnHands({
                level: 1,
                personality: 10,
                alignment: "same",
                target: TARGET_THIEF_3,
                luck: 14,
                luckBurn: 2,
            }, TEST_LAY_ON_HANDS_TABLE, { mode: "evaluate", roller: mockRoller(10) });
            // d20=10, level=1, PER 10 (+0), luck burn +2 → total = 13
            expect(result.check.total).toBe(13);
        });
    });
    describe("getLayOnHandsModifier", () => {
        it("returns level plus personality modifier", () => {
            expect(getLayOnHandsModifier(3, 16)).toBe(5); // 3 + 2
            expect(getLayOnHandsModifier(5, 10)).toBe(5); // 5 + 0
            expect(getLayOnHandsModifier(1, 8)).toBe(0); // 1 + (-1)
        });
        it("includes self-healing penalty", () => {
            expect(getLayOnHandsModifier(3, 16, true)).toBe(1); // 3 + 2 - 4
            expect(getLayOnHandsModifier(5, 10, true)).toBe(1); // 5 + 0 - 4
        });
    });
    describe("getLayOnHandsDie", () => {
        it("returns d20", () => {
            expect(getLayOnHandsDie()).toBe("d20");
        });
    });
});
// =============================================================================
// Divine Aid Tests
// =============================================================================
describe("Divine Aid", () => {
    describe("DIVINE_AID_SKILL definition", () => {
        it("has correct id and type", () => {
            expect(DIVINE_AID_SKILL.id).toBe("divine-aid");
            expect(DIVINE_AID_SKILL.type).toBe("check");
        });
        it("uses d20 with Personality", () => {
            expect(DIVINE_AID_SKILL.roll?.die).toBe("d20");
            expect(DIVINE_AID_SKILL.roll?.ability).toBe("per");
        });
        it("adds full level to roll", () => {
            expect(DIVINE_AID_SKILL.roll?.levelModifier).toBe("full");
        });
        it("allows luck", () => {
            expect(DIVINE_AID_SKILL.roll?.allowLuck).toBe(true);
        });
    });
    describe("divineAid", () => {
        it("performs a skill check with level and personality", () => {
            const result = divineAid({ level: 3, personality: 16, disapprovalRange: 1 }, TEST_DIVINE_AID_TABLE, { mode: "evaluate", roller: mockRoller(10) });
            // With d20=10, level=3, PER 16 (+2), total = 15
            expect(result.check.total).toBe(15);
            expect(result.check.modifiers).toHaveLength(2);
        });
        it("returns failure for low rolls", () => {
            const result = divineAid({ level: 1, personality: 10, disapprovalRange: 1 }, TEST_DIVINE_AID_TABLE, { mode: "evaluate", roller: mockRoller(5) });
            // With d20=5, level=1, PER 10 (+0), total = 6
            expect(result.check.total).toBe(6);
            expect(result.success).toBe(false);
            expect(result.effect.type).toBe("none");
        });
        it("returns minor aid for moderate rolls", () => {
            const result = divineAid({ level: 2, personality: 10, disapprovalRange: 1 }, TEST_DIVINE_AID_TABLE, { mode: "evaluate", roller: mockRoller(10) });
            // With d20=10, level=2, PER 10 (+0), total = 12
            expect(result.check.total).toBe(12);
            expect(result.success).toBe(true);
            expect(result.effect.type).toBe("minor-aid");
        });
        it("returns moderate aid for higher rolls", () => {
            const result = divineAid({ level: 3, personality: 14, disapprovalRange: 1 }, TEST_DIVINE_AID_TABLE, { mode: "evaluate", roller: mockRoller(10) });
            // With d20=10, level=3, PER 14 (+1), total = 14
            expect(result.check.total).toBe(14);
            expect(result.success).toBe(true);
            expect(result.effect.type).toBe("moderate-aid");
        });
        it("returns major aid for high rolls", () => {
            const result = divineAid({ level: 5, personality: 18, disapprovalRange: 1 }, TEST_DIVINE_AID_TABLE, { mode: "evaluate", roller: mockRoller(15) });
            // With d20=15, level=5, PER 18 (+3), total = 23
            expect(result.check.total).toBe(23);
            expect(result.success).toBe(true);
            expect(result.effect.type).toBe("major-aid");
        });
        it("returns miraculous aid for very high rolls", () => {
            const result = divineAid({ level: 7, personality: 18, disapprovalRange: 1 }, TEST_DIVINE_AID_TABLE, { mode: "evaluate", roller: mockRoller(16) });
            // With d20=16, level=7, PER 18 (+3), total = 26
            expect(result.check.total).toBe(26);
            expect(result.success).toBe(true);
            expect(result.effect.type).toBe("miraculous-aid");
        });
        it("accrues the RAW +10 disapproval cost on a natural 1, plus the range-hit bump", () => {
            const result = divineAid({ level: 5, personality: 18, disapprovalRange: 1 }, TEST_DIVINE_AID_TABLE, { mode: "evaluate", roller: mockRoller(1) });
            expect(result.natural).toBe(1);
            expect(result.disapprovalTriggered).toBe(true);
            expect(result.success).toBe(false);
            // Start 1 → +10 (Divine Aid cost) → 11 → +1 (natural-1 in-range bump) → 12
            expect(result.newDisapprovalRange).toBe(12);
        });
        it("accrues the RAW +10 on an in-range non-1 roll plus the range-hit bump", () => {
            const result = divineAid({ level: 5, personality: 18, disapprovalRange: 3 }, TEST_DIVINE_AID_TABLE, { mode: "evaluate", roller: mockRoller(3) });
            expect(result.natural).toBe(3);
            expect(result.disapprovalTriggered).toBe(true);
            expect(result.success).toBe(false);
            // Start 3 → +10 → 13 → +1 → 14
            expect(result.newDisapprovalRange).toBe(14);
        });
        it("accrues the RAW +10 even when the roll is outside the disapproval range", () => {
            const result = divineAid({ level: 5, personality: 18, disapprovalRange: 2 }, TEST_DIVINE_AID_TABLE, { mode: "evaluate", roller: mockRoller(3) });
            expect(result.natural).toBe(3);
            expect(result.disapprovalTriggered).toBe(false);
            // Start 2 → +10 → 12 (no extra bump, since not in range)
            expect(result.newDisapprovalRange).toBe(12);
        });
        it("applies luck burn", () => {
            const result = divineAid({ level: 1, personality: 10, disapprovalRange: 1, luck: 14, luckBurn: 2 }, TEST_DIVINE_AID_TABLE, { mode: "evaluate", roller: mockRoller(10) });
            // With d20=10, level=1, PER 10 (+0), luck burn 2, total = 13
            expect(result.check.total).toBe(13);
            expect(result.check.modifiers.some((m) => m.origin.category === "luck-burn")).toBe(true);
        });
        it("includes spell level in effect", () => {
            const result = divineAid({ level: 3, personality: 14, disapprovalRange: 1 }, TEST_DIVINE_AID_TABLE, { mode: "evaluate", roller: mockRoller(10) });
            expect(result.effect.spellLevelEquivalent).toBe(2);
        });
    });
    describe("getDivineAidModifier", () => {
        it("returns level plus personality modifier", () => {
            expect(getDivineAidModifier(3, 16)).toBe(5); // 3 + 2
            expect(getDivineAidModifier(5, 10)).toBe(5); // 5 + 0
            expect(getDivineAidModifier(1, 8)).toBe(0); // 1 + (-1)
        });
    });
    describe("getDivineAidDie", () => {
        it("returns d20", () => {
            expect(getDivineAidDie()).toBe("d20");
        });
    });
    describe("getMinimumCheckForSpellLevel", () => {
        it("returns correct thresholds for each spell level", () => {
            expect(getMinimumCheckForSpellLevel(1)).toBe(12);
            expect(getMinimumCheckForSpellLevel(2)).toBe(14);
            expect(getMinimumCheckForSpellLevel(3)).toBe(18);
            expect(getMinimumCheckForSpellLevel(4)).toBe(22);
            expect(getMinimumCheckForSpellLevel(5)).toBe(26);
        });
        it("extrapolates for higher levels", () => {
            expect(getMinimumCheckForSpellLevel(6)).toBe(32);
        });
    });
    describe("estimateAidSpellLevel", () => {
        it("returns 0 for low results", () => {
            expect(estimateAidSpellLevel(5)).toBe(0);
            expect(estimateAidSpellLevel(11)).toBe(0);
        });
        it("returns correct spell levels for results", () => {
            expect(estimateAidSpellLevel(12)).toBe(1);
            expect(estimateAidSpellLevel(13)).toBe(1);
            expect(estimateAidSpellLevel(14)).toBe(2);
            expect(estimateAidSpellLevel(17)).toBe(2);
            expect(estimateAidSpellLevel(18)).toBe(3);
            expect(estimateAidSpellLevel(21)).toBe(3);
            expect(estimateAidSpellLevel(22)).toBe(4);
            expect(estimateAidSpellLevel(25)).toBe(4);
            expect(estimateAidSpellLevel(26)).toBe(5);
            expect(estimateAidSpellLevel(30)).toBe(5);
        });
    });
    describe("describePotentialAid", () => {
        it("describes potential aid for very low modifiers", () => {
            const desc = describePotentialAid(-10);
            expect(desc).toContain("unlikely");
        });
        it("describes range for moderate modifiers", () => {
            const desc = describePotentialAid(5);
            expect(desc).toContain("ranges from");
        });
        it("describes reliable aid for very high modifiers", () => {
            // With +25, even min roll (1+25=26) gives spell level 5
            const desc = describePotentialAid(25);
            expect(desc).toContain("reliably");
        });
    });
});
//# sourceMappingURL=cleric.test.js.map