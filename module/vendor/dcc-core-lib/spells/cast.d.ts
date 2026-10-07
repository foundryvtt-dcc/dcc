/**
 * Spell Casting Core
 *
 * Pure functions for casting spells and determining results.
 * Handles spell checks, result determination, and integration
 * with the table lookup system.
 */
import type { SpellCastInput, SpellCastResult, SpellCheckOptions, SpellDefinition, SpellResultEntry, SpellEvents, CasterProfile } from "../types/spells.js";
import type { LegacyRollModifier } from "../types/dice.js";
import type { ResultTier, TieredTable, TieredEntry } from "../tables/types.js";
/**
 * Build the modifier list for a spell check.
 * Combines ability modifier, caster level, luck burn, spellburn, and situational modifiers.
 */
export declare function buildSpellCheckModifiers(input: SpellCastInput): LegacyRollModifier[];
/**
 * Find a spell result entry from inline results
 */
export declare function findInlineResult(results: readonly SpellResultEntry[], roll: number): SpellResultEntry | undefined;
/**
 * Minimum spell check total to succeed, by spell level (DCC RAW: 10 + 2 × level)
 */
export declare const SPELL_CHECK_THRESHOLDS: Record<number, number>;
/**
 * Get the minimum spell check threshold for a spell level
 */
export declare function getSpellCheckThreshold(spellLevel: number): number;
/**
 * Check if a spell check succeeded (met minimum threshold)
 */
export declare function didSpellCheckSucceed(total: number, spellLevel: number): boolean;
/**
 * Determine the spell result from a check total.
 * Uses inline results if available, otherwise falls back to table lookup.
 *
 * Without inline results or a table, the default tiers apply the spell-level
 * threshold: a total below `getSpellCheckThreshold(spell.level)` is a failure.
 * A missing or invalid level is treated as level 1.
 */
export declare function determineSpellResult(total: number, spell: SpellDefinition, resultTable?: TieredTable): {
    tier: ResultTier;
    entry?: SpellResultEntry | TieredEntry;
    text?: string;
} | undefined;
/**
 * Does this caster lose the spell for the day on a failed spell check?
 * See `CasterProfile.losesSpellOnFailure`.
 */
export declare function losesSpellOnFailure(profile: CasterProfile): boolean;
/**
 * Check if a result indicates the spell is lost.
 *
 * An entry's explicit `lost` flag always wins. Otherwise, with a caster
 * profile, DCC RAW applies: a wizard or elf loses the spell on any failed
 * check (`failure` or `lost` tier), and a cleric keeps it (a failed cleric
 * check raises disapproval instead). Without a profile, only the `lost`
 * tier counts.
 */
export declare function isSpellLostResult(entry: SpellResultEntry | TieredEntry | undefined, tier: ResultTier, profile?: CasterProfile): boolean;
/**
 * Check if a result triggers corruption
 */
export declare function triggersCorruption(entry: SpellResultEntry | TieredEntry | undefined, natural: number | undefined, profile: CasterProfile): boolean;
/**
 * Check if a spell check triggers disapproval (clerics only)
 */
export declare function checkDisapproval(natural: number, disapprovalRange: number): boolean;
/**
 * Calculate the disapproval-range increase this cast causes.
 *
 * DCC RAW (core rulebook, cleric magic): "Each failed spell check increases
 * the chance of disapproval" by one, and "any natural roll within that range
 * automatically fails". So a natural inside the range (natural 1 included)
 * is a failed check and raises the range by exactly 1.
 *
 * Only in-range naturals are counted here. A check that fails on its total
 * (outside the range) also raises the range under RAW, but whether a total
 * fails depends on the spell's result table, so that increase is left to
 * the caller.
 *
 * @param natural - The natural spell-check roll
 * @param profile - The caster profile
 * @param disapprovalRange - Current disapproval range. When omitted, only a
 *   natural 1 counts (the range is always at least 1).
 */
export declare function calculateDisapprovalIncrease(natural: number | undefined, profile: CasterProfile, disapprovalRange?: number): number;
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
export declare function getSpellCheckTotalModifier(modifiers: LegacyRollModifier[]): number;
