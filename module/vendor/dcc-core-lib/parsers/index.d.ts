/**
 * Parser Module
 *
 * Parsers for various DCC RPG data formats:
 *
 * - **Purple Sorcerer Parser**: Parses character data from Purple Sorcerer's generators
 *   (text format and JSON format)
 * - **Stat Block Parser**: Parses NPC/creature stat blocks from text format
 *
 * @example
 * ```typescript
 * // Purple Sorcerer character import
 * import { parsePurpleSorcerer, convertPSCharacters } from "dcc-core-lib";
 *
 * const result = parsePurpleSorcerer(inputData);
 * if (result.success) {
 *   const characters = convertPSCharacters(result.characters);
 * }
 *
 * // NPC stat block parsing
 * import { parseStatBlock } from "dcc-core-lib";
 *
 * const result = parseStatBlock(
 *   "Goblin: Init +1; Atk club +0 melee (1d4); AC 11; HD 1d6; MV 30'; Act 1d20; SV Fort +0, Ref +1, Will -1; AL C."
 * );
 * if (result.success) {
 *   console.log(result.creature);
 * }
 * ```
 */
export type { PSCharacter, PSGeneratorSettings, PSAbilityScore, PSAbilityScores, PSWeapon, PSArmor, PSThiefSkill, PSSpell, PSLuckySign, PSClassType, PSParseResult, PSJsonZeroLevel, PSJsonCharacterList, } from "./purple-sorcerer-types.js";
export { parsePurpleSorcererText } from "./parse-text.js";
export { parsePurpleSorcererJson } from "./parse-json.js";
export { convertPSCharacter, convertPSCharacters } from "./convert.js";
export type { ConvertOptions } from "./convert.js";
import type { PSParseResult } from "./purple-sorcerer-types.js";
/**
 * Parse Purple Sorcerer data (auto-detects format)
 *
 * Supports:
 * - Text format (copy-paste from Purple Sorcerer website)
 * - JSON format (export from Purple Sorcerer API)
 *
 * @param input - Text or JSON data from Purple Sorcerer
 * @returns Parse result with characters and any errors/warnings
 */
export declare function parsePurpleSorcerer(input: string): PSParseResult;
export { parseStatBlock, parseStatBlocks } from "./parse-statblock.js";
export type { StatBlockParseResult, StatBlockParseOptions, ParsedAttack, ParsedStatBlock, } from "./statblock-types.js";
//# sourceMappingURL=index.d.ts.map