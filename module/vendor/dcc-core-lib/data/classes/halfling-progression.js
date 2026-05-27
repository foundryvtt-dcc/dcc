/**
 * Halfling Class Progression
 *
 * Complete level-by-level advancement data for the Halfling class.
 * Data extracted from DCC RPG core rules.
 *
 * Halflings are skilled at fighting with two weapons and are excellent
 * at sneaking and hiding. They have good luck abilities and can share
 * their luck with others.
 */
export const HALFLING_PROGRESSION = {
    classId: "halfling",
    name: "Halfling",
    skills: [
        "sneak-and-hide",
        "two-weapon-fighting",
        "luck-sharing",
        "good-luck-charm",
        "infravision",
    ],
    levels: {
        1: {
            attackBonus: 1,
            criticalDie: "1d8",
            criticalTable: "III",
            actionDice: ["1d20"],
            hitDie: "d6",
            saves: { ref: 1, frt: 1, wil: 1 },
            lawful: {
                title: "Wanderer",
                skills: { "sneak-and-hide": 3 },
            },
            neutral: {
                title: "Wanderer",
                skills: { "sneak-and-hide": 3 },
            },
            chaotic: {
                title: "Wanderer",
                skills: { "sneak-and-hide": 3 },
            },
        },
        2: {
            attackBonus: 2,
            criticalDie: "1d8",
            criticalTable: "III",
            actionDice: ["1d20"],
            hitDie: "d6",
            saves: { ref: 1, frt: 1, wil: 1 },
            lawful: {
                title: "Explorer",
                skills: { "sneak-and-hide": 5 },
            },
            neutral: {
                title: "Explorer",
                skills: { "sneak-and-hide": 5 },
            },
            chaotic: {
                title: "Explorer",
                skills: { "sneak-and-hide": 5 },
            },
        },
        3: {
            attackBonus: 2,
            criticalDie: "1d10",
            criticalTable: "III",
            actionDice: ["1d20"],
            hitDie: "d6",
            saves: { ref: 2, frt: 1, wil: 2 },
            lawful: {
                title: "Collector",
                skills: { "sneak-and-hide": 7 },
            },
            neutral: {
                title: "Collector",
                skills: { "sneak-and-hide": 7 },
            },
            chaotic: {
                title: "Collector",
                skills: { "sneak-and-hide": 7 },
            },
        },
        4: {
            attackBonus: 3,
            criticalDie: "1d10",
            criticalTable: "III",
            actionDice: ["1d20"],
            hitDie: "d6",
            saves: { ref: 2, frt: 2, wil: 2 },
            lawful: {
                title: "Accumulator",
                skills: { "sneak-and-hide": 8 },
            },
            neutral: {
                title: "Accumulator",
                skills: { "sneak-and-hide": 8 },
            },
            chaotic: {
                title: "Accumulator",
                skills: { "sneak-and-hide": 8 },
            },
        },
        5: {
            attackBonus: 4,
            criticalDie: "1d12",
            criticalTable: "III",
            actionDice: ["1d20"],
            hitDie: "d6",
            saves: { ref: 3, frt: 2, wil: 3 },
            lawful: {
                title: "Wise One",
                skills: { "sneak-and-hide": 9 },
            },
            neutral: {
                title: "Wise One",
                skills: { "sneak-and-hide": 9 },
            },
            chaotic: {
                title: "Wise One",
                skills: { "sneak-and-hide": 9 },
            },
        },
        6: {
            attackBonus: 5,
            criticalDie: "1d12",
            criticalTable: "III",
            actionDice: ["1d20", "1d14"],
            hitDie: "d6",
            saves: { ref: 4, frt: 2, wil: 4 },
        },
        7: {
            attackBonus: 5,
            criticalDie: "1d14",
            criticalTable: "III",
            actionDice: ["1d20", "1d16"],
            hitDie: "d6",
            saves: { ref: 4, frt: 3, wil: 4 },
        },
        8: {
            attackBonus: 6,
            criticalDie: "1d14",
            criticalTable: "III",
            actionDice: ["1d20", "1d20"],
            hitDie: "d6",
            saves: { ref: 5, frt: 3, wil: 5 },
        },
        9: {
            attackBonus: 7,
            criticalDie: "1d16",
            criticalTable: "III",
            actionDice: ["1d20", "1d20"],
            hitDie: "d6",
            saves: { ref: 5, frt: 3, wil: 5 },
        },
        10: {
            attackBonus: 8,
            criticalDie: "1d16",
            criticalTable: "III",
            actionDice: ["1d20", "1d20"],
            hitDie: "d6",
            saves: { ref: 6, frt: 4, wil: 6 },
        },
    },
};
/**
 * Get halfling sneak and hide bonus for a level.
 *
 * @param level - The halfling's level
 * @returns The sneak and hide bonus
 */
export function getHalflingSneakAndHideBonus(level) {
    if (level >= 10)
        return 15;
    if (level >= 9)
        return 14;
    if (level >= 8)
        return 13;
    if (level >= 7)
        return 12;
    if (level >= 6)
        return 11;
    if (level >= 5)
        return 9;
    if (level >= 4)
        return 8;
    if (level >= 3)
        return 7;
    if (level >= 2)
        return 5;
    if (level >= 1)
        return 3;
    return 0;
}
//# sourceMappingURL=halfling-progression.js.map