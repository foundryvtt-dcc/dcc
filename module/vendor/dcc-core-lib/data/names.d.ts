/**
 * Fan-Made Name Generation Data
 *
 * DISCLAIMER: This is FAN-MADE CONTENT, not official DCC RPG material.
 * These names are original creations for use with the dcc-core-lib.
 */
import type { RandomSource } from "../types/random.js";
/**
 * Name data organized by ancestry/race.
 */
export interface NameData {
    /** Display name for this ancestry */
    ancestry: string;
    /** First names */
    firstNames: string[];
    /** Optional epithets/titles (e.g., "the Bold", "Ironfoot") */
    epithets?: string[];
}
/**
 * Collection of all name data.
 */
export interface NameGenerationData {
    human: NameData;
    dwarf: NameData;
    elf: NameData;
    halfling: NameData;
}
/**
 * Options for name generation.
 */
export interface NameGenerationOptions {
    /** Include an epithet (default: false) */
    includeEpithet?: boolean;
    /** Chance of epithet if includeEpithet is true (0-1, default: 0.3) */
    epithetChance?: number;
}
/**
 * Result of name generation.
 */
export interface GeneratedName {
    /** The first name */
    firstName: string;
    /** Optional epithet */
    epithet?: string;
    /** Full formatted name */
    fullName: string;
    /** The ancestry used */
    ancestry: string;
}
/**
 * Default name generation data with all ancestries.
 */
export declare const DEFAULT_NAME_DATA: NameGenerationData;
/**
 * Ancestry type for name generation.
 */
export type Ancestry = keyof NameGenerationData;
/**
 * Generate a random name for the given ancestry.
 *
 * @param ancestry - The ancestry/race to generate a name for
 * @param data - Name generation data (defaults to DEFAULT_NAME_DATA)
 * @param options - Generation options
 * @param random - Random source (defaults to createDefaultRandomSource())
 * @returns Generated name result
 */
export declare function generateName(ancestry: Ancestry, data?: NameGenerationData, options?: NameGenerationOptions, random?: RandomSource): GeneratedName;
/**
 * Detect likely ancestry from occupation name.
 * Returns 'human' as default if no specific ancestry detected.
 *
 * @param occupation - The occupation string to analyze
 * @returns Detected ancestry
 */
export declare function detectAncestryFromOccupation(occupation: string): Ancestry;
/**
 * Generate a name based on the character's occupation.
 * Automatically detects ancestry from occupation keywords.
 *
 * @param occupation - The character's occupation
 * @param data - Name generation data
 * @param options - Generation options
 * @param random - Random source
 * @returns Generated name result
 */
export declare function generateNameForOccupation(occupation: string, data?: NameGenerationData, options?: NameGenerationOptions, random?: RandomSource): GeneratedName;
//# sourceMappingURL=names.d.ts.map