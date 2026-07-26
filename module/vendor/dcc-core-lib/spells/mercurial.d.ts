/**
 * Mercurial Magic Module
 *
 * Pure functions for wizard mercurial magic mechanics.
 * Mercurial magic is rolled once when a wizard learns a spell,
 * creating a permanent unique effect for that character's casting of that spell.
 */
import type { RollOptions } from "../types/dice.js";
import type { MercurialEffect, MercurialTableEntry } from "../types/spells.js";
/**
 * A mercurial magic table (typically d100 with ranges)
 */
export interface MercurialTable {
    /** Table identifier */
    id: string;
    /** Table name */
    name: string;
    /** Entries sorted by min value */
    entries: MercurialTableEntry[];
}
/**
 * Maximum recursion depth when expanding `rollAgain` specials. A sub-roll
 * landing on another special entry recurses; past this depth the literal
 * (unexpanded) effect is returned instead so a pathological table cannot
 * loop forever.
 */
export declare const MAX_MERCURIAL_SPECIAL_DEPTH = 5;
/**
 * Roll for mercurial magic effect.
 *
 * In DCC, mercurial magic is rolled on d100 + (Luck modifier × 10).
 * This creates a range roughly from -20 to 130+.
 *
 * When the drawn entry carries a `special` instruction (e.g. Table 5-2's
 * 99 "Roll again twice."), the special is expanded: `count` sub-rolls are
 * made with the special's `formula` (default "1d100") plus the same luck
 * modifier, and the returned effect combines the sub-effects (individually
 * available via `subEffects`). Sub-rolls landing on another special entry
 * recurse, capped at {@link MAX_MERCURIAL_SPECIAL_DEPTH}.
 *
 * @param luckModifier - Character's luck modifier
 * @param table - Mercurial magic table to look up the result
 * @param options - Roll options
 * @returns The mercurial effect
 */
export declare function rollMercurialMagic(luckModifier: number, table: MercurialTable, options?: RollOptions): MercurialEffect;
/**
 * Expand a looked-up special (`rollAgain`) effect into its sub-effects.
 *
 * Useful directly for consumers that resolved an effect via
 * {@link lookupMercurialEffect} (e.g. a manual "look up value 99") and
 * want it expanded with real rolls. No-op (returns the effect unchanged)
 * when the effect carries no special or is already expanded.
 *
 * @param effect - A special-carrying effect from `lookupMercurialEffect`
 * @param luckModifier - Character's luck modifier (applied to sub-rolls)
 * @param table - The mercurial table to draw sub-effects from
 * @param options - Roll options (the roller receives the sub-roll formula)
 * @param depth - Current recursion depth (internal; defaults to 0)
 * @returns A combined effect with `subEffects` populated
 */
export declare function expandMercurialSpecial(effect: MercurialEffect, luckModifier: number, table: MercurialTable, options?: RollOptions, depth?: number): MercurialEffect;
/**
 * Look up a mercurial effect by roll value.
 *
 * Pure lookup — a `special` entry is NOT expanded (no roller is available
 * here); its instruction is copied onto the returned effect so callers can
 * detect it (`effect.special && !effect.subEffects`) and expand via
 * {@link expandMercurialSpecial} or their own roll machinery.
 */
export declare function lookupMercurialEffect(roll: number, table: MercurialTable): MercurialEffect;
/**
 * Check if a mercurial effect should trigger based on the spell check result.
 *
 * A combined (roll-again) effect triggers when ANY of its sub-effects
 * would trigger — the sub-effects are independent effects that each
 * apply on their own terms, so callers wanting per-effect precision
 * should iterate `subEffects` and check each individually.
 *
 * @param effect - The mercurial effect to check
 * @param natural - The natural roll on the spell check
 * @param success - Whether the spell check succeeded
 * @returns True if the effect should trigger
 */
export declare function shouldMercurialTrigger(effect: MercurialEffect, natural: number, success: boolean): boolean;
/**
 * Get the spell check modifier from a mercurial effect.
 * Returns 0 if the effect doesn't provide a modifier.
 *
 * For a combined (roll-again) effect the sub-effect modifiers are
 * summed — every sub-effect applies.
 */
export declare function getMercurialModifier(effect: MercurialEffect): number;
/**
 * Get the dice modifier from a mercurial effect (e.g., "+1d4").
 * Returns undefined if the effect doesn't provide a dice modifier.
 *
 * For a combined (roll-again) effect the sub-effect dice modifiers are
 * concatenated (e.g. "+1d4" and "+1d3" → "+1d4+1d3") — every
 * sub-effect applies.
 */
export declare function getMercurialDiceModifier(effect: MercurialEffect): string | undefined;
/**
 * Get the duration adjustment from a mercurial effect.
 * Returns undefined if the effect doesn't modify duration.
 *
 * Durations don't combine — for a combined (roll-again) effect this
 * returns the FIRST sub-effect duration found; iterate `subEffects`
 * for per-effect durations.
 */
export declare function getMercurialDuration(effect: MercurialEffect): string | undefined;
/**
 * Get custom data from a mercurial effect.
 * Returns undefined if no custom data exists.
 *
 * Custom data doesn't merge — for a combined (roll-again) effect this
 * returns the FIRST sub-effect data found; iterate `subEffects` for
 * per-effect data.
 */
export declare function getMercurialData(effect: MercurialEffect): Record<string, unknown> | undefined;
/**
 * Mercurial effect classification
 */
export type MercurialClassification = "beneficial" | "detrimental" | "neutral" | "mixed";
/**
 * Classify a mercurial effect as beneficial, detrimental, neutral, or mixed.
 *
 * A combined (roll-again) effect is classified from its sub-effects:
 * uniformly beneficial/detrimental sub-effects keep that class, any
 * disagreement (or a mixed sub-effect) is "mixed", and all-neutral
 * stays "neutral".
 */
export declare function classifyMercurialEffect(effect: MercurialEffect): MercurialClassification;
/**
 * Get a summary of what the mercurial effect does numerically.
 *
 * A combined (roll-again) effect summarizes each sub-effect and joins
 * them with "; ".
 */
export declare function summarizeMercurialEffect(effect: MercurialEffect): string;
/**
 * Validate that a mercurial table has no gaps or overlaps.
 */
export declare function validateMercurialTable(table: MercurialTable): {
    valid: boolean;
    errors: string[];
};
/**
 * Get the roll range covered by a mercurial table.
 */
export declare function getMercurialTableRange(table: MercurialTable): {
    min: number;
    max: number;
};
/**
 * Count entries by classification.
 */
export declare function countMercurialByClassification(table: MercurialTable): Record<MercurialClassification, number>;
/**
 * Create a "no effect" mercurial result for spells that don't use mercurial magic.
 */
export declare function createNoMercurialEffect(): MercurialEffect;
/**
 * Check if a mercurial effect is the "no effect" placeholder.
 */
export declare function isMercurialEffectPlaceholder(effect: MercurialEffect): boolean;
