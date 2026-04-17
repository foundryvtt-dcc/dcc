/**
 * Elf Class Progression
 *
 * Complete level-by-level advancement data for the Elf class.
 * Data extracted from DCC RPG core rules.
 *
 * Elves are warrior-mages who combine martial prowess with arcane spellcasting.
 * They are sensitive to iron and must wear mithril armor or suffer penalties.
 */
export const ELF_PROGRESSION = {
    classId: "elf",
    name: "Elf",
    skills: [
        "spell-casting",
        "patron-bond",
        "heightened-senses",
        "iron-vulnerability",
        "infravision",
    ],
    levels: {
        1: {
            attackBonus: 1,
            criticalDie: "1d6",
            criticalTable: "II",
            actionDice: ["1d20"],
            hitDie: "d6",
            saves: { ref: 1, frt: 1, wil: 1 },
            lawful: {
                title: "Wanderer",
                skills: {},
            },
            neutral: {
                title: "Wanderer",
                skills: {},
            },
            chaotic: {
                title: "Wanderer",
                skills: {},
            },
        },
        2: {
            attackBonus: 1,
            criticalDie: "1d8",
            criticalTable: "II",
            actionDice: ["1d20"],
            hitDie: "d6",
            saves: { ref: 1, frt: 1, wil: 1 },
            lawful: {
                title: "Seer",
                skills: {},
            },
            neutral: {
                title: "Seer",
                skills: {},
            },
            chaotic: {
                title: "Seer",
                skills: {},
            },
        },
        3: {
            attackBonus: 2,
            criticalDie: "1d8",
            criticalTable: "II",
            actionDice: ["1d20"],
            hitDie: "d6",
            saves: { ref: 1, frt: 1, wil: 2 },
            lawful: {
                title: "Quester",
                skills: {},
            },
            neutral: {
                title: "Quester",
                skills: {},
            },
            chaotic: {
                title: "Quester",
                skills: {},
            },
        },
        4: {
            attackBonus: 2,
            criticalDie: "1d10",
            criticalTable: "II",
            actionDice: ["1d20"],
            hitDie: "d6",
            saves: { ref: 2, frt: 2, wil: 2 },
            lawful: {
                title: "Savant",
                skills: {},
            },
            neutral: {
                title: "Savant",
                skills: {},
            },
            chaotic: {
                title: "Savant",
                skills: {},
            },
        },
        5: {
            attackBonus: 3,
            criticalDie: "1d10",
            criticalTable: "II",
            actionDice: ["1d20", "1d14"],
            hitDie: "d6",
            saves: { ref: 2, frt: 2, wil: 2 },
            lawful: {
                title: "Elder",
                skills: {},
            },
            neutral: {
                title: "Elder",
                skills: {},
            },
            chaotic: {
                title: "Elder",
                skills: {},
            },
        },
        6: {
            attackBonus: 3,
            criticalDie: "1d12",
            criticalTable: "II",
            actionDice: ["1d20", "1d16"],
            hitDie: "d6",
            saves: { ref: 2, frt: 2, wil: 4 },
        },
        7: {
            attackBonus: 4,
            criticalDie: "1d12",
            criticalTable: "II",
            actionDice: ["1d20", "1d20"],
            hitDie: "d6",
            saves: { ref: 3, frt: 3, wil: 4 },
        },
        8: {
            attackBonus: 4,
            criticalDie: "1d14",
            criticalTable: "II",
            actionDice: ["1d20", "1d20"],
            hitDie: "d6",
            saves: { ref: 3, frt: 3, wil: 5 },
        },
        9: {
            attackBonus: 5,
            criticalDie: "1d14",
            criticalTable: "II",
            actionDice: ["1d20", "1d20"],
            hitDie: "d6",
            saves: { ref: 3, frt: 3, wil: 5 },
        },
        10: {
            attackBonus: 5,
            criticalDie: "1d16",
            criticalTable: "II",
            actionDice: ["1d20", "1d20", "1d14"],
            hitDie: "d6",
            saves: { ref: 4, frt: 4, wil: 6 },
        },
    },
};
/**
 * Get elf spellcasting progression for a level.
 *
 * @param level - The elf's level
 * @returns The spell progression data
 */
export function getElfSpellProgression(level) {
    if (level >= 10)
        return { knownSpells: 14, maxSpellLevel: 5 };
    if (level >= 9)
        return { knownSpells: 12, maxSpellLevel: 5 };
    if (level >= 8)
        return { knownSpells: 10, maxSpellLevel: 4 };
    if (level >= 7)
        return { knownSpells: 9, maxSpellLevel: 4 };
    if (level >= 6)
        return { knownSpells: 8, maxSpellLevel: 3 };
    if (level >= 5)
        return { knownSpells: 7, maxSpellLevel: 3 };
    if (level >= 4)
        return { knownSpells: 6, maxSpellLevel: 2 };
    if (level >= 3)
        return { knownSpells: 5, maxSpellLevel: 2 };
    if (level >= 2)
        return { knownSpells: 4, maxSpellLevel: 1 };
    if (level >= 1)
        return { knownSpells: 3, maxSpellLevel: 1 };
    return { knownSpells: 0, maxSpellLevel: 0 };
}
//# sourceMappingURL=elf-progression.js.map