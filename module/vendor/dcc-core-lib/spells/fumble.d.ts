/**
 * Spell Fumble Module
 *
 * Pure functions for handling spell fumbles (natural 1 on spell checks).
 * Spell fumbles can result in misfires, corruption, or patron taint.
 */
import type { RollOptions } from "../types/dice.js";
import type { SimpleTable } from "../tables/types.js";
import type { SpellFumbleResult, CasterProfile } from "../types/spells.js";
/**
 * Roll on the spell fumble table.
 *
 * In DCC, spell fumbles are typically rolled on 1d4 modified by:
 * - Spell level (higher level = worse fumbles)
 *
 * @param spellLevel - Level of the spell that fumbled
 * @param fumbleTable - Table to look up the result
 * @param options - Roll options
 * @returns The fumble result
 */
export declare function rollSpellFumble(spellLevel: number, fumbleTable: SimpleTable, options?: RollOptions): SpellFumbleResult;
/**
 * Roll spell fumble with a modifier (e.g., from luck or other sources).
 */
export declare function rollSpellFumbleWithModifier(spellLevel: number, modifier: number, fumbleTable: SimpleTable, options?: RollOptions): SpellFumbleResult;
/**
 * Fumble severity level
 */
export type FumbleSeverity = "minor" | "moderate" | "major" | "catastrophic";
/**
 * Determine fumble severity from the roll.
 */
export declare function getFumbleSeverity(roll: number): FumbleSeverity;
/**
 * Calculate expected fumble range for a spell level.
 */
export declare function getExpectedFumbleRange(spellLevel: number): {
    min: number;
    max: number;
    averageSeverity: FumbleSeverity;
};
/**
 * Check if a natural roll is a fumble.
 * Fumbles occur on natural 1 for spell checks.
 */
export declare function isSpellFumble(natural: number): boolean;
/**
 * Check if a fumble result requires a corruption roll.
 */
export declare function fumbleRequiresCorruption(fumbleResult: SpellFumbleResult, profile: CasterProfile): boolean;
/**
 * Misfire result - spell goes wrong in some way
 */
export interface MisfireResult {
    /** Description of the misfire */
    description: string;
    /** Type of misfire */
    type: "target-change" | "effect-reverse" | "random-effect" | "backfire" | "other";
    /** Additional data */
    data?: Record<string, unknown>;
}
/**
 * Determine misfire type from fumble result.
 * This is a helper for systems that want to parse misfire effects.
 */
export declare function parseMisfireType(fumbleResult: SpellFumbleResult): MisfireResult | undefined;
/**
 * Cleric natural 1 handling is different - it's disapproval, not fumble.
 * This function documents the distinction.
 */
export declare function isClericSpellFailure(natural: number, profile: CasterProfile): boolean;
/**
 * Get the appropriate failure type for a caster.
 */
export declare function getFailureType(natural: number, profile: CasterProfile): "fumble" | "disapproval" | "none";
//# sourceMappingURL=fumble.d.ts.map