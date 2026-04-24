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
 * Roll for mercurial magic effect.
 *
 * In DCC, mercurial magic is rolled on d100 + (Luck modifier × 10).
 * This creates a range roughly from -20 to 130+.
 *
 * @param luckModifier - Character's luck modifier
 * @param table - Mercurial magic table to look up the result
 * @param options - Roll options
 * @returns The mercurial effect
 */
export declare function rollMercurialMagic(luckModifier: number, table: MercurialTable, options?: RollOptions): MercurialEffect;
/**
 * Look up a mercurial effect by roll value.
 */
export declare function lookupMercurialEffect(roll: number, table: MercurialTable): MercurialEffect;
/**
 * Check if a mercurial effect should trigger based on the spell check result.
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
 */
export declare function getMercurialModifier(effect: MercurialEffect): number;
/**
 * Get the dice modifier from a mercurial effect (e.g., "+1d4").
 * Returns undefined if the effect doesn't provide a dice modifier.
 */
export declare function getMercurialDiceModifier(effect: MercurialEffect): string | undefined;
/**
 * Get the duration adjustment from a mercurial effect.
 * Returns undefined if the effect doesn't modify duration.
 */
export declare function getMercurialDuration(effect: MercurialEffect): string | undefined;
/**
 * Get custom data from a mercurial effect.
 * Returns undefined if no custom data exists.
 */
export declare function getMercurialData(effect: MercurialEffect): Record<string, unknown> | undefined;
/**
 * Mercurial effect classification
 */
export type MercurialClassification = "beneficial" | "detrimental" | "neutral" | "mixed";
/**
 * Classify a mercurial effect as beneficial, detrimental, neutral, or mixed.
 */
export declare function classifyMercurialEffect(effect: MercurialEffect): MercurialClassification;
/**
 * Get a summary of what the mercurial effect does numerically.
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
//# sourceMappingURL=mercurial.d.ts.map