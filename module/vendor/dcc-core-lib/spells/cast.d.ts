/**
 * Spell Casting Core
 *
 * Pure functions for casting spells and determining results.
 * Handles spell checks, result determination, and integration
 * with the table lookup system.
 */
import type { SpellCastInput, SpellCastResult, SpellCheckOptions, SpellDefinition, SpellResultEntry, SpellEvents, CasterProfile } from "../types/spells.js";
import type { RollModifier } from "../types/dice.js";
import type { ResultTier, TieredTable, TieredEntry } from "../tables/types.js";
/**
 * Build the modifier list for a spell check.
 * Combines ability modifier, caster level, luck burn, spellburn, and situational modifiers.
 */
export declare function buildSpellCheckModifiers(input: SpellCastInput): RollModifier[];
/**
 * Find a spell result entry from inline results
 */
export declare function findInlineResult(results: readonly SpellResultEntry[], roll: number): SpellResultEntry | undefined;
/**
 * Determine the spell result from a check total.
 * Uses inline results if available, otherwise falls back to table lookup.
 */
export declare function determineSpellResult(total: number, spell: SpellDefinition, resultTable?: TieredTable): {
    tier: ResultTier;
    entry?: SpellResultEntry | TieredEntry;
    text?: string;
} | undefined;
/**
 * Check if a result indicates the spell is lost
 */
export declare function isSpellLostResult(entry: SpellResultEntry | TieredEntry | undefined, tier: ResultTier): boolean;
/**
 * Check if a result triggers corruption
 */
export declare function triggersCorruption(entry: SpellResultEntry | TieredEntry | undefined, natural: number | undefined, profile: CasterProfile): boolean;
/**
 * Check if a spell check triggers disapproval (clerics only)
 */
export declare function checkDisapproval(natural: number, disapprovalRange: number): boolean;
/**
 * Calculate disapproval increase based on result
 */
export declare function calculateDisapprovalIncrease(natural: number | undefined, profile: CasterProfile): number;
/**
 * Cast a spell, performing the spell check and determining results.
 *
 * This is the main entry point for spell casting. It:
 * 1. Builds the modifier list
 * 2. Rolls the spell check (if mode is evaluate)
 * 3. Determines the result tier
 * 4. Handles critical/fumble detection
 * 5. Triggers events for UI integration
 *
 * Note: Corruption rolling, fumble tables, and mercurial effects
 * are handled by their respective modules - this function sets
 * the flags indicating when they should be triggered.
 */
export declare function castSpell(input: SpellCastInput, options?: SpellCheckOptions, events?: SpellEvents): SpellCastResult;
/**
 * Get the default caster profile for a class
 */
export declare function getCasterProfile(classId: string): CasterProfile | undefined;
/**
 * Check if a result is a success (any success tier)
 */
export declare function isSuccess(tier: ResultTier | undefined): boolean;
/**
 * Check if a result is a failure (failure or lost)
 */
export declare function isFailure(tier: ResultTier | undefined): boolean;
/**
 * Calculate the total modifier sum from a spell check modifiers list
 */
export declare function getSpellCheckTotalModifier(modifiers: RollModifier[]): number;
//# sourceMappingURL=cast.d.ts.map