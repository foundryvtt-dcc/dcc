/**
 * Spell Duel System Tests
 */
import { describe, it, expect } from "vitest";
import { 
// Constants
STARTING_MOMENTUM, SPELL_CHECK_THRESHOLDS, 
// Table 4-5
getComparisonDie, compareSpellChecks, 
// Table 4-6
rollCounterspellPower, 
// Table 4-7
rollPhlogistonDisturbance, 
// State management
createSpellDuelState, createSpellDuelParticipant, getSpellCheckThreshold, didSpellCheckSucceed, checkSpellLostInDuel, 
// Counterspell validation
canCounter, isSamePatronInvocation, 
// Resolution
makeSpellDuelCheck, resolveCounterspellExchange, applyExchangeResult, getInitiativeOrder, canCounterspellByInitiative, 
// Formatting
formatSpellDuelCheck, formatExchangeResult, formatSpellDuelState, } from "./spell-duel.js";
// =============================================================================
// Test Helpers
// =============================================================================
/**
 * Create a mock roller that always returns the same value
 */
function createMockRoller(value) {
    return () => value;
}
function createTestSpell(name, level, category = "same-spell", patron) {
    return {
        name,
        level,
        category,
        patron,
    };
}
function createMagicMissile() {
    return createTestSpell("magic-missile", 1, "same-spell");
}
function createMagicShield() {
    return {
        name: "magic-shield",
        level: 1,
        category: "magic-shield",
        counters: ["magic-missile", "fireball", "scorching-ray", "lightning-bolt"],
    };
}
function createFireball() {
    return createTestSpell("fireball", 3, "same-spell");
}
function createFireResistance() {
    return {
        name: "fire-resistance",
        level: 1,
        category: "fire-resistance",
        counters: ["fireball", "scorching-ray"],
    };
}
function createDispelMagic() {
    return createTestSpell("dispel-magic", 2, "dispel-magic");
}
function createInvokePatron(patron) {
    return {
        name: "invoke-patron",
        level: 1,
        category: "invoke-patron",
        patron,
    };
}
// =============================================================================
// Constants Tests
// =============================================================================
describe("Spell Duel Constants", () => {
    it("starting momentum is 10", () => {
        expect(STARTING_MOMENTUM).toBe(10);
    });
    it("spell check thresholds follow DCC pattern", () => {
        expect(SPELL_CHECK_THRESHOLDS[1]).toBe(12);
        expect(SPELL_CHECK_THRESHOLDS[2]).toBe(14);
        expect(SPELL_CHECK_THRESHOLDS[3]).toBe(16);
        expect(SPELL_CHECK_THRESHOLDS[4]).toBe(18);
        expect(SPELL_CHECK_THRESHOLDS[5]).toBe(20);
    });
});
// =============================================================================
// Spell Check Threshold Tests
// =============================================================================
describe("getSpellCheckThreshold", () => {
    it("returns correct threshold for level 1 spells", () => {
        expect(getSpellCheckThreshold(1)).toBe(12);
    });
    it("returns correct threshold for level 2 spells", () => {
        expect(getSpellCheckThreshold(2)).toBe(14);
    });
    it("returns correct threshold for level 3 spells", () => {
        expect(getSpellCheckThreshold(3)).toBe(16);
    });
    it("extrapolates for higher level spells", () => {
        expect(getSpellCheckThreshold(6)).toBe(22);
    });
});
describe("didSpellCheckSucceed", () => {
    it("succeeds when meeting threshold", () => {
        expect(didSpellCheckSucceed(12, 1)).toBe(true);
        expect(didSpellCheckSucceed(14, 2)).toBe(true);
        expect(didSpellCheckSucceed(16, 3)).toBe(true);
    });
    it("fails when below threshold", () => {
        expect(didSpellCheckSucceed(11, 1)).toBe(false);
        expect(didSpellCheckSucceed(13, 2)).toBe(false);
        expect(didSpellCheckSucceed(15, 3)).toBe(false);
    });
    it("succeeds when exceeding threshold", () => {
        expect(didSpellCheckSucceed(20, 1)).toBe(true);
        expect(didSpellCheckSucceed(25, 2)).toBe(true);
    });
});
describe("checkSpellLostInDuel", () => {
    it("spell is lost when total is below threshold", () => {
        expect(checkSpellLostInDuel(5, 11, 1)).toBe(true);
        expect(checkSpellLostInDuel(10, 13, 2)).toBe(true);
    });
    it("spell is not lost when total meets threshold", () => {
        expect(checkSpellLostInDuel(10, 12, 1)).toBe(false);
        expect(checkSpellLostInDuel(8, 14, 2)).toBe(false);
    });
});
// =============================================================================
// Table 4-5: Spell Duel Check Comparison Tests
// =============================================================================
describe("getComparisonDie (Table 4-5)", () => {
    it("returns PD when checks are equal", () => {
        expect(getComparisonDie(12, 12)).toBe("PD");
        expect(getComparisonDie(15, 15)).toBe("PD");
        expect(getComparisonDie(20, 20)).toBe("PD");
        expect(getComparisonDie(28, 28)).toBe("PD");
    });
    it("returns d3 for difference of 1", () => {
        expect(getComparisonDie(13, 12)).toBe("d3");
        expect(getComparisonDie(12, 13)).toBe("d3");
        expect(getComparisonDie(20, 19)).toBe("d3");
    });
    it("returns d4 for difference of 2", () => {
        expect(getComparisonDie(14, 12)).toBe("d4");
        expect(getComparisonDie(12, 14)).toBe("d4");
    });
    it("returns d5 for difference of 3-4", () => {
        expect(getComparisonDie(15, 12)).toBe("d5");
        expect(getComparisonDie(16, 12)).toBe("d5");
    });
    it("returns d6 for difference of 5-6", () => {
        expect(getComparisonDie(17, 12)).toBe("d6");
        expect(getComparisonDie(18, 12)).toBe("d6");
    });
    it("returns larger dice for larger differences", () => {
        expect(getComparisonDie(20, 12)).toBe("d7"); // diff 8 = d7
        expect(getComparisonDie(22, 12)).toBe("d8"); // diff 10 = d8
        expect(getComparisonDie(24, 12)).toBe("d10"); // diff 12 = d10
        expect(getComparisonDie(28, 12)).toBe("d14"); // diff 16 = d14
    });
    it("clamps values to table range (12-28)", () => {
        expect(getComparisonDie(10, 10)).toBe("PD"); // clamped to 12, 12
        expect(getComparisonDie(30, 30)).toBe("PD"); // clamped to 28, 28
    });
});
describe("compareSpellChecks", () => {
    it("identifies attacker high correctly", () => {
        const result = compareSpellChecks(18, 14);
        expect(result.attackerHigh).toBe(true);
        expect(result.attackerCheck).toBe(18);
        expect(result.defenderCheck).toBe(14);
    });
    it("identifies defender high correctly", () => {
        const result = compareSpellChecks(14, 18);
        expect(result.attackerHigh).toBe(false);
    });
    it("identifies phlogiston disturbance on equal checks", () => {
        const result = compareSpellChecks(15, 15);
        expect(result.isPhlogistonDisturbance).toBe(true);
        expect(result.comparisonDie).toBe("PD");
    });
    it("returns correct comparison die", () => {
        const result = compareSpellChecks(18, 14);
        expect(result.comparisonDie).toBe("d5"); // diff of 4
    });
});
// =============================================================================
// Table 4-6: Counterspell Power Tests
// =============================================================================
describe("rollCounterspellPower (Table 4-6)", () => {
    it("throws error on phlogiston disturbance die", () => {
        expect(() => rollCounterspellPower("PD", true, 0)).toThrow("Cannot roll counterspell power on Phlogiston Disturbance");
    });
    it("rolls the specified die", () => {
        const roller = createMockRoller(4);
        const result = rollCounterspellPower("d6", true, 0, roller);
        expect(result.roll).toBe(4);
    });
    it("applies momentum modifier when attacker high", () => {
        const roller = createMockRoller(3);
        const result = rollCounterspellPower("d6", true, 3, roller);
        expect(result.momentumModifier).toBe(3);
        expect(result.modifiedResult).toBe(6); // 3 + 3
    });
    it("applies negative momentum modifier when defender high", () => {
        const roller = createMockRoller(5);
        const result = rollCounterspellPower("d6", false, 3, roller);
        expect(result.momentumModifier).toBe(-3);
        expect(result.modifiedResult).toBe(2); // 5 - 3
    });
    it("clamps modified result to minimum 1", () => {
        const roller = createMockRoller(1);
        const result = rollCounterspellPower("d6", false, 10, roller);
        expect(result.modifiedResult).toBe(1); // 1 - 10 = -9, clamped to 1
    });
    it("returns appropriate effect structure", () => {
        const roller = createMockRoller(4);
        const result = rollCounterspellPower("d8", true, 0, roller);
        expect(result.effect).toBeDefined();
        expect(typeof result.attackerSpellEffective).toBe("boolean");
        expect(typeof result.defenderSpellEffective).toBe("boolean");
        expect(typeof result.attackerCheckModifier).toBe("number");
        expect(typeof result.defenderCheckModifier).toBe("number");
        expect(typeof result.simultaneousEffect).toBe("boolean");
    });
    it("high rolls favor the attacker when attacker high", () => {
        const roller = createMockRoller(3);
        // With +10 momentum, roll of 3 = 13
        const result = rollCounterspellPower("d3", true, 10, roller);
        expect(result.modifiedResult).toBe(13);
        expect(result.attackerSpellEffective).toBe(true);
    });
    it("low rolls favor the defender when defender high", () => {
        const roller = createMockRoller(1);
        // With -3 momentum, roll of 1 = 1 (clamped)
        const result = rollCounterspellPower("d6", false, 3, roller);
        expect(result.modifiedResult).toBe(1);
    });
});
// =============================================================================
// Table 4-7: Phlogiston Disturbance Tests
// =============================================================================
describe("rollPhlogistonDisturbance (Table 4-7)", () => {
    it("rolls a d20 and returns an effect", () => {
        const roller = createMockRoller(10);
        const result = rollPhlogistonDisturbance(roller);
        expect(result.roll).toBe(10);
        expect(result.effect).toBeDefined();
    });
    it("always affects both attacker and defender", () => {
        const roller = createMockRoller(5);
        const result = rollPhlogistonDisturbance(roller);
        expect(result.affectsAttacker).toBe(true);
        expect(result.affectsDefender).toBe(true);
    });
    it("low rolls result in spell cancellation", () => {
        const roller = createMockRoller(1);
        const result = rollPhlogistonDisturbance(roller);
        expect(result.effect).toContain("cancel");
    });
    it("includes damage for explosive results (roll 11-12)", () => {
        const roller = createMockRoller(11);
        const result = rollPhlogistonDisturbance(roller);
        expect(result.damage).toBe("2d6");
        expect(result.areaOfEffect).toBe(20);
    });
    it("includes special effects for corruption results (roll 8)", () => {
        const roller = createMockRoller(8);
        const result = rollPhlogistonDisturbance(roller);
        expect(result.specialEffect).toBe("corruption");
    });
    it("includes dimensional rift for roll 19", () => {
        const roller = createMockRoller(19);
        const result = rollPhlogistonDisturbance(roller);
        expect(result.specialEffect).toBe("dimensional-rift");
    });
    it("includes magical chaos for roll 20", () => {
        const roller = createMockRoller(20);
        const result = rollPhlogistonDisturbance(roller);
        expect(result.specialEffect).toBe("magical-chaos");
    });
});
// =============================================================================
// State Management Tests
// =============================================================================
describe("createSpellDuelState", () => {
    it("creates state with participants at starting momentum", () => {
        const state = createSpellDuelState([
            { id: "wiz1", name: "Emerald Sorcerer", casterType: "wizard", initiative: 17 },
            { id: "wiz2", name: "Magnus", casterType: "wizard", initiative: 12 },
        ]);
        expect(state.participants).toHaveLength(2);
        expect(state.participants[0]?.momentum).toBe(STARTING_MOMENTUM);
        expect(state.participants[1]?.momentum).toBe(STARTING_MOMENTUM);
        expect(state.active).toBe(true);
        expect(state.exchanges).toHaveLength(0);
    });
    it("preserves patron information", () => {
        const state = createSpellDuelState([
            { id: "wiz1", name: "Patron Wizard", casterType: "wizard", initiative: 15, patron: "Azi Dahaka" },
        ]);
        expect(state.participants[0]?.patron).toBe("Azi Dahaka");
    });
});
describe("createSpellDuelParticipant", () => {
    it("creates a participant with correct properties", () => {
        const p = createSpellDuelParticipant("test", "Test Wizard", "wizard", 15, "Bobugbubilz");
        expect(p.id).toBe("test");
        expect(p.name).toBe("Test Wizard");
        expect(p.casterType).toBe("wizard");
        expect(p.initiative).toBe(15);
        expect(p.patron).toBe("Bobugbubilz");
        expect(p.momentum).toBe(STARTING_MOMENTUM);
    });
});
describe("getInitiativeOrder", () => {
    it("sorts participants by initiative (highest first)", () => {
        const state = createSpellDuelState([
            { id: "low", name: "Low", casterType: "wizard", initiative: 5 },
            { id: "high", name: "High", casterType: "wizard", initiative: 20 },
            { id: "mid", name: "Mid", casterType: "wizard", initiative: 12 },
        ]);
        const ordered = getInitiativeOrder(state);
        expect(ordered[0]?.id).toBe("high");
        expect(ordered[1]?.id).toBe("mid");
        expect(ordered[2]?.id).toBe("low");
    });
});
describe("canCounterspellByInitiative", () => {
    it("allows lower initiative to counterspell higher", () => {
        const state = createSpellDuelState([
            { id: "high", name: "High", casterType: "wizard", initiative: 20 },
            { id: "low", name: "Low", casterType: "wizard", initiative: 5 },
        ]);
        expect(canCounterspellByInitiative(state, "high", "low")).toBe(true);
    });
    it("prevents higher initiative from counterspelling lower", () => {
        const state = createSpellDuelState([
            { id: "high", name: "High", casterType: "wizard", initiative: 20 },
            { id: "low", name: "Low", casterType: "wizard", initiative: 5 },
        ]);
        expect(canCounterspellByInitiative(state, "low", "high")).toBe(false);
    });
    it("prevents same initiative from counterspelling", () => {
        const state = createSpellDuelState([
            { id: "a", name: "A", casterType: "wizard", initiative: 15 },
            { id: "b", name: "B", casterType: "wizard", initiative: 15 },
        ]);
        expect(canCounterspellByInitiative(state, "a", "b")).toBe(false);
    });
});
// =============================================================================
// Counterspell Validation Tests
// =============================================================================
describe("canCounter", () => {
    it("same spell can counter itself", () => {
        const fireball = createFireball();
        expect(canCounter(fireball, fireball)).toBe(true);
    });
    it("magic shield can counter magic missile", () => {
        const magicMissile = createMagicMissile();
        const magicShield = createMagicShield();
        expect(canCounter(magicMissile, magicShield)).toBe(true);
    });
    it("magic shield can counter fireball", () => {
        const fireball = createFireball();
        const magicShield = createMagicShield();
        expect(canCounter(fireball, magicShield)).toBe(true);
    });
    it("fire resistance can counter fireball", () => {
        const fireball = createFireball();
        const fireResist = createFireResistance();
        expect(canCounter(fireball, fireResist)).toBe(true);
    });
    it("fire resistance cannot counter magic missile", () => {
        const magicMissile = createMagicMissile();
        const fireResist = createFireResistance();
        expect(canCounter(magicMissile, fireResist)).toBe(false);
    });
    it("dispel magic can counter any spell", () => {
        const dispel = createDispelMagic();
        expect(canCounter(createMagicMissile(), dispel)).toBe(true);
        expect(canCounter(createFireball(), dispel)).toBe(true);
        expect(canCounter(createInvokePatron("Azi Dahaka"), dispel)).toBe(true);
    });
    it("invoke patron can counter invoke patron", () => {
        const invoke1 = createInvokePatron("Azi Dahaka");
        const invoke2 = createInvokePatron("Bobugbubilz");
        expect(canCounter(invoke1, invoke2)).toBe(true);
    });
    it("random attack spell cannot counter different spell", () => {
        const fireball = createFireball();
        const magicMissile = createMagicMissile();
        expect(canCounter(fireball, magicMissile)).toBe(false);
    });
});
describe("isSamePatronInvocation", () => {
    it("returns true for same patron", () => {
        const invoke1 = createInvokePatron("Azi Dahaka");
        const invoke2 = createInvokePatron("Azi Dahaka");
        expect(isSamePatronInvocation(invoke1, invoke2)).toBe(true);
    });
    it("is case insensitive", () => {
        const invoke1 = createInvokePatron("Azi Dahaka");
        const invoke2 = createInvokePatron("AZI DAHAKA");
        expect(isSamePatronInvocation(invoke1, invoke2)).toBe(true);
    });
    it("returns false for different patrons", () => {
        const invoke1 = createInvokePatron("Azi Dahaka");
        const invoke2 = createInvokePatron("Bobugbubilz");
        expect(isSamePatronInvocation(invoke1, invoke2)).toBe(false);
    });
    it("returns false for non-invoke-patron spells", () => {
        const fireball = createFireball();
        const magicMissile = createMagicMissile();
        expect(isSamePatronInvocation(fireball, magicMissile)).toBe(false);
    });
    it("returns false when patron is undefined", () => {
        const invoke1 = {
            name: "invoke-patron",
            level: 1,
            category: "invoke-patron",
        };
        const invoke2 = createInvokePatron("Azi Dahaka");
        expect(isSamePatronInvocation(invoke1, invoke2)).toBe(false);
    });
});
// =============================================================================
// Spell Duel Check Tests
// =============================================================================
describe("makeSpellDuelCheck", () => {
    it("creates a spell check with correct properties", () => {
        const roller = createMockRoller(15);
        const spell = createMagicMissile();
        const check = makeSpellDuelCheck(spell, "wiz1", 5, roller);
        expect(check.casterId).toBe("wiz1");
        expect(check.spell).toBe(spell);
        expect(check.naturalRoll).toBe(15);
        expect(check.total).toBe(20); // 15 + 5
    });
    it("determines success correctly", () => {
        const roller = createMockRoller(10);
        const spell = createMagicMissile(); // Level 1, threshold 12
        // Roll 10 + bonus 5 = 15 >= 12, should succeed
        const check = makeSpellDuelCheck(spell, "wiz1", 5, roller);
        expect(check.succeeded).toBe(true);
    });
    it("determines failure correctly", () => {
        const roller = createMockRoller(5);
        const spell = createMagicMissile(); // Level 1, threshold 12
        // Roll 5 + bonus 3 = 8 < 12, should fail
        const check = makeSpellDuelCheck(spell, "wiz1", 3, roller);
        expect(check.succeeded).toBe(false);
    });
    it("determines spell loss correctly", () => {
        const roller = createMockRoller(5);
        const spell = createMagicMissile(); // Level 1, threshold 12
        // Roll 5 + bonus -5 = 0 < 12, spell should be lost
        const check = makeSpellDuelCheck(spell, "wiz1", -5, roller);
        expect(check.total).toBe(0);
        expect(check.spellLost).toBe(true);
    });
});
// =============================================================================
// Exchange Resolution Tests
// =============================================================================
describe("resolveCounterspellExchange", () => {
    it("resolves a basic exchange", () => {
        const state = createSpellDuelState([
            { id: "attacker", name: "Attacker", casterType: "wizard", initiative: 17 },
            { id: "defender", name: "Defender", casterType: "wizard", initiative: 12 },
        ]);
        const attackerCheck = {
            casterId: "attacker",
            spell: createMagicMissile(),
            naturalRoll: 10,
            total: 15,
            succeeded: true,
            spellLost: false,
        };
        const defenderCheck = {
            casterId: "defender",
            spell: createMagicShield(),
            naturalRoll: 8,
            total: 13,
            succeeded: true,
            spellLost: false,
        };
        const roller = createMockRoller(3);
        const result = resolveCounterspellExchange(state, "attacker", "defender", attackerCheck, defenderCheck, roller);
        expect(result.attackerCheck).toBe(attackerCheck);
        expect(result.defenderCheck).toBe(defenderCheck);
        expect(result.comparison).toBeDefined();
        expect(result.samePatronCancellation).toBe(false);
    });
    it("increments winner's momentum", () => {
        const state = createSpellDuelState([
            { id: "attacker", name: "Attacker", casterType: "wizard", initiative: 17 },
            { id: "defender", name: "Defender", casterType: "wizard", initiative: 12 },
        ]);
        // Force attacker to have higher check with big bonus
        const attackerCheck = {
            casterId: "attacker",
            spell: createMagicMissile(),
            naturalRoll: 15,
            total: 20, // High
            succeeded: true,
            spellLost: false,
        };
        const defenderCheck = {
            casterId: "defender",
            spell: createMagicShield(),
            naturalRoll: 10,
            total: 13, // Lower but succeeds
            succeeded: true,
            spellLost: false,
        };
        const roller = createMockRoller(5);
        const result = resolveCounterspellExchange(state, "attacker", "defender", attackerCheck, defenderCheck, roller);
        expect(result.comparison.attackerHigh).toBe(true);
        expect(result.newAttackerMomentum).toBe(11); // Incremented from 10
        expect(result.newDefenderMomentum).toBe(10); // Unchanged
    });
    it("handles same patron cancellation", () => {
        const state = createSpellDuelState([
            { id: "attacker", name: "Attacker", casterType: "wizard", initiative: 17, patron: "Azi Dahaka" },
            { id: "defender", name: "Defender", casterType: "wizard", initiative: 12, patron: "Azi Dahaka" },
        ]);
        const attackerCheck = {
            casterId: "attacker",
            spell: createInvokePatron("Azi Dahaka"),
            naturalRoll: 15,
            total: 20,
            succeeded: true,
            spellLost: false,
        };
        const defenderCheck = {
            casterId: "defender",
            spell: createInvokePatron("Azi Dahaka"),
            naturalRoll: 12,
            total: 17,
            succeeded: true,
            spellLost: false,
        };
        const result = resolveCounterspellExchange(state, "attacker", "defender", attackerCheck, defenderCheck);
        expect(result.samePatronCancellation).toBe(true);
        expect(result.newAttackerMomentum).toBe(10); // Unchanged
        expect(result.newDefenderMomentum).toBe(10); // Unchanged
    });
    it("triggers phlogiston disturbance on equal checks", () => {
        const state = createSpellDuelState([
            { id: "attacker", name: "Attacker", casterType: "wizard", initiative: 17 },
            { id: "defender", name: "Defender", casterType: "wizard", initiative: 12 },
        ]);
        const attackerCheck = {
            casterId: "attacker",
            spell: createMagicMissile(),
            naturalRoll: 10,
            total: 15,
            succeeded: true,
            spellLost: false,
        };
        const defenderCheck = {
            casterId: "defender",
            spell: createMagicShield(),
            naturalRoll: 10,
            total: 15, // Same as attacker
            succeeded: true,
            spellLost: false,
        };
        const roller = createMockRoller(10);
        const result = resolveCounterspellExchange(state, "attacker", "defender", attackerCheck, defenderCheck, roller);
        expect(result.comparison.isPhlogistonDisturbance).toBe(true);
        expect(result.phlogistonDisturbance).toBeDefined();
        expect(result.counterspellPower).toBeUndefined();
    });
    it("rolls on counterspell power table for unequal checks", () => {
        const state = createSpellDuelState([
            { id: "attacker", name: "Attacker", casterType: "wizard", initiative: 17 },
            { id: "defender", name: "Defender", casterType: "wizard", initiative: 12 },
        ]);
        const attackerCheck = {
            casterId: "attacker",
            spell: createMagicMissile(),
            naturalRoll: 15,
            total: 18,
            succeeded: true,
            spellLost: false,
        };
        const defenderCheck = {
            casterId: "defender",
            spell: createMagicShield(),
            naturalRoll: 10,
            total: 14,
            succeeded: true,
            spellLost: false,
        };
        const roller = createMockRoller(5);
        const result = resolveCounterspellExchange(state, "attacker", "defender", attackerCheck, defenderCheck, roller);
        expect(result.comparison.isPhlogistonDisturbance).toBe(false);
        expect(result.counterspellPower).toBeDefined();
        expect(result.phlogistonDisturbance).toBeUndefined();
    });
});
describe("applyExchangeResult", () => {
    it("updates momentum in state", () => {
        const state = createSpellDuelState([
            { id: "attacker", name: "Attacker", casterType: "wizard", initiative: 17 },
            { id: "defender", name: "Defender", casterType: "wizard", initiative: 12 },
        ]);
        const result = {
            attackerCheck: {
                casterId: "attacker",
                spell: createMagicMissile(),
                naturalRoll: 15,
                total: 18,
                succeeded: true,
                spellLost: false,
            },
            defenderCheck: {
                casterId: "defender",
                spell: createMagicShield(),
                naturalRoll: 10,
                total: 14,
                succeeded: true,
                spellLost: false,
            },
            comparison: {
                attackerCheck: 18,
                defenderCheck: 14,
                attackerHigh: true,
                comparisonDie: "d5",
                isPhlogistonDisturbance: false,
            },
            newAttackerMomentum: 11,
            newDefenderMomentum: 10,
            samePatronCancellation: false,
        };
        const newState = applyExchangeResult(state, result);
        const attacker = newState.participants.find((p) => p.id === "attacker");
        const defender = newState.participants.find((p) => p.id === "defender");
        expect(attacker?.momentum).toBe(11);
        expect(defender?.momentum).toBe(10);
        expect(newState.exchanges).toHaveLength(1);
    });
});
// =============================================================================
// Example from Rules Tests
// =============================================================================
describe("Example: Emerald Sorcerer vs Magnus", () => {
    it("reproduces the example from the rulebook", () => {
        // Initiative order:
        // 17 = The Emerald Sorcerer
        // 12 = Magnus the Gray
        const state = createSpellDuelState([
            { id: "emerald", name: "The Emerald Sorcerer", casterType: "wizard", initiative: 17 },
            { id: "magnus", name: "Magnus the Gray", casterType: "wizard", initiative: 12 },
        ]);
        // Verify state was created correctly
        expect(state.participants).toHaveLength(2);
        expect(state.participants[0]?.momentum).toBe(10);
        // Round 1: Emerald casts magic missile (13), Magnus counters with magic shield (16)
        const emeraldCheck = {
            casterId: "emerald",
            spell: createMagicMissile(),
            naturalRoll: 8,
            total: 13,
            succeeded: true, // 13 >= 12 for level 1
            spellLost: false,
        };
        const magnusCheck = {
            casterId: "magnus",
            spell: createMagicShield(),
            naturalRoll: 11,
            total: 16,
            succeeded: true,
            spellLost: false,
        };
        // Verify checks are valid
        expect(emeraldCheck.succeeded).toBe(true);
        expect(magnusCheck.succeeded).toBe(true);
        // Verify comparison
        const comparison = compareSpellChecks(13, 16);
        expect(comparison.attackerHigh).toBe(false); // Magnus wins
        expect(comparison.comparisonDie).toBe("d5"); // Diff of 3 = d5 per table
        // Magnus wins, so his momentum goes to 11
        // The example says momentum difference is 1, and defender rolls on Table 4-6
    });
    it("handles multiple counterspellers correctly", () => {
        // Round 2 from example: Emerald (18) vs Magnus (19) AND Athle (14)
        const state = createSpellDuelState([
            { id: "emerald", name: "The Emerald Sorcerer", casterType: "wizard", initiative: 17 },
            { id: "magnus", name: "Magnus the Gray", casterType: "wizard", initiative: 12 },
            { id: "athle", name: "Athle the Astounding", casterType: "wizard", initiative: 6 },
        ]);
        // Verify we have 3 participants
        expect(state.participants).toHaveLength(3);
        // Set Magnus's momentum to 11 (from winning round 1)
        const updatedState = {
            ...state,
            participants: state.participants.map((p) => p.id === "magnus" ? { ...p, momentum: 11 } : p),
        };
        // Verify momentum was updated
        const magnus = updatedState.participants.find((p) => p.id === "magnus");
        expect(magnus?.momentum).toBe(11);
        // Emerald vs Magnus: 18 vs 19
        const emVsMagnus = compareSpellChecks(18, 19);
        expect(emVsMagnus.attackerHigh).toBe(false); // Magnus wins
        expect(emVsMagnus.comparisonDie).toBe("d3"); // Diff of 1
        // Emerald vs Athle: 18 vs 14
        const emVsAthle = compareSpellChecks(18, 14);
        expect(emVsAthle.attackerHigh).toBe(true); // Emerald wins
        expect(emVsAthle.comparisonDie).toBe("d5"); // Diff of 4
    });
});
// =============================================================================
// Formatting Tests
// =============================================================================
describe("formatSpellDuelCheck", () => {
    it("formats a successful check", () => {
        const check = {
            casterId: "wiz1",
            spell: createMagicMissile(),
            naturalRoll: 15,
            total: 20,
            succeeded: true,
            spellLost: false,
        };
        const formatted = formatSpellDuelCheck(check);
        expect(formatted).toContain("magic-missile");
        expect(formatted).toContain("15");
        expect(formatted).toContain("20");
        expect(formatted).toContain("SUCCESS");
    });
    it("formats a failed check with spell lost", () => {
        const check = {
            casterId: "wiz1",
            spell: createMagicMissile(),
            naturalRoll: 5,
            total: 8,
            succeeded: false,
            spellLost: true,
        };
        const formatted = formatSpellDuelCheck(check);
        expect(formatted).toContain("FAILED");
        expect(formatted).toContain("spell lost");
    });
});
describe("formatExchangeResult", () => {
    it("formats a basic exchange result", () => {
        const result = {
            attackerCheck: {
                casterId: "attacker",
                spell: createMagicMissile(),
                naturalRoll: 15,
                total: 18,
                succeeded: true,
                spellLost: false,
            },
            defenderCheck: {
                casterId: "defender",
                spell: createMagicShield(),
                naturalRoll: 10,
                total: 14,
                succeeded: true,
                spellLost: false,
            },
            comparison: {
                attackerCheck: 18,
                defenderCheck: 14,
                attackerHigh: true,
                comparisonDie: "d5",
                isPhlogistonDisturbance: false,
            },
            counterspellPower: {
                roll: 3,
                momentumModifier: 1,
                modifiedResult: 4,
                effect: "Test effect",
                attackerSpellEffective: true,
                defenderSpellEffective: false,
                attackerCheckModifier: 0,
                defenderCheckModifier: 0,
                simultaneousEffect: false,
            },
            newAttackerMomentum: 11,
            newDefenderMomentum: 10,
            samePatronCancellation: false,
        };
        const formatted = formatExchangeResult(result, "Emerald", "Magnus");
        expect(formatted).toContain("Spell Duel Exchange");
        expect(formatted).toContain("Emerald wins");
        expect(formatted).toContain("Momentum");
        expect(formatted).toContain("11");
        expect(formatted).toContain("d5");
    });
    it("formats same patron cancellation", () => {
        const result = {
            attackerCheck: {
                casterId: "attacker",
                spell: createInvokePatron("Azi Dahaka"),
                naturalRoll: 15,
                total: 18,
                succeeded: true,
                spellLost: false,
            },
            defenderCheck: {
                casterId: "defender",
                spell: createInvokePatron("Azi Dahaka"),
                naturalRoll: 10,
                total: 14,
                succeeded: true,
                spellLost: false,
            },
            comparison: {
                attackerCheck: 18,
                defenderCheck: 14,
                attackerHigh: true,
                comparisonDie: "PD",
                isPhlogistonDisturbance: false,
            },
            newAttackerMomentum: 10,
            newDefenderMomentum: 10,
            samePatronCancellation: true,
        };
        const formatted = formatExchangeResult(result, "Emerald", "Magnus");
        expect(formatted).toContain("SAME PATRON");
        expect(formatted).toContain("cancelled");
    });
});
describe("formatSpellDuelState", () => {
    it("formats the duel state", () => {
        const state = createSpellDuelState([
            { id: "emerald", name: "Emerald Sorcerer", casterType: "wizard", initiative: 17 },
            { id: "magnus", name: "Magnus", casterType: "wizard", initiative: 12 },
        ]);
        const formatted = formatSpellDuelState(state);
        expect(formatted).toContain("Spell Duel Status");
        expect(formatted).toContain("Active: Yes");
        expect(formatted).toContain("Emerald Sorcerer");
        expect(formatted).toContain("Magnus");
        expect(formatted).toContain("Init: 17");
        expect(formatted).toContain("Momentum: 10");
    });
});
//# sourceMappingURL=spell-duel.test.js.map