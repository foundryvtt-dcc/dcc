/**
 * Spell Check Orchestration Tests
 */
import { describe, it, expect } from "vitest";
import { calculateSpellCheck, getCasterLevel, getCasterProfileFromCharacter, getSpellCheckAbility, getCurrentLuck, getStartingLuck, getLuckMultiplier, getDisapprovalRange, getPatronId, getSpellbookEntry, buildSpellCastInput, isSpellCheckSuccess, isSpellCheckFailure, getSpellCheckSummary, } from "./spell-check.js";
import { CASTER_PROFILES } from "../types/spells.js";
// =============================================================================
// Test Fixtures
// =============================================================================
const testSpell = {
    id: "magic-missile",
    name: "Magic Missile",
    level: 1,
    casterTypes: ["wizard", "elf"],
    description: "Fires magical missiles at targets",
};
const clericSpell = {
    id: "bless",
    name: "Bless",
    level: 1,
    casterTypes: ["cleric"],
    description: "Invokes divine blessing",
};
const wizardSpellbook = {
    spells: [
        { spellId: "magic-missile", lost: false },
        { spellId: "sleep", lost: true }, // Lost for testing
    ],
};
const clericSpellbook = {
    spells: [{ spellId: "bless", lost: false }],
};
function createTestWizard() {
    return {
        identity: {
            id: "test-wizard",
            name: "Merlin",
            occupation: "Apprentice",
            alignment: "n",
            birthAugur: {
                id: "lucky-sign",
                name: "Lucky Sign",
                effect: "Spell checks",
                modifies: "spell-check",
                multiplier: 1,
            },
            startingLuck: 12,
            languages: ["Common"],
        },
        classInfo: {
            classId: "wizard",
            level: 3,
            title: "Magician",
        },
        state: {
            hp: { current: 10, max: 10, temp: 0 },
            abilities: {
                str: { current: 10, max: 10 },
                agl: { current: 12, max: 12 },
                sta: { current: 11, max: 11 },
                per: { current: 10, max: 10 },
                int: { current: 16, max: 16 }, // +2 modifier
                lck: { current: 12, max: 12 },
            },
            xp: { current: 50, nextLevel: 100 },
            saves: { reflex: 1, fortitude: 1, will: 2 },
            combat: {
                attackBonus: 1,
                actionDice: ["d20"],
                critDie: "d6",
                critTable: "I",
                threatRange: 20,
                ac: 10,
                speed: 30,
                initiative: 1,
            },
            currency: { pp: 0, ep: 0, gp: 10, sp: 5, cp: 20 },
            inventory: { items: [] },
            conditions: [],
            classState: {
                wizard: {
                    corruption: [],
                    patron: "The King of Elfland",
                    spellbook: wizardSpellbook,
                },
            },
        },
    };
}
function createTestCleric() {
    return {
        identity: {
            id: "test-cleric",
            name: "Brother Marcus",
            occupation: "Acolyte",
            alignment: "l",
            birthAugur: {
                id: "holy-touched",
                name: "Holy Touched",
                effect: "Turn unholy",
                modifies: "turn-unholy",
                multiplier: 1,
            },
            startingLuck: 10,
            languages: ["Common"],
        },
        classInfo: {
            classId: "cleric",
            level: 2,
            title: "Priest",
        },
        state: {
            hp: { current: 12, max: 12, temp: 0 },
            abilities: {
                str: { current: 12, max: 12 },
                agl: { current: 10, max: 10 },
                sta: { current: 14, max: 14 },
                per: { current: 15, max: 15 }, // +1 modifier
                int: { current: 10, max: 10 },
                lck: { current: 10, max: 10 },
            },
            xp: { current: 25, nextLevel: 50 },
            saves: { reflex: 0, fortitude: 2, will: 2 },
            combat: {
                attackBonus: 1,
                actionDice: ["d20"],
                critDie: "d8",
                critTable: "III",
                threatRange: 20,
                ac: 14,
                speed: 30,
                initiative: 0,
            },
            currency: { pp: 0, ep: 0, gp: 5, sp: 10, cp: 30 },
            inventory: { items: [] },
            conditions: [],
            classState: {
                cleric: {
                    disapprovalRange: 2,
                    deity: "Justicia",
                    spellbook: clericSpellbook,
                },
            },
        },
    };
}
function createTestFighter() {
    return {
        identity: {
            id: "test-fighter",
            name: "Conan",
            occupation: "Mercenary",
            alignment: "n",
            birthAugur: {
                id: "warrior-born",
                name: "Warrior Born",
                effect: "Melee attacks",
                modifies: "melee-attack",
                multiplier: 1,
            },
            startingLuck: 11,
            languages: ["Common"],
        },
        classInfo: {
            classId: "warrior",
            level: 3,
            title: "Warrior",
        },
        state: {
            hp: { current: 20, max: 20, temp: 0 },
            abilities: {
                str: { current: 16, max: 16 },
                agl: { current: 14, max: 14 },
                sta: { current: 15, max: 15 },
                per: { current: 10, max: 10 },
                int: { current: 10, max: 10 },
                lck: { current: 11, max: 11 },
            },
            xp: { current: 50, nextLevel: 100 },
            saves: { reflex: 1, fortitude: 2, will: 1 },
            combat: {
                attackBonus: 3,
                actionDice: ["d20"],
                critDie: "d12",
                critTable: "III",
                threatRange: 19,
                ac: 16,
                speed: 30,
                initiative: 2,
            },
            currency: { pp: 0, ep: 0, gp: 20, sp: 15, cp: 10 },
            inventory: { items: [] },
            conditions: [],
            classState: {
                warrior: {
                    deedDie: "d4",
                },
            },
        },
    };
}
// Simple mock tables for testing
const mockSpellResultTable = {
    id: "magic-missile-results",
    name: "Magic Missile Results",
    type: "tiered",
    entries: [
        { min: 1, max: 11, tier: "lost", text: "Lost. Failure." },
        { min: 12, max: 13, tier: "failure", text: "Failure." },
        { min: 14, max: 17, tier: "success-minor", text: "1 missile, 1d4 damage." },
        { min: 18, max: 21, tier: "success", text: "1 missile, 1d6 damage." },
        { min: 22, max: 25, tier: "success-major", text: "2 missiles, 1d6 each." },
        { min: 26, max: 999, tier: "success-critical", text: "3 missiles, 1d8 each." },
    ],
};
const mockFumbleTable = {
    id: "spell-fumble",
    name: "Spell Fumble",
    type: "simple",
    entries: [
        { min: 1, max: 2, text: "Spell fizzles harmlessly." },
        { min: 3, max: 4, text: "Spell misfires!", effect: { type: "misfire" } },
        { min: 5, max: 6, text: "Corruption!", effect: { type: "corruption", data: { corruption: true } } },
    ],
};
const mockDisapprovalTable = {
    id: "disapproval",
    name: "Disapproval",
    type: "simple",
    entries: [
        { min: 1, max: 4, text: "Minor penance required." },
        { min: 5, max: 8, text: "Moderate penance required." },
        { min: 9, max: 12, text: "Major penance required." },
    ],
};
// =============================================================================
// Character State Extraction Tests
// =============================================================================
describe("Character State Extraction", () => {
    describe("getCasterLevel", () => {
        it("returns level for classed character", () => {
            const wizard = createTestWizard();
            expect(getCasterLevel(wizard)).toBe(3);
        });
        it("returns 0 for character without class", () => {
            const wizard = createTestWizard();
            wizard.classInfo = undefined;
            expect(getCasterLevel(wizard)).toBe(0);
        });
    });
    describe("getCasterProfileFromCharacter", () => {
        it("returns wizard profile for wizard", () => {
            const wizard = createTestWizard();
            const profile = getCasterProfileFromCharacter(wizard);
            expect(profile).toBeDefined();
            expect(profile?.type).toBe("wizard");
            expect(profile?.spellCheckAbility).toBe("int");
            expect(profile?.usesCorruption).toBe(true);
            expect(profile?.usesDisapproval).toBe(false);
        });
        it("returns cleric profile for cleric", () => {
            const cleric = createTestCleric();
            const profile = getCasterProfileFromCharacter(cleric);
            expect(profile).toBeDefined();
            expect(profile?.type).toBe("cleric");
            expect(profile?.spellCheckAbility).toBe("per");
            expect(profile?.usesCorruption).toBe(false);
            expect(profile?.usesDisapproval).toBe(true);
        });
        it("returns undefined for non-caster", () => {
            const fighter = createTestFighter();
            const profile = getCasterProfileFromCharacter(fighter);
            expect(profile).toBeUndefined();
        });
    });
    describe("getSpellCheckAbility", () => {
        it("returns INT for wizard", () => {
            const wizard = createTestWizard();
            const profile = CASTER_PROFILES.wizard;
            const { score, modifier } = getSpellCheckAbility(wizard, profile);
            expect(score).toBe(16);
            expect(modifier).toBe(2); // 16 = +2
        });
        it("returns PER for cleric", () => {
            const cleric = createTestCleric();
            const profile = CASTER_PROFILES.cleric;
            const { score, modifier } = getSpellCheckAbility(cleric, profile);
            expect(score).toBe(15);
            expect(modifier).toBe(1); // 15 = +1
        });
    });
    describe("getCurrentLuck", () => {
        it("returns current luck value", () => {
            const wizard = createTestWizard();
            expect(getCurrentLuck(wizard)).toBe(12);
        });
    });
    describe("getStartingLuck", () => {
        it("returns starting luck from identity", () => {
            const wizard = createTestWizard();
            expect(getStartingLuck(wizard)).toBe(12);
        });
    });
    describe("getLuckMultiplier", () => {
        it("returns luck multiplier from birth augur", () => {
            const wizard = createTestWizard();
            expect(getLuckMultiplier(wizard)).toBe(1);
        });
    });
    describe("getDisapprovalRange", () => {
        it("returns disapproval range for cleric", () => {
            const cleric = createTestCleric();
            expect(getDisapprovalRange(cleric)).toBe(2);
        });
        it("returns 1 for non-cleric", () => {
            const wizard = createTestWizard();
            expect(getDisapprovalRange(wizard)).toBe(1);
        });
    });
    describe("getPatronId", () => {
        it("returns patron for wizard", () => {
            const wizard = createTestWizard();
            expect(getPatronId(wizard)).toBe("The King of Elfland");
        });
        it("returns undefined for cleric", () => {
            const cleric = createTestCleric();
            expect(getPatronId(cleric)).toBeUndefined();
        });
    });
    describe("getSpellbookEntry", () => {
        it("finds spell in wizard spellbook", () => {
            const wizard = createTestWizard();
            const entry = getSpellbookEntry(wizard, "magic-missile");
            expect(entry).toBeDefined();
            expect(entry?.spellId).toBe("magic-missile");
            expect(entry?.lost).toBe(false);
        });
        it("finds spell in cleric spellbook", () => {
            const cleric = createTestCleric();
            const entry = getSpellbookEntry(cleric, "bless");
            expect(entry).toBeDefined();
            expect(entry?.spellId).toBe("bless");
        });
        it("returns undefined for unknown spell", () => {
            const wizard = createTestWizard();
            const entry = getSpellbookEntry(wizard, "unknown-spell");
            expect(entry).toBeUndefined();
        });
    });
});
// =============================================================================
// Build Spell Cast Input Tests
// =============================================================================
describe("buildSpellCastInput", () => {
    it("builds valid input for wizard spell", () => {
        const wizard = createTestWizard();
        const profile = CASTER_PROFILES.wizard;
        const result = buildSpellCastInput(wizard, { spell: testSpell }, profile);
        expect("error" in result).toBe(false);
        if (!("error" in result)) {
            expect(result.spell.id).toBe("magic-missile");
            expect(result.casterLevel).toBe(3);
            expect(result.abilityModifier).toBe(2);
            expect(result.patron).toBe("The King of Elfland");
        }
    });
    it("builds valid input for cleric spell", () => {
        const cleric = createTestCleric();
        const profile = CASTER_PROFILES.cleric;
        const result = buildSpellCastInput(cleric, { spell: clericSpell }, profile);
        expect("error" in result).toBe(false);
        if (!("error" in result)) {
            expect(result.spell.id).toBe("bless");
            expect(result.casterLevel).toBe(2);
            expect(result.abilityModifier).toBe(1);
            expect(result.disapprovalRange).toBe(2);
        }
    });
    it("returns error for spell not in spellbook", () => {
        const wizard = createTestWizard();
        const profile = CASTER_PROFILES.wizard;
        const unknownSpell = {
            id: "unknown",
            name: "Unknown",
            level: 1,
            casterTypes: ["wizard"],
        };
        const result = buildSpellCastInput(wizard, { spell: unknownSpell }, profile);
        expect("error" in result).toBe(true);
        if ("error" in result) {
            expect(result.error).toContain("not found in spellbook");
        }
    });
    it("returns error for lost spell", () => {
        const wizard = createTestWizard();
        const profile = CASTER_PROFILES.wizard;
        const sleepSpell = {
            id: "sleep",
            name: "Sleep",
            level: 1,
            casterTypes: ["wizard"],
        };
        const result = buildSpellCastInput(wizard, { spell: sleepSpell }, profile);
        expect("error" in result).toBe(true);
        if ("error" in result) {
            expect(result.error).toContain("lost for the day");
        }
    });
    it("includes spellburn when provided", () => {
        const wizard = createTestWizard();
        const profile = CASTER_PROFILES.wizard;
        const result = buildSpellCastInput(wizard, {
            spell: testSpell,
            spellburn: { str: 2, agl: 0, sta: 1 },
        }, profile);
        expect("error" in result).toBe(false);
        if (!("error" in result)) {
            expect(result.spellburn).toEqual({ str: 2, agl: 0, sta: 1 });
        }
    });
    it("includes luck burn when provided", () => {
        const wizard = createTestWizard();
        const profile = CASTER_PROFILES.wizard;
        const result = buildSpellCastInput(wizard, {
            spell: testSpell,
            luckBurn: 3,
        }, profile);
        expect("error" in result).toBe(false);
        if (!("error" in result)) {
            expect(result.luckBurn).toBe(3);
        }
    });
});
// =============================================================================
// Calculate Spell Check Tests
// =============================================================================
describe("calculateSpellCheck", () => {
    it("returns error for non-caster", () => {
        const fighter = createTestFighter();
        const result = calculateSpellCheck(fighter, { spell: testSpell });
        expect(result.error).toBeDefined();
        expect(result.error).toContain("not a spellcaster");
    });
    it("returns error for wrong caster type", () => {
        const cleric = createTestCleric();
        const result = calculateSpellCheck(cleric, { spell: testSpell }); // wizard spell
        expect(result.error).toBeDefined();
        expect(result.error).toContain("cleric cannot cast");
    });
    it("performs wizard spell check with seeded roller", () => {
        const wizard = createTestWizard();
        const result = calculateSpellCheck(wizard, {
            spell: testSpell,
            resultTable: mockSpellResultTable,
        }, {
            roller: () => 15, // Force roll of 15
        });
        expect(result.error).toBeUndefined();
        expect(result.natural).toBe(15);
        // Total = 15 (roll) + 2 (INT) + 3 (level) = 20
        expect(result.total).toBe(20);
        expect(result.tier).toBe("success");
        expect(result.spellLost).toBe(false);
        expect(result.fumble).toBe(false);
        expect(result.critical).toBe(false);
    });
    it("performs cleric spell check with seeded roller", () => {
        const cleric = createTestCleric();
        const result = calculateSpellCheck(cleric, {
            spell: clericSpell,
            resultTable: mockSpellResultTable,
        }, {
            roller: () => 12,
        });
        expect(result.error).toBeUndefined();
        expect(result.natural).toBe(12);
        // Total = 12 (roll) + 1 (PER) + 2 (level) = 15
        expect(result.total).toBe(15);
    });
    it("detects critical on natural 20", () => {
        const wizard = createTestWizard();
        const result = calculateSpellCheck(wizard, {
            spell: testSpell,
            resultTable: mockSpellResultTable,
        }, {
            roller: () => 20,
        });
        expect(result.critical).toBe(true);
        expect(result.fumble).toBe(false);
    });
    it("detects fumble on natural 1", () => {
        const wizard = createTestWizard();
        const result = calculateSpellCheck(wizard, {
            spell: testSpell,
            resultTable: mockSpellResultTable,
            fumbleTable: mockFumbleTable,
        }, {
            roller: () => 1,
        });
        expect(result.fumble).toBe(true);
        expect(result.critical).toBe(false);
        expect(result.spellLost).toBe(true);
    });
    it("handles cleric disapproval on low roll", () => {
        const cleric = createTestCleric();
        // Set disapproval range to 2
        if (cleric.state.classState?.cleric) {
            cleric.state.classState.cleric.disapprovalRange = 2;
        }
        const result = calculateSpellCheck(cleric, {
            spell: clericSpell,
            resultTable: mockSpellResultTable,
            disapprovalTable: mockDisapprovalTable,
        }, {
            roller: () => 2, // Within disapproval range of 2
        });
        expect(result.disapprovalResult).toBeDefined();
        expect(result.newDisapprovalRange).toBe(3); // Increased from 2
    });
    it("includes spellburn in modifiers", () => {
        const wizard = createTestWizard();
        const result = calculateSpellCheck(wizard, {
            spell: testSpell,
            spellburn: { str: 3, agl: 0, sta: 2 }, // +5 total
        }, {
            roller: () => 10,
        });
        // Total = 10 (roll) + 2 (INT) + 3 (level) + 5 (spellburn) = 20
        expect(result.total).toBe(20);
        expect(result.spellburnApplied).toEqual({ str: 3, agl: 0, sta: 2 });
    });
    it("includes luck burn in modifiers", () => {
        const wizard = createTestWizard();
        const result = calculateSpellCheck(wizard, {
            spell: testSpell,
            luckBurn: 2,
        }, {
            roller: () => 10,
        });
        // Total = 10 (roll) + 2 (INT) + 3 (level) + 2 (luck) = 17
        expect(result.total).toBe(17);
        expect(result.luckBurned).toBe(2);
    });
});
// =============================================================================
// Result Utility Tests
// =============================================================================
describe("isSpellCheckSuccess", () => {
    it("returns true for success tiers", () => {
        expect(isSpellCheckSuccess({ tier: "success", spellId: "test", die: "d20", formula: "", modifiers: [], critical: false, fumble: false, spellLost: false, corruptionTriggered: false, disapprovalIncrease: 0, luckBurned: 0 })).toBe(true);
        expect(isSpellCheckSuccess({ tier: "success-minor", spellId: "test", die: "d20", formula: "", modifiers: [], critical: false, fumble: false, spellLost: false, corruptionTriggered: false, disapprovalIncrease: 0, luckBurned: 0 })).toBe(true);
        expect(isSpellCheckSuccess({ tier: "success-major", spellId: "test", die: "d20", formula: "", modifiers: [], critical: false, fumble: false, spellLost: false, corruptionTriggered: false, disapprovalIncrease: 0, luckBurned: 0 })).toBe(true);
        expect(isSpellCheckSuccess({ tier: "success-critical", spellId: "test", die: "d20", formula: "", modifiers: [], critical: false, fumble: false, spellLost: false, corruptionTriggered: false, disapprovalIncrease: 0, luckBurned: 0 })).toBe(true);
    });
    it("returns false for failure tiers", () => {
        expect(isSpellCheckSuccess({ tier: "failure", spellId: "test", die: "d20", formula: "", modifiers: [], critical: false, fumble: false, spellLost: false, corruptionTriggered: false, disapprovalIncrease: 0, luckBurned: 0 })).toBe(false);
        expect(isSpellCheckSuccess({ tier: "lost", spellId: "test", die: "d20", formula: "", modifiers: [], critical: false, fumble: false, spellLost: false, corruptionTriggered: false, disapprovalIncrease: 0, luckBurned: 0 })).toBe(false);
    });
    it("returns false for error results", () => {
        expect(isSpellCheckSuccess({ error: "test error", spellId: "test", die: "d20", formula: "", modifiers: [], critical: false, fumble: false, spellLost: false, corruptionTriggered: false, disapprovalIncrease: 0, luckBurned: 0 })).toBe(false);
    });
});
describe("isSpellCheckFailure", () => {
    it("returns true for failure tiers", () => {
        expect(isSpellCheckFailure({ tier: "failure", spellId: "test", die: "d20", formula: "", modifiers: [], critical: false, fumble: false, spellLost: false, corruptionTriggered: false, disapprovalIncrease: 0, luckBurned: 0 })).toBe(true);
        expect(isSpellCheckFailure({ tier: "lost", spellId: "test", die: "d20", formula: "", modifiers: [], critical: false, fumble: false, spellLost: false, corruptionTriggered: false, disapprovalIncrease: 0, luckBurned: 0 })).toBe(true);
    });
    it("returns false for success tiers", () => {
        expect(isSpellCheckFailure({ tier: "success", spellId: "test", die: "d20", formula: "", modifiers: [], critical: false, fumble: false, spellLost: false, corruptionTriggered: false, disapprovalIncrease: 0, luckBurned: 0 })).toBe(false);
    });
    it("returns true for error results", () => {
        expect(isSpellCheckFailure({ error: "test error", spellId: "test", die: "d20", formula: "", modifiers: [], critical: false, fumble: false, spellLost: false, corruptionTriggered: false, disapprovalIncrease: 0, luckBurned: 0 })).toBe(true);
    });
});
describe("getSpellCheckSummary", () => {
    it("shows error message for errors", () => {
        const result = { error: "Something went wrong", spellId: "test", die: "d20", formula: "", modifiers: [], critical: false, fumble: false, spellLost: false, corruptionTriggered: false, disapprovalIncrease: 0, luckBurned: 0 };
        expect(getSpellCheckSummary(result)).toContain("Error: Something went wrong");
    });
    it("shows roll info", () => {
        const result = {
            spellId: "test",
            die: "d20",
            formula: "1d20+5",
            modifiers: [],
            natural: 15,
            total: 20,
            tier: "success",
            critical: false,
            fumble: false,
            spellLost: false,
            corruptionTriggered: false,
            disapprovalIncrease: 0,
            luckBurned: 0,
        };
        const summary = getSpellCheckSummary(result);
        expect(summary).toContain("Roll: 15 → 20");
        expect(summary).toContain("Success");
    });
    it("shows critical", () => {
        const result = {
            spellId: "test",
            die: "d20",
            formula: "1d20+5",
            modifiers: [],
            natural: 20,
            total: 25,
            tier: "success-critical",
            critical: true,
            fumble: false,
            spellLost: false,
            corruptionTriggered: false,
            disapprovalIncrease: 0,
            luckBurned: 0,
        };
        expect(getSpellCheckSummary(result)).toContain("CRITICAL!");
    });
    it("shows fumble", () => {
        const result = {
            spellId: "test",
            die: "d20",
            formula: "1d20+5",
            modifiers: [],
            natural: 1,
            total: 6,
            tier: "lost",
            critical: false,
            fumble: true,
            spellLost: true,
            corruptionTriggered: false,
            disapprovalIncrease: 0,
            luckBurned: 0,
        };
        const summary = getSpellCheckSummary(result);
        expect(summary).toContain("FUMBLE!");
        expect(summary).toContain("Spell Lost");
    });
});
//# sourceMappingURL=spell-check.test.js.map