/**
 * Fan-Made Lay on Hands Table (For Testing)
 *
 * Mirrors the RAW 3-column (same/adjacent/opposed) structure but uses
 * fan-made values to avoid copyright issues. Licensed under MIT.
 */
/**
 * Fan-made Lay on Hands table for testing. Structure matches RAW (3 alignment
 * columns, dice-count cells), values are original.
 */
export const TEST_LAY_ON_HANDS_TABLE = {
    id: "test-lay-on-hands",
    name: "Lay on Hands (Test)",
    type: "lay-on-hands",
    description: "Fan-made lay on hands table for testing",
    source: "Fan-made for dcc-core-lib tests",
    tags: ["cleric", "lay-on-hands", "healing", "test", "fan-made"],
    rows: [
        { min: 1, max: 10, dice: { same: 0, adjacent: 0, opposed: 0 }, text: "Failure." },
        { min: 11, max: 12, dice: { same: 2, adjacent: 1, opposed: 1 }, text: "Minor healing." },
        { min: 13, max: 18, dice: { same: 3, adjacent: 2, opposed: 1 }, text: "Healing." },
        { min: 19, max: 20, dice: { same: 4, adjacent: 3, opposed: 2 }, text: "Greater healing." },
        {
            min: 21,
            max: 999,
            dice: { same: 5, adjacent: 4, opposed: 3 },
            text: "Miraculous healing.",
            extra: { curesDisease: true, neutralizesPoison: true },
        },
    ],
    conditions: {
        "broken-limb": 1,
        "organ-damage": 2,
        "disease": 2,
        "paralysis": 3,
        "poison": 3,
        "blindness": 4,
    },
};
//# sourceMappingURL=test-lay-on-hands.js.map