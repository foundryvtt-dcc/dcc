/**
 * Tests for Enabling Skills
 */
import { describe, it, expect } from "vitest";
import { 
// Skill definitions
MIGHTY_DEED, SHIELD_BASH, BACKSTAB_ENABLING, TWO_WEAPON_FIGHTING, LUCK_RECOVERY, LUCK_SHARING, ENABLING_SKILLS, ENABLING_SKILL_IDS, 
// Mighty Deed functions
getDeedDieFromSkill, getDeedSuccessThreshold, 
// Shield Bash functions
canShieldBash, getShieldBashDamageDie, 
// Backstab functions
getBackstabMultiplierFromSkill, canBackstab, 
// Two-Weapon Fighting functions
hasTwoWeaponFighting, getTwoWeaponAttackPenalty, getTwoWeaponInitBonus, 
// Luck Recovery functions
getLuckDieFromSkill, canRecoverLuck, getHalflingDailyLuckRecovery, thiefShouldRecoverLuck, 
// Luck Sharing functions
canShareLuck, 
// Registry functions
getEnablingSkillsForClass, classHasEnablingSkill, } from "./enabling-skills.js";
describe("Enabling Skills", () => {
    describe("MIGHTY_DEED", () => {
        it("has correct structure", () => {
            expect(MIGHTY_DEED.id).toBe("mighty-deed");
            expect(MIGHTY_DEED.type).toBe("passive");
            expect(MIGHTY_DEED.enables).toBeDefined();
            expect(MIGHTY_DEED.enables?.action).toBe("deed-attempt");
            expect(MIGHTY_DEED.classes).toContain("warrior");
            expect(MIGHTY_DEED.classes).toContain("dwarf");
        });
        it("has progression data for all 10 levels", () => {
            expect(MIGHTY_DEED.progression).toBeDefined();
            for (let level = 1; level <= 10; level++) {
                expect(MIGHTY_DEED.progression?.[level]).toBeDefined();
            }
        });
    });
    describe("getDeedDieFromSkill", () => {
        it("returns d3 for level 0", () => {
            expect(getDeedDieFromSkill(0)).toBe("d3");
        });
        it("returns d3 for levels 1-2", () => {
            expect(getDeedDieFromSkill(1)).toBe("d3");
            expect(getDeedDieFromSkill(2)).toBe("d3");
        });
        it("returns d4 for levels 3-4", () => {
            expect(getDeedDieFromSkill(3)).toBe("d4");
            expect(getDeedDieFromSkill(4)).toBe("d4");
        });
        it("returns d5 for levels 5-6", () => {
            expect(getDeedDieFromSkill(5)).toBe("d5");
            expect(getDeedDieFromSkill(6)).toBe("d5");
        });
        it("returns d6 for levels 7-8", () => {
            expect(getDeedDieFromSkill(7)).toBe("d6");
            expect(getDeedDieFromSkill(8)).toBe("d6");
        });
        it("returns d7 for levels 9-10", () => {
            expect(getDeedDieFromSkill(9)).toBe("d7");
            expect(getDeedDieFromSkill(10)).toBe("d7");
        });
        it("extrapolates for levels beyond 10", () => {
            // Formula: d(7 + floor((level - 7) / 2)), capped at d12
            // Level 11: 7 + floor(4/2) = 7 + 2 = 9 → d9
            // Level 13: 7 + floor(6/2) = 7 + 3 = 10 → d10
            expect(getDeedDieFromSkill(11)).toBe("d9");
            expect(getDeedDieFromSkill(13)).toBe("d10");
        });
    });
    describe("getDeedSuccessThreshold", () => {
        it("returns 3 as the success threshold", () => {
            expect(getDeedSuccessThreshold()).toBe(3);
        });
    });
    describe("SHIELD_BASH", () => {
        it("has correct structure", () => {
            expect(SHIELD_BASH.id).toBe("shield-bash");
            expect(SHIELD_BASH.type).toBe("passive");
            expect(SHIELD_BASH.enables?.action).toBe("shield-bash-attack");
            expect(SHIELD_BASH.enables?.condition).toBe("wielding-shield");
            expect(SHIELD_BASH.classes).toContain("dwarf");
            expect(SHIELD_BASH.classes).not.toContain("warrior");
        });
    });
    describe("canShieldBash", () => {
        it("returns true for dwarf with shield", () => {
            expect(canShieldBash(true, "dwarf")).toBe(true);
        });
        it("returns false for dwarf without shield", () => {
            expect(canShieldBash(false, "dwarf")).toBe(false);
        });
        it("returns false for warrior with shield", () => {
            expect(canShieldBash(true, "warrior")).toBe(false);
        });
        it("returns false for other classes", () => {
            expect(canShieldBash(true, "thief")).toBe(false);
            expect(canShieldBash(true, "cleric")).toBe(false);
        });
    });
    describe("getShieldBashDamageDie", () => {
        it("returns d3", () => {
            expect(getShieldBashDamageDie()).toBe("d3");
        });
    });
    describe("BACKSTAB_ENABLING", () => {
        it("has correct structure", () => {
            expect(BACKSTAB_ENABLING.id).toBe("backstab");
            expect(BACKSTAB_ENABLING.type).toBe("passive");
            expect(BACKSTAB_ENABLING.enables?.action).toBe("backstab");
            expect(BACKSTAB_ENABLING.classes).toContain("thief");
        });
        it("has progression data for all 10 levels", () => {
            expect(BACKSTAB_ENABLING.progression).toBeDefined();
            for (let level = 1; level <= 10; level++) {
                expect(BACKSTAB_ENABLING.progression?.[level]).toBeDefined();
            }
        });
    });
    describe("getBackstabMultiplierFromSkill", () => {
        it("returns 1 for level 0", () => {
            expect(getBackstabMultiplierFromSkill(0)).toBe(1);
        });
        it("returns 2 for levels 1-2", () => {
            expect(getBackstabMultiplierFromSkill(1)).toBe(2);
            expect(getBackstabMultiplierFromSkill(2)).toBe(2);
        });
        it("returns 3 for levels 3-4", () => {
            expect(getBackstabMultiplierFromSkill(3)).toBe(3);
            expect(getBackstabMultiplierFromSkill(4)).toBe(3);
        });
        it("returns 4 for levels 5-6", () => {
            expect(getBackstabMultiplierFromSkill(5)).toBe(4);
            expect(getBackstabMultiplierFromSkill(6)).toBe(4);
        });
        it("returns 5 for levels 7+", () => {
            expect(getBackstabMultiplierFromSkill(7)).toBe(5);
            expect(getBackstabMultiplierFromSkill(10)).toBe(5);
            expect(getBackstabMultiplierFromSkill(15)).toBe(5);
        });
    });
    describe("canBackstab", () => {
        it("returns true for thief when conditions are met", () => {
            expect(canBackstab(true, true, "thief")).toBe(true);
        });
        it("returns false when target is not surprised", () => {
            expect(canBackstab(false, true, "thief")).toBe(false);
        });
        it("returns false when not behind target", () => {
            expect(canBackstab(true, false, "thief")).toBe(false);
        });
        it("returns false for non-thief classes", () => {
            expect(canBackstab(true, true, "warrior")).toBe(false);
            expect(canBackstab(true, true, "wizard")).toBe(false);
        });
    });
    describe("TWO_WEAPON_FIGHTING", () => {
        it("has correct structure", () => {
            expect(TWO_WEAPON_FIGHTING.id).toBe("two-weapon-fighting");
            expect(TWO_WEAPON_FIGHTING.type).toBe("passive");
            expect(TWO_WEAPON_FIGHTING.enables?.action).toBe("two-weapon-attacks");
            expect(TWO_WEAPON_FIGHTING.classes).toContain("halfling");
        });
    });
    describe("hasTwoWeaponFighting", () => {
        it("returns true for halfling", () => {
            expect(hasTwoWeaponFighting("halfling")).toBe(true);
        });
        it("returns false for other classes", () => {
            expect(hasTwoWeaponFighting("warrior")).toBe(false);
            expect(hasTwoWeaponFighting("thief")).toBe(false);
        });
    });
    describe("getTwoWeaponAttackPenalty", () => {
        it("returns -1 for halfling", () => {
            expect(getTwoWeaponAttackPenalty("halfling")).toBe(-1);
        });
        it("returns -2 for other classes", () => {
            expect(getTwoWeaponAttackPenalty("warrior")).toBe(-2);
            expect(getTwoWeaponAttackPenalty("thief")).toBe(-2);
        });
    });
    describe("getTwoWeaponInitBonus", () => {
        it("returns 1 for halfling", () => {
            expect(getTwoWeaponInitBonus("halfling")).toBe(1);
        });
        it("returns 0 for other classes", () => {
            expect(getTwoWeaponInitBonus("warrior")).toBe(0);
            expect(getTwoWeaponInitBonus("thief")).toBe(0);
        });
    });
    describe("LUCK_RECOVERY", () => {
        it("has correct structure", () => {
            expect(LUCK_RECOVERY.id).toBe("luck-recovery");
            expect(LUCK_RECOVERY.type).toBe("passive");
            expect(LUCK_RECOVERY.classes).toContain("thief");
            expect(LUCK_RECOVERY.classes).toContain("halfling");
        });
        it("has progression data for luck die", () => {
            expect(LUCK_RECOVERY.progression).toBeDefined();
            for (let level = 1; level <= 10; level++) {
                expect(LUCK_RECOVERY.progression?.[level]?.die).toBeDefined();
            }
        });
    });
    describe("getLuckDieFromSkill", () => {
        it("returns d3 for level 0", () => {
            expect(getLuckDieFromSkill(0)).toBe("d3");
        });
        it("returns d3 for levels 1-2", () => {
            expect(getLuckDieFromSkill(1)).toBe("d3");
            expect(getLuckDieFromSkill(2)).toBe("d3");
        });
        it("returns d4 for levels 3-4", () => {
            expect(getLuckDieFromSkill(3)).toBe("d4");
            expect(getLuckDieFromSkill(4)).toBe("d4");
        });
        it("returns d5 for levels 5-6", () => {
            expect(getLuckDieFromSkill(5)).toBe("d5");
            expect(getLuckDieFromSkill(6)).toBe("d5");
        });
        it("returns d6 for levels 7-8", () => {
            expect(getLuckDieFromSkill(7)).toBe("d6");
            expect(getLuckDieFromSkill(8)).toBe("d6");
        });
        it("returns d7 for levels 9-10", () => {
            expect(getLuckDieFromSkill(9)).toBe("d7");
            expect(getLuckDieFromSkill(10)).toBe("d7");
        });
        it("extrapolates for levels beyond 10", () => {
            // Formula: d(7 + floor((level - 7) / 2)), capped at d12
            // Level 11: 7 + floor(4/2) = 7 + 2 = 9 → d9
            expect(getLuckDieFromSkill(11)).toBe("d9");
        });
    });
    describe("canRecoverLuck", () => {
        it("returns true for thief", () => {
            expect(canRecoverLuck("thief")).toBe(true);
        });
        it("returns true for halfling", () => {
            expect(canRecoverLuck("halfling")).toBe(true);
        });
        it("returns false for other classes", () => {
            expect(canRecoverLuck("warrior")).toBe(false);
            expect(canRecoverLuck("wizard")).toBe(false);
        });
    });
    describe("getHalflingDailyLuckRecovery", () => {
        it("returns 1", () => {
            expect(getHalflingDailyLuckRecovery()).toBe(1);
        });
    });
    describe("thiefShouldRecoverLuck", () => {
        it("returns true on natural 20 with thief skill", () => {
            expect(thiefShouldRecoverLuck(20, true)).toBe(true);
        });
        it("returns false on non-20 with thief skill", () => {
            expect(thiefShouldRecoverLuck(19, true)).toBe(false);
            expect(thiefShouldRecoverLuck(1, true)).toBe(false);
        });
        it("returns false on natural 20 with non-thief skill", () => {
            expect(thiefShouldRecoverLuck(20, false)).toBe(false);
        });
    });
    describe("LUCK_SHARING", () => {
        it("has correct structure", () => {
            expect(LUCK_SHARING.id).toBe("luck-sharing");
            expect(LUCK_SHARING.type).toBe("passive");
            expect(LUCK_SHARING.enables?.action).toBe("share-luck");
            expect(LUCK_SHARING.classes).toContain("halfling");
        });
    });
    describe("canShareLuck", () => {
        it("returns true for halfling within 30 feet", () => {
            expect(canShareLuck("halfling", 30)).toBe(true);
            expect(canShareLuck("halfling", 15)).toBe(true);
            expect(canShareLuck("halfling", 0)).toBe(true);
        });
        it("returns false for halfling beyond 30 feet", () => {
            expect(canShareLuck("halfling", 31)).toBe(false);
            expect(canShareLuck("halfling", 100)).toBe(false);
        });
        it("returns false for non-halfling", () => {
            expect(canShareLuck("thief", 10)).toBe(false);
            expect(canShareLuck("warrior", 10)).toBe(false);
        });
    });
    describe("ENABLING_SKILLS registry", () => {
        it("contains all six enabling skills", () => {
            expect(Object.keys(ENABLING_SKILLS)).toHaveLength(6);
            expect(ENABLING_SKILLS["mighty-deed"]).toBe(MIGHTY_DEED);
            expect(ENABLING_SKILLS["shield-bash"]).toBe(SHIELD_BASH);
            expect(ENABLING_SKILLS["backstab"]).toBe(BACKSTAB_ENABLING);
            expect(ENABLING_SKILLS["two-weapon-fighting"]).toBe(TWO_WEAPON_FIGHTING);
            expect(ENABLING_SKILLS["luck-recovery"]).toBe(LUCK_RECOVERY);
            expect(ENABLING_SKILLS["luck-sharing"]).toBe(LUCK_SHARING);
        });
    });
    describe("ENABLING_SKILL_IDS", () => {
        it("contains all skill IDs", () => {
            expect(ENABLING_SKILL_IDS).toHaveLength(6);
            expect(ENABLING_SKILL_IDS).toContain("mighty-deed");
            expect(ENABLING_SKILL_IDS).toContain("shield-bash");
            expect(ENABLING_SKILL_IDS).toContain("backstab");
            expect(ENABLING_SKILL_IDS).toContain("two-weapon-fighting");
            expect(ENABLING_SKILL_IDS).toContain("luck-recovery");
            expect(ENABLING_SKILL_IDS).toContain("luck-sharing");
        });
    });
    describe("getEnablingSkillsForClass", () => {
        it("returns mighty-deed and shield-bash for dwarf", () => {
            const dwarfSkills = getEnablingSkillsForClass("dwarf");
            const skillIds = dwarfSkills.map((s) => s.id);
            expect(skillIds).toContain("mighty-deed");
            expect(skillIds).toContain("shield-bash");
        });
        it("returns mighty-deed only for warrior", () => {
            const warriorSkills = getEnablingSkillsForClass("warrior");
            const skillIds = warriorSkills.map((s) => s.id);
            expect(skillIds).toContain("mighty-deed");
            expect(skillIds).not.toContain("shield-bash");
        });
        it("returns backstab and luck-recovery for thief", () => {
            const thiefSkills = getEnablingSkillsForClass("thief");
            const skillIds = thiefSkills.map((s) => s.id);
            expect(skillIds).toContain("backstab");
            expect(skillIds).toContain("luck-recovery");
        });
        it("returns two-weapon-fighting, luck-recovery, and luck-sharing for halfling", () => {
            const halflingSkills = getEnablingSkillsForClass("halfling");
            const skillIds = halflingSkills.map((s) => s.id);
            expect(skillIds).toContain("two-weapon-fighting");
            expect(skillIds).toContain("luck-recovery");
            expect(skillIds).toContain("luck-sharing");
        });
        it("returns empty array for classes without enabling skills", () => {
            const wizardSkills = getEnablingSkillsForClass("wizard");
            expect(wizardSkills).toHaveLength(0);
        });
    });
    describe("classHasEnablingSkill", () => {
        it("returns true when class has the skill", () => {
            expect(classHasEnablingSkill("warrior", "mighty-deed")).toBe(true);
            expect(classHasEnablingSkill("dwarf", "mighty-deed")).toBe(true);
            expect(classHasEnablingSkill("dwarf", "shield-bash")).toBe(true);
            expect(classHasEnablingSkill("thief", "backstab")).toBe(true);
            expect(classHasEnablingSkill("halfling", "two-weapon-fighting")).toBe(true);
        });
        it("returns false when class does not have the skill", () => {
            expect(classHasEnablingSkill("warrior", "backstab")).toBe(false);
            expect(classHasEnablingSkill("thief", "mighty-deed")).toBe(false);
            expect(classHasEnablingSkill("wizard", "shield-bash")).toBe(false);
        });
        it("returns false for unknown skill", () => {
            expect(classHasEnablingSkill("warrior", "unknown-skill")).toBe(false);
        });
    });
});
//# sourceMappingURL=enabling-skills.test.js.map