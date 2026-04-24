/**
 * Thief Skills Tests
 *
 * Tests for thief skill definitions.
 */
import { describe, it, expect } from "vitest";
import { BACKSTAB, SNEAK_SILENTLY, HIDE_IN_SHADOWS, PICK_POCKETS, CLIMB_SHEER_SURFACES, PICK_LOCK, FIND_TRAP, DISABLE_TRAP, FORGE_DOCUMENT, DISGUISE_SELF, READ_LANGUAGES, HANDLE_POISON, CAST_SPELL_FROM_SCROLL, THIEF_SKILLS, THIEF_SKILL_IDS, } from "./thief-skills.js";
describe("Thief Skill Definitions", () => {
    describe("THIEF_SKILLS collection", () => {
        it("contains all 13 thief skills", () => {
            expect(Object.keys(THIEF_SKILLS).length).toBe(13);
        });
        it("has matching keys and skill IDs", () => {
            for (const [key, skill] of Object.entries(THIEF_SKILLS)) {
                expect(skill.id).toBe(key);
            }
        });
        it("all skills have thief class restriction", () => {
            for (const skill of Object.values(THIEF_SKILLS)) {
                expect(skill.classes).toContain("thief");
            }
        });
        it("all skills have thief tag", () => {
            for (const skill of Object.values(THIEF_SKILLS)) {
                expect(skill.tags).toContain("thief");
            }
        });
    });
    describe("THIEF_SKILL_IDS", () => {
        it("contains all skill IDs", () => {
            expect(THIEF_SKILL_IDS.length).toBe(13);
        });
        it("matches the keys in THIEF_SKILLS", () => {
            expect(THIEF_SKILL_IDS.sort()).toEqual(Object.keys(THIEF_SKILLS).sort());
        });
    });
    describe("BACKSTAB", () => {
        it("has correct structure", () => {
            // BACKSTAB is defined in enabling-skills.ts (passive enabling
            // skill: auto-crit + Table 1-9 attack bonus) and re-exported
            // through the thief-skills catalog so the Table 1-7 skill list
            // is complete under one registry.
            expect(BACKSTAB.id).toBe("backstab");
            expect(BACKSTAB.name).toBe("Backstab");
            expect(BACKSTAB.type).toBe("passive");
        });
        it("enables an auto-crit on Crit Table II", () => {
            expect(BACKSTAB.enables?.action).toBe("backstab");
            expect(BACKSTAB.enables?.data?.["grantsAutoCrit"]).toBe(true);
            expect(BACKSTAB.enables?.data?.["critTable"]).toBe("II");
        });
        it("triggers on a target from behind or an unaware target", () => {
            expect(BACKSTAB.enables?.condition).toBe("target-behind-or-unaware");
        });
        it("has combat, stealth, and thief tags", () => {
            expect(BACKSTAB.tags).toContain("combat");
            expect(BACKSTAB.tags).toContain("stealth");
            expect(BACKSTAB.tags).toContain("thief");
        });
    });
    describe("Check-type skills", () => {
        const checkSkills = [
            SNEAK_SILENTLY,
            HIDE_IN_SHADOWS,
            PICK_POCKETS,
            CLIMB_SHEER_SURFACES,
            PICK_LOCK,
            FIND_TRAP,
            DISABLE_TRAP,
            FORGE_DOCUMENT,
            DISGUISE_SELF,
            READ_LANGUAGES,
            HANDLE_POISON,
            CAST_SPELL_FROM_SCROLL,
        ];
        it("all have type check", () => {
            for (const skill of checkSkills) {
                expect(skill.type).toBe("check");
            }
        });
        it("all have roll configuration", () => {
            for (const skill of checkSkills) {
                expect(skill.roll).toBeDefined();
                expect(skill.roll?.die).toBeDefined();
                expect(skill.roll?.ability).toBeDefined();
            }
        });
        it("all allow luck", () => {
            for (const skill of checkSkills) {
                expect(skill.roll?.allowLuck).toBe(true);
            }
        });
    });
    describe("Skill ability assignments", () => {
        it("agility-based skills use agi", () => {
            const agilitySkills = [
                SNEAK_SILENTLY,
                HIDE_IN_SHADOWS,
                PICK_POCKETS,
                CLIMB_SHEER_SURFACES,
                PICK_LOCK,
                DISABLE_TRAP,
            ];
            for (const skill of agilitySkills) {
                expect(skill.roll?.ability).toBe("agi");
            }
        });
        it("intelligence-based skills use int", () => {
            const intSkills = [
                FIND_TRAP,
                FORGE_DOCUMENT,
                READ_LANGUAGES,
                HANDLE_POISON,
                CAST_SPELL_FROM_SCROLL,
            ];
            for (const skill of intSkills) {
                expect(skill.roll?.ability).toBe("int");
            }
        });
        it("disguise uses personality", () => {
            expect(DISGUISE_SELF.roll?.ability).toBe("per");
        });
    });
    describe("Skill tags", () => {
        it("stealth skills have stealth tag", () => {
            expect(SNEAK_SILENTLY.tags).toContain("stealth");
            expect(HIDE_IN_SHADOWS.tags).toContain("stealth");
            expect(PICK_POCKETS.tags).toContain("stealth");
        });
        it("security skills have security tag", () => {
            expect(PICK_LOCK.tags).toContain("security");
            expect(FIND_TRAP.tags).toContain("security");
            expect(DISABLE_TRAP.tags).toContain("security");
        });
        it("deception skills have deception tag", () => {
            expect(FORGE_DOCUMENT.tags).toContain("deception");
            expect(DISGUISE_SELF.tags).toContain("deception");
        });
    });
    describe("CAST_SPELL_FROM_SCROLL special mechanics", () => {
        it("uses dice chain progression", () => {
            expect(CAST_SPELL_FROM_SCROLL.roll?.useDiceChain).toBe(true);
        });
        it("has no level modifier (uses different die instead)", () => {
            expect(CAST_SPELL_FROM_SCROLL.roll?.levelModifier).toBe("none");
        });
        it("has magic tag", () => {
            expect(CAST_SPELL_FROM_SCROLL.tags).toContain("magic");
        });
        it("starts with d10 base die", () => {
            expect(CAST_SPELL_FROM_SCROLL.roll?.die).toBe("d10");
        });
    });
    describe("Standard d20 skills", () => {
        const d20Skills = [
            SNEAK_SILENTLY,
            HIDE_IN_SHADOWS,
            PICK_POCKETS,
            CLIMB_SHEER_SURFACES,
            PICK_LOCK,
            FIND_TRAP,
            DISABLE_TRAP,
            FORGE_DOCUMENT,
            DISGUISE_SELF,
            READ_LANGUAGES,
            HANDLE_POISON,
        ];
        it("all use d20", () => {
            for (const skill of d20Skills) {
                expect(skill.roll?.die).toBe("d20");
            }
        });
        it("all use custom level modifier", () => {
            for (const skill of d20Skills) {
                expect(skill.roll?.levelModifier).toBe("custom");
            }
        });
    });
    describe("Skill descriptions", () => {
        it("all skills have descriptions", () => {
            for (const skill of Object.values(THIEF_SKILLS)) {
                expect(skill.description).toBeDefined();
                expect(skill.description?.length).toBeGreaterThan(0);
            }
        });
        it("all skills have names", () => {
            for (const skill of Object.values(THIEF_SKILLS)) {
                expect(skill.name).toBeDefined();
                expect(skill.name.length).toBeGreaterThan(0);
            }
        });
    });
});
//# sourceMappingURL=thief-skills.test.js.map