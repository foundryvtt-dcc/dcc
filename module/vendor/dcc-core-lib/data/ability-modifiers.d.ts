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
export declare const ABILITY_MODIFIERS: Readonly<Record<number, number>>;
/**
 * Minimum ability score with a defined modifier
 */
export declare const MIN_ABILITY_SCORE = 0;
/**
 * Maximum ability score with a defined modifier
 */
export declare const MAX_ABILITY_SCORE = 24;
/**
 * Get the modifier for an ability score
 *
 * @param score - The ability score (0-24)
 * @returns The modifier, or 0 if score is out of range
 */
export declare function getAbilityModifier(score: number): number;
/**
 * Get the modifier with a plus sign prefix for positive values
 *
 * @param score - The ability score
 * @returns Formatted modifier string (e.g., "+2", "-1", "0")
 */
export declare function formatAbilityModifier(score: number): string;
//# sourceMappingURL=ability-modifiers.d.ts.map