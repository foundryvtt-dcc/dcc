/**
 * Tests for mercurial magic rolling, with regression focus on special
 * (`rollAgain`) table entries — DCC core Table 5-2 entries 99 ("Roll
 * again twice.") and 100+ ("Roll again twice, but instead of rolling
 * d%, roll 4d20 ..."). See foundryvtt-dcc/dcc#339.
 */
import { describe, it, expect } from "vitest";
import { MAX_MERCURIAL_SPECIAL_DEPTH, classifyMercurialEffect, expandMercurialSpecial, getMercurialDiceModifier, getMercurialModifier, lookupMercurialEffect, rollMercurialMagic, shouldMercurialTrigger, summarizeMercurialEffect, } from "./mercurial.js";
/**
 * Build a roller that returns the given totals in sequence and records
 * the expressions it was asked to roll.
 */
function scriptedRoller(totals) {
    const expressions = [];
    let i = 0;
    return {
        roller: (expression) => {
            expressions.push(expression);
            const total = totals[i];
            i++;
            if (total === undefined) {
                throw new Error(`scriptedRoller ran out of totals (call ${String(i)})`);
            }
            return total;
        },
        expressions,
    };
}
/** A small table shaped like Table 5-2, with both special entries. */
function testTable() {
    return {
        id: "test-mercurial",
        name: "Test Mercurial Magic",
        entries: [
            {
                min: -99,
                max: 30,
                summary: "Breath of the fish",
                description: "Breath of the fish. The caster can breathe underwater.",
                displayOnCast: false,
            },
            {
                min: 31,
                max: 60,
                summary: "Turbulent magic",
                description: "Turbulent magic. Winds whip around the caster.",
                displayOnCast: true,
            },
            {
                min: 61,
                max: 98,
                summary: "Cannibal magic",
                description: "Cannibal magic. The spell consumes other magic.",
                displayOnCast: true,
            },
            {
                min: 99,
                max: 99,
                summary: "Roll again twice",
                description: "Roll again twice.",
                displayOnCast: true,
                special: { action: "rollAgain", count: 2 },
            },
            {
                min: 100,
                max: 500,
                summary: "Roll again twice with 4d20",
                description: "Roll again twice, but instead of rolling d%, roll 4d20 modified by the wizard's Luck adjustment.",
                displayOnCast: true,
                special: { action: "rollAgain", count: 2, formula: "4d20" },
            },
        ],
    };
}
describe("rollMercurialMagic", () => {
    it("returns a plain entry unchanged (no special, no subEffects)", () => {
        const { roller } = scriptedRoller([45]);
        const effect = rollMercurialMagic(0, testTable(), { roller });
        expect(effect.rollValue).toBe(45);
        expect(effect.summary).toBe("Turbulent magic");
        expect(effect.special).toBeUndefined();
        expect(effect.subEffects).toBeUndefined();
    });
    it("applies the luck modifier (×10) to the base roll", () => {
        const { roller } = scriptedRoller([25]);
        const effect = rollMercurialMagic(2, testTable(), { roller });
        expect(effect.rollValue).toBe(45);
        expect(effect.summary).toBe("Turbulent magic");
    });
    it("expands a rollAgain special into count sub-effects", () => {
        const { roller, expressions } = scriptedRoller([99, 45, 70]);
        const effect = rollMercurialMagic(0, testTable(), { roller });
        expect(effect.rollValue).toBe(99);
        expect(effect.special).toEqual({ action: "rollAgain", count: 2 });
        expect(effect.subEffects).toHaveLength(2);
        expect(effect.subEffects?.[0]?.rollValue).toBe(45);
        expect(effect.subEffects?.[1]?.rollValue).toBe(70);
        expect(effect.summary).toBe("Turbulent magic; Cannibal magic");
        expect(effect.description).toBe("(45) Turbulent magic. Winds whip around the caster.\n\n" +
            "(70) Cannibal magic. The spell consumes other magic.");
        // All three rolls use the default d100 formula
        expect(expressions).toEqual(["1d100", "1d100", "1d100"]);
    });
    it("uses the special's formula for sub-rolls and still applies luck", () => {
        // Luck +1: base 90 → 100 lands on the 4d20 entry; sub-rolls 35 and
        // 51 become 45 and 61 after the same +10 luck adjustment.
        const { roller, expressions } = scriptedRoller([90, 35, 51]);
        const effect = rollMercurialMagic(1, testTable(), { roller });
        expect(effect.rollValue).toBe(100);
        expect(expressions).toEqual(["1d100", "4d20", "4d20"]);
        expect(effect.subEffects?.[0]?.rollValue).toBe(45);
        expect(effect.subEffects?.[0]?.summary).toBe("Turbulent magic");
        expect(effect.subEffects?.[1]?.rollValue).toBe(61);
        expect(effect.subEffects?.[1]?.summary).toBe("Cannibal magic");
    });
    it("recurses when a sub-roll lands on another special entry", () => {
        // 99 → (99 → (45, 70), 20): the first sub-roll hits the special
        // again and expands into two nested effects of its own.
        const { roller } = scriptedRoller([99, 99, 45, 70, 20]);
        const effect = rollMercurialMagic(0, testTable(), { roller });
        expect(effect.subEffects).toHaveLength(2);
        const nested = effect.subEffects?.[0];
        expect(nested?.rollValue).toBe(99);
        expect(nested?.subEffects).toHaveLength(2);
        expect(nested?.summary).toBe("Turbulent magic; Cannibal magic");
        expect(effect.subEffects?.[1]?.summary).toBe("Breath of the fish");
        expect(effect.summary).toBe("Turbulent magic; Cannibal magic; Breath of the fish");
    });
    it("stops expanding at the recursion depth cap", () => {
        // A roller that always rolls 99 would recurse forever without a cap.
        const roller = () => 99;
        const effect = rollMercurialMagic(0, testTable(), { roller });
        // Walk the first-child chain: expanded effects have subEffects, the
        // capped leaf is the literal instruction with special but no children.
        let node = effect;
        let expandedLevels = 0;
        while (node.subEffects) {
            const child = node.subEffects[0];
            if (!child)
                break;
            expandedLevels++;
            node = child;
        }
        expect(expandedLevels).toBe(MAX_MERCURIAL_SPECIAL_DEPTH);
        expect(node.special).toBeDefined();
        expect(node.subEffects).toBeUndefined();
        expect(node.description).toBe("Roll again twice.");
    });
    it("aggregates displayOnCast from sub-effects", () => {
        // Both sub-rolls land on the displayOnCast: false entry.
        const { roller } = scriptedRoller([99, 10, 20]);
        const effect = rollMercurialMagic(0, testTable(), { roller });
        expect(effect.displayOnCast).toBe(false);
        const { roller: roller2 } = scriptedRoller([99, 10, 45]);
        const effect2 = rollMercurialMagic(0, testTable(), { roller: roller2 });
        expect(effect2.displayOnCast).toBe(true);
    });
});
describe("lookupMercurialEffect", () => {
    it("copies the special through without expanding it", () => {
        const effect = lookupMercurialEffect(99, testTable());
        expect(effect.special).toEqual({ action: "rollAgain", count: 2 });
        expect(effect.subEffects).toBeUndefined();
        expect(effect.description).toBe("Roll again twice.");
    });
    it("returns plain entries without a special", () => {
        const effect = lookupMercurialEffect(45, testTable());
        expect(effect.special).toBeUndefined();
    });
});
describe("expandMercurialSpecial", () => {
    it("expands a looked-up special effect with real rolls", () => {
        const looked = lookupMercurialEffect(99, testTable());
        const { roller } = scriptedRoller([45, 70]);
        const effect = expandMercurialSpecial(looked, 0, testTable(), { roller });
        expect(effect.rollValue).toBe(99);
        expect(effect.subEffects).toHaveLength(2);
        expect(effect.summary).toBe("Turbulent magic; Cannibal magic");
    });
    it("returns non-special effects unchanged", () => {
        const looked = lookupMercurialEffect(45, testTable());
        const effect = expandMercurialSpecial(looked, 0, testTable());
        expect(effect).toBe(looked);
    });
    it("applies flat modifiers in the formula on the built-in roller path", () => {
        // No custom roller: the built-in evaluator must honor the "+44"
        // suffix. 1d1 always rolls 1, so each sub-roll totals 45 →
        // "Turbulent magic" deterministically.
        const table = testTable();
        const entry = table.entries.find((e) => e.min === 99);
        if (entry?.special) {
            entry.special.formula = "1d1+44";
        }
        const looked = lookupMercurialEffect(99, table);
        const effect = expandMercurialSpecial(looked, 0, table);
        expect(effect.subEffects).toHaveLength(2);
        expect(effect.subEffects?.[0]?.rollValue).toBe(45);
        expect(effect.subEffects?.[1]?.rollValue).toBe(45);
        expect(effect.summary).toBe("Turbulent magic; Turbulent magic");
    });
    it("clamps a malformed count to the ceiling", () => {
        const table = testTable();
        const entry = table.entries.find((e) => e.min === 99);
        if (entry?.special) {
            entry.special.count = 9999;
        }
        // 1 trigger + at most 10 sub-rolls — scripted roller throws if more
        // rolls are requested than provided.
        const totals = [99, ...Array.from({ length: 10 }, () => 45)];
        const { roller } = scriptedRoller(totals);
        const effect = rollMercurialMagic(0, table, { roller });
        expect(effect.subEffects).toHaveLength(10);
    });
});
describe("accessors on combined (roll-again) effects", () => {
    /** A table whose entries carry structured effect data. */
    function structuredTable() {
        return {
            id: "structured-mercurial",
            name: "Structured Mercurial Magic",
            entries: [
                {
                    min: -99,
                    max: 30,
                    summary: "Hindered casting",
                    description: "Hindered casting. -2 to spell checks.",
                    displayOnCast: true,
                    effect: { type: "modifier", modifier: -2 },
                },
                {
                    min: 31,
                    max: 60,
                    summary: "Empowered casting",
                    description: "Empowered casting. +1 to spell checks.",
                    displayOnCast: true,
                    effect: { type: "modifier", modifier: 1, dice: "+1d4" },
                },
                {
                    min: 61,
                    max: 98,
                    summary: "Crit surge",
                    description: "Crit surge. +3 on a natural 20.",
                    displayOnCast: true,
                    effect: { type: "modifier", modifier: 3, trigger: "on-crit" },
                },
                {
                    min: 99,
                    max: 500,
                    summary: "Roll again twice",
                    description: "Roll again twice.",
                    displayOnCast: true,
                    special: { action: "rollAgain", count: 2 },
                },
            ],
        };
    }
    it("sums modifiers across sub-effects", () => {
        const { roller } = scriptedRoller([99, 10, 45]);
        const effect = rollMercurialMagic(0, structuredTable(), { roller });
        expect(getMercurialModifier(effect)).toBe(-1);
    });
    it("concatenates dice modifiers across sub-effects", () => {
        const { roller } = scriptedRoller([99, 45, 45]);
        const effect = rollMercurialMagic(0, structuredTable(), { roller });
        expect(getMercurialDiceModifier(effect)).toBe("+1d4+1d4");
    });
    it("triggers when any sub-effect triggers", () => {
        // Both sub-effects are on-crit only
        const { roller } = scriptedRoller([99, 70, 70]);
        const effect = rollMercurialMagic(0, structuredTable(), { roller });
        expect(shouldMercurialTrigger(effect, 20, true)).toBe(true);
        expect(shouldMercurialTrigger(effect, 15, true)).toBe(false);
    });
    it("classifies combined effects from their sub-effects", () => {
        const { roller: mixedRoller } = scriptedRoller([99, 10, 45]);
        const mixed = rollMercurialMagic(0, structuredTable(), {
            roller: mixedRoller,
        });
        expect(classifyMercurialEffect(mixed)).toBe("mixed");
        const { roller: goodRoller } = scriptedRoller([99, 45, 45]);
        const good = rollMercurialMagic(0, structuredTable(), {
            roller: goodRoller,
        });
        expect(classifyMercurialEffect(good)).toBe("beneficial");
        const { roller: badRoller } = scriptedRoller([99, 10, 10]);
        const bad = rollMercurialMagic(0, structuredTable(), {
            roller: badRoller,
        });
        expect(classifyMercurialEffect(bad)).toBe("detrimental");
    });
    it("summarizes each sub-effect", () => {
        const { roller } = scriptedRoller([99, 10, 45]);
        const effect = rollMercurialMagic(0, structuredTable(), { roller });
        expect(summarizeMercurialEffect(effect)).toBe("-2 to spell check; +1 to spell check, +1d4 to effect");
    });
});
