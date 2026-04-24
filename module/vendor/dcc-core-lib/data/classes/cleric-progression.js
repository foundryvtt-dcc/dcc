/**
 * Cleric Class Progression
 *
 * Complete level-by-level advancement data for the Cleric class.
 * Data extracted from DCC RPG core rules.
 *
 * Note: Cleric also has spellcasting data (spells per level) which
 * are tracked via helper functions below.
 */
export const CLERIC_PROGRESSION = {
    classId: "cleric",
    name: "Cleric",
    skills: [
        "divine-aid",
        "turn-unholy",
        "lay-on-hands",
        "spell-casting",
    ],
    levels: {
        1: {
            attackBonus: 0,
            criticalDie: "1d8",
            criticalTable: "III",
            actionDice: ["1d20"],
            hitDie: "d8",
            saves: { ref: 0, frt: 1, wil: 1 },
            lawful: {
                title: "Acolyte",
                skills: {},
            },
            neutral: {
                title: "Witness",
                skills: {},
            },
            chaotic: {
                title: "Zealot",
                skills: {},
            },
        },
        2: {
            attackBonus: 1,
            criticalDie: "1d8",
            criticalTable: "III",
            actionDice: ["1d20"],
            hitDie: "d8",
            saves: { ref: 0, frt: 1, wil: 1 },
            lawful: {
                title: "Heathen-slayer",
                skills: {},
            },
            neutral: {
                title: "Pupil",
                skills: {},
            },
            chaotic: {
                title: "Convert",
                skills: {},
            },
        },
        3: {
            attackBonus: 2,
            criticalDie: "1d10",
            criticalTable: "III",
            actionDice: ["1d20"],
            hitDie: "d8",
            saves: { ref: 1, frt: 1, wil: 2 },
            lawful: {
                title: "Brother",
                skills: {},
            },
            neutral: {
                title: "Chronicler",
                skills: {},
            },
            chaotic: {
                title: "Cultist",
                skills: {},
            },
        },
        4: {
            attackBonus: 2,
            criticalDie: "1d10",
            criticalTable: "III",
            actionDice: ["1d20"],
            hitDie: "d8",
            saves: { ref: 1, frt: 2, wil: 2 },
            lawful: {
                title: "Curate",
                skills: {},
            },
            neutral: {
                title: "Judge",
                skills: {},
            },
            chaotic: {
                title: "Apostle",
                skills: {},
            },
        },
        5: {
            attackBonus: 3,
            criticalDie: "1d12",
            criticalTable: "III",
            actionDice: ["1d20"],
            hitDie: "d8",
            saves: { ref: 1, frt: 2, wil: 3 },
            lawful: {
                title: "Father",
                skills: {},
            },
            neutral: {
                title: "Druid",
                skills: {},
            },
            chaotic: {
                title: "High Priest",
                skills: {},
            },
        },
        6: {
            attackBonus: 4,
            criticalDie: "1d12",
            criticalTable: "III",
            actionDice: ["1d20", "1d14"],
            hitDie: "d8",
            saves: { ref: 2, frt: 2, wil: 4 },
        },
        7: {
            attackBonus: 5,
            criticalDie: "1d14",
            criticalTable: "III",
            actionDice: ["1d20", "1d16"],
            hitDie: "d8",
            saves: { ref: 2, frt: 3, wil: 4 },
        },
        8: {
            attackBonus: 5,
            criticalDie: "1d14",
            criticalTable: "III",
            actionDice: ["1d20", "1d20"],
            hitDie: "d8",
            saves: { ref: 2, frt: 3, wil: 5 },
        },
        9: {
            attackBonus: 6,
            criticalDie: "1d16",
            criticalTable: "III",
            actionDice: ["1d20", "1d20"],
            hitDie: "d8",
            saves: { ref: 3, frt: 3, wil: 5 },
        },
        10: {
            attackBonus: 7,
            criticalDie: "1d16",
            criticalTable: "III",
            actionDice: ["1d20", "1d20"],
            hitDie: "d8",
            saves: { ref: 3, frt: 4, wil: 6 },
        },
    },
};
/**
 * Get cleric spellcasting progression for a level.
 *
 * @param level - The cleric's level
 * @returns The spell progression data (spells per day at each spell level)
 */
export function getClericSpellProgression(level) {
    if (level >= 10)
        return { level1: 9, level2: 7, level3: 6, level4: 4, level5: 2 };
    if (level >= 9)
        return { level1: 8, level2: 7, level3: 5, level4: 3, level5: 1 };
    if (level >= 8)
        return { level1: 8, level2: 6, level3: 5, level4: 2, level5: 0 };
    if (level >= 7)
        return { level1: 7, level2: 6, level3: 4, level4: 1, level5: 0 };
    if (level >= 6)
        return { level1: 7, level2: 5, level3: 3, level4: 0, level5: 0 };
    if (level >= 5)
        return { level1: 6, level2: 5, level3: 2, level4: 0, level5: 0 };
    if (level >= 4)
        return { level1: 6, level2: 4, level3: 0, level4: 0, level5: 0 };
    if (level >= 3)
        return { level1: 5, level2: 3, level3: 0, level4: 0, level5: 0 };
    if (level >= 2)
        return { level1: 5, level2: 0, level3: 0, level4: 0, level5: 0 };
    if (level >= 1)
        return { level1: 4, level2: 0, level3: 0, level4: 0, level5: 0 };
    return { level1: 0, level2: 0, level3: 0, level4: 0, level5: 0 };
}
//# sourceMappingURL=cleric-progression.js.map