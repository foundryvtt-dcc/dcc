/**
 * Spellburn Module
 *
 * Pure functions for wizard/elf spellburn mechanics.
 * Spellburn allows casters to temporarily sacrifice physical ability
 * scores for bonuses to spell checks.
 */
import type { SpellburnCommitment } from "../types/spells.js";
import type { AbilityScores } from "../types/character.js";
/**
 * Result of validating a spellburn commitment
 */
export interface SpellburnValidationResult {
    /** Whether the spellburn is valid */
    valid: boolean;
    /** Error messages if invalid */
    errors: string[];
    /** Warning messages (valid but potentially problematic) */
    warnings: string[];
}
/**
 * Validate that a spellburn commitment is possible given current ability scores.
 *
 * Rules:
 * - Cannot burn more than current score minus 1 (can't go below 1)
 * - Can only burn from STR, AGL, STA
 * - Total burn must be positive to have any effect
 */
export declare function validateSpellburn(abilities: AbilityScores, commitment: SpellburnCommitment): SpellburnValidationResult;
/**
 * Get the maximum spellburn possible for each ability
 */
export declare function getMaxSpellburn(abilities: AbilityScores): SpellburnCommitment;
/**
 * Get total maximum spellburn across all abilities
 */
export declare function getTotalMaxSpellburn(abilities: AbilityScores): number;
/**
 * Apply spellburn to ability scores.
 * Returns new ability scores with reduced current values.
 *
 * Note: This function does NOT validate - call validateSpellburn first.
 */
export declare function applySpellburn(abilities: AbilityScores, commitment: SpellburnCommitment): AbilityScores;
/**
 * Recover spellburn damage (1 point per day per ability).
 * Returns new ability scores with recovered values.
 */
export declare function recoverSpellburn(abilities: AbilityScores, pointsPerAbility?: number): AbilityScores;
/**
 * Fully recover all spellburn damage.
 * Restores all physical abilities to their max values.
 */
export declare function fullyRecoverSpellburn(abilities: AbilityScores): AbilityScores;
/**
 * Get the current spellburn damage (difference between max and current).
 */
export declare function getSpellburnDamage(abilities: AbilityScores): SpellburnCommitment;
/**
 * Check if any spellburn damage remains
 */
export declare function hasSpellburnDamage(abilities: AbilityScores): boolean;
//# sourceMappingURL=spellburn.d.ts.map