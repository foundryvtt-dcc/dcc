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
// Text parser
export { parsePurpleSorcererText } from "./parse-text.js";
// JSON parser
export { parsePurpleSorcererJson } from "./parse-json.js";
// Converter
export { convertPSCharacter, convertPSCharacters } from "./convert.js";
import { parsePurpleSorcererText } from "./parse-text.js";
import { parsePurpleSorcererJson } from "./parse-json.js";
/**
 * Detect if input is JSON format
 */
function isJsonFormat(input) {
    const trimmed = input.trim();
    return trimmed.startsWith("{") || trimmed.startsWith("[");
}
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
export function parsePurpleSorcerer(input) {
    if (!input.trim()) {
        return {
            success: false,
            characters: [],
            errors: ["Empty input"],
            warnings: [],
        };
    }
    if (isJsonFormat(input)) {
        return parsePurpleSorcererJson(input);
    }
    return parsePurpleSorcererText(input);
}
// =============================================================================
// Stat Block Parser
// =============================================================================
export { parseStatBlock, parseStatBlocks } from "./parse-statblock.js";
//# sourceMappingURL=index.js.map