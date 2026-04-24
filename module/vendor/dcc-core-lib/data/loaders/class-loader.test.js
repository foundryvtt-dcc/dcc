import { describe, expect, it } from "vitest";
import { parseClassLevel, loadClassProgression, getSkillBonusFromProgression, } from "./class-loader.js";
describe("class-loader", () => {
    describe("parseClassLevel", () => {
        it("parses base level data", () => {
            const raw = {
                class: "thief",
                level: "1",
                levelData: "system.details.attackBonus=+0\n" +
                    "system.attributes.critical.die=1d10\n" +
                    "system.attributes.critical.table=II\n" +
                    "system.attributes.actionDice.value=1d20\n" +
                    "system.attributes.hitDice.value=1d6\n" +
                    "system.class.luckDie=d3\n" +
                    "system.saves.ref.classBonus=+1\n" +
                    "system.saves.frt.classBonus=+1\n" +
                    "system.saves.wil.classBonus=+0\n",
            };
            const result = parseClassLevel(raw);
            expect(result.attackBonus).toBe(0);
            expect(result.criticalDie).toBe("1d10");
            expect(result.criticalTable).toBe("II");
            expect(result.actionDice).toEqual(["1d20"]);
            expect(result.hitDie).toBe("1d6");
            expect(result.luckDie).toBe("d3");
            expect(result.saves).toEqual({ ref: 1, frt: 1, wil: 0 });
        });
        it("parses warrior attack bonus as die", () => {
            const raw = {
                class: "warrior",
                level: "1",
                levelData: "system.details.attackBonus=+d3\n" +
                    "system.attributes.critical.die=1d12\n" +
                    "system.attributes.critical.table=III\n" +
                    "system.details.critRange=19\n" +
                    "system.attributes.actionDice.value=1d20\n" +
                    "system.attributes.hitDice.value=1d12\n" +
                    "system.saves.ref.classBonus=+1\n" +
                    "system.saves.frt.classBonus=+1\n" +
                    "system.saves.wil.classBonus=+0\n",
            };
            const result = parseClassLevel(raw);
            expect(result.attackBonus).toBe("d3");
            expect(result.critRange).toBe(19);
        });
        it("parses alignment-specific skill bonuses", () => {
            const raw = {
                class: "thief",
                level: "1",
                levelData: "system.details.attackBonus=+0\n" +
                    "system.attributes.critical.die=1d10\n" +
                    "system.attributes.critical.table=II\n" +
                    "system.attributes.actionDice.value=1d20\n" +
                    "system.attributes.hitDice.value=1d6\n" +
                    "system.saves.ref.classBonus=+1\n" +
                    "system.saves.frt.classBonus=+1\n" +
                    "system.saves.wil.classBonus=+0\n",
                levelDataLawful: "system.details.title.value=Bravo\n" +
                    "system.class.backstab=+1\n" +
                    "system.skills.sneakSilently.value=+1\n" +
                    "system.skills.hideInShadows.value=+3\n" +
                    "system.skills.pickPockets.value=+1\n" +
                    "system.skills.climbSheerSurfaces.value=+3\n" +
                    "system.skills.pickLock.value=+1\n" +
                    "system.skills.findTrap.value=+3\n" +
                    "system.skills.disableTrap.value=+3\n" +
                    "system.skills.forgeDocument.value=+0\n" +
                    "system.skills.disguiseSelf.value=+0\n" +
                    "system.skills.readLanguages.value=+0\n" +
                    "system.skills.handlePoison.value=+0\n" +
                    "system.skills.castSpellFromScroll.die=d10\n",
                levelDataNeutral: "system.details.title.value=Beggar\n" +
                    "system.class.backstab=+0\n" +
                    "system.skills.sneakSilently.value=+3\n" +
                    "system.skills.hideInShadows.value=+1\n" +
                    "system.skills.castSpellFromScroll.die=d12\n",
                levelDataChaotic: "system.details.title.value=Thug\n" +
                    "system.class.backstab=+3\n" +
                    "system.skills.handlePoison.value=+3\n" +
                    "system.skills.castSpellFromScroll.die=d10\n",
            };
            const result = parseClassLevel(raw);
            // Check lawful
            expect(result.lawful?.title).toBe("Bravo");
            expect(result.lawful?.skills["backstab"]).toBe(1);
            expect(result.lawful?.skills["sneak-silently"]).toBe(1);
            expect(result.lawful?.skills["hide-in-shadows"]).toBe(3);
            expect(result.lawful?.skills["cast-spell-from-scroll"]).toBe("d10");
            // Check neutral
            expect(result.neutral?.title).toBe("Beggar");
            expect(result.neutral?.skills["backstab"]).toBe(0);
            expect(result.neutral?.skills["sneak-silently"]).toBe(3);
            expect(result.neutral?.skills["cast-spell-from-scroll"]).toBe("d12");
            // Check chaotic
            expect(result.chaotic?.title).toBe("Thug");
            expect(result.chaotic?.skills["backstab"]).toBe(3);
            expect(result.chaotic?.skills["handle-poison"]).toBe(3);
        });
        it("parses multiple action dice", () => {
            const raw = {
                class: "thief",
                level: "6",
                levelData: "system.details.attackBonus=+4\n" +
                    "system.attributes.critical.die=1d24\n" +
                    "system.attributes.critical.table=II\n" +
                    "system.attributes.actionDice.value=1d20,1d14\n" +
                    "system.attributes.hitDice.value=1d6\n" +
                    "system.saves.ref.classBonus=+4\n" +
                    "system.saves.frt.classBonus=+2\n" +
                    "system.saves.wil.classBonus=+2\n",
            };
            const result = parseClassLevel(raw);
            expect(result.actionDice).toEqual(["1d20", "1d14"]);
        });
    });
    describe("loadClassProgression", () => {
        it("loads multiple levels into progression", () => {
            const rawLevels = [
                {
                    class: "thief",
                    level: "1",
                    levelData: "system.details.attackBonus=+0\n" +
                        "system.attributes.critical.die=1d10\n" +
                        "system.attributes.critical.table=II\n" +
                        "system.attributes.actionDice.value=1d20\n" +
                        "system.attributes.hitDice.value=1d6\n" +
                        "system.saves.ref.classBonus=+1\n" +
                        "system.saves.frt.classBonus=+1\n" +
                        "system.saves.wil.classBonus=+0\n",
                    levelDataLawful: "system.details.title.value=Bravo\n" +
                        "system.skills.hideInShadows.value=+3\n",
                },
                {
                    class: "thief",
                    level: "2",
                    levelData: "system.details.attackBonus=+1\n" +
                        "system.attributes.critical.die=1d12\n" +
                        "system.attributes.critical.table=II\n" +
                        "system.attributes.actionDice.value=1d20\n" +
                        "system.attributes.hitDice.value=1d6\n" +
                        "system.saves.ref.classBonus=+1\n" +
                        "system.saves.frt.classBonus=+1\n" +
                        "system.saves.wil.classBonus=+0\n",
                    levelDataLawful: "system.details.title.value=Apprentice\n" +
                        "system.skills.hideInShadows.value=+5\n",
                },
            ];
            const progression = loadClassProgression("thief", "Thief", ["hide-in-shadows", "sneak-silently"], rawLevels);
            expect(progression.classId).toBe("thief");
            expect(progression.name).toBe("Thief");
            expect(progression.skills).toContain("hide-in-shadows");
            expect(progression.levels[1]?.attackBonus).toBe(0);
            expect(progression.levels[2]?.attackBonus).toBe(1);
            expect(progression.levels[1]?.lawful?.skills["hide-in-shadows"]).toBe(3);
            expect(progression.levels[2]?.lawful?.skills["hide-in-shadows"]).toBe(5);
        });
    });
    describe("getSkillBonusFromProgression", () => {
        it("returns skill bonus for alignment and level", () => {
            const rawLevels = [
                {
                    class: "thief",
                    level: "3",
                    levelData: "system.details.attackBonus=+2\n" +
                        "system.attributes.critical.die=1d14\n" +
                        "system.attributes.critical.table=II\n" +
                        "system.attributes.actionDice.value=1d20\n" +
                        "system.attributes.hitDice.value=1d6\n" +
                        "system.saves.ref.classBonus=+2\n" +
                        "system.saves.frt.classBonus=+1\n" +
                        "system.saves.wil.classBonus=+1\n",
                    levelDataLawful: "system.details.title.value=Rogue\n" +
                        "system.skills.hideInShadows.value=+7\n",
                    levelDataNeutral: "system.details.title.value=Burglar\n" +
                        "system.skills.hideInShadows.value=+5\n",
                    levelDataChaotic: "system.details.title.value=Cutthroat\n" +
                        "system.skills.hideInShadows.value=+5\n",
                },
            ];
            const progression = loadClassProgression("thief", "Thief", ["hide-in-shadows"], rawLevels);
            expect(getSkillBonusFromProgression(progression, 3, "lawful", "hide-in-shadows")).toBe(7);
            expect(getSkillBonusFromProgression(progression, 3, "neutral", "hide-in-shadows")).toBe(5);
            expect(getSkillBonusFromProgression(progression, 3, "chaotic", "hide-in-shadows")).toBe(5);
        });
        it("returns undefined for missing level", () => {
            const rawLevels = [
                {
                    class: "thief",
                    level: "1",
                    levelData: "system.details.attackBonus=+0\n" +
                        "system.attributes.critical.die=1d10\n" +
                        "system.attributes.critical.table=II\n" +
                        "system.attributes.actionDice.value=1d20\n" +
                        "system.attributes.hitDice.value=1d6\n" +
                        "system.saves.ref.classBonus=+1\n" +
                        "system.saves.frt.classBonus=+1\n" +
                        "system.saves.wil.classBonus=+0\n",
                },
            ];
            const progression = loadClassProgression("thief", "Thief", [], rawLevels);
            expect(getSkillBonusFromProgression(progression, 5, "lawful", "hide-in-shadows")).toBeUndefined();
        });
        it("returns die type for cast-spell-from-scroll", () => {
            const rawLevels = [
                {
                    class: "thief",
                    level: "5",
                    levelData: "system.details.attackBonus=+3\n" +
                        "system.attributes.critical.die=1d20\n" +
                        "system.attributes.critical.table=II\n" +
                        "system.attributes.actionDice.value=1d20\n" +
                        "system.attributes.hitDice.value=1d6\n" +
                        "system.saves.ref.classBonus=+3\n" +
                        "system.saves.frt.classBonus=+2\n" +
                        "system.saves.wil.classBonus=+1\n",
                    levelDataNeutral: "system.details.title.value=Swindler\n" +
                        "system.skills.castSpellFromScroll.die=d16\n",
                },
            ];
            const progression = loadClassProgression("thief", "Thief", [], rawLevels);
            expect(getSkillBonusFromProgression(progression, 5, "neutral", "cast-spell-from-scroll")).toBe("d16");
        });
    });
});
//# sourceMappingURL=class-loader.test.js.map