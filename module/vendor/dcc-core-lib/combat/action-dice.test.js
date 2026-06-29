import { describe, expect, it } from "vitest";
import { actionDieRollTerms, actionMatchesUse, classExtraActionDieUse, isActionDiceStateCurrent, nextActionDie, parseActionDice, resetActionDice, spendActionDie, } from "./action-dice.js";
describe("classExtraActionDieUse", () => {
    it("restricts only the wizard's extra dice to spells", () => {
        expect(classExtraActionDieUse("wizard")).toBe("spell");
        expect(classExtraActionDieUse("Wizard")).toBe("spell");
    });
    it("leaves every other class (including caster elves/clerics) unrestricted", () => {
        for (const cls of ["elf", "cleric", "warrior", "dwarf", "thief", "halfling"]) {
            expect(classExtraActionDieUse(cls)).toBe("any");
        }
    });
    it("defaults to 'any' for unknown/missing class", () => {
        expect(classExtraActionDieUse(undefined)).toBe("any");
        expect(classExtraActionDieUse("")).toBe("any");
        expect(classExtraActionDieUse("homebrew-knight")).toBe("any");
    });
});
describe("parseActionDice — shapes", () => {
    it("parses a plain comma string into unrestricted slots", () => {
        expect(parseActionDice("1d20,1d16")).toEqual([
            { slot: 0, die: "d20", modifier: 0, use: "any" },
            { slot: 1, die: "d16", modifier: 0, use: "any" },
        ]);
    });
    it("tolerates whitespace and an array input", () => {
        expect(parseActionDice(" 1d20 , 1d14 ")).toEqual(parseActionDice(["1d20", "1d14"]));
    });
    it("expands an NPC 'Nd' token into N separate single-die slots", () => {
        expect(parseActionDice("2d20")).toEqual([
            { slot: 0, die: "d20", modifier: 0, use: "any" },
            { slot: 1, die: "d20", modifier: 0, use: "any" },
        ]);
    });
    it("treats a '+'-joined dice token as a separator (NPC '1d24+1d20')", () => {
        expect(parseActionDice("1d24+1d20")).toEqual([
            { slot: 0, die: "d24", modifier: 0, use: "any" },
            { slot: 1, die: "d20", modifier: 0, use: "any" },
        ]);
    });
    it("treats a bare '+N' as a per-die rider, not a slot", () => {
        expect(parseActionDice("1d20+4, 1d20, 1d16")).toEqual([
            { slot: 0, die: "d20", modifier: 4, use: "any" },
            { slot: 1, die: "d20", modifier: 0, use: "any" },
            { slot: 2, die: "d16", modifier: 0, use: "any" },
        ]);
    });
    it("ignores empty tokens", () => {
        expect(parseActionDice("1d20,,")).toHaveLength(1);
        expect(parseActionDice("")).toEqual([]);
    });
});
describe("parseActionDice — use inference", () => {
    it("tags a wizard's extra die spells-only from the unchanged string", () => {
        expect(parseActionDice("1d20,1d16", { className: "wizard" })).toEqual([
            { slot: 0, die: "d20", modifier: 0, use: "any" }, // first die always flexible
            { slot: 1, die: "d16", modifier: 0, use: "spell" },
        ]);
    });
    it("leaves an elf's extra die unrestricted (RAW: elf can attack twice)", () => {
        const slots = parseActionDice("1d20,1d14", { className: "elf" });
        expect(slots.map((s) => s.use)).toEqual(["any", "any"]);
    });
    it("honors an explicit *tag over class inference", () => {
        // a warrior with a hand-authored spells-only second die
        expect(parseActionDice("1d20,1d16*spell", { className: "warrior" })[1]?.use).toBe("spell");
        // explicit *any on a wizard overrides the spells-only default
        expect(parseActionDice("1d20,1d16*any", { className: "wizard" })[1]?.use).toBe("any");
    });
});
describe("actionMatchesUse", () => {
    it("lets an 'any' die take any action", () => {
        for (const a of ["attack", "spell", "check"]) {
            expect(actionMatchesUse("any", a)).toBe(true);
        }
    });
    it("restricts a spells-only die to spells (not attacks or checks)", () => {
        expect(actionMatchesUse("spell", "spell")).toBe(true);
        expect(actionMatchesUse("spell", "attack")).toBe(false);
        expect(actionMatchesUse("spell", "check")).toBe(false);
    });
});
describe("nextActionDie", () => {
    const warrior = parseActionDice("1d20,1d14"); // two unrestricted
    const fresh = () => resetActionDice(warrior, 1);
    it("defaults to the first unspent slot, then the next", () => {
        const state = fresh();
        const first = nextActionDie(warrior, state, "attack");
        expect(first?.index).toBe(0);
        const afterFirst = spendActionDie(state, 0);
        expect(nextActionDie(warrior, afterFirst, "attack")?.index).toBe(1);
    });
    it("returns null when the budget is spent (over budget)", () => {
        let state = fresh();
        state = spendActionDie(state, 0);
        state = spendActionDie(state, 1);
        expect(nextActionDie(warrior, state, "attack")).toBeNull();
    });
    it("skips a wizard's spells-only die for a weapon attack but offers it for a spell", () => {
        const wizard = parseActionDice("1d20,1d16", { className: "wizard" });
        let state = resetActionDice(wizard, 1);
        // spend the flexible first die on an attack
        state = spendActionDie(state, 0);
        // no die left for a second attack — the 1d16 is spells-only
        expect(nextActionDie(wizard, state, "attack")).toBeNull();
        // but the spells-only die is available to cast
        expect(nextActionDie(wizard, state, "spell")?.index).toBe(1);
    });
    it("treats a short/empty spent array as all-unspent", () => {
        expect(nextActionDie(warrior, { round: 1, spent: [] }, "attack")?.index).toBe(0);
    });
});
describe("spendActionDie / resetActionDice", () => {
    it("spends without mutating the input state", () => {
        const state = { round: 3, spent: [false, false] };
        const next = spendActionDie(state, 1);
        expect(next.spent).toEqual([false, true]);
        expect(state.spent).toEqual([false, false]); // unchanged
        expect(next.round).toBe(3);
    });
    it("extends the spent array for an out-of-range index", () => {
        expect(spendActionDie({ round: 1, spent: [] }, 2).spent).toEqual([
            false,
            false,
            true,
        ]);
    });
    it("resets to all-unspent sized to the slot list", () => {
        const slots = parseActionDice("1d20,1d20,1d14");
        expect(resetActionDice(slots, 7)).toEqual({
            round: 7,
            spent: [false, false, false],
        });
    });
    it("reports whether state matches the current round", () => {
        const state = resetActionDice(parseActionDice("1d20"), 5);
        expect(isActionDiceStateCurrent(state, 5)).toBe(true);
        expect(isActionDiceStateCurrent(state, 6)).toBe(false);
    });
});
describe("actionDieRollTerms — D2 double-count reconciliation", () => {
    it("suppresses the generic attack bonus when the slot carries its own rider", () => {
        const [withRider] = parseActionDice("1d20+4");
        if (!withRider)
            throw new Error("expected a parsed slot");
        expect(actionDieRollTerms(withRider)).toEqual({
            die: "d20",
            modifier: 4,
            suppressAttackBonus: true,
        });
    });
    it("defers to the caller's normal bonus logic when there is no rider", () => {
        const [plain] = parseActionDice("1d20");
        if (!plain)
            throw new Error("expected a parsed slot");
        expect(actionDieRollTerms(plain)).toEqual({
            die: "d20",
            modifier: 0,
            suppressAttackBonus: false,
        });
    });
});
