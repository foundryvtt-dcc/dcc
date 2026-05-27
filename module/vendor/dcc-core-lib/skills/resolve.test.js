import { describe, expect, it, vi } from "vitest";
import { resolveSkillCheck, quickSkillCheck, abilityCheck, savingThrow, } from "./resolve.js";
describe("resolve", () => {
    describe("resolveSkillCheck", () => {
        const basicSkill = {
            id: "test-skill",
            name: "Test Skill",
            type: "check",
            roll: {
                die: "d20",
                ability: "str",
                levelModifier: "full",
            },
        };
        it("returns formula without rolling by default", () => {
            const input = {
                skill: basicSkill,
                abilities: { str: 16 },
                level: 3,
            };
            const result = resolveSkillCheck(input);
            expect(result.skillId).toBe("test-skill");
            expect(result.die).toBe("d20");
            expect(result.formula).toBe("1d20+5"); // +2 STR mod, +3 level
            expect(result.natural).toBeUndefined();
            expect(result.total).toBeUndefined();
        });
        it("evaluates roll when mode is evaluate", () => {
            const customRoller = vi.fn().mockReturnValue(15);
            const input = {
                skill: basicSkill,
                abilities: { str: 16 },
                level: 3,
            };
            const result = resolveSkillCheck(input, {
                mode: "evaluate",
                roller: customRoller,
            });
            expect(result.natural).toBe(15);
            expect(result.total).toBe(20); // 15 + 2 + 3
        });
        it("uses custom die from skill definition", () => {
            const skill = {
                id: "custom-die",
                name: "Custom Die Skill",
                type: "check",
                roll: {
                    die: "d24",
                    levelModifier: "none",
                },
            };
            const input = {
                skill,
                abilities: {},
                level: 1,
            };
            const result = resolveSkillCheck(input);
            expect(result.die).toBe("d24");
            expect(result.formula).toBe("1d24");
        });
        it("uses die from progression when available", () => {
            const skill = {
                id: "progression-die",
                name: "Progression Die Skill",
                type: "check",
                roll: {
                    die: "d10",
                    levelModifier: "none",
                },
                progression: {
                    1: { die: "d10" },
                    3: { die: "d12" },
                    5: { die: "d14" },
                },
            };
            const input1 = {
                skill,
                abilities: {},
                level: 2,
            };
            expect(resolveSkillCheck(input1).die).toBe("d10");
            const input2 = {
                skill,
                abilities: {},
                level: 4,
            };
            expect(resolveSkillCheck(input2).die).toBe("d12");
            const input3 = {
                skill,
                abilities: {},
                level: 7,
            };
            expect(resolveSkillCheck(input3).die).toBe("d14");
        });
        it("includes ability modifier", () => {
            const input = {
                skill: basicSkill,
                abilities: { str: 18 }, // +3 modifier
                level: 1,
            };
            const result = resolveSkillCheck(input);
            expect(result.modifiers).toContainEqual({
                kind: "add",
                value: 3,
                origin: { category: "ability", id: "str", label: "STR modifier" },
                applied: true,
            });
        });
        it("handles missing ability score", () => {
            const input = {
                skill: basicSkill,
                abilities: {}, // No STR score
                level: 1,
            };
            const result = resolveSkillCheck(input);
            // Should not crash, just no ability modifier
            expect(result.formula).toBe("1d20+1"); // Just level modifier
        });
        it("includes level modifier for full level", () => {
            const input = {
                skill: basicSkill,
                abilities: {},
                level: 5,
            };
            const result = resolveSkillCheck(input);
            expect(result.modifiers).toContainEqual({
                kind: "add",
                value: 5,
                origin: { category: "level", id: "level", label: "Level" },
                applied: true,
            });
        });
        it("includes half level modifier", () => {
            const skill = {
                id: "half-level",
                name: "Half Level Skill",
                type: "check",
                roll: {
                    die: "d20",
                    levelModifier: "half",
                },
            };
            const input = {
                skill,
                abilities: {},
                level: 5,
            };
            const result = resolveSkillCheck(input);
            expect(result.modifiers).toContainEqual({
                kind: "add",
                value: 2,
                origin: { category: "level", id: "level", label: "Level" },
                applied: true,
            });
        });
        it("includes no level modifier when none", () => {
            const skill = {
                id: "no-level",
                name: "No Level Skill",
                type: "check",
                roll: {
                    die: "d20",
                    levelModifier: "none",
                },
            };
            const input = {
                skill,
                abilities: {},
                level: 5,
            };
            const result = resolveSkillCheck(input);
            expect(result.modifiers.find((m) => m.origin.category === "level")).toBeUndefined();
        });
        it("includes custom bonus from progression", () => {
            const skill = {
                id: "custom-bonus",
                name: "Custom Bonus Skill",
                type: "check",
                roll: {
                    die: "d20",
                    levelModifier: "custom",
                },
                progression: {
                    1: { bonus: 2 },
                    3: { bonus: 4 },
                    5: { bonus: 6 },
                },
            };
            const input = {
                skill,
                abilities: {},
                level: 4,
            };
            const result = resolveSkillCheck(input);
            // Level modifier should be the custom bonus
            expect(result.modifiers).toContainEqual({
                kind: "add",
                value: 4,
                origin: { category: "level", id: "level", label: "Level" },
                applied: true,
            });
        });
        it("includes progression bonus separate from level modifier", () => {
            const skill = {
                id: "prog-bonus",
                name: "Progression Bonus Skill",
                type: "check",
                roll: {
                    die: "d20",
                    levelModifier: "full",
                },
                progression: {
                    1: { bonus: 1 },
                    3: { bonus: 2 },
                },
            };
            const input = {
                skill,
                abilities: {},
                level: 4,
            };
            const result = resolveSkillCheck(input);
            expect(result.modifiers).toContainEqual({
                kind: "add",
                value: 4,
                origin: { category: "level", id: "level", label: "Level" },
                applied: true,
            });
            expect(result.modifiers).toContainEqual({
                kind: "add",
                value: 2,
                origin: { category: "progression", id: "class-bonus", label: "Class bonus" },
                applied: true,
            });
        });
        it("handles luck burn", () => {
            const skill = {
                id: "luck-skill",
                name: "Luck Skill",
                type: "check",
                roll: {
                    die: "d20",
                    levelModifier: "none",
                    allowLuck: true,
                },
            };
            const input = {
                skill,
                abilities: {},
                level: 1,
                luck: 12,
                luckBurn: 3,
            };
            const result = resolveSkillCheck(input);
            expect(result.modifiers).toContainEqual({
                kind: "add",
                value: 3,
                origin: { category: "luck-burn", id: "lck", label: "Luck" },
                applied: true,
            });
        });
        it("applies luck multiplier", () => {
            const skill = {
                id: "luck-mult",
                name: "Luck Multiplier Skill",
                type: "check",
                roll: {
                    die: "d20",
                    levelModifier: "none",
                    allowLuck: true,
                    luckMultiplier: 2,
                },
            };
            const input = {
                skill,
                abilities: {},
                level: 1,
                luck: 12,
                luckBurn: 3,
            };
            const result = resolveSkillCheck(input);
            expect(result.modifiers).toContainEqual({
                kind: "add",
                value: 6, // 3 * 2
                origin: { category: "luck-burn", id: "lck", label: "Luck" },
                applied: true,
            });
        });
        it("does not allow luck when not configured", () => {
            const input = {
                skill: basicSkill, // allowLuck not set
                abilities: {},
                level: 1,
                luck: 12,
                luckBurn: 3,
            };
            const result = resolveSkillCheck(input);
            expect(result.modifiers.find((m) => m.origin.category === "luck-burn")).toBeUndefined();
        });
        it("includes situational modifiers", () => {
            const input = {
                skill: basicSkill,
                abilities: {},
                level: 1,
                situationalModifiers: [
                    { kind: "add", value: -2, origin: { category: "situational", id: "darkness", label: "Darkness penalty" } },
                    { kind: "add", value: 1, origin: { category: "situational", id: "blessing", label: "Blessing" } },
                ],
            };
            const result = resolveSkillCheck(input);
            expect(result.modifiers).toContainEqual({
                kind: "add",
                value: -2,
                origin: { category: "situational", id: "darkness", label: "Darkness penalty" },
                applied: true,
            });
            expect(result.modifiers).toContainEqual({
                kind: "add",
                value: 1,
                origin: { category: "situational", id: "blessing", label: "Blessing" },
                applied: true,
            });
        });
        it("detects critical hit at max roll", () => {
            const customRoller = vi.fn().mockReturnValue(20);
            const input = {
                skill: basicSkill,
                abilities: {},
                level: 1,
            };
            const result = resolveSkillCheck(input, {
                mode: "evaluate",
                roller: customRoller,
            });
            expect(result.critical).toBe(true);
            expect(result.fumble).toBe(false);
        });
        it("detects fumble on natural 1", () => {
            const customRoller = vi.fn().mockReturnValue(1);
            const input = {
                skill: basicSkill,
                abilities: {},
                level: 1,
            };
            const result = resolveSkillCheck(input, {
                mode: "evaluate",
                roller: customRoller,
            });
            expect(result.fumble).toBe(true);
            expect(result.critical).toBe(false);
        });
        it("uses custom threat range", () => {
            const customRoller = vi.fn().mockReturnValue(19);
            const input = {
                skill: basicSkill,
                abilities: {},
                level: 1,
            };
            const result = resolveSkillCheck(input, {
                mode: "evaluate",
                roller: customRoller,
                threatRange: 19,
            });
            expect(result.critical).toBe(true);
        });
        it("fires skill check events", () => {
            const events = {
                onSkillCheckStart: vi.fn(),
                onSkillCheckComplete: vi.fn(),
            };
            const input = {
                skill: basicSkill,
                abilities: {},
                level: 1,
            };
            resolveSkillCheck(input, { mode: "formula" }, events);
            expect(events.onSkillCheckStart).toHaveBeenCalledWith(input);
            expect(events.onSkillCheckComplete).toHaveBeenCalled();
        });
        it("fires critical event", () => {
            const customRoller = vi.fn().mockReturnValue(20);
            const events = {
                onCritical: vi.fn(),
            };
            const input = {
                skill: basicSkill,
                abilities: {},
                level: 1,
            };
            resolveSkillCheck(input, { mode: "evaluate", roller: customRoller }, events);
            expect(events.onCritical).toHaveBeenCalled();
        });
        it("fires fumble event", () => {
            const customRoller = vi.fn().mockReturnValue(1);
            const events = {
                onFumble: vi.fn(),
            };
            const input = {
                skill: basicSkill,
                abilities: {},
                level: 1,
            };
            resolveSkillCheck(input, { mode: "evaluate", roller: customRoller }, events);
            expect(events.onFumble).toHaveBeenCalled();
        });
        it("tracks luck burn as resource consumed", () => {
            const events = {
                onResourceConsumed: vi.fn(),
            };
            const skill = {
                id: "luck-track",
                name: "Luck Track Skill",
                type: "check",
                roll: {
                    die: "d20",
                    levelModifier: "none",
                    allowLuck: true,
                },
            };
            const input = {
                skill,
                abilities: {},
                level: 1,
                luck: 12,
                luckBurn: 2,
            };
            const result = resolveSkillCheck(input, { mode: "formula" }, events);
            expect(events.onResourceConsumed).toHaveBeenCalledWith("luck", 2);
            expect(result.resourcesConsumed).toContainEqual({
                resource: "luck",
                amount: 2,
            });
        });
        it("tracks skill cost on fumble", () => {
            const customRoller = vi.fn().mockReturnValue(1);
            const events = {
                onResourceConsumed: vi.fn(),
            };
            const skill = {
                id: "disapproval-skill",
                name: "Disapproval Skill",
                type: "check",
                roll: {
                    die: "d20",
                    levelModifier: "none",
                },
                cost: {
                    resource: "disapproval",
                    amount: 1,
                    timing: "after-failure",
                },
            };
            const input = {
                skill,
                abilities: {},
                level: 1,
            };
            const result = resolveSkillCheck(input, { mode: "evaluate", roller: customRoller }, events);
            expect(events.onResourceConsumed).toHaveBeenCalledWith("disapproval", 1);
            expect(result.resourcesConsumed).toContainEqual({
                resource: "disapproval",
                amount: 1,
            });
        });
    });
    describe("quickSkillCheck", () => {
        it("creates and resolves a simple skill check", () => {
            const customRoller = vi.fn().mockReturnValue(15);
            const result = quickSkillCheck("test", "d20", 16, "str", 3, {
                mode: "evaluate",
                roller: customRoller,
            });
            expect(result.skillId).toBe("test");
            expect(result.die).toBe("d20");
            expect(result.natural).toBe(15);
            expect(result.total).toBe(20); // 15 + 2 (STR) + 3 (level)
        });
        it("returns formula only in default mode", () => {
            const result = quickSkillCheck("test", "d20", 14, "dex", 2);
            expect(result.formula).toBe("1d20+3"); // +1 DEX, +2 level
            expect(result.total).toBeUndefined();
        });
    });
    describe("abilityCheck", () => {
        it("creates a simple ability check", () => {
            const customRoller = vi.fn().mockReturnValue(12);
            const result = abilityCheck("str", 16, {
                mode: "evaluate",
                roller: customRoller,
            });
            expect(result.skillId).toBe("str-check");
            expect(result.die).toBe("d20");
            expect(result.natural).toBe(12);
            expect(result.total).toBe(14); // 12 + 2 (STR mod)
        });
        it("has no level modifier", () => {
            const result = abilityCheck("int", 10);
            expect(result.formula).toBe("1d20"); // No modifier for INT 10
            expect(result.modifiers.find((m) => m.origin.category === "level")).toBeUndefined();
        });
    });
    describe("savingThrow", () => {
        it("creates a saving throw with bonus", () => {
            const customRoller = vi.fn().mockReturnValue(10);
            const result = savingThrow("fort", "str", 14, 3, {
                mode: "evaluate",
                roller: customRoller,
            });
            expect(result.skillId).toBe("save-fort");
            expect(result.natural).toBe(10);
            expect(result.total).toBe(14); // 10 + 1 (STR) + 3 (save bonus)
        });
        it("includes save bonus in modifiers", () => {
            const result = savingThrow("ref", "dex", 16, 2);
            expect(result.modifiers).toContainEqual({
                kind: "add",
                value: 2,
                origin: { category: "other", id: "save-bonus", label: "Save bonus" },
                applied: true,
            });
        });
    });
});
//# sourceMappingURL=resolve.test.js.map