/**
 * Spell Check Orchestration
 *
 * High-level function that orchestrates the complete spell check process:
 * 1. Builds spell check input from character state
 * 2. Performs the spell check roll
 * 3. Handles follow-up rolls (corruption, fumble, disapproval)
 * 4. Returns comprehensive result
 *
 * This is the main entry point for spell casting in applications.
 */
import type { Character } from "../types/character.js";
import type { DieType, LegacyRollModifier } from "../types/dice.js";
import type { SimpleTable, TieredTable } from "../tables/types.js";
import type { SpellDefinition, SpellbookEntry, SpellCastInput, SpellCastResult, SpellCheckOptions, SpellEvents, CasterProfile, SpellburnCommitment } from "../types/spells.js";
import type { DisapprovalResult } from "./disapproval.js";
/**
 * Simplified input for spell checks.
 * The function will extract needed data from character state.
 */
export interface SpellCheckInput {
    /** The spell being cast (definition) */
    spell: SpellDefinition;
    /** Luck to burn on this check (optional) */
    luckBurn?: number;
    /** Spellburn commitment (wizard/elf only) */
    spellburn?: SpellburnCommitment;
    /** Situational modifiers to apply */
    situationalModifiers?: LegacyRollModifier[];
    /** Action die override (if not d20) */
    actionDie?: DieType;
    /** Result table for spell effects (pre-loaded) */
    resultTable?: TieredTable;
    /** Fumble table (pre-loaded) */
    fumbleTable?: SimpleTable;
    /** Corruption table (pre-loaded) */
    corruptionTable?: SimpleTable;
    /** Disapproval table (pre-loaded, for clerics) */
    disapprovalTable?: SimpleTable;
    /** Patron taint table (pre-loaded, if applicable) */
    patronTaintTable?: SimpleTable;
    /**
     * Current patron-taint chance as integer percent. Defaults to 1 when
     * omitted. See `SpellCastInput.patronTaintChance`.
     */
    patronTaintChance?: number;
    /**
     * Caller override for "is this cast a patron-based spell?". When omitted,
     * the lib falls back to `spell.tags?.includes('patron')`.
     */
    isPatronSpell?: boolean;
}
/**
 * Complete result of a spell check including all follow-up rolls
 */
export interface SpellCheckResult extends SpellCastResult {
    /** Disapproval result (if cleric triggered disapproval) */
    disapprovalResult?: DisapprovalResult;
    /** Updated spellbook entry (with lost status) */
    updatedSpellbookEntry?: SpellbookEntry;
    /** Error message if spell check could not be performed */
    error?: string;
}
/**
 * Get the caster level from character
 */
export declare function getCasterLevel(character: Character): number;
/**
 * Get the caster profile from character class
 */
export declare function getCasterProfileFromCharacter(character: Character): CasterProfile | undefined;
/**
 * Get the spell check ability score and modifier from character
 */
export declare function getSpellCheckAbility(character: Character, profile: CasterProfile): {
    score: number;
    modifier: number;
};
/**
 * Get current luck from character
 */
export declare function getCurrentLuck(character: Character): number;
/**
 * Get starting luck from character identity
 */
export declare function getStartingLuck(character: Character): number;
/**
 * Get luck modifier multiplier from birth augur
 */
export declare function getLuckMultiplier(character: Character): number;
/**
 * Get disapproval range for cleric
 */
export declare function getDisapprovalRange(character: Character): number;
/**
 * Get patron ID for wizard/elf
 */
export declare function getPatronId(character: Character): string | undefined;
/**
 * Get spellbook entry for a spell
 */
export declare function getSpellbookEntry(character: Character, spellId: string): SpellbookEntry | undefined;
/**
 * Build the full SpellCastInput from character state and simplified input
 */
export declare function buildSpellCastInput(character: Character, input: SpellCheckInput, profile: CasterProfile): SpellCastInput | {
    error: string;
};
/**
 * Calculate a complete spell check with all follow-up effects.
 *
 * This is the main entry point for spell casting. It:
 * 1. Validates the character can cast the spell
 * 2. Builds the full spell check input
 * 3. Performs the spell check roll
 * 4. Handles fumbles (for wizards/elves)
 * 5. Handles corruption (for wizards/elves)
 * 6. Handles disapproval (for clerics)
 * 7. Marks spell as lost if applicable
 * 8. Returns comprehensive result
 *
 * @param character - The character casting the spell
 * @param input - Simplified spell check input
 * @param options - Roll options
 * @param events - Event callbacks for UI integration
 * @returns Complete spell check result
 */
export declare function calculateSpellCheck(character: Character, input: SpellCheckInput, options?: SpellCheckOptions, events?: SpellEvents): SpellCheckResult;
/**
 * Check if a spell check result is successful
 */
export declare function isSpellCheckSuccess(result: SpellCheckResult): boolean;
/**
 * Check if a spell check result is a failure
 */
export declare function isSpellCheckFailure(result: SpellCheckResult): boolean;
/**
 * Get a summary of the spell check result for display
 */
export declare function getSpellCheckSummary(result: SpellCheckResult): string;
//# sourceMappingURL=spell-check.d.ts.map