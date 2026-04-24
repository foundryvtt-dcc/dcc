import { describe, expect, it, vi } from "vitest";
import { rollCheck, rollAbilityCheck, rollSavingThrow, } from "./roll.js";
import { Ability, Save, CheckNamespace, parseCheckId, createCheckId, isAbilityCheckId, isSaveCheckId, isAbilityId, isSaveId, } from "./constants.js";
import { getCheckDefinition, registerCheckDefinition, hasCheckDefinition, getRegisteredCheckIds, getCheckIdsByNamespace, } from "./definitions.js";
import { DEFAULT_ACCESSORS, extractAbilityScores, } from "./accessors.js";
/**
 * Create a mock character for testing
 */
function createMockCharacter(overrides) {
    return {
        identity: {
            id: "test-char",
            name: "Test Character",
            occupation: "Farmer",
            alignment: "n",
            birthAugur: {
                id: "test-augur",
                name: "Test Augur",
                effect: "Test effect",
                modifies: "attack",
                multiplier: 1,
            },
            startingLuck: 10,
            languages: ["Common"],
        },
        classInfo: {
            classId: "warrior",
            level: 3,
        },
        state: {
            hp: { current: 20, max: 20, temp: 0 },
            abilities: {
                str: { current: 16, max: 16 }, // +2 modifier
                agl: { current: 14, max: 14 }, // +1 modifier
                sta: { current: 12, max: 12 }, // 0 modifier
                per: { current: 10, max: 10 }, // 0 modifier
                int: { current: 8, max: 8 }, // -1 modifier
                lck: { current: 13, max: 13 }, // +1 modifier
            },
            xp: { current: 50, nextLevel: 100 },
            saves: {
                reflex: 2,
                fortitude: 3,
                will: 1,
            },
            combat: {
                attackBonus: 3,
                actionDice: ["d20"],
                critDie: "d12",
                critTable: "III",
                threatRange: 20,
                ac: 14,
                speed: 30,
                initiative: 1,
            },
            currency: { pp: 0, ep: 0, gp: 10, sp: 5, cp: 20 },
            inventory: { items: [] },
            conditions: [],
        },
        ...overrides,
    };
}
describe("checks", () => {
    describe("constants", () => {
        describe("Ability", () => {
            it("has namespaced ability IDs", () => {
                expect(Ability.STR).toBe("ability:str");
                expect(Ability.AGL).toBe("ability:agl");
                expect(Ability.STA).toBe("ability:sta");
                expect(Ability.PER).toBe("ability:per");
                expect(Ability.INT).toBe("ability:int");
                expect(Ability.LCK).toBe("ability:lck");
            });
        });
        describe("Save", () => {
            it("has namespaced save IDs", () => {
                expect(Save.REF).toBe("save:reflex");
                expect(Save.FORT).toBe("save:fortitude");
                expect(Save.WIL).toBe("save:will");
            });
        });
        describe("parseCheckId", () => {
            it("parses namespaced IDs", () => {
                expect(parseCheckId("ability:str")).toEqual({
                    namespace: "ability",
                    value: "str",
                    raw: "ability:str",
                });
                expect(parseCheckId("save:reflex")).toEqual({
                    namespace: "save",
                    value: "reflex",
                    raw: "save:reflex",
                });
                expect(parseCheckId("skill:backstab")).toEqual({
                    namespace: "skill",
                    value: "backstab",
                    raw: "skill:backstab",
                });
            });
            it("handles non-namespaced IDs", () => {
                expect(parseCheckId("str")).toEqual({
                    namespace: null,
                    value: "str",
                    raw: "str",
                });
            });
            it("handles unknown namespaces as non-namespaced", () => {
                expect(parseCheckId("unknown:foo")).toEqual({
                    namespace: null,
                    value: "unknown:foo",
                    raw: "unknown:foo",
                });
            });
        });
        describe("createCheckId", () => {
            it("creates namespaced IDs", () => {
                expect(createCheckId(CheckNamespace.ABILITY, "str")).toBe("ability:str");
                expect(createCheckId(CheckNamespace.SAVE, "reflex")).toBe("save:reflex");
                expect(createCheckId(CheckNamespace.SKILL, "backstab")).toBe("skill:backstab");
            });
        });
        describe("isAbilityCheckId", () => {
            it("returns true for valid namespaced ability IDs", () => {
                expect(isAbilityCheckId("ability:str")).toBe(true);
                expect(isAbilityCheckId("ability:agl")).toBe(true);
            });
            it("returns false for non-ability IDs", () => {
                expect(isAbilityCheckId("save:reflex")).toBe(false);
                expect(isAbilityCheckId("str")).toBe(false);
                expect(isAbilityCheckId("ability:unknown")).toBe(false);
            });
        });
        describe("isSaveCheckId", () => {
            it("returns true for valid namespaced save IDs", () => {
                expect(isSaveCheckId("save:reflex")).toBe(true);
                expect(isSaveCheckId("save:fortitude")).toBe(true);
                expect(isSaveCheckId("save:will")).toBe(true);
            });
            it("returns false for non-save IDs", () => {
                expect(isSaveCheckId("ability:str")).toBe(false);
                expect(isSaveCheckId("reflex")).toBe(false);
                expect(isSaveCheckId("save:unknown")).toBe(false);
            });
        });
        describe("isAbilityId (raw)", () => {
            it("returns true for valid raw ability IDs", () => {
                expect(isAbilityId("str")).toBe(true);
                expect(isAbilityId("agl")).toBe(true);
            });
            it("returns false for invalid IDs", () => {
                expect(isAbilityId("ability:str")).toBe(false);
                expect(isAbilityId("cha")).toBe(false);
            });
        });
        describe("isSaveId (raw)", () => {
            it("returns true for valid raw save IDs", () => {
                expect(isSaveId("reflex")).toBe(true);
                expect(isSaveId("fortitude")).toBe(true);
                expect(isSaveId("will")).toBe(true);
            });
            it("returns false for invalid IDs", () => {
                expect(isSaveId("save:reflex")).toBe(false);
                expect(isSaveId("ref")).toBe(false);
            });
        });
    });
    describe("definitions", () => {
        describe("getCheckDefinition", () => {
            it("returns ability check definitions by namespaced ID", () => {
                const strCheck = getCheckDefinition("ability:str");
                expect(strCheck).toBeDefined();
                expect(strCheck?.id).toBe("ability:str");
                expect(strCheck?.name).toBe("Strength Check");
                expect(strCheck?.roll?.ability).toBe("str");
            });
            it("returns save definitions by namespaced ID", () => {
                const refSave = getCheckDefinition("save:reflex");
                expect(refSave).toBeDefined();
                expect(refSave?.id).toBe("save:reflex");
                expect(refSave?.name).toBe("Reflex Save");
                // Save definitions intentionally omit roll.ability — the save
                // bonus pulled via getSaveBonus is already the full total
                // (class + ability mod). See createSaveDefinition.
                expect(refSave?.roll?.ability).toBeUndefined();
            });
            it("returns undefined for non-namespaced IDs", () => {
                expect(getCheckDefinition("str")).toBeUndefined();
                expect(getCheckDefinition("reflex")).toBeUndefined();
            });
            it("returns undefined for unknown IDs", () => {
                expect(getCheckDefinition("ability:unknown")).toBeUndefined();
            });
        });
        describe("registerCheckDefinition", () => {
            it("registers a custom check definition", () => {
                const customSkill = {
                    id: "skill:custom-test",
                    name: "Custom Test Skill",
                    type: "check",
                    roll: {
                        die: "d20",
                        ability: "str",
                        levelModifier: "full",
                    },
                };
                registerCheckDefinition(customSkill);
                expect(hasCheckDefinition("skill:custom-test")).toBe(true);
                expect(getCheckDefinition("skill:custom-test")).toEqual(customSkill);
            });
        });
        describe("getRegisteredCheckIds", () => {
            it("returns all registered namespaced check IDs", () => {
                const ids = getRegisteredCheckIds();
                // Should include all abilities (namespaced)
                expect(ids).toContain("ability:str");
                expect(ids).toContain("ability:agl");
                // Should include all saves (namespaced)
                expect(ids).toContain("save:reflex");
                expect(ids).toContain("save:fortitude");
                expect(ids).toContain("save:will");
            });
        });
        describe("getCheckIdsByNamespace", () => {
            it("returns only ability check IDs", () => {
                const ids = getCheckIdsByNamespace(CheckNamespace.ABILITY);
                expect(ids).toContain("ability:str");
                expect(ids).not.toContain("save:reflex");
            });
            it("returns only save check IDs", () => {
                const ids = getCheckIdsByNamespace(CheckNamespace.SAVE);
                expect(ids).toContain("save:reflex");
                expect(ids).not.toContain("ability:str");
            });
        });
    });
    describe("rollCheck", () => {
        describe("ability checks", () => {
            it("rolls a strength check using Ability constant", () => {
                const character = createMockCharacter();
                const result = rollCheck(Ability.STR, character);
                expect(result.skillId).toBe("ability:str");
                expect(result.die).toBe("d20");
                // STR 16 = +2 modifier, no level modifier for ability checks
                expect(result.formula).toBe("1d20+2");
            });
            it("rolls an intelligence check with negative modifier", () => {
                const character = createMockCharacter();
                const result = rollCheck(Ability.INT, character);
                // INT 8 = -1 modifier
                expect(result.formula).toBe("1d20-1");
            });
            it("evaluates the roll with custom roller", () => {
                const character = createMockCharacter();
                const customRoller = vi.fn().mockReturnValue(15);
                const result = rollCheck(Ability.STR, character, {
                    mode: "evaluate",
                    roller: customRoller,
                });
                expect(result.natural).toBe(15);
                expect(result.total).toBe(17); // 15 + 2 (STR mod)
            });
        });
        describe("saving throws", () => {
            // state.saves[id] is the FULL save (class + ability mod) per
            // calculateSavingThrows. Save check definitions deliberately omit
            // roll.ability so the resolver does NOT add the governing ability
            // mod a second time. Mock saves: reflex=2, fortitude=3, will=1.
            it("rolls a reflex save using Save constant", () => {
                const character = createMockCharacter();
                const result = rollCheck(Save.REF, character);
                expect(result.skillId).toBe("save:reflex");
                expect(result.die).toBe("d20");
                expect(result.formula).toBe("1d20+2");
            });
            it("rolls a fortitude save", () => {
                const character = createMockCharacter();
                const result = rollCheck(Save.FORT, character);
                expect(result.formula).toBe("1d20+3");
            });
            it("rolls a will save", () => {
                const character = createMockCharacter();
                const result = rollCheck(Save.WIL, character);
                expect(result.formula).toBe("1d20+1");
            });
            it("evaluates saving throw with correct total", () => {
                const character = createMockCharacter();
                const customRoller = vi.fn().mockReturnValue(12);
                const result = rollCheck(Save.REF, character, {
                    mode: "evaluate",
                    roller: customRoller,
                });
                expect(result.natural).toBe(12);
                expect(result.total).toBe(14); // 12 + 2 (saves.reflex)
            });
        });
        describe("custom checks", () => {
            it("accepts a SkillDefinition directly", () => {
                const character = createMockCharacter();
                const customSkill = {
                    id: "skill:custom",
                    name: "Custom Skill",
                    type: "check",
                    roll: {
                        die: "d24",
                        ability: "str",
                        levelModifier: "full",
                    },
                };
                const result = rollCheck(customSkill, character);
                expect(result.skillId).toBe("skill:custom");
                expect(result.die).toBe("d24");
                // STR 16 = +2, level 3 = +3
                expect(result.formula).toBe("1d24+5");
            });
            it("accepts an inline config", () => {
                const character = createMockCharacter();
                const result = rollCheck({ ability: "agl", die: "d16", name: "Acrobatics" }, character);
                expect(result.skillId).toBe("ability:agl");
                expect(result.die).toBe("d16");
                // AGL 14 = +1
                expect(result.formula).toBe("1d16+1");
            });
            it("inline config defaults to d20", () => {
                const character = createMockCharacter();
                const result = rollCheck({ ability: "str" }, character);
                expect(result.die).toBe("d20");
            });
        });
        describe("modifiers", () => {
            it("applies situational modifiers", () => {
                const character = createMockCharacter();
                const result = rollCheck(Ability.STR, character, {
                    modifiers: [
                        { kind: "add", value: 1, origin: { category: "situational", id: "bless", label: "Bless" } },
                        { kind: "add", value: -2, origin: { category: "situational", id: "prone", label: "Prone" } },
                    ],
                });
                // STR +2, bless +1, prone -2 → additive sum = +1 → "1d20+1"
                expect(result.formula).toBe("1d20+1");
                expect(result.modifiers).toContainEqual({
                    kind: "add",
                    value: 1,
                    origin: { category: "situational", id: "bless", label: "Bless" },
                    applied: true,
                });
            });
            it("applies luck burn when skill allows it", () => {
                const character = createMockCharacter();
                const luckSkill = {
                    id: "skill:luck-test",
                    name: "Luck Test",
                    type: "check",
                    roll: {
                        die: "d20",
                        ability: "str",
                        levelModifier: "none",
                        allowLuck: true,
                    },
                };
                const result = rollCheck(luckSkill, character, {
                    luckBurn: 3,
                });
                // STR +2, luck burn +3
                expect(result.formula).toBe("1d20+5");
                expect(result.resourcesConsumed).toContainEqual({
                    resource: "luck",
                    amount: 3,
                });
            });
        });
        describe("events", () => {
            it("fires events during resolution", () => {
                const character = createMockCharacter();
                const events = {
                    onSkillCheckStart: vi.fn(),
                    onSkillCheckComplete: vi.fn(),
                };
                rollCheck(Ability.STR, character, { events });
                expect(events.onSkillCheckStart).toHaveBeenCalled();
                expect(events.onSkillCheckComplete).toHaveBeenCalled();
            });
            it("fires critical event on natural max", () => {
                const character = createMockCharacter();
                const customRoller = vi.fn().mockReturnValue(20);
                const events = {
                    onCritical: vi.fn(),
                };
                const result = rollCheck(Ability.STR, character, {
                    mode: "evaluate",
                    roller: customRoller,
                    events,
                });
                expect(result.critical).toBe(true);
                expect(events.onCritical).toHaveBeenCalled();
            });
            it("fires fumble event on natural 1", () => {
                const character = createMockCharacter();
                const customRoller = vi.fn().mockReturnValue(1);
                const events = {
                    onFumble: vi.fn(),
                };
                const result = rollCheck(Ability.STR, character, {
                    mode: "evaluate",
                    roller: customRoller,
                    events,
                });
                expect(result.fumble).toBe(true);
                expect(events.onFumble).toHaveBeenCalled();
            });
        });
        describe("0-level characters", () => {
            it("handles characters without classInfo", () => {
                const character = createMockCharacter();
                character.classInfo = undefined;
                const result = rollCheck(Ability.STR, character);
                // Should still work, just no level bonus
                expect(result.skillId).toBe("ability:str");
                expect(result.formula).toBe("1d20+2");
            });
        });
        describe("error handling", () => {
            it("throws for unknown namespaced check ID", () => {
                const character = createMockCharacter();
                expect(() => rollCheck("ability:unknown", character)).toThrow("Unknown check ID: ability:unknown");
            });
            it("throws for non-namespaced check ID", () => {
                const character = createMockCharacter();
                expect(() => rollCheck("str", character)).toThrow("Unknown check ID: str");
            });
        });
    });
    describe("rollAbilityCheck", () => {
        it("rolls an ability check with namespaced ID", () => {
            const character = createMockCharacter();
            const result = rollAbilityCheck(Ability.STR, character);
            expect(result.skillId).toBe("ability:str");
            expect(result.formula).toBe("1d20+2");
        });
        it("handles raw ability IDs with inline config", () => {
            const character = createMockCharacter();
            const result = rollAbilityCheck("mojo", character);
            // Raw ID becomes inline config
            expect(result.skillId).toBe("ability:mojo");
            expect(result.die).toBe("d20");
        });
    });
    describe("rollSavingThrow", () => {
        it("rolls a saving throw with namespaced ID", () => {
            const character = createMockCharacter();
            const result = rollSavingThrow(Save.REF, character);
            expect(result.skillId).toBe("save:reflex");
            // state.saves.reflex is the FULL bonus (class + ability mod) per
            // calculateSavingThrows. The save check definition deliberately
            // omits roll.ability so the resolver does NOT add the governing
            // ability mod a second time. Mock saves.reflex = 2 → formula 1d20+2.
            expect(result.formula).toBe("1d20+2");
        });
        it("handles raw save IDs by namespacing them", () => {
            const character = createMockCharacter();
            const result = rollSavingThrow("reflex", character);
            expect(result.skillId).toBe("save:reflex");
            expect(result.formula).toBe("1d20+2");
        });
        it("includes save bonus in modifiers", () => {
            const character = createMockCharacter();
            const result = rollSavingThrow(Save.FORT, character);
            expect(result.modifiers).toContainEqual({
                kind: "add",
                value: 3,
                origin: { category: "other", id: "save-bonus", label: "Save bonus" },
                applied: true,
            });
        });
        // Regression: ensure the save check does not double-count the
        // governing ability modifier. Repro from
        // FoundryVTT-Next/Data/systems/dcc Cheesemaker (sta 14, level 0,
        // saves.fortitude = +1): formula must be 1d20+1, not 1d20+2.
        it("does not double-count ability mod into save bonus", () => {
            const character = createMockCharacter({
                classInfo: undefined,
                state: {
                    ...createMockCharacter().state,
                    abilities: {
                        str: { current: 15, max: 15 },
                        agl: { current: 11, max: 11 },
                        sta: { current: 14, max: 14 }, // +1 modifier
                        per: { current: 17, max: 17 },
                        int: { current: 16, max: 16 },
                        lck: { current: 16, max: 16 },
                    },
                    saves: { reflex: 0, fortitude: 1, will: 2 },
                },
            });
            const result = rollSavingThrow(Save.FORT, character);
            expect(result.formula).toBe("1d20+1");
            // The fortitude `add` modifier carries the full save value, with
            // no separate `ability:sta` modifier piled on top.
            const abilityMod = result.modifiers.find((m) => m.origin.category === "ability");
            expect(abilityMod).toBeUndefined();
        });
    });
    describe("accessors", () => {
        describe("DEFAULT_ACCESSORS", () => {
            it("getAbilityScore extracts from state.abilities[id].current", () => {
                const character = createMockCharacter();
                expect(DEFAULT_ACCESSORS.getAbilityScore(character, "str")).toBe(16);
                expect(DEFAULT_ACCESSORS.getAbilityScore(character, "agl")).toBe(14);
                expect(DEFAULT_ACCESSORS.getAbilityScore(character, "int")).toBe(8);
            });
            it("getAbilityScore returns undefined for unknown abilities", () => {
                const character = createMockCharacter();
                expect(DEFAULT_ACCESSORS.getAbilityScore(character, "unknown")).toBeUndefined();
            });
            it("getSaveBonus extracts from state.saves[id]", () => {
                const character = createMockCharacter();
                expect(DEFAULT_ACCESSORS.getSaveBonus(character, "reflex")).toBe(2);
                expect(DEFAULT_ACCESSORS.getSaveBonus(character, "fortitude")).toBe(3);
                expect(DEFAULT_ACCESSORS.getSaveBonus(character, "will")).toBe(1);
            });
            it("getSaveBonus returns 0 for unknown saves", () => {
                const character = createMockCharacter();
                expect(DEFAULT_ACCESSORS.getSaveBonus(character, "unknown")).toBe(0);
            });
            it("getLevel extracts from classInfo.level", () => {
                const character = createMockCharacter();
                expect(DEFAULT_ACCESSORS.getLevel(character)).toBe(3);
            });
            it("getLevel returns 0 for 0-level characters", () => {
                const character = createMockCharacter();
                character.classInfo = undefined;
                expect(DEFAULT_ACCESSORS.getLevel(character)).toBe(0);
            });
            it("getLuck extracts from state.abilities.lck.current", () => {
                const character = createMockCharacter();
                expect(DEFAULT_ACCESSORS.getLuck(character)).toBe(13);
            });
            it("getClassId extracts from classInfo.classId", () => {
                const character = createMockCharacter();
                expect(DEFAULT_ACCESSORS.getClassId(character)).toBe("warrior");
            });
        });
        describe("extractAbilityScores", () => {
            it("extracts all standard abilities", () => {
                const character = createMockCharacter();
                const scores = extractAbilityScores(character);
                expect(scores).toEqual({
                    str: 16,
                    agl: 14,
                    sta: 12,
                    per: 10,
                    int: 8,
                    lck: 13,
                });
            });
            it("extracts only specified abilities", () => {
                const character = createMockCharacter();
                const scores = extractAbilityScores(character, DEFAULT_ACCESSORS, ["str", "agl"]);
                expect(scores).toEqual({
                    str: 16,
                    agl: 14,
                });
            });
        });
        describe("custom accessors", () => {
            it("uses custom accessors when provided", () => {
                const character = createMockCharacter();
                // Custom accessor that doubles all ability scores
                const customAccessors = {
                    ...DEFAULT_ACCESSORS,
                    getAbilityScore: (char, id) => {
                        const score = DEFAULT_ACCESSORS.getAbilityScore(char, id);
                        return score !== undefined ? score * 2 : undefined;
                    },
                };
                const result = rollCheck(Ability.STR, character, {
                    accessors: customAccessors,
                    mode: "formula",
                });
                // STR 32 (16 * 2) → modifier would be off chart
                // This test verifies the accessor is being used
                expect(result.formula).not.toBe("1d20+2"); // Original would be +2 for STR 16
            });
            it("allows extending with additional abilities", () => {
                const character = createMockCharacter();
                // Extend the character with a custom ability
                const extendedChar = {
                    ...character,
                    state: {
                        ...character.state,
                        abilities: {
                            ...character.state.abilities,
                            psy: { current: 18, max: 18 },
                        },
                    },
                };
                // Custom accessor that can handle 'psy'
                const mccAccessors = {
                    ...DEFAULT_ACCESSORS,
                    getAbilityScore: (char, id) => {
                        const abilities = char.state.abilities;
                        return abilities[id]?.current;
                    },
                };
                const result = rollCheck({ ability: "psy", name: "Psychic Check" }, extendedChar, {
                    accessors: mccAccessors,
                    additionalAbilities: ["psy"],
                });
                // PSY 18 = +3 modifier
                expect(result.formula).toBe("1d20+3");
            });
        });
    });
});
//# sourceMappingURL=roll.test.js.map