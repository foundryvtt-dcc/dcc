/**
 * Patron System Tests
 *
 * Tests for patron registry, invoke patron mechanics, and patron bonds.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { 
// Registry
registerPatron, registerPatrons, clearPatronRegistry, getPatron, requirePatron, hasPatron, getRegisteredPatronIds, getAllPatrons, findPatrons, getPatronInvokeTableId, getPatronTaintTableId, getPatronSpells, getPatronCount, 
// Invoke
INVOKE_PATRON_MIN_SUCCESS, buildInvokeModifiers, sumModifiers, buildInvokeFormula, invokePatron, isInvokeSuccess, isInvokeFumble, getInvokeSummary, estimateInvokeSuccessChance, 
// Bond
createPatronBond, canFormPatronBond, getCharacterPatronId, hasPatronBond, formWizardPatronBond, formElfPatronBond, getAvailablePatronSpells, canLearnPatronSpell, createPatronSpellEntry, incrementTaintCount, addTaintToNotes, getPatronBondBreakConsequences, canBreakPatronBond, } from "./index.js";
// =============================================================================
// Test Data
// =============================================================================
const testPatron = {
    id: "test-patron",
    name: "The Test Patron",
    description: "A patron for testing purposes",
    domain: "testing",
    alignment: "neutral",
    source: "Test Data",
    invokeTableId: "invoke-test-patron",
    taintTableId: "taint-test-patron",
    grantedSpells: [
        { spellId: "test-spell-1", minLevel: 1, description: "Basic patron spell" },
        { spellId: "test-spell-2", minLevel: 3, description: "Advanced patron spell" },
        { spellId: "test-spell-3", minLevel: 5, description: "Master patron spell" },
    ],
    bondRequirements: "Must complete a test",
};
const testPatron2 = {
    id: "chaos-patron",
    name: "Lord of Chaos",
    domain: "chaos",
    alignment: "chaotic",
    invokeTableId: "invoke-chaos-patron",
    taintTableId: "taint-chaos-patron",
    grantedSpells: [
        { spellId: "chaos-bolt", minLevel: 1 },
    ],
};
const testInvokeTable = {
    id: "invoke-test-patron",
    type: "tiered",
    name: "Invoke Test Patron",
    entries: [
        { min: 1, max: 11, tier: "failure", text: "The patron ignores your plea." },
        { min: 12, max: 17, tier: "success-minor", text: "The patron grants minor aid." },
        { min: 18, max: 23, tier: "success", text: "The patron grants significant aid." },
        { min: 24, max: 100, tier: "success-major", text: "The patron grants major aid." },
    ],
};
const testTaintTable = {
    id: "taint-test-patron",
    type: "simple",
    name: "Test Patron Taint",
    entries: [
        { min: 1, max: 2, text: "Minor cosmetic change" },
        { min: 3, max: 4, text: "Moderate physical alteration" },
        { min: 5, max: 6, text: "Major transformation" },
    ],
};
function createTestWizard(options) {
    return {
        identity: {
            id: "test-wizard",
            name: "Test Wizard",
            occupation: "Wizard's Apprentice",
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
            classId: "wizard",
            level: options?.level ?? 3,
            title: "Magician",
        },
        state: {
            hp: { current: 10, max: 10, temp: 0 },
            abilities: {
                str: { current: 10, max: 10 },
                agl: { current: 10, max: 10 },
                sta: { current: 10, max: 10 },
                per: { current: 10, max: 10 },
                int: { current: 16, max: 16 },
                lck: { current: 10, max: 10 },
            },
            xp: { current: 0, nextLevel: 100 },
            saves: { reflex: 0, fortitude: 0, will: 2 },
            combat: {
                attackBonus: 1,
                actionDice: ["d20"],
                critDie: "d6",
                critTable: "I",
                threatRange: 20,
                ac: 10,
                speed: 30,
                initiative: 0,
            },
            currency: { pp: 0, ep: 0, gp: 10, sp: 0, cp: 0 },
            inventory: { items: [] },
            conditions: [],
            classState: {
                wizard: options?.patron
                    ? {
                        corruption: [],
                        patron: options.patron,
                        spellbook: { spells: [] },
                    }
                    : {
                        corruption: [],
                        spellbook: { spells: [] },
                    },
            },
        },
    };
}
function createTestElf(options) {
    const char = createTestWizard(options);
    char.classInfo = { classId: "elf", level: 2, title: "Wanderer" };
    char.state.classState = {
        elf: options?.patron
            ? {
                patron: options.patron,
                corruption: [],
                spellbook: { spells: [] },
            }
            : {
                corruption: [],
                spellbook: { spells: [] },
            },
    };
    return char;
}
function createTestWarrior() {
    const char = createTestWizard();
    char.classInfo = { classId: "warrior", level: 2, title: "Warrior" };
    char.state.classState = {
        warrior: { deedDie: "d3" },
    };
    return char;
}
// =============================================================================
// Registry Tests
// =============================================================================
describe("Patron Registry", () => {
    beforeEach(() => {
        clearPatronRegistry();
    });
    describe("registerPatron", () => {
        it("registers a patron successfully", () => {
            registerPatron(testPatron);
            expect(hasPatron(testPatron.id)).toBe(true);
        });
        it("throws error when registering duplicate patron", () => {
            registerPatron(testPatron);
            expect(() => { registerPatron(testPatron); }).toThrow('Patron "test-patron" is already registered');
        });
    });
    describe("registerPatrons", () => {
        it("registers multiple patrons", () => {
            registerPatrons([testPatron, testPatron2]);
            expect(getPatronCount()).toBe(2);
        });
    });
    describe("clearPatronRegistry", () => {
        it("clears all registered patrons", () => {
            registerPatrons([testPatron, testPatron2]);
            clearPatronRegistry();
            expect(getPatronCount()).toBe(0);
        });
    });
    describe("getPatron", () => {
        it("returns patron when found", () => {
            registerPatron(testPatron);
            const result = getPatron(testPatron.id);
            expect(result).toEqual(testPatron);
        });
        it("returns undefined when not found", () => {
            const result = getPatron("nonexistent");
            expect(result).toBeUndefined();
        });
    });
    describe("requirePatron", () => {
        it("returns patron when found", () => {
            registerPatron(testPatron);
            const result = requirePatron(testPatron.id);
            expect(result).toEqual(testPatron);
        });
        it("throws error when not found", () => {
            expect(() => requirePatron("nonexistent")).toThrow('Patron "nonexistent" is not registered');
        });
    });
    describe("getRegisteredPatronIds", () => {
        it("returns all registered patron IDs", () => {
            registerPatrons([testPatron, testPatron2]);
            const ids = getRegisteredPatronIds();
            expect(ids).toContain("test-patron");
            expect(ids).toContain("chaos-patron");
        });
    });
    describe("getAllPatrons", () => {
        it("returns all registered patrons", () => {
            registerPatrons([testPatron, testPatron2]);
            const patrons = getAllPatrons();
            expect(patrons).toHaveLength(2);
        });
    });
    describe("findPatrons", () => {
        beforeEach(() => {
            registerPatrons([testPatron, testPatron2]);
        });
        it("filters by alignment", () => {
            const results = findPatrons({ alignment: "chaotic" });
            expect(results).toHaveLength(1);
            expect(results[0]?.id).toBe("chaos-patron");
        });
        it("filters by domain", () => {
            const results = findPatrons({ domain: "testing" });
            expect(results).toHaveLength(1);
            expect(results[0]?.id).toBe("test-patron");
        });
        it("filters by name search", () => {
            const results = findPatrons({ nameSearch: "chaos" });
            expect(results).toHaveLength(1);
            expect(results[0]?.id).toBe("chaos-patron");
        });
        it("returns all when no filters", () => {
            const results = findPatrons({});
            expect(results).toHaveLength(2);
        });
    });
    describe("getPatronInvokeTableId", () => {
        it("returns invoke table ID for registered patron", () => {
            registerPatron(testPatron);
            const tableId = getPatronInvokeTableId(testPatron.id);
            expect(tableId).toBe("invoke-test-patron");
        });
        it("returns undefined for unregistered patron", () => {
            const tableId = getPatronInvokeTableId("nonexistent");
            expect(tableId).toBeUndefined();
        });
    });
    describe("getPatronTaintTableId", () => {
        it("returns taint table ID for registered patron", () => {
            registerPatron(testPatron);
            const tableId = getPatronTaintTableId(testPatron.id);
            expect(tableId).toBe("taint-test-patron");
        });
    });
    describe("getPatronSpells", () => {
        beforeEach(() => {
            registerPatron(testPatron);
        });
        it("returns all spells when no level filter", () => {
            const spells = getPatronSpells(testPatron.id);
            expect(spells).toHaveLength(3);
        });
        it("returns spells available at level 1", () => {
            const spells = getPatronSpells(testPatron.id, 1);
            expect(spells).toHaveLength(1);
            expect(spells[0]?.spellId).toBe("test-spell-1");
        });
        it("returns spells available at level 3", () => {
            const spells = getPatronSpells(testPatron.id, 3);
            expect(spells).toHaveLength(2);
        });
        it("returns all spells at level 5+", () => {
            const spells = getPatronSpells(testPatron.id, 5);
            expect(spells).toHaveLength(3);
        });
        it("returns empty array for unregistered patron", () => {
            const spells = getPatronSpells("nonexistent");
            expect(spells).toHaveLength(0);
        });
    });
});
// =============================================================================
// Invoke Patron Tests
// =============================================================================
describe("Invoke Patron", () => {
    describe("buildInvokeModifiers", () => {
        it("includes caster level", () => {
            const input = {
                patronId: "test-patron",
                casterLevel: 3,
                abilityModifier: 0,
            };
            const mods = buildInvokeModifiers(input);
            expect(mods).toContainEqual({ source: "Caster Level", value: 3 });
        });
        it("includes ability modifier", () => {
            const input = {
                patronId: "test-patron",
                casterLevel: 1,
                abilityModifier: 2,
            };
            const mods = buildInvokeModifiers(input);
            expect(mods).toContainEqual({ source: "Intelligence", value: 2 });
        });
        it("includes luck modifier", () => {
            const input = {
                patronId: "test-patron",
                casterLevel: 1,
                abilityModifier: 0,
                luckModifier: 1,
            };
            const mods = buildInvokeModifiers(input);
            expect(mods).toContainEqual({ source: "Luck Modifier", value: 1 });
        });
        it("includes luck burn", () => {
            const input = {
                patronId: "test-patron",
                casterLevel: 1,
                abilityModifier: 0,
                luckBurn: 3,
            };
            const mods = buildInvokeModifiers(input);
            expect(mods).toContainEqual({ source: "Luck Burn", value: 3 });
        });
        it("includes spellburn", () => {
            const input = {
                patronId: "test-patron",
                casterLevel: 1,
                abilityModifier: 0,
                spellburn: { str: 2, agl: 1, sta: 0 },
            };
            const mods = buildInvokeModifiers(input);
            expect(mods).toContainEqual({ source: "Spellburn", value: 3 });
        });
        it("includes situational modifiers", () => {
            const input = {
                patronId: "test-patron",
                casterLevel: 1,
                abilityModifier: 0,
                situationalModifiers: [
                    { source: "Ritual", value: 2 },
                    { source: "Holy Ground", value: 1 },
                ],
            };
            const mods = buildInvokeModifiers(input);
            expect(mods).toContainEqual({ source: "Ritual", value: 2 });
            expect(mods).toContainEqual({ source: "Holy Ground", value: 1 });
        });
    });
    describe("sumModifiers", () => {
        it("sums all modifier values", () => {
            const mods = [
                { source: "A", value: 3 },
                { source: "B", value: 2 },
                { source: "C", value: -1 },
            ];
            expect(sumModifiers(mods)).toBe(4);
        });
        it("returns 0 for empty array", () => {
            expect(sumModifiers([])).toBe(0);
        });
    });
    describe("buildInvokeFormula", () => {
        it("builds formula with positive modifiers", () => {
            const mods = [
                { source: "A", value: 3 },
                { source: "B", value: 2 },
            ];
            const formula = buildInvokeFormula(15, mods);
            expect(formula).toBe("15 +3 +2 = 20");
        });
        it("builds formula with negative modifiers", () => {
            const mods = [
                { source: "A", value: 3 },
                { source: "B", value: -1 },
            ];
            const formula = buildInvokeFormula(15, mods);
            expect(formula).toBe("15 +3 -1 = 17");
        });
        it("builds formula with no modifiers", () => {
            const formula = buildInvokeFormula(15, []);
            expect(formula).toBe("15 = 15");
        });
    });
    describe("invokePatron", () => {
        const baseInput = {
            patronId: "test-patron",
            casterLevel: 3,
            abilityModifier: 2,
            invokeTable: testInvokeTable,
            taintTable: testTaintTable,
        };
        it("returns success result when total >= 12", () => {
            // Mock roller that returns 10, total will be 10+3+2 = 15
            const result = invokePatron(baseInput, { roller: () => 10 });
            expect(result.success).toBe(true);
            expect(result.natural).toBe(10);
            expect(result.total).toBe(15);
        });
        it("returns failure result when total < 12", () => {
            // Mock roller that returns 3, total will be 3+3+2 = 8
            const result = invokePatron(baseInput, { roller: () => 3 });
            expect(result.success).toBe(false);
            expect(result.total).toBe(8);
        });
        it("detects critical on natural 20", () => {
            const result = invokePatron(baseInput, { roller: () => 20 });
            expect(result.critical).toBe(true);
            expect(result.fumble).toBe(false);
        });
        it("detects fumble on natural 1", () => {
            const result = invokePatron(baseInput, { roller: () => 1 });
            expect(result.fumble).toBe(true);
            expect(result.critical).toBe(false);
            expect(result.success).toBe(false);
        });
        it("incurs taint on fumble", () => {
            const result = invokePatron(baseInput, { roller: () => 1 });
            expect(result.taintIncurred).toBe(true);
            expect(result.taintDescription).toBeDefined();
        });
        it("marks spell as lost on fumble", () => {
            const result = invokePatron(baseInput, { roller: () => 1 });
            expect(result.spellLost).toBe(true);
        });
        it("does not incur taint when no taint table", () => {
            const inputNoTaint = {
                patronId: "test-patron",
                casterLevel: 3,
                abilityModifier: 2,
                invokeTable: testInvokeTable,
                // taintTable intentionally omitted
            };
            const result = invokePatron(inputNoTaint, { roller: () => 1 });
            expect(result.taintIncurred).toBe(false);
        });
        it("looks up result tier from invoke table", () => {
            const result = invokePatron(baseInput, { roller: () => 15 }); // total = 20
            expect(result.tier).toBe("success");
            expect(result.resultText).toBe("The patron grants significant aid.");
        });
        it("emits events", () => {
            const events = [];
            const result = invokePatron(baseInput, { roller: () => 15 }, {
                onInvokeStart: () => events.push("start"),
                onInvokeComplete: () => events.push("complete"),
                onPatronAnswers: () => events.push("answers"),
            });
            expect(events).toContain("start");
            expect(events).toContain("complete");
            expect(events).toContain("answers");
            expect(result.success).toBe(true);
        });
        it("emits patron ignores event on failure", () => {
            const events = [];
            invokePatron(baseInput, { roller: () => 3 }, {
                onPatronIgnores: () => events.push("ignores"),
            });
            expect(events).toContain("ignores");
        });
    });
    describe("isInvokeSuccess", () => {
        it("returns true for successful result", () => {
            const result = invokePatron({ patronId: "test", casterLevel: 5, abilityModifier: 5 }, { roller: () => 10 });
            expect(isInvokeSuccess(result)).toBe(true);
        });
        it("returns false for failed result", () => {
            const result = invokePatron({ patronId: "test", casterLevel: 1, abilityModifier: 0 }, { roller: () => 5 });
            expect(isInvokeSuccess(result)).toBe(false);
        });
    });
    describe("isInvokeFumble", () => {
        it("returns true for fumble", () => {
            const result = invokePatron({ patronId: "test", casterLevel: 1, abilityModifier: 0 }, { roller: () => 1 });
            expect(isInvokeFumble(result)).toBe(true);
        });
        it("returns false for non-fumble", () => {
            const result = invokePatron({ patronId: "test", casterLevel: 1, abilityModifier: 0 }, { roller: () => 10 });
            expect(isInvokeFumble(result)).toBe(false);
        });
    });
    describe("getInvokeSummary", () => {
        it("includes roll info", () => {
            const result = invokePatron({ patronId: "test", casterLevel: 3, abilityModifier: 2 }, { roller: () => 15 });
            const summary = getInvokeSummary(result);
            expect(summary).toContain("Roll: 15");
            expect(summary).toContain("20");
        });
        it("indicates success", () => {
            const result = invokePatron({ patronId: "test", casterLevel: 5, abilityModifier: 5 }, { roller: () => 15 });
            const summary = getInvokeSummary(result);
            expect(summary).toContain("Patron Answers");
        });
        it("indicates fumble", () => {
            const result = invokePatron({ patronId: "test", casterLevel: 1, abilityModifier: 0, taintTable: testTaintTable }, { roller: () => 1 });
            const summary = getInvokeSummary(result);
            expect(summary).toContain("FUMBLE");
            expect(summary).toContain("Spell Lost");
        });
    });
    describe("estimateInvokeSuccessChance", () => {
        it("returns high probability with large modifier", () => {
            const chance = estimateInvokeSuccessChance(10);
            expect(chance).toBeGreaterThan(0.9);
        });
        it("returns low probability with negative modifier", () => {
            const chance = estimateInvokeSuccessChance(-5);
            expect(chance).toBeLessThan(0.3);
        });
        it("handles edge case where natural 1 always fails", () => {
            // Even with modifier of 100, natural 1 fails
            const chance = estimateInvokeSuccessChance(100);
            expect(chance).toBeLessThanOrEqual(0.95);
        });
        it("allows custom target DC", () => {
            const chance = estimateInvokeSuccessChance(0, 10);
            expect(chance).toBeGreaterThan(estimateInvokeSuccessChance(0, 15));
        });
    });
    describe("INVOKE_PATRON_MIN_SUCCESS", () => {
        it("is 12 per DCC rules", () => {
            expect(INVOKE_PATRON_MIN_SUCCESS).toBe(12);
        });
    });
});
// =============================================================================
// Patron Bond Tests
// =============================================================================
describe("Patron Bond", () => {
    beforeEach(() => {
        clearPatronRegistry();
        registerPatron(testPatron);
    });
    describe("createPatronBond", () => {
        it("creates a basic bond", () => {
            const bond = createPatronBond("test-patron");
            expect(bond.patronId).toBe("test-patron");
            expect(bond.taintCount).toBe(0);
            expect(bond.bondedAt).toBeDefined();
        });
        it("creates bond with options", () => {
            const bond = createPatronBond("test-patron", {
                bondStrength: "strong",
                notes: "Bonded during ritual",
            });
            expect(bond.bondStrength).toBe("strong");
            expect(bond.notes).toBe("Bonded during ritual");
        });
    });
    describe("canFormPatronBond", () => {
        it("allows wizard to form bond", () => {
            const wizard = createTestWizard();
            const result = canFormPatronBond(wizard, testPatron.id);
            expect(result.canBond).toBe(true);
        });
        it("allows elf to form bond", () => {
            const elf = createTestElf();
            const result = canFormPatronBond(elf, testPatron.id);
            expect(result.canBond).toBe(true);
        });
        it("prevents warrior from forming bond", () => {
            const warrior = createTestWarrior();
            const result = canFormPatronBond(warrior, testPatron.id);
            expect(result.canBond).toBe(false);
            expect(result.reason).toContain("Only wizards and elves");
        });
        it("prevents bonding to unregistered patron", () => {
            const wizard = createTestWizard();
            const result = canFormPatronBond(wizard, "nonexistent");
            expect(result.canBond).toBe(false);
            expect(result.reason).toContain("not registered");
        });
        it("prevents second patron bond", () => {
            const wizard = createTestWizard({ patron: "existing-patron" });
            const result = canFormPatronBond(wizard, testPatron.id);
            expect(result.canBond).toBe(false);
            expect(result.reason).toContain("Already bonded");
        });
    });
    describe("getCharacterPatronId", () => {
        it("returns patron for wizard", () => {
            const wizard = createTestWizard({ patron: "test-patron" });
            expect(getCharacterPatronId(wizard)).toBe("test-patron");
        });
        it("returns patron for elf", () => {
            const elf = createTestElf({ patron: "test-patron" });
            expect(getCharacterPatronId(elf)).toBe("test-patron");
        });
        it("returns undefined when no patron", () => {
            const wizard = createTestWizard();
            expect(getCharacterPatronId(wizard)).toBeUndefined();
        });
    });
    describe("hasPatronBond", () => {
        it("returns true when character has patron", () => {
            const wizard = createTestWizard({ patron: "test-patron" });
            expect(hasPatronBond(wizard)).toBe(true);
        });
        it("returns false when character has no patron", () => {
            const wizard = createTestWizard();
            expect(hasPatronBond(wizard)).toBe(false);
        });
    });
    describe("formWizardPatronBond", () => {
        it("creates wizard state with patron", () => {
            const result = formWizardPatronBond(undefined, "test-patron");
            expect(result.patron).toBe("test-patron");
            expect(result.corruption).toEqual([]);
        });
        it("preserves existing state", () => {
            const existingState = {
                corruption: ["existing corruption"],
                familiar: "cat",
                spellbook: { spells: [] },
            };
            const result = formWizardPatronBond(existingState, "test-patron");
            expect(result.patron).toBe("test-patron");
            expect(result.corruption).toEqual(["existing corruption"]);
            expect(result.familiar).toBe("cat");
        });
    });
    describe("formElfPatronBond", () => {
        it("creates elf state with patron", () => {
            const result = formElfPatronBond(undefined, "test-patron");
            expect(result.patron).toBe("test-patron");
            expect(result.corruption).toEqual([]);
        });
        it("preserves existing state", () => {
            const existingState = {
                corruption: ["elf corruption"],
                spellbook: { spells: [] },
            };
            const result = formElfPatronBond(existingState, "test-patron");
            expect(result.patron).toBe("test-patron");
            expect(result.corruption).toEqual(["elf corruption"]);
        });
    });
    describe("getAvailablePatronSpells", () => {
        it("returns patron spells for bonded wizard", () => {
            const wizard = createTestWizard({ level: 3, patron: "test-patron" });
            const spells = getAvailablePatronSpells(wizard);
            expect(spells).toContain("test-spell-1");
            expect(spells).toContain("test-spell-2");
            expect(spells).not.toContain("test-spell-3"); // level 5 required
        });
        it("returns empty array for unbonded character", () => {
            const wizard = createTestWizard();
            const spells = getAvailablePatronSpells(wizard);
            expect(spells).toHaveLength(0);
        });
    });
    describe("canLearnPatronSpell", () => {
        it("returns true for available spell", () => {
            const wizard = createTestWizard({ level: 3, patron: "test-patron" });
            expect(canLearnPatronSpell(wizard, "test-spell-1")).toBe(true);
        });
        it("returns false for spell above level", () => {
            const wizard = createTestWizard({ level: 3, patron: "test-patron" });
            expect(canLearnPatronSpell(wizard, "test-spell-3")).toBe(false);
        });
        it("returns false for unbonded character", () => {
            const wizard = createTestWizard();
            expect(canLearnPatronSpell(wizard, "test-spell-1")).toBe(false);
        });
    });
    describe("createPatronSpellEntry", () => {
        it("creates a spellbook entry for patron spell", () => {
            const entry = createPatronSpellEntry("test-spell-1");
            expect(entry.spellId).toBe("test-spell-1");
            expect(entry.lost).toBe(false);
            expect(entry.notes).toBe("Patron spell");
            expect(entry.learnedAt).toBeDefined();
        });
    });
    describe("incrementTaintCount", () => {
        it("increments taint count", () => {
            const bond = {
                patronId: "test-patron",
                bondedAt: new Date().toISOString(),
                taintCount: 2,
            };
            const result = incrementTaintCount(bond);
            expect(result.taintCount).toBe(3);
        });
    });
    describe("addTaintToNotes", () => {
        it("adds taint description to notes", () => {
            const bond = {
                patronId: "test-patron",
                bondedAt: new Date().toISOString(),
                taintCount: 0,
            };
            const result = addTaintToNotes(bond, "Eyes turn red");
            expect(result.notes).toContain("Eyes turn red");
            expect(result.taintCount).toBe(1);
        });
        it("appends to existing notes", () => {
            const bond = {
                patronId: "test-patron",
                bondedAt: new Date().toISOString(),
                taintCount: 1,
                notes: "Previous notes",
            };
            const result = addTaintToNotes(bond, "New taint");
            expect(result.notes).toContain("Previous notes");
            expect(result.notes).toContain("New taint");
        });
    });
    describe("getPatronBondBreakConsequences", () => {
        it("returns consequences info", () => {
            const consequences = getPatronBondBreakConsequences("test-patron");
            expect(consequences.potentiallyFatal).toBe(true);
            expect(consequences.description).toBeDefined();
            expect(consequences.suggestedEffects.length).toBeGreaterThan(0);
        });
    });
    describe("canBreakPatronBond", () => {
        it("returns canBreak true with warning for bonded character", () => {
            const wizard = createTestWizard({ patron: "test-patron" });
            const result = canBreakPatronBond(wizard);
            expect(result.canBreak).toBe(true);
            expect(result.warning).toBeDefined();
        });
        it("returns canBreak false for unbonded character", () => {
            const wizard = createTestWizard();
            const result = canBreakPatronBond(wizard);
            expect(result.canBreak).toBe(false);
        });
    });
});
//# sourceMappingURL=patron.test.js.map