/**
 * Character Serialization
 *
 * Functions for exporting and importing characters as JSON.
 */
import type { Character } from "../types/character.js";
/**
 * Current export format version.
 * Increment when making breaking changes to the format.
 *
 * 1.1 — dropped `ThiefState.backstabMultiplier` (DCC backstab is
 *       auto-crit + Table 1-9 attack bonus, not a damage multiplier).
 *       Legacy imports are migrated automatically on read.
 */
export declare const CHARACTER_FORMAT_VERSION = "1.1";
/**
 * Exported character wrapper with metadata.
 */
export interface ExportedCharacter {
    /** Format version for compatibility checking */
    version: string;
    /** Format identifier */
    format: "dcc-core-lib";
    /** Export timestamp (ISO 8601) */
    exportedAt: string;
    /** The character data */
    character: Character;
}
/**
 * Options for character export.
 */
export interface ExportOptions {
    /** Pretty print with indentation (default: true) */
    pretty?: boolean;
    /** Indentation spaces when pretty printing (default: 2) */
    indent?: number;
}
/**
 * Export a character to JSON string.
 *
 * @param character - The character to export
 * @param options - Export options
 * @returns JSON string representation
 */
export declare function exportCharacter(character: Character, options?: ExportOptions): string;
/**
 * Export just the character data without wrapper metadata.
 *
 * @param character - The character to export
 * @param options - Export options
 * @returns JSON string of character data only
 */
export declare function exportCharacterRaw(character: Character, options?: ExportOptions): string;
/**
 * Result of importing a character.
 */
export interface ImportResult {
    /** Whether the import was successful */
    success: boolean;
    /** The imported character (if successful) */
    character?: Character | undefined;
    /** Error message (if failed) */
    error?: string | undefined;
    /** Warnings about the import (e.g., version mismatch) */
    warnings?: string[] | undefined;
}
/**
 * Import a character from JSON string.
 *
 * Accepts both wrapped format (with metadata) and raw character JSON.
 *
 * @param json - JSON string to import
 * @returns Import result with character or error
 */
export declare function importCharacter(json: string): ImportResult;
/**
 * Result of peeking at exported character metadata.
 */
export interface PeekResult {
    valid: boolean;
    version?: string | undefined;
    format?: string | undefined;
    exportedAt?: string | undefined;
    characterName?: string | undefined;
    occupation?: string | undefined;
    error?: string | undefined;
}
/**
 * Parse exported character metadata without importing the full character.
 * Useful for previewing before import.
 */
export declare function peekExportedCharacter(json: string): PeekResult;
//# sourceMappingURL=serialize.d.ts.map