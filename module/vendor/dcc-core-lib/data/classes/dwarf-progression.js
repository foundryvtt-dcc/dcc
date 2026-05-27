/**
 * Dwarf Class Progression
 *
 * Complete level-by-level advancement data for the Dwarf class.
 * Data extracted from DCC RPG core rules.
 *
 * Dwarves fight like warriors with deed dice and shield bashing abilities.
 * Note: At levels 7+, the deed die has a flat bonus (e.g., d10+1 at level 7).
 */
export const DWARF_PROGRESSION = {
    classId: "dwarf",
    name: "Dwarf",
    skills: [
        "mighty-deed",
        "shield-bash",
        "sword-and-board",
        "infravision",
        "underground-skills",
    ],
    levels: {
        1: {
            attackBonus: "d3",
            criticalDie: "1d10",
            criticalTable: "III",
            actionDice: ["1d20"],
            hitDie: "d10",
            saves: { ref: 1, frt: 1, wil: 1 },
            lawful: {
                title: "Agent",
                skills: {},
            },
            neutral: {
                title: "Apprentice",
                skills: {},
            },
            chaotic: {
                title: "Rebel",
                skills: {},
            },
        },
        2: {
            attackBonus: "d4",
            criticalDie: "1d12",
            criticalTable: "III",
            actionDice: ["1d20"],
            hitDie: "d10",
            saves: { ref: 1, frt: 1, wil: 1 },
            lawful: {
                title: "Broker",
                skills: {},
            },
            neutral: {
                title: "Novice",
                skills: {},
            },
            chaotic: {
                title: "Dissident",
                skills: {},
            },
        },
        3: {
            attackBonus: "d5",
            criticalDie: "1d14",
            criticalTable: "III",
            actionDice: ["1d20"],
            hitDie: "d10",
            saves: { ref: 1, frt: 2, wil: 1 },
            lawful: {
                title: "Delegate",
                skills: {},
            },
            neutral: {
                title: "Journeyer",
                skills: {},
            },
            chaotic: {
                title: "Exile",
                skills: {},
            },
        },
        4: {
            attackBonus: "d6",
            criticalDie: "1d16",
            criticalTable: "IV",
            actionDice: ["1d20"],
            hitDie: "d10",
            saves: { ref: 2, frt: 2, wil: 2 },
            lawful: {
                title: "Envoy",
                skills: {},
            },
            neutral: {
                title: "Crafter",
                skills: {},
            },
            chaotic: {
                title: "Iconoclast",
                skills: {},
            },
        },
        5: {
            attackBonus: "d7",
            criticalDie: "1d20",
            criticalTable: "IV",
            actionDice: ["1d20", "1d14"],
            hitDie: "d10",
            saves: { ref: 2, frt: 3, wil: 2 },
            lawful: {
                title: "Syndic",
                skills: {},
            },
            neutral: {
                title: "Thegn",
                skills: {},
            },
            chaotic: {
                title: "Renegade",
                skills: {},
            },
        },
        6: {
            attackBonus: "d8",
            criticalDie: "1d24",
            criticalTable: "V",
            actionDice: ["1d20", "1d16"],
            hitDie: "d10",
            saves: { ref: 2, frt: 4, wil: 2 },
        },
        7: {
            attackBonus: "d10",
            criticalDie: "1d30",
            criticalTable: "V",
            actionDice: ["1d20", "1d20"],
            hitDie: "d10",
            saves: { ref: 3, frt: 4, wil: 3 },
        },
        8: {
            attackBonus: "d10",
            criticalDie: "1d30",
            criticalTable: "V",
            actionDice: ["1d20", "1d20"],
            hitDie: "d10",
            saves: { ref: 3, frt: 5, wil: 3 },
        },
        9: {
            attackBonus: "d10",
            criticalDie: "2d20",
            criticalTable: "V",
            actionDice: ["1d20", "1d20"],
            hitDie: "d10",
            saves: { ref: 3, frt: 5, wil: 3 },
        },
        10: {
            attackBonus: "d10",
            criticalDie: "2d20",
            criticalTable: "V",
            actionDice: ["1d20", "1d20", "1d14"],
            hitDie: "d10",
            saves: { ref: 4, frt: 6, wil: 4 },
        },
    },
};
/**
 * Get the flat attack bonus for dwarves at high levels.
 * At levels 7+, dwarves gain a flat bonus in addition to their deed die.
 *
 * @param level - The dwarf's level
 * @returns The flat bonus (0 for levels 1-6)
 */
export function getDwarfDeedDieBonus(level) {
    if (level >= 10)
        return 4;
    if (level >= 9)
        return 3;
    if (level >= 8)
        return 2;
    if (level >= 7)
        return 1;
    return 0;
}
//# sourceMappingURL=dwarf-progression.js.map