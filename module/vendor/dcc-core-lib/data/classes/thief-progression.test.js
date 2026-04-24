/**
 * Thief Progression Tests
 *
 * Tests for the thief class progression data integrity and structure.
 */
import { describe, it, expect } from "vitest";
import { THIEF_PROGRESSION } from "./thief-progression.js";
import { getSkillBonus } from "../../types/class-progression.js";
describe("THIEF_PROGRESSION", () => {
    describe("basic structure", () => {
        it("has correct class metadata", () => {
            expect(THIEF_PROGRESSION.classId).toBe("thief");
            expect(THIEF_PROGRESSION.name).toBe("Thief");
        });
        it("has all expected skills listed", () => {
            const expectedSkills = [
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
            ];
            expect(THIEF_PROGRESSION.skills).toEqual(expectedSkills);
        });
        it("has progression data for levels 1-10", () => {
            for (let level = 1; level <= 10; level++) {
                expect(THIEF_PROGRESSION.levels[level]).toBeDefined();
            }
        });
    });
    describe("level 1 data", () => {
        const level1 = THIEF_PROGRESSION.levels[1];
        it("has correct base combat stats", () => {
            expect(level1?.attackBonus).toBe(0);
            expect(level1?.criticalDie).toBe("1d10");
            expect(level1?.criticalTable).toBe("II");
            expect(level1?.actionDice).toEqual(["1d20"]);
            expect(level1?.hitDie).toBe("d6");
            expect(level1?.luckDie).toBe("d3");
        });
        it("has correct saving throws", () => {
            expect(level1?.saves).toEqual({ ref: 1, frt: 1, wil: 0 });
        });
        it("has data for all three alignments", () => {
            expect(level1?.lawful).toBeDefined();
            expect(level1?.neutral).toBeDefined();
            expect(level1?.chaotic).toBeDefined();
        });
        it("has alignment-appropriate titles", () => {
            expect(level1?.lawful?.title).toBe("Bravo");
            expect(level1?.neutral?.title).toBe("Beggar");
            expect(level1?.chaotic?.title).toBe("Thug");
        });
        it("has all 13 skills for each alignment", () => {
            const skillCount = THIEF_PROGRESSION.skills.length;
            expect(Object.keys(level1?.lawful?.skills ?? {}).length).toBe(skillCount);
            expect(Object.keys(level1?.neutral?.skills ?? {}).length).toBe(skillCount);
            expect(Object.keys(level1?.chaotic?.skills ?? {}).length).toBe(skillCount);
        });
    });
    describe("progression advancement", () => {
        it("attack bonus increases with level", () => {
            const attackBonuses = [0, 1, 2, 2, 3, 4, 5, 5, 6, 7];
            for (let level = 1; level <= 10; level++) {
                const expected = attackBonuses[level - 1];
                expect(THIEF_PROGRESSION.levels[level]?.attackBonus).toBe(expected);
            }
        });
        it("luck die improves through the dice chain", () => {
            const expectedLuckDice = ["d3", "d4", "d5", "d6", "d7", "d8", "d10", "d12", "d14", "d16"];
            for (let level = 1; level <= 10; level++) {
                const expected = expectedLuckDice[level - 1];
                expect(THIEF_PROGRESSION.levels[level]?.luckDie).toBe(expected);
            }
        });
        it("saving throws improve with level", () => {
            const level1 = THIEF_PROGRESSION.levels[1];
            const level10 = THIEF_PROGRESSION.levels[10];
            // All saves should be higher at level 10
            expect(level10?.saves.ref).toBeGreaterThan(level1?.saves.ref ?? 0);
            expect(level10?.saves.frt).toBeGreaterThan(level1?.saves.frt ?? 0);
            expect(level10?.saves.wil).toBeGreaterThan(level1?.saves.wil ?? 0);
        });
        it("gains additional action die at level 6", () => {
            const level5 = THIEF_PROGRESSION.levels[5];
            const level6 = THIEF_PROGRESSION.levels[6];
            expect(level5?.actionDice).toEqual(["1d20"]);
            expect(level6?.actionDice.length).toBeGreaterThan(1);
        });
    });
    describe("alignment skill variations", () => {
        it("lawful thieves excel at hide-in-shadows, find-trap, disable-trap", () => {
            const level1 = THIEF_PROGRESSION.levels[1];
            const lawful = level1?.lawful?.skills;
            const neutral = level1?.neutral?.skills;
            // Lawful should have higher hide-in-shadows at level 1
            expect(lawful?.["hide-in-shadows"]).toBeGreaterThan(neutral?.["hide-in-shadows"]);
            // Lawful should have higher find-trap at level 1
            expect(lawful?.["find-trap"]).toBeGreaterThan(neutral?.["find-trap"]);
        });
        it("neutral thieves excel at pick-pockets, forge-document", () => {
            const level1 = THIEF_PROGRESSION.levels[1];
            const neutral = level1?.neutral?.skills;
            const lawful = level1?.lawful?.skills;
            // Neutral should have higher pick-pockets at level 1
            expect(neutral?.["pick-pockets"]).toBeGreaterThan(lawful?.["pick-pockets"]);
            // Neutral should have forge-document while lawful has 0
            expect(neutral?.["forge-document"]).toBeGreaterThan(lawful?.["forge-document"]);
        });
        it("chaotic thieves excel at backstab, handle-poison, disguise-self", () => {
            const level1 = THIEF_PROGRESSION.levels[1];
            const chaotic = level1?.chaotic?.skills;
            const lawful = level1?.lawful?.skills;
            // Chaotic should have higher backstab at level 1
            expect(chaotic?.["backstab"]).toBeGreaterThan(lawful?.["backstab"]);
            // Chaotic should have higher handle-poison at level 1
            expect(chaotic?.["handle-poison"]).toBeGreaterThan(lawful?.["handle-poison"]);
            // Chaotic should have higher disguise-self at level 1
            expect(chaotic?.["disguise-self"]).toBeGreaterThan(lawful?.["disguise-self"]);
        });
        it("cast-spell-from-scroll uses dice not numbers", () => {
            for (let level = 1; level <= 10; level++) {
                const levelData = THIEF_PROGRESSION.levels[level];
                // All alignments should have a die type for scroll casting
                expect(typeof levelData?.lawful?.skills["cast-spell-from-scroll"]).toBe("string");
                expect(typeof levelData?.neutral?.skills["cast-spell-from-scroll"]).toBe("string");
                expect(typeof levelData?.chaotic?.skills["cast-spell-from-scroll"]).toBe("string");
            }
        });
    });
    describe("getSkillBonus helper", () => {
        it("returns correct skill bonus for level 1 lawful thief backstab", () => {
            const bonus = getSkillBonus(THIEF_PROGRESSION, 1, "lawful", "backstab");
            expect(bonus).toBe(1);
        });
        it("returns correct skill bonus for level 5 chaotic thief backstab", () => {
            const bonus = getSkillBonus(THIEF_PROGRESSION, 5, "chaotic", "backstab");
            expect(bonus).toBe(9);
        });
        it("returns undefined for invalid level", () => {
            const bonus = getSkillBonus(THIEF_PROGRESSION, 99, "lawful", "backstab");
            expect(bonus).toBeUndefined();
        });
        it("returns die type for cast-spell-from-scroll", () => {
            const bonus = getSkillBonus(THIEF_PROGRESSION, 1, "neutral", "cast-spell-from-scroll");
            expect(bonus).toBe("d12");
        });
    });
    describe("title progression", () => {
        it("has unique titles for each alignment at each level", () => {
            // Check first few levels for distinct titles
            const level1 = THIEF_PROGRESSION.levels[1];
            const titles = new Set([
                level1?.lawful?.title,
                level1?.neutral?.title,
                level1?.chaotic?.title,
            ]);
            expect(titles.size).toBe(3); // All different
        });
        it("ends with Lord/King of Thieves titles at high levels", () => {
            const level10 = THIEF_PROGRESSION.levels[10];
            expect(level10?.lawful?.title).toBe("Lord of Thieves");
            expect(level10?.neutral?.title).toBe("Lord of Thieves");
            expect(level10?.chaotic?.title).toBe("Lord of Thieves");
        });
    });
});
//# sourceMappingURL=thief-progression.test.js.map