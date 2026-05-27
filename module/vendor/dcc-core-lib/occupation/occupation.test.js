/**
 * Occupation Skills Tests
 *
 * Tests for occupation-based skills including:
 * - Weapon training parsing
 * - Limited thief skills
 * - Trade skills
 * - Skill resolution
 */
import { describe, it, expect } from "vitest";
import { 
// Weapon training
parseWeaponTraining, isTrainedWeapon, getTrainedWeaponBonus, 
// Limited thief skills
calculateEffectiveLevel, getOccupationThiefSkill, hasOccupationThiefSkill, 
// Skill resolution
buildOccupationSkillModifiers, resolveOccupationSkillCheck, 
// Skill accessors
getTradeSkills, getKnowledgeSkills, getLimitedThiefSkills, 
// Result helpers
isOccupationSkillSuccess, getOccupationSkillSummary, 
// Sample data
PICKPOCKET_SKILL, KEY_MAKER_SKILL, HEALER_SKILL, GEM_CUTTER_SKILL, TRADER_SKILL, PLATE_SMITH_SKILL, getSkillsForOccupation, occupationHasSkills, } from "./index.js";
// =============================================================================
// Test Data
// =============================================================================
const sampleAbilities = {
    str: 12,
    agl: 14,
    sta: 10,
    per: 16,
    int: 13,
    lck: 11,
};
const mixedOccupationSkills = [
    PICKPOCKET_SKILL,
    HEALER_SKILL,
    GEM_CUTTER_SKILL,
    TRADER_SKILL,
];
// =============================================================================
// Weapon Training Tests
// =============================================================================
describe("Weapon Training", () => {
    describe("parseWeaponTraining", () => {
        it("parses simple weapon names", () => {
            const result = parseWeaponTraining("Dagger");
            expect(result.weaponName).toBe("Dagger");
            expect(result.weaponType).toBe("dagger");
            expect(result.attackBonus).toBe(0);
        });
        it("parses 'X (as Y)' pattern", () => {
            const result = parseWeaponTraining("Hammer (as club)");
            expect(result.weaponName).toBe("Hammer");
            expect(result.weaponType).toBe("club");
            expect(result.notes).toBe("Hammer (as club)");
        });
        it("handles various 'as' patterns", () => {
            expect(parseWeaponTraining("Cleaver (as axe)").weaponType).toBe("axe");
            expect(parseWeaponTraining("Razor (as dagger)").weaponType).toBe("dagger");
            expect(parseWeaponTraining("Pole (as staff)").weaponType).toBe("staff");
        });
        it("handles weapons with spaces", () => {
            const result = parseWeaponTraining("Short sword");
            expect(result.weaponName).toBe("Short sword");
            expect(result.weaponType).toBe("short sword");
        });
    });
    describe("isTrainedWeapon", () => {
        it("matches exact weapon type", () => {
            const training = parseWeaponTraining("Hammer (as club)");
            expect(isTrainedWeapon("club", training)).toBe(true);
        });
        it("matches weapon name", () => {
            const training = parseWeaponTraining("Hammer (as club)");
            expect(isTrainedWeapon("Hammer", training)).toBe(true);
        });
        it("is case insensitive", () => {
            const training = parseWeaponTraining("Dagger");
            expect(isTrainedWeapon("DAGGER", training)).toBe(true);
            expect(isTrainedWeapon("dagger", training)).toBe(true);
        });
        it("returns false for non-matching weapons", () => {
            const training = parseWeaponTraining("Dagger");
            expect(isTrainedWeapon("sword", training)).toBe(false);
            expect(isTrainedWeapon("club", training)).toBe(false);
        });
    });
    describe("getTrainedWeaponBonus", () => {
        it("returns bonus for trained weapon", () => {
            const training = parseWeaponTraining("Dagger");
            training.attackBonus = 1;
            expect(getTrainedWeaponBonus("dagger", training)).toBe(1);
        });
        it("returns 0 for untrained weapon", () => {
            const training = parseWeaponTraining("Dagger");
            training.attackBonus = 1;
            expect(getTrainedWeaponBonus("sword", training)).toBe(0);
        });
    });
});
// =============================================================================
// Limited Thief Skills Tests
// =============================================================================
describe("Limited Thief Skills", () => {
    describe("calculateEffectiveLevel", () => {
        it("calculates effective level with negative adjustment", () => {
            expect(calculateEffectiveLevel(5, -2)).toBe(3);
            expect(calculateEffectiveLevel(3, -2)).toBe(1);
        });
        it("enforces minimum level of 0", () => {
            expect(calculateEffectiveLevel(1, -2)).toBe(0);
            expect(calculateEffectiveLevel(0, -2)).toBe(0);
            expect(calculateEffectiveLevel(2, -5)).toBe(0);
        });
        it("handles no adjustment", () => {
            expect(calculateEffectiveLevel(5)).toBe(5);
            expect(calculateEffectiveLevel(5, 0)).toBe(5);
        });
        it("handles positive adjustment", () => {
            expect(calculateEffectiveLevel(3, 2)).toBe(5);
        });
    });
    describe("getOccupationThiefSkill", () => {
        const skills = [PICKPOCKET_SKILL, KEY_MAKER_SKILL];
        it("finds matching thief skill", () => {
            const result = getOccupationThiefSkill(skills, "pick-pocket");
            expect(result).toBeDefined();
            expect(result?.id).toBe("pickpocket-trade");
        });
        it("returns undefined for non-existent skill", () => {
            const result = getOccupationThiefSkill(skills, "backstab");
            expect(result).toBeUndefined();
        });
    });
    describe("hasOccupationThiefSkill", () => {
        const skills = [PICKPOCKET_SKILL];
        it("returns true for available skill", () => {
            expect(hasOccupationThiefSkill(skills, "pick-pocket")).toBe(true);
        });
        it("returns false for unavailable skill", () => {
            expect(hasOccupationThiefSkill(skills, "pick-lock")).toBe(false);
        });
    });
});
// =============================================================================
// Skill Accessors Tests
// =============================================================================
describe("Skill Accessors", () => {
    describe("getTradeSkills", () => {
        it("filters trade and craft skills", () => {
            const result = getTradeSkills(mixedOccupationSkills);
            expect(result).toContain(GEM_CUTTER_SKILL);
        });
    });
    describe("getKnowledgeSkills", () => {
        it("filters knowledge skills", () => {
            const result = getKnowledgeSkills(mixedOccupationSkills);
            expect(result).toContain(HEALER_SKILL);
        });
    });
    describe("getLimitedThiefSkills", () => {
        it("filters limited thief skills", () => {
            const result = getLimitedThiefSkills(mixedOccupationSkills);
            expect(result).toContain(PICKPOCKET_SKILL);
        });
    });
});
// =============================================================================
// Sample Data Tests
// =============================================================================
describe("Sample Occupation Skills", () => {
    describe("getSkillsForOccupation", () => {
        it("returns skills for Pickpocket", () => {
            const skills = getSkillsForOccupation("Pickpocket");
            expect(skills).toHaveLength(1);
            expect(skills[0]?.id).toBe("pickpocket-trade");
        });
        it("returns skills for Key Maker", () => {
            const skills = getSkillsForOccupation("Key Maker");
            expect(skills).toHaveLength(1);
            expect(skills[0]?.thiefSkillId).toBe("pick-lock");
        });
        it("returns empty array for occupation without skills", () => {
            const skills = getSkillsForOccupation("Farmer");
            expect(skills).toHaveLength(0);
        });
    });
    describe("occupationHasSkills", () => {
        it("returns true for occupations with skills", () => {
            expect(occupationHasSkills("Pickpocket")).toBe(true);
            expect(occupationHasSkills("Village Healer")).toBe(true);
        });
        it("returns false for occupations without skills", () => {
            expect(occupationHasSkills("Farmer")).toBe(false);
            expect(occupationHasSkills("Unknown Occupation")).toBe(false);
        });
    });
});
// =============================================================================
// Skill Resolution Tests
// =============================================================================
describe("Skill Resolution", () => {
    describe("buildOccupationSkillModifiers", () => {
        it("includes ability modifier", () => {
            const input = {
                skill: HEALER_SKILL,
                level: 1,
                abilities: sampleAbilities,
            };
            const modifiers = buildOccupationSkillModifiers(input);
            expect(modifiers.find((m) => m.source === "INT")).toBeDefined();
        });
        it("includes skill bonus", () => {
            const input = {
                skill: GEM_CUTTER_SKILL, // Has bonus: 4
                level: 1,
                abilities: sampleAbilities,
            };
            const modifiers = buildOccupationSkillModifiers(input);
            expect(modifiers.find((m) => m.source === "Skill Bonus")?.value).toBe(4);
        });
        it("includes luck burn", () => {
            const input = {
                skill: HEALER_SKILL,
                level: 1,
                abilities: sampleAbilities,
                luckBurn: 3,
            };
            const modifiers = buildOccupationSkillModifiers(input);
            expect(modifiers.find((m) => m.source === "Luck")?.value).toBe(3);
        });
        it("includes situational modifiers", () => {
            const input = {
                skill: HEALER_SKILL,
                level: 1,
                abilities: sampleAbilities,
                situationalModifiers: [{ source: "Tools", value: 2 }],
            };
            const modifiers = buildOccupationSkillModifiers(input);
            expect(modifiers.find((m) => m.source === "Tools")?.value).toBe(2);
        });
    });
    describe("resolveOccupationSkillCheck", () => {
        it("resolves a skill check with fixed roll", () => {
            const input = {
                skill: HEALER_SKILL,
                level: 1,
                abilities: sampleAbilities,
            };
            const result = resolveOccupationSkillCheck(input, { roller: () => 15 });
            expect(result.natural).toBe(15);
            expect(result.total).toBeDefined();
        });
        it("uses d20 for knowledge skills", () => {
            const input = {
                skill: HEALER_SKILL,
                level: 1,
                abilities: sampleAbilities,
            };
            const result = resolveOccupationSkillCheck(input, { roller: () => 10 });
            expect(result.die).toBe("d20");
        });
        it("detects critical on natural 20", () => {
            const input = {
                skill: HEALER_SKILL,
                level: 1,
                abilities: sampleAbilities,
            };
            const result = resolveOccupationSkillCheck(input, { roller: () => 20 });
            expect(result.critical).toBe(true);
        });
        it("detects fumble on natural 1", () => {
            const input = {
                skill: HEALER_SKILL,
                level: 1,
                abilities: sampleAbilities,
            };
            const result = resolveOccupationSkillCheck(input, { roller: () => 1 });
            expect(result.fumble).toBe(true);
        });
        it("determines success for DC-based checks", () => {
            const input = {
                skill: HEALER_SKILL, // baseDC: 10
                level: 1,
                abilities: sampleAbilities, // INT 13 = +1
            };
            // Roll 15 + 1 (INT) + 2 (bonus) = 18 vs DC 10
            const result = resolveOccupationSkillCheck(input, { roller: () => 15 });
            expect(result.success).toBe(true);
        });
        it("determines failure for DC-based checks", () => {
            const lowAbilities = { ...sampleAbilities, int: 8 }; // -1 mod
            const input = {
                skill: HEALER_SKILL, // baseDC: 10, bonus: 2
                level: 1,
                abilities: lowAbilities,
            };
            // Roll 5 - 1 (INT) + 2 (bonus) = 6 vs DC 10
            const result = resolveOccupationSkillCheck(input, { roller: () => 5 });
            expect(result.success).toBe(false);
        });
        it("tracks luck burned", () => {
            const input = {
                skill: HEALER_SKILL,
                level: 1,
                abilities: sampleAbilities,
                luckBurn: 2,
            };
            const result = resolveOccupationSkillCheck(input, { roller: () => 10 });
            expect(result.luckBurned).toBe(2);
        });
        it("fires events", () => {
            const events = [];
            const input = {
                skill: HEALER_SKILL,
                level: 1,
                abilities: sampleAbilities,
            };
            resolveOccupationSkillCheck(input, { roller: () => 10 }, {
                onCheckStart: () => events.push("start"),
                onCheckComplete: () => events.push("complete"),
            });
            expect(events).toContain("start");
            expect(events).toContain("complete");
        });
        it("fires critical event", () => {
            let criticalFired = false;
            const input = {
                skill: HEALER_SKILL,
                level: 1,
                abilities: sampleAbilities,
            };
            resolveOccupationSkillCheck(input, { roller: () => 20 }, {
                onCritical: () => { criticalFired = true; },
            });
            expect(criticalFired).toBe(true);
        });
        it("fires fumble event", () => {
            let fumbleFired = false;
            const input = {
                skill: HEALER_SKILL,
                level: 1,
                abilities: sampleAbilities,
            };
            resolveOccupationSkillCheck(input, { roller: () => 1 }, {
                onFumble: () => { fumbleFired = true; },
            });
            expect(fumbleFired).toBe(true);
        });
    });
});
// =============================================================================
// Result Helper Tests
// =============================================================================
describe("Result Helpers", () => {
    describe("isOccupationSkillSuccess", () => {
        it("returns true for explicit success", () => {
            const result = resolveOccupationSkillCheck({ skill: HEALER_SKILL, level: 1, abilities: sampleAbilities }, { roller: () => 15 });
            expect(isOccupationSkillSuccess(result)).toBe(true);
        });
        it("returns true for critical", () => {
            // Create skill without baseDC to test critical success path
            const { baseDC: _, ...skillWithoutDC } = HEALER_SKILL;
            const result = resolveOccupationSkillCheck({ skill: skillWithoutDC, level: 1, abilities: sampleAbilities }, { roller: () => 20 });
            expect(isOccupationSkillSuccess(result)).toBe(true);
        });
        it("returns false for fumble", () => {
            // Create skill without baseDC to test fumble path
            const { baseDC: _, ...skillWithoutDC } = HEALER_SKILL;
            const result = resolveOccupationSkillCheck({ skill: skillWithoutDC, level: 1, abilities: sampleAbilities }, { roller: () => 1 });
            expect(isOccupationSkillSuccess(result)).toBe(false);
        });
    });
    describe("getOccupationSkillSummary", () => {
        it("includes roll info", () => {
            const result = resolveOccupationSkillCheck({ skill: HEALER_SKILL, level: 1, abilities: sampleAbilities }, { roller: () => 15 });
            const summary = getOccupationSkillSummary(result);
            expect(summary).toContain("Roll: 15");
        });
        it("indicates critical", () => {
            const result = resolveOccupationSkillCheck({ skill: HEALER_SKILL, level: 1, abilities: sampleAbilities }, { roller: () => 20 });
            const summary = getOccupationSkillSummary(result);
            expect(summary).toContain("CRITICAL");
        });
        it("indicates fumble", () => {
            const result = resolveOccupationSkillCheck({ skill: HEALER_SKILL, level: 1, abilities: sampleAbilities }, { roller: () => 1 });
            const summary = getOccupationSkillSummary(result);
            expect(summary).toContain("FUMBLE");
        });
        it("indicates success/failure", () => {
            const result = resolveOccupationSkillCheck({ skill: HEALER_SKILL, level: 1, abilities: sampleAbilities }, { roller: () => 15 });
            const summary = getOccupationSkillSummary(result);
            expect(summary).toContain("Success");
        });
    });
});
// =============================================================================
// Skill Definition Tests
// =============================================================================
describe("Skill Definitions", () => {
    describe("PICKPOCKET_SKILL", () => {
        it("has correct category", () => {
            expect(PICKPOCKET_SKILL.category).toBe("limited-thief");
        });
        it("references pick-pocket thief skill", () => {
            expect(PICKPOCKET_SKILL.thiefSkillId).toBe("pick-pocket");
        });
        it("has -2 effective level adjustment", () => {
            expect(PICKPOCKET_SKILL.effectiveLevel).toBe(-2);
        });
    });
    describe("HEALER_SKILL", () => {
        it("has correct category", () => {
            expect(HEALER_SKILL.category).toBe("knowledge");
        });
        it("uses INT ability", () => {
            expect(HEALER_SKILL.abilityId).toBe("int");
        });
        it("has DC 10", () => {
            expect(HEALER_SKILL.baseDC).toBe(10);
        });
    });
    describe("PLATE_SMITH_SKILL", () => {
        it("has craft category", () => {
            expect(PLATE_SMITH_SKILL.category).toBe("craft");
        });
        it("uses STR ability", () => {
            expect(PLATE_SMITH_SKILL.abilityId).toBe("str");
        });
    });
    describe("TRADER_SKILL", () => {
        it("has social category", () => {
            expect(TRADER_SKILL.category).toBe("social");
        });
        it("uses PER ability", () => {
            expect(TRADER_SKILL.abilityId).toBe("per");
        });
    });
});
//# sourceMappingURL=occupation.test.js.map