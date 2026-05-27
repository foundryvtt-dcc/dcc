/**
 * Wizard Class Progression
 *
 * Complete level-by-level advancement data for the Wizard class.
 * Data extracted from DCC RPG core rules.
 *
 * Note: Wizard also has spellcasting data (knownSpells, maxSpellLevel) which
 * are tracked via helper functions below.
 */
export const WIZARD_PROGRESSION = {
    classId: "wizard",
    name: "Wizard",
    skills: [
        "spell-casting",
        "spellburn",
        "patron-bond",
        "supernatural-patron",
    ],
    levels: {
        1: {
            attackBonus: 0,
            criticalDie: "1d6",
            criticalTable: "I",
            actionDice: ["1d20"],
            hitDie: "d4",
            saves: { ref: 1, frt: 0, wil: 1 },
            lawful: {
                title: "Evoker",
                skills: {},
            },
            neutral: {
                title: "Astrologist",
                skills: {},
            },
            chaotic: {
                title: "Cultist",
                skills: {},
            },
        },
        2: {
            attackBonus: 1,
            criticalDie: "1d6",
            criticalTable: "I",
            actionDice: ["1d20"],
            hitDie: "d4",
            saves: { ref: 1, frt: 0, wil: 1 },
            lawful: {
                title: "Controller",
                skills: {},
            },
            neutral: {
                title: "Enchanter",
                skills: {},
            },
            chaotic: {
                title: "Shaman",
                skills: {},
            },
        },
        3: {
            attackBonus: 1,
            criticalDie: "1d8",
            criticalTable: "I",
            actionDice: ["1d20"],
            hitDie: "d4",
            saves: { ref: 1, frt: 1, wil: 2 },
            lawful: {
                title: "Conjurer",
                skills: {},
            },
            neutral: {
                title: "Magician",
                skills: {},
            },
            chaotic: {
                title: "Diabolist",
                skills: {},
            },
        },
        4: {
            attackBonus: 1,
            criticalDie: "1d8",
            criticalTable: "I",
            actionDice: ["1d20"],
            hitDie: "d4",
            saves: { ref: 2, frt: 1, wil: 2 },
            lawful: {
                title: "Summoner",
                skills: {},
            },
            neutral: {
                title: "Thaumaturgist",
                skills: {},
            },
            chaotic: {
                title: "Warlock",
                skills: {},
            },
        },
        5: {
            attackBonus: 2,
            criticalDie: "1d10",
            criticalTable: "I",
            actionDice: ["1d20", "1d14"],
            hitDie: "d4",
            saves: { ref: 2, frt: 1, wil: 3 },
            lawful: {
                title: "Elementalist",
                skills: {},
            },
            neutral: {
                title: "Sorcerer",
                skills: {},
            },
            chaotic: {
                title: "Necromancer",
                skills: {},
            },
        },
        6: {
            attackBonus: 2,
            criticalDie: "1d10",
            criticalTable: "I",
            actionDice: ["1d20", "1d16"],
            hitDie: "d4",
            saves: { ref: 2, frt: 2, wil: 4 },
        },
        7: {
            attackBonus: 3,
            criticalDie: "1d12",
            criticalTable: "I",
            actionDice: ["1d20", "1d20"],
            hitDie: "d4",
            saves: { ref: 3, frt: 2, wil: 4 },
        },
        8: {
            attackBonus: 3,
            criticalDie: "1d12",
            criticalTable: "I",
            actionDice: ["1d20", "1d20"],
            hitDie: "d4",
            saves: { ref: 3, frt: 2, wil: 5 },
        },
        9: {
            attackBonus: 4,
            criticalDie: "1d14",
            criticalTable: "I",
            actionDice: ["1d20", "1d20"],
            hitDie: "d4",
            saves: { ref: 3, frt: 3, wil: 5 },
        },
        10: {
            attackBonus: 4,
            criticalDie: "1d14",
            criticalTable: "I",
            actionDice: ["1d20", "1d20", "1d14"],
            hitDie: "d4",
            saves: { ref: 4, frt: 3, wil: 6 },
        },
    },
};
/**
 * Get wizard spellcasting progression for a level.
 *
 * @param level - The wizard's level
 * @returns The spell progression data
 */
export function getWizardSpellProgression(level) {
    if (level >= 10)
        return { knownSpells: 16, maxSpellLevel: 5 };
    if (level >= 9)
        return { knownSpells: 14, maxSpellLevel: 5 };
    if (level >= 8)
        return { knownSpells: 12, maxSpellLevel: 4 };
    if (level >= 7)
        return { knownSpells: 10, maxSpellLevel: 4 };
    if (level >= 6)
        return { knownSpells: 9, maxSpellLevel: 3 };
    if (level >= 5)
        return { knownSpells: 8, maxSpellLevel: 3 };
    if (level >= 4)
        return { knownSpells: 7, maxSpellLevel: 2 };
    if (level >= 3)
        return { knownSpells: 6, maxSpellLevel: 2 };
    if (level >= 2)
        return { knownSpells: 5, maxSpellLevel: 1 };
    if (level >= 1)
        return { knownSpells: 4, maxSpellLevel: 1 };
    return { knownSpells: 0, maxSpellLevel: 0 };
}
//# sourceMappingURL=wizard-progression.js.map