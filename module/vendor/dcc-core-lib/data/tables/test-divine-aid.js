/**
 * Test Divine Aid Table
 *
 * Fan-made table for testing divine aid resolution.
 */
export const TEST_DIVINE_AID_TABLE = {
    id: "test-divine-aid",
    name: "Divine Aid (Test)",
    type: "simple",
    description: "Fan-made divine aid table for testing",
    source: "Fan-made for dcc-core-lib tests",
    tags: ["cleric", "divine-aid", "test", "fan-made"],
    die: "d20",
    entries: [
        {
            min: 1,
            max: 11,
            text: "Your deity does not respond to your plea.",
            effect: {
                type: "none",
            },
        },
        {
            min: 12,
            max: 13,
            text: "Your deity grants minor aid equivalent to a 1st-level spell.",
            effect: {
                type: "minor-aid",
                data: {
                    spellLevel: 1,
                    aidDescription: "Minor divine intervention",
                },
            },
        },
        {
            min: 14,
            max: 17,
            text: "Your deity grants moderate aid equivalent to a 2nd-level spell.",
            effect: {
                type: "moderate-aid",
                data: {
                    spellLevel: 2,
                    aidDescription: "Moderate divine intervention",
                },
            },
        },
        {
            min: 18,
            max: 21,
            text: "Your deity grants significant aid equivalent to a 3rd-level spell.",
            effect: {
                type: "major-aid",
                data: {
                    spellLevel: 3,
                    aidDescription: "Significant divine intervention",
                },
            },
        },
        {
            min: 22,
            max: 25,
            text: "Your deity grants major aid equivalent to a 4th-level spell!",
            effect: {
                type: "major-aid",
                data: {
                    spellLevel: 4,
                    aidDescription: "Major divine intervention",
                },
            },
        },
        {
            min: 26,
            max: 99,
            text: "Your deity grants miraculous aid equivalent to a 5th-level spell or greater!",
            effect: {
                type: "miraculous-aid",
                data: {
                    spellLevel: 5,
                    aidDescription: "Miraculous divine intervention",
                },
            },
        },
    ],
};
//# sourceMappingURL=test-divine-aid.js.map