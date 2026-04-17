/**
 * Integration tests using real source data files
 *
 * These tests verify that the loaders work correctly with actual
 * FoundryVTT DCC data files.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadClassProgression, parseClassLevel, getSkillBonusFromProgression, } from "./class-loader.js";
import { loadBirthAugurs, loadRollableTable } from "./table-loader.js";
const SOURCE_DATA_PATH = join(process.cwd(), "source_data");
/**
 * Helper to load a JSON file from source_data
 */
function loadLevelItem(subpath) {
    const fullPath = join(SOURCE_DATA_PATH, subpath);
    const content = readFileSync(fullPath, "utf-8");
    return JSON.parse(content);
}
/**
 * Helper to load a table JSON file from source_data
 */
function loadTableData(subpath) {
    const fullPath = join(SOURCE_DATA_PATH, subpath);
    const content = readFileSync(fullPath, "utf-8");
    return JSON.parse(content);
}
/**
 * Helper to extract level data from FoundryVTT item format
 */
function extractLevelData(item) {
    const result = {
        class: item.system.class,
        level: item.system.level,
        levelData: item.system.levelData,
    };
    // Conditionally assign optional properties (exactOptionalPropertyTypes)
    if (item.system.levelDataLawful) {
        result.levelDataLawful = item.system.levelDataLawful;
    }
    if (item.system.levelDataNeutral) {
        result.levelDataNeutral = item.system.levelDataNeutral;
    }
    if (item.system.levelDataChaotic) {
        result.levelDataChaotic = item.system.levelDataChaotic;
    }
    return result;
}
describe("Integration: Real Source Data", () => {
    describe("Thief Class Progression", () => {
        it("loads thief level 1 data correctly", () => {
            const rawItem = loadLevelItem("dcc-class-level-data/src/thief_1_SDz1gXt6oqV9UIRs.json");
            const raw = extractLevelData(rawItem);
            const level = parseClassLevel(raw);
            // Base stats
            expect(level.attackBonus).toBe(0);
            expect(level.criticalDie).toBe("1d10");
            expect(level.criticalTable).toBe("II");
            expect(level.hitDie).toBe("1d6");
            expect(level.luckDie).toBe("d3");
            expect(level.saves).toEqual({ ref: 1, frt: 1, wil: 0 });
            // Lawful alignment
            expect(level.lawful?.title).toBe("Bravo");
            expect(level.lawful?.skills["backstab"]).toBe(1);
            expect(level.lawful?.skills["hide-in-shadows"]).toBe(3);
            expect(level.lawful?.skills["cast-spell-from-scroll"]).toBe("d10");
            // Neutral alignment
            expect(level.neutral?.title).toBe("Beggar");
            expect(level.neutral?.skills["backstab"]).toBe(0);
            expect(level.neutral?.skills["sneak-silently"]).toBe(3);
            expect(level.neutral?.skills["cast-spell-from-scroll"]).toBe("d12");
            // Chaotic alignment
            expect(level.chaotic?.title).toBe("Thug");
            expect(level.chaotic?.skills["backstab"]).toBe(3);
            expect(level.chaotic?.skills["handle-poison"]).toBe(3);
        });
        it("loads thief level 5 data correctly", () => {
            const rawItem = loadLevelItem("dcc-class-level-data/src/thief_5_vF0SqRJVUCaC6RJL.json");
            const raw = extractLevelData(rawItem);
            const level = parseClassLevel(raw);
            // Base stats at level 5
            expect(level.attackBonus).toBe(3);
            expect(level.criticalDie).toBe("1d20");
            expect(level.luckDie).toBe("d7");
            expect(level.saves).toEqual({ ref: 3, frt: 2, wil: 1 });
            // Skill bonuses should be higher at level 5
            expect(level.lawful?.skills["hide-in-shadows"]).toBe(9);
            expect(level.neutral?.skills["forge-document"]).toBe(9);
            expect(level.chaotic?.skills["backstab"]).toBe(9);
        });
        it("loads complete thief progression", () => {
            const levelFiles = [
                "thief_1_SDz1gXt6oqV9UIRs.json",
                "thief_2_XbDE7bvpOOxVOoNv.json",
                "thief_3_nT8sz4rKlKPyvrP5.json",
                "thief_4_Tr5zIoJjdxjRn6GR.json",
                "thief_5_vF0SqRJVUCaC6RJL.json",
                "thief_6_Mk2MxCeryXgOwRXr.json",
                "thief_7_Ur1eHrczCtYmpdS8.json",
                "thief_8_eoF08Xovht4KcARs.json",
                "thief_9_HsYGd8naab7qduyE.json",
                "thief_10_RNtQBaKFB6J4vqhe.json",
            ];
            const rawLevels = levelFiles.map((file) => {
                const rawItem = loadLevelItem(`dcc-class-level-data/src/${file}`);
                return extractLevelData(rawItem);
            });
            const progression = loadClassProgression("thief", "Thief", [
                "backstab",
                "sneak-silently",
                "hide-in-shadows",
                "pick-pockets",
                "climb-sheer-surfaces",
                "pick-lock",
                "find-trap",
                "disable-trap",
                "forge-document",
                "disguise-self",
                "read-languages",
                "handle-poison",
                "cast-spell-from-scroll",
            ], rawLevels);
            // Verify all 10 levels loaded
            expect(Object.keys(progression.levels)).toHaveLength(10);
            // Verify progression increases
            expect(progression.levels[1]?.attackBonus).toBe(0);
            expect(progression.levels[5]?.attackBonus).toBe(3);
            expect(progression.levels[10]?.attackBonus).toBe(7);
            // Test skill bonus lookup
            expect(getSkillBonusFromProgression(progression, 1, "lawful", "hide-in-shadows")).toBe(3);
            expect(getSkillBonusFromProgression(progression, 5, "lawful", "hide-in-shadows")).toBe(9);
            expect(getSkillBonusFromProgression(progression, 10, "lawful", "hide-in-shadows")).toBe(15); // Actual value from source data
            // Test die-based skill (cast spell from scroll)
            expect(getSkillBonusFromProgression(progression, 1, "neutral", "cast-spell-from-scroll")).toBe("d12");
            expect(getSkillBonusFromProgression(progression, 10, "neutral", "cast-spell-from-scroll")).toBe("d20"); // Actual value from source data
        });
    });
    describe("Warrior Class Progression", () => {
        it("loads warrior level 1 with deed die", () => {
            const rawItem = loadLevelItem("dcc-class-level-data/src/warrior_1_kzl66RhzqXE8kyct.json");
            const raw = extractLevelData(rawItem);
            const level = parseClassLevel(raw);
            // Warrior has deed die as attack bonus
            expect(level.attackBonus).toBe("d3");
            expect(level.criticalDie).toBe("1d12");
            expect(level.criticalTable).toBe("III");
            expect(level.critRange).toBe(19);
            expect(level.hitDie).toBe("1d12");
        });
    });
    describe("Birth Augurs (Luck Table)", () => {
        it("loads all 30 birth augurs", () => {
            const rawTable = loadTableData("dcc-core-tables/src/Table_1_2__Luck_Score_rf8qSPFamqmB5eQo.json");
            const augurs = loadBirthAugurs(rawTable);
            expect(augurs).toHaveLength(30);
            // Check first entry
            expect(augurs[0]).toEqual({
                roll: 1,
                name: "Harsh winter",
                affects: "All attack rolls",
                effectType: "attack-all",
            });
            // Check some specific entries
            const theBull = augurs.find((a) => a.roll === 2);
            expect(theBull?.name).toBe("The bull");
            expect(theBull?.effectType).toBe("attack-melee");
            const seventhSon = augurs.find((a) => a.roll === 13);
            expect(seventhSon?.name).toBe("Seventh son");
            expect(seventhSon?.effectType).toBe("spell-check");
            const speedOfCobra = augurs.find((a) => a.roll === 24);
            expect(speedOfCobra?.name).toBe("Speed of the cobra");
            expect(speedOfCobra?.effectType).toBe("initiative");
            // Check last entry
            const lastAugur = augurs[29];
            expect(lastAugur?.roll).toBe(30);
            expect(lastAugur?.name).toBe("Wild child");
            expect(lastAugur?.effectType).toBe("speed");
            // Note: affects string may have special characters, just verify it contains key parts
            expect(lastAugur?.affects).toContain("Speed");
        });
        it("loads luck table as rollable table", () => {
            const rawTable = loadTableData("dcc-core-tables/src/Table_1_2__Luck_Score_rf8qSPFamqmB5eQo.json");
            const table = loadRollableTable(rawTable);
            expect(table.name).toBe("Table 1-2: Luck Score");
            expect(table.formula).toBe("1d30");
            expect(table.entries).toHaveLength(30);
        });
    });
});
//# sourceMappingURL=integration.test.js.map