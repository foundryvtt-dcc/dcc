/**
 * Corruption Module
 *
 * Pure functions for wizard/elf corruption mechanics.
 * Corruption represents the physical and mental toll of channeling
 * arcane energies, resulting in permanent mutations and deformities.
 */
import type { RollOptions } from "../types/dice.js";
import type { SimpleTable } from "../tables/types.js";
import type { CorruptionResult, PatronTaintResult } from "../types/spells.js";
import type { Character } from "../types/character.js";
/**
 * Roll for corruption effect.
 *
 * In DCC, corruption is typically rolled on d10 for minor,
 * d10+10 for major, or d10+20 for greater corruption.
 *
 * @param corruptionTable - Table to look up the result
 * @param tier - Corruption tier (determines die modifier)
 * @param options - Roll options
 * @returns The corruption result
 */
export declare function rollCorruption(corruptionTable: SimpleTable, tier?: "minor" | "major" | "greater", options?: RollOptions): CorruptionResult;
/**
 * Roll corruption with a specific modifier (e.g., from luck).
 */
export declare function rollCorruptionWithModifier(corruptionTable: SimpleTable, modifier: number, tier?: "minor" | "major" | "greater", options?: RollOptions): CorruptionResult;
/**
 * Add a corruption to a character's corruption list.
 * Returns the updated corruption array.
 */
export declare function addCorruption(currentCorruptions: readonly string[], newCorruption: CorruptionResult): string[];
/**
 * Get corruptions from a character's class state.
 * Works for both wizards and elves.
 */
export declare function getCorruptions(character: Character): readonly string[];
/**
 * Count the number of corruptions a character has.
 */
export declare function getCorruptionCount(character: Character): number;
/**
 * Check if a character has any corruptions.
 */
export declare function hasCorruptions(character: Character): boolean;
/**
 * Determine corruption tier based on spell level.
 * Higher level spells risk greater corruption.
 */
export declare function determineCorruptionTier(spellLevel: number): "minor" | "major" | "greater";
/**
 * Determine corruption tier based on roll result.
 */
export declare function getCorruptionSeverity(roll: number): "minor" | "major" | "greater";
/**
 * Roll for patron taint.
 * Patron taint is similar to corruption but specific to the patron.
 *
 * @param patronId - The patron's identifier
 * @param taintTable - Table to look up the result
 * @param options - Roll options
 * @returns The patron taint result
 */
export declare function rollPatronTaint(patronId: string, taintTable: SimpleTable, options?: RollOptions): PatronTaintResult;
/**
 * Remove a corruption from a character (very rare in DCC).
 * Returns the updated corruption array.
 *
 * Note: In most DCC games, corruption is permanent. This function
 * exists for special cases like divine intervention or powerful magic.
 */
export declare function removeCorruption(currentCorruptions: readonly string[], indexToRemove: number): string[];
/**
 * Remove all corruptions from a character (extremely rare).
 */
export declare function clearAllCorruptions(): string[];
//# sourceMappingURL=corruption.d.ts.map