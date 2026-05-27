/**
 * Ability score to modifier lookup table
 *
 * DCC uses a slightly different modifier progression than D&D 5e:
 * - Scores 0-1: -4
 * - Scores 2-3: -3
 * - Scores 4-5: -2
 * - Scores 6-8: -1
 * - Scores 9-12: 0
 * - Scores 13-15: +1
 * - Scores 16-17: +2
 * - Score 18: +3
 * - Scores 19-20: +3/+4 (continues upward for superhuman scores)
 */
/**
 * Ability modifier lookup table
 * Key: ability score (0-24)
 * Value: modifier (-4 to +6)
 */
export const ABILITY_MODIFIERS = {
    0: -4,
    1: -4,
    2: -3,
    3: -3,
    4: -2,
    5: -2,
    6: -1,
    7: -1,
    8: -1,
    9: 0,
    10: 0,
    11: 0,
    12: 0,
    13: 1,
    14: 1,
    15: 1,
    16: 2,
    17: 2,
    18: 3,
    19: 3,
    20: 4,
    21: 4,
    22: 5,
    23: 5,
    24: 6,
};
/**
 * Minimum ability score with a defined modifier
 */
export const MIN_ABILITY_SCORE = 0;
/**
 * Maximum ability score with a defined modifier
 */
export const MAX_ABILITY_SCORE = 24;
/**
 * Get the modifier for an ability score
 *
 * @param score - The ability score (0-24)
 * @returns The modifier, or 0 if score is out of range
 */
export function getAbilityModifier(score) {
    // Clamp to valid range
    if (score < MIN_ABILITY_SCORE) {
        return ABILITY_MODIFIERS[MIN_ABILITY_SCORE] ?? -4;
    }
    if (score > MAX_ABILITY_SCORE) {
        return ABILITY_MODIFIERS[MAX_ABILITY_SCORE] ?? 6;
    }
    return ABILITY_MODIFIERS[score] ?? 0;
}
/**
 * Get the modifier with a plus sign prefix for positive values
 *
 * @param score - The ability score
 * @returns Formatted modifier string (e.g., "+2", "-1", "0")
 */
export function formatAbilityModifier(score) {
    const mod = getAbilityModifier(score);
    if (mod > 0) {
        return `+${String(mod)}`;
    }
    return String(mod);
}
//# sourceMappingURL=ability-modifiers.js.map