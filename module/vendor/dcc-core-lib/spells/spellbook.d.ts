/**
 * Spellbook Management
 *
 * Pure functions for managing a character's known spells.
 * Handles adding/removing spells, tracking lost spells, and spell limits.
 */
import type { Spellbook, SpellbookEntry, SpellDefinition, MercurialEffect, CasterType } from "../types/spells.js";
import type { DeepReadonly } from "../types/character.js";
/**
 * Find a spell entry in a spellbook by ID
 */
export declare function findSpellEntry(spellbook: DeepReadonly<Spellbook>, spellId: string): SpellbookEntry | undefined;
/**
 * Check if a spell is known
 */
export declare function knowsSpell(spellbook: DeepReadonly<Spellbook>, spellId: string): boolean;
/**
 * Check if a spell is currently lost (for the day)
 */
export declare function isSpellLost(spellbook: DeepReadonly<Spellbook>, spellId: string): boolean;
/**
 * Get count of spells known at a specific level
 */
export declare function getSpellCountAtLevel(spellbook: DeepReadonly<Spellbook>, spells: DeepReadonly<SpellDefinition[]>, level: number): number;
/**
 * Get all spell entries at a specific level
 */
export declare function getSpellsAtLevel(spellbook: DeepReadonly<Spellbook>, spells: DeepReadonly<SpellDefinition[]>, level: number): SpellbookEntry[];
/**
 * Get all lost spells
 */
export declare function getLostSpells(spellbook: DeepReadonly<Spellbook>): SpellbookEntry[];
/**
 * Get all castable (not lost) spells from a spellbook
 */
export declare function getCastableSpells(spellbook: DeepReadonly<Spellbook>): SpellbookEntry[];
/**
 * Result of checking if a spell can be learned
 */
export interface CanLearnResult {
    /** Whether the spell can be learned */
    allowed: boolean;
    /** Reason if not allowed */
    reason?: string;
}
/**
 * Check if a character can learn a specific spell
 */
export declare function canLearnSpell(spellbook: DeepReadonly<Spellbook>, spell: DeepReadonly<SpellDefinition>, casterType: CasterType, allSpells: DeepReadonly<SpellDefinition[]>): CanLearnResult;
/**
 * Add a spell to a spellbook.
 * Returns a new spellbook with the spell added.
 */
export declare function addSpellToSpellbook(spellbook: DeepReadonly<Spellbook>, spell: DeepReadonly<SpellDefinition>, mercurialEffect?: MercurialEffect, manifestation?: string): Spellbook;
/**
 * Remove a spell from a spellbook.
 * Returns a new spellbook with the spell removed.
 */
export declare function removeSpellFromSpellbook(spellbook: DeepReadonly<Spellbook>, spellId: string): Spellbook;
/**
 * Mark a spell as lost for the day.
 * Returns a new spellbook with the spell marked as lost.
 */
export declare function markSpellLost(spellbook: DeepReadonly<Spellbook>, spellId: string): Spellbook;
/**
 * Mark a spell as recovered (no longer lost).
 * Returns a new spellbook with the spell marked as available.
 */
export declare function markSpellRecovered(spellbook: DeepReadonly<Spellbook>, spellId: string): Spellbook;
/**
 * Recover all lost spells (after rest/prayer).
 * Returns a new spellbook with all spells marked as available.
 */
export declare function recoverAllSpells(spellbook: DeepReadonly<Spellbook>): Spellbook;
/**
 * Update the last result for a spell (for GM adjustment feature).
 * Returns a new spellbook with the result recorded.
 */
export declare function updateSpellLastResult(spellbook: DeepReadonly<Spellbook>, spellId: string, result: number): Spellbook;
/**
 * Update notes for a spell.
 * Returns a new spellbook with updated notes.
 */
export declare function updateSpellNotes(spellbook: DeepReadonly<Spellbook>, spellId: string, notes: string | undefined): Spellbook;
/**
 * Set the maximum spells per level limits.
 * Returns a new spellbook with updated limits.
 */
export declare function setSpellLimits(spellbook: DeepReadonly<Spellbook>, limits: Partial<Record<number, number>>): Spellbook;
/**
 * Update a spell's mercurial effect.
 * Returns a new spellbook with updated mercurial effect.
 */
export declare function updateMercurialEffect(spellbook: DeepReadonly<Spellbook>, spellId: string, mercurialEffect: MercurialEffect | undefined): Spellbook;
//# sourceMappingURL=spellbook.d.ts.map