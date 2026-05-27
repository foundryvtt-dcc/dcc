/**
 * Fan-Made Turn Unholy Table (For Testing)
 *
 * This is a simplified fan-made table for testing purposes.
 * It follows the same structure as the official table but with
 * different values to avoid copyright issues.
 *
 * Licensed under MIT - safe for open source distribution.
 */
/**
 * Fan-made Turn Unholy result table for testing.
 * Simplified version with fewer entries for test coverage.
 */
export const TEST_TURN_UNHOLY_TABLE = {
    id: "test-turn-unholy",
    name: "Turn Unholy (Test)",
    type: "simple",
    description: "Fan-made turn unholy table for testing",
    source: "Fan-made for dcc-core-lib tests",
    tags: ["cleric", "turn-unholy", "test", "fan-made"],
    die: "d20",
    entries: [
        {
            min: 1,
            max: 10,
            text: "Failure. The unholy creatures are unaffected.",
            effect: { type: "none" },
        },
        {
            min: 11,
            max: 14,
            text: "Minor success. Turn 1d4 HD of unholy creatures for 1d4 rounds.",
            effect: { type: "turn", dice: "1d4", data: { fleeRounds: "1d4" } },
        },
        {
            min: 15,
            max: 18,
            text: "Success. Turn 1d6+level HD of unholy creatures for 1d6 rounds.",
            effect: { type: "turn", dice: "1d6+CL", data: { fleeRounds: "1d6" } },
        },
        {
            min: 19,
            max: 22,
            text: "Great success. Turn 1d8+level HD and destroy up to 1d4 HD for 2d6 rounds.",
            effect: { type: "turn-destroy", dice: "1d8+CL", data: { destroyDice: "1d4", fleeRounds: "2d6" } },
        },
        {
            min: 23,
            max: 999,
            text: "Critical success. Turn 1d12+level HD and destroy up to 1d6 HD permanently.",
            effect: { type: "turn-destroy", dice: "1d12+CL", data: { destroyDice: "1d6", fleeRounds: "permanent" } },
        },
    ],
};
//# sourceMappingURL=test-turn-unholy.js.map