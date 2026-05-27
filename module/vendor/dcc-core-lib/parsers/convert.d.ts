/**
 * Purple Sorcerer to Character Converter
 *
 * Converts parsed Purple Sorcerer data to the library's Character type.
 */
import type { Alignment } from "../types/system.js";
import type { Character } from "../types/character.js";
import type { PSCharacter } from "./purple-sorcerer-types.js";
/**
 * Options for conversion
 */
export interface ConvertOptions {
    /**
     * Generate a unique ID for the character.
     * If not provided, a random UUID-like ID will be generated.
     */
    generateId?: () => string;
    /**
     * Default name if the character doesn't have one.
     * Purple Sorcerer doesn't generate names, so this is often needed.
     */
    defaultName?: string;
    /**
     * Default alignment for 0-level characters.
     */
    defaultAlignment?: Alignment;
}
/**
 * Convert a parsed Purple Sorcerer character to the library's Character type
 */
export declare function convertPSCharacter(ps: PSCharacter, options?: ConvertOptions): Character;
/**
 * Convert multiple parsed characters
 */
export declare function convertPSCharacters(characters: PSCharacter[], options?: ConvertOptions): Character[];
//# sourceMappingURL=convert.d.ts.map