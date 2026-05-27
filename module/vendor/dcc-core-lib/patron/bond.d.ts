/**
 * Patron Bond Mechanics
 *
 * Pure functions for forming and managing patron bonds.
 * A patron bond is the supernatural contract between a wizard/elf
 * and their patron, granting access to Invoke Patron and patron spells.
 */
import type { Character } from "../types/character.js";
import type { PatronBond, PatronDefinition } from "../types/patron.js";
import type { SpellbookEntry, Spellbook } from "../types/spells.js";
/**
 * Create a new patron bond.
 *
 * @param patronId - The patron's ID
 * @param options - Optional bond configuration
 * @returns A new patron bond record
 */
export declare function createPatronBond(patronId: string, options?: {
    bondStrength?: "weak" | "normal" | "strong";
    notes?: string;
}): PatronBond;
/**
 * Check if a character can form a bond with a patron.
 *
 * @param character - The character attempting to bond
 * @param patronId - The patron to bond with
 * @returns Object with canBond flag and reason if false
 */
export declare function canFormPatronBond(character: Character, patronId: string): {
    canBond: boolean;
    reason?: string;
};
/**
 * Get the patron ID from a character's state.
 *
 * @param character - The character
 * @returns Patron ID or undefined if not bonded
 */
export declare function getCharacterPatronId(character: Character): string | undefined;
/**
 * Check if a character has a patron bond.
 *
 * @param character - The character
 * @returns True if character has a patron
 */
export declare function hasPatronBond(character: Character): boolean;
/**
 * Form a patron bond for a wizard.
 * Returns the updated wizard state.
 *
 * @param currentState - Current wizard state (or undefined for new)
 * @param patronId - The patron to bond with
 * @param patronDef - The patron definition (optional, for validation)
 * @returns Updated wizard state
 */
export declare function formWizardPatronBond(currentState: {
    corruption: string[];
    patron?: string;
    familiar?: string;
    spellburnDamage?: Partial<Record<string, number>>;
    spellbook?: Spellbook;
} | undefined, patronId: string, _patronDef?: PatronDefinition): {
    corruption: string[];
    patron: string;
    familiar?: string;
    spellburnDamage?: Partial<Record<string, number>>;
    spellbook?: Spellbook;
};
/**
 * Form a patron bond for an elf.
 * Returns the updated elf state.
 *
 * @param currentState - Current elf state (or undefined for new)
 * @param patronId - The patron to bond with
 * @param patronDef - The patron definition (optional, for validation)
 * @returns Updated elf state
 */
export declare function formElfPatronBond(currentState: {
    patron?: string;
    corruption: string[];
    spellbook?: Spellbook;
} | undefined, patronId: string, _patronDef?: PatronDefinition): {
    patron: string;
    corruption: string[];
    spellbook?: Spellbook;
};
/**
 * Get the patron spells available to a character.
 *
 * @param character - The character
 * @returns Array of available patron spell IDs
 */
export declare function getAvailablePatronSpells(character: Character): string[];
/**
 * Check if a character can learn a specific patron spell.
 *
 * @param character - The character
 * @param spellId - The spell to check
 * @returns True if the spell is available from their patron at their level
 */
export declare function canLearnPatronSpell(character: Character, spellId: string): boolean;
/**
 * Create a spellbook entry for a patron spell.
 *
 * @param spellId - The patron spell ID
 * @returns A new spellbook entry
 */
export declare function createPatronSpellEntry(spellId: string): SpellbookEntry;
/**
 * Increment the taint count on a patron bond.
 *
 * @param bond - The current patron bond
 * @returns Updated patron bond with incremented taint count
 */
export declare function incrementTaintCount(bond: PatronBond): PatronBond;
/**
 * Add a taint description to the bond notes.
 *
 * @param bond - The current patron bond
 * @param taintDescription - Description of the taint received
 * @returns Updated patron bond
 */
export declare function addTaintToNotes(bond: PatronBond, taintDescription: string): PatronBond;
/**
 * Information about the consequences of breaking a patron bond.
 * In DCC, this is extremely dangerous and often results in death or worse.
 */
export interface BondBreakConsequences {
    /** Description of the consequences */
    description: string;
    /** Suggested mechanical effects */
    suggestedEffects: string[];
    /** Is this potentially fatal? */
    potentiallyFatal: boolean;
}
/**
 * Get information about breaking a patron bond.
 * This doesn't actually break the bond - just informs about consequences.
 *
 * @param patronId - The patron whose bond would be broken
 * @returns Information about consequences
 */
export declare function getPatronBondBreakConsequences(patronId: string): BondBreakConsequences;
/**
 * Check if a character is eligible to break their patron bond.
 * This is always possible but always dangerous.
 *
 * @param character - The character
 * @returns Object with canBreak flag and warning
 */
export declare function canBreakPatronBond(character: Character): {
    canBreak: boolean;
    warning: string;
};
//# sourceMappingURL=bond.d.ts.map