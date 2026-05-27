/**
 * Patron Bond Mechanics
 *
 * Pure functions for forming and managing patron bonds.
 * A patron bond is the supernatural contract between a wizard/elf
 * and their patron, granting access to Invoke Patron and patron spells.
 */
import { getPatron, getPatronSpells } from "./registry.js";
// =============================================================================
// Bond Creation
// =============================================================================
/**
 * Create a new patron bond.
 *
 * @param patronId - The patron's ID
 * @param options - Optional bond configuration
 * @returns A new patron bond record
 */
export function createPatronBond(patronId, options) {
    const bond = {
        patronId,
        bondedAt: new Date().toISOString(),
        taintCount: 0,
    };
    if (options?.bondStrength !== undefined) {
        bond.bondStrength = options.bondStrength;
    }
    if (options?.notes !== undefined) {
        bond.notes = options.notes;
    }
    return bond;
}
// =============================================================================
// Bond Validation
// =============================================================================
/**
 * Check if a character can form a bond with a patron.
 *
 * @param character - The character attempting to bond
 * @param patronId - The patron to bond with
 * @returns Object with canBond flag and reason if false
 */
export function canFormPatronBond(character, patronId) {
    // Must be a wizard or elf
    const classId = character.classInfo?.classId;
    if (!classId || (classId !== "wizard" && classId !== "elf")) {
        return { canBond: false, reason: "Only wizards and elves can bond with patrons" };
    }
    // Check if patron exists
    const patron = getPatron(patronId);
    if (!patron) {
        return { canBond: false, reason: `Patron "${patronId}" is not registered` };
    }
    // Check if already bonded to a patron
    const existingPatron = getCharacterPatronId(character);
    if (existingPatron) {
        return {
            canBond: false,
            reason: `Already bonded to patron "${existingPatron}". Breaking a patron bond is extremely dangerous.`,
        };
    }
    return { canBond: true };
}
/**
 * Get the patron ID from a character's state.
 *
 * @param character - The character
 * @returns Patron ID or undefined if not bonded
 */
export function getCharacterPatronId(character) {
    return (character.state.classState?.wizard?.patron ??
        character.state.classState?.elf?.patron);
}
/**
 * Check if a character has a patron bond.
 *
 * @param character - The character
 * @returns True if character has a patron
 */
export function hasPatronBond(character) {
    return getCharacterPatronId(character) !== undefined;
}
// =============================================================================
// Bond Formation
// =============================================================================
/**
 * Form a patron bond for a wizard.
 * Returns the updated wizard state.
 *
 * @param currentState - Current wizard state (or undefined for new)
 * @param patronId - The patron to bond with
 * @param patronDef - The patron definition (optional, for validation)
 * @returns Updated wizard state
 */
export function formWizardPatronBond(currentState, patronId, _patronDef) {
    const result = {
        corruption: currentState?.corruption ?? [],
        patron: patronId,
    };
    // Only add optional properties if they have values (exactOptionalPropertyTypes)
    if (currentState?.familiar !== undefined) {
        result.familiar = currentState.familiar;
    }
    if (currentState?.spellburnDamage !== undefined) {
        result.spellburnDamage = currentState.spellburnDamage;
    }
    if (currentState?.spellbook !== undefined) {
        result.spellbook = currentState.spellbook;
    }
    return result;
}
/**
 * Form a patron bond for an elf.
 * Returns the updated elf state.
 *
 * @param currentState - Current elf state (or undefined for new)
 * @param patronId - The patron to bond with
 * @param patronDef - The patron definition (optional, for validation)
 * @returns Updated elf state
 */
export function formElfPatronBond(currentState, patronId, _patronDef) {
    const result = {
        patron: patronId,
        corruption: currentState?.corruption ?? [],
    };
    // Only add optional properties if they have values (exactOptionalPropertyTypes)
    if (currentState?.spellbook !== undefined) {
        result.spellbook = currentState.spellbook;
    }
    return result;
}
// =============================================================================
// Patron Spell Grants
// =============================================================================
/**
 * Get the patron spells available to a character.
 *
 * @param character - The character
 * @returns Array of available patron spell IDs
 */
export function getAvailablePatronSpells(character) {
    const patronId = getCharacterPatronId(character);
    if (!patronId)
        return [];
    const level = character.classInfo?.level ?? 0;
    const grants = getPatronSpells(patronId, level);
    return grants.map((g) => g.spellId);
}
/**
 * Check if a character can learn a specific patron spell.
 *
 * @param character - The character
 * @param spellId - The spell to check
 * @returns True if the spell is available from their patron at their level
 */
export function canLearnPatronSpell(character, spellId) {
    return getAvailablePatronSpells(character).includes(spellId);
}
/**
 * Create a spellbook entry for a patron spell.
 *
 * @param spellId - The patron spell ID
 * @returns A new spellbook entry
 */
export function createPatronSpellEntry(spellId) {
    return {
        spellId,
        lost: false,
        learnedAt: new Date().toISOString(),
        notes: "Patron spell",
    };
}
// =============================================================================
// Taint Tracking
// =============================================================================
/**
 * Increment the taint count on a patron bond.
 *
 * @param bond - The current patron bond
 * @returns Updated patron bond with incremented taint count
 */
export function incrementTaintCount(bond) {
    return {
        ...bond,
        taintCount: bond.taintCount + 1,
    };
}
/**
 * Add a taint description to the bond notes.
 *
 * @param bond - The current patron bond
 * @param taintDescription - Description of the taint received
 * @returns Updated patron bond
 */
export function addTaintToNotes(bond, taintDescription) {
    const timestamp = new Date().toISOString().split("T")[0] ?? "unknown";
    const taintNote = `[${timestamp}] Taint: ${taintDescription}`;
    const currentNotes = bond.notes ?? "";
    const newNotes = currentNotes
        ? `${currentNotes}\n${taintNote}`
        : taintNote;
    return {
        ...bond,
        taintCount: bond.taintCount + 1,
        notes: newNotes,
    };
}
/**
 * Get information about breaking a patron bond.
 * This doesn't actually break the bond - just informs about consequences.
 *
 * @param patronId - The patron whose bond would be broken
 * @returns Information about consequences
 */
export function getPatronBondBreakConsequences(patronId) {
    const patron = getPatron(patronId);
    const patronName = patron?.name ?? patronId;
    return {
        description: `Breaking the bond with ${patronName} would be an act of supreme betrayal. ` +
            `The patron may hunt the former servant, curse them, or worse. ` +
            `Few who break a patron bond survive unscathed.`,
        suggestedEffects: [
            "Immediate corruption or patron taint",
            "Loss of all patron-granted spells",
            "Permanent curse from the patron",
            "Patron sends agents to punish the betrayer",
            "Other patrons may refuse to bond with such an unreliable servant",
        ],
        potentiallyFatal: true,
    };
}
/**
 * Check if a character is eligible to break their patron bond.
 * This is always possible but always dangerous.
 *
 * @param character - The character
 * @returns Object with canBreak flag and warning
 */
export function canBreakPatronBond(character) {
    const patronId = getCharacterPatronId(character);
    if (!patronId) {
        return {
            canBreak: false,
            warning: "Character has no patron bond to break",
        };
    }
    const consequences = getPatronBondBreakConsequences(patronId);
    return {
        canBreak: true,
        warning: consequences.description,
    };
}
//# sourceMappingURL=bond.js.map