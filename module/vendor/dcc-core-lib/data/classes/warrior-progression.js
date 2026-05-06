/**
 * Warrior Class Progression
 *
 * Complete level-by-level advancement data for the Warrior class.
 * Data extracted from DCC RPG core rules.
 *
 * Note: At levels 7+, the deed die has a flat bonus (e.g., d10+1 at level 7).
 * The attackBonus stores the deed die, and the flat bonus progression is:
 * Level 7: +1, Level 8: +2, Level 9: +3, Level 10: +4
 */
export const WARRIOR_PROGRESSION = {
    classId: "warrior",
    name: "Warrior",
    skills: [
        "mighty-deed",
        "weapon-training",
    ],
    levels: {
        1: {
            attackBonus: "d3",
            criticalDie: "1d12",
            criticalTable: "III",
            critRange: 19,
            actionDice: ["1d20"],
            hitDie: "d12",
            saves: { ref: 1, frt: 1, wil: 0 },
            lawful: {
                title: "Squire",
                skills: {},
            },
            neutral: {
                title: "Wildling",
                skills: {},
            },
            chaotic: {
                title: "Bandit",
                skills: {},
            },
        },
        2: {
            attackBonus: "d4",
            criticalDie: "1d14",
            criticalTable: "III",
            critRange: 19,
            actionDice: ["1d20"],
            hitDie: "d12",
            saves: { ref: 1, frt: 1, wil: 0 },
            lawful: {
                title: "Champion",
                skills: {},
            },
            neutral: {
                title: "Barbarian",
                skills: {},
            },
            chaotic: {
                title: "Brigand",
                skills: {},
            },
        },
        3: {
            attackBonus: "d5",
            criticalDie: "1d16",
            criticalTable: "IV",
            critRange: 19,
            actionDice: ["1d20"],
            hitDie: "d12",
            saves: { ref: 1, frt: 2, wil: 1 },
            lawful: {
                title: "Knight",
                skills: {},
            },
            neutral: {
                title: "Berserker",
                skills: {},
            },
            chaotic: {
                title: "Marauder",
                skills: {},
            },
        },
        4: {
            attackBonus: "d6",
            criticalDie: "1d20",
            criticalTable: "IV",
            critRange: 19,
            actionDice: ["1d20"],
            hitDie: "d12",
            saves: { ref: 2, frt: 2, wil: 1 },
            lawful: {
                title: "Cavalier",
                skills: {},
            },
            neutral: {
                title: "Headman",
                skills: {},
            },
            chaotic: {
                title: "Ravager",
                skills: {},
            },
        },
        5: {
            attackBonus: "d7",
            criticalDie: "1d24",
            criticalTable: "V",
            critRange: 18,
            actionDice: ["1d20", "1d14"],
            hitDie: "d12",
            saves: { ref: 2, frt: 3, wil: 1 },
            lawful: {
                title: "Paladin",
                skills: {},
            },
            neutral: {
                title: "Chieftain",
                skills: {},
            },
            chaotic: {
                title: "Reaver",
                skills: {},
            },
        },
        6: {
            attackBonus: "d8",
            criticalDie: "1d30",
            criticalTable: "V",
            critRange: 18,
            actionDice: ["1d20", "1d16"],
            hitDie: "d12",
            saves: { ref: 2, frt: 4, wil: 2 },
        },
        7: {
            attackBonus: "d10",
            criticalDie: "1d30",
            criticalTable: "V",
            critRange: 18,
            actionDice: ["1d20", "1d20"],
            hitDie: "d12",
            saves: { ref: 3, frt: 4, wil: 2 },
        },
        8: {
            attackBonus: "d10",
            criticalDie: "2d20",
            criticalTable: "V",
            critRange: 18,
            actionDice: ["1d20", "1d20"],
            hitDie: "d12",
            saves: { ref: 3, frt: 5, wil: 2 },
        },
        9: {
            attackBonus: "d10",
            criticalDie: "2d20",
            criticalTable: "V",
            critRange: 17,
            actionDice: ["1d20", "1d20"],
            hitDie: "d12",
            saves: { ref: 3, frt: 5, wil: 3 },
        },
        10: {
            attackBonus: "d10",
            criticalDie: "2d20",
            criticalTable: "V",
            critRange: 17,
            actionDice: ["1d20", "1d20", "1d14"],
            hitDie: "d12",
            saves: { ref: 4, frt: 6, wil: 3 },
        },
    },
};
/**
 * Get the flat attack bonus for warriors at high levels.
 * At levels 7+, warriors gain a flat bonus in addition to their deed die.
 *
 * @param level - The warrior's level
 * @returns The flat bonus (0 for levels 1-6)
 */
export function getWarriorDeedDieBonus(level) {
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
//# sourceMappingURL=warrior-progression.js.map