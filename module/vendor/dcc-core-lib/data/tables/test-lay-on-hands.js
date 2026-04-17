/**
 * Fan-Made Lay on Hands Table (For Testing)
 *
 * This is a simplified fan-made table for testing purposes.
 * It follows the same structure as the official table but with
 * different values to avoid copyright issues.
 *
 * Licensed under MIT - safe for open source distribution.
 */
/**
 * Fan-made Lay on Hands result table for testing.
 * Simplified version with fewer entries for test coverage.
 */
export const TEST_LAY_ON_HANDS_TABLE = {
    id: "test-lay-on-hands",
    name: "Lay on Hands (Test)",
    type: "simple",
    description: "Fan-made lay on hands table for testing",
    source: "Fan-made for dcc-core-lib tests",
    tags: ["cleric", "lay-on-hands", "healing", "test", "fan-made"],
    die: "d20",
    entries: [
        {
            min: 1,
            max: 10,
            text: "Failure. Divine healing does not flow through you.",
            effect: { type: "none" },
        },
        {
            min: 11,
            max: 14,
            text: "Minor healing. Restore 1 hit point per caster level.",
            effect: { type: "heal", dice: "1*CL" },
        },
        {
            min: 15,
            max: 18,
            text: "Healing. Restore 2 hit points per caster level.",
            effect: { type: "heal", dice: "2*CL" },
        },
        {
            min: 19,
            max: 22,
            text: "Greater healing. Restore 3 hit points per caster level.",
            effect: { type: "heal", dice: "3*CL" },
        },
        {
            min: 23,
            max: 26,
            text: "Miraculous healing. Restore 5 hit points per caster level and cure one ailment.",
            effect: { type: "heal-cure", dice: "5*CL", data: { cureDisease: true } },
        },
        {
            min: 27,
            max: 999,
            text: "Divine intervention. Restore 8 hit points per caster level, cure all ailments, and restore one lost limb.",
            effect: { type: "heal-restore", dice: "8*CL", data: { cureAllDiseases: true, restoreLimb: true } },
        },
    ],
};
//# sourceMappingURL=test-lay-on-hands.js.map