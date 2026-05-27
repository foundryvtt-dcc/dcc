/**
 * Spell System Types
 *
 * Comprehensive types for DCC spell casting including:
 * - Spell definitions (external JSON data)
 * - Spellbooks (character-specific spell knowledge)
 * - Mercurial magic effects
 * - Spell casting input/output
 * - Corruption and fumble results
 */
/**
 * Standard caster profiles for DCC classes
 */
export const CASTER_PROFILES = {
    wizard: {
        type: "wizard",
        spellCheckAbility: "int",
        usesMercurial: true,
        usesCorruption: true,
        usesDisapproval: false,
        canSpellburn: true,
        lostSpellRecovery: "rest",
    },
    cleric: {
        type: "cleric",
        spellCheckAbility: "per",
        usesMercurial: false,
        usesCorruption: false,
        usesDisapproval: true,
        canSpellburn: false,
        lostSpellRecovery: "prayer",
    },
    elf: {
        type: "elf",
        spellCheckAbility: "int",
        usesMercurial: true,
        usesCorruption: true,
        usesDisapproval: false,
        canSpellburn: true,
        lostSpellRecovery: "rest",
    },
};
/**
 * Create an empty spellbook
 */
export function createEmptySpellbook() {
    return {
        spells: [],
    };
}
/**
 * Create an empty spellburn commitment
 */
export function createEmptySpellburn() {
    return { str: 0, agl: 0, sta: 0 };
}
/**
 * Calculate total spellburn points
 */
export function totalSpellburn(commitment) {
    return commitment.str + commitment.agl + commitment.sta;
}
//# sourceMappingURL=spells.js.map