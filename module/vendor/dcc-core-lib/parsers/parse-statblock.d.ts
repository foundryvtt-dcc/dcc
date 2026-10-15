/**
 * NPC/Creature Stat Block Parser
 *
 * Parses DCC RPG stat blocks from text format into Creature objects.
 *
 * @example
 * const result = parseStatBlock(
 *   "Goblin: Init +1; Atk club +0 melee (1d4); AC 11; HD 1d6; MV 30'; Act 1d20; SV Fort +3, Ref +4, Will -1; AL C."
 * );
 * if (result.success) {
 *   console.log(result.creature);
 * }
 */
import type { StatBlockParseResult, StatBlockParseOptions } from "./statblock-types.js";
/**
 * Parse a DCC stat block string into a Creature object
 *
 * @param statblock - The stat block text to parse
 * @param options - Optional parsing configuration
 * @returns Parse result with creature data or error
 *
 * @example
 * parseStatBlock("Road Reaver: Init +1; Atk hooked blade +3 melee (1d7+1); AC 14; HD 1d10; MV 25'; Act 1d20; SV Fort +2, Ref +4, Will -1; AL C.")
 */
export declare function parseStatBlock(statblock: string, options?: StatBlockParseOptions): StatBlockParseResult;
/**
 * Parse multiple stat blocks from text (separated by blank lines or double newlines)
 */
export declare function parseStatBlocks(text: string, options?: StatBlockParseOptions): StatBlockParseResult[];
