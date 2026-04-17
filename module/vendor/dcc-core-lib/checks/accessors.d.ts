/**
 * Character Accessors
 *
 * Defines how check IDs map to character data.
 * This separates the "what" (ability ID like 'str') from the
 * "how to get it" (character.state.abilities.str.current).
 *
 * Default accessors work with the standard Character type.
 * Override for custom character structures or different game systems.
 *
 * @example
 * // Default behavior
 * rollCheck(Ability.STR, character);
 * // Internally: getAbilityScore(character, 'str') → character.state.abilities.str.current
 *
 * @example
 * // Custom accessors for a different character structure
 * const myAccessors: CharacterAccessors = {
 *   getAbilityScore: (char, id) => char.stats[id],
 *   getSaveBonus: (char, id) => char.saves[id],
 *   getLevel: (char) => char.level,
 *   getLuck: (char) => char.stats.lck,
 * };
 * rollCheck(Ability.STR, character, { accessors: myAccessors });
 */
import type { Character } from "../types/index.js";
/**
 * Functions to extract check-relevant data from a character.
 *
 * Mapping summary (default DCC):
 * - Ability ID 'str' → character.state.abilities.str.current
 * - Save ID 'reflex' → character.state.saves.reflex (bonus)
 * - Level → character.classInfo?.level ?? 0
 * - Luck → character.state.abilities.lck.current
 */
export interface CharacterAccessors {
    /**
     * Get an ability score value for modifier calculation.
     *
     * Default mapping: id → character.state.abilities[id].current
     *
     * @param character - The character
     * @param abilityId - The ability ID (e.g., 'str', 'agl')
     * @returns The ability score (e.g., 16), or undefined if not found
     */
    getAbilityScore: (character: Character, abilityId: string) => number | undefined;
    /**
     * Get a saving throw bonus (class-based bonus, not ability modifier).
     *
     * Default mapping: id → character.state.saves[id]
     *
     * @param character - The character
     * @param saveId - The save ID (e.g., 'reflex', 'fortitude', 'will')
     * @returns The save bonus (e.g., 2), or 0 if not found
     */
    getSaveBonus: (character: Character, saveId: string) => number;
    /**
     * Get the character's level.
     *
     * Default mapping: character.classInfo?.level ?? 0
     *
     * @param character - The character
     * @returns The character level (0 for 0-level characters)
     */
    getLevel: (character: Character) => number;
    /**
     * Get the character's current luck score (for luck burning).
     *
     * Default mapping: character.state.abilities.lck.current
     *
     * @param character - The character
     * @returns The current luck score
     */
    getLuck: (character: Character) => number;
    /**
     * Get the character's class ID.
     *
     * Default mapping: character.classInfo?.classId
     *
     * @param character - The character
     * @returns The class ID, or undefined for 0-level
     */
    getClassId: (character: Character) => string | undefined;
}
/**
 * Default accessors for standard DCC Character structure.
 *
 * These map check IDs to the standard character data paths:
 *
 * | Check ID    | Character Path                          |
 * |-------------|----------------------------------------|
 * | 'str'       | state.abilities.str.current            |
 * | 'agl'       | state.abilities.agl.current            |
 * | 'sta'       | state.abilities.sta.current            |
 * | 'per'       | state.abilities.per.current            |
 * | 'int'       | state.abilities.int.current            |
 * | 'lck'       | state.abilities.lck.current            |
 * | 'reflex'    | state.saves.reflex (bonus only)        |
 * | 'fortitude' | state.saves.fortitude (bonus only)     |
 * | 'will'      | state.saves.will (bonus only)          |
 * | level       | classInfo?.level ?? 0                  |
 * | classId     | classInfo?.classId                     |
 */
export declare const DEFAULT_ACCESSORS: CharacterAccessors;
/**
 * Extract all ability scores as a flat record.
 *
 * This is used internally by resolveSkillCheck which expects
 * a Record<string, number> of ability scores.
 *
 * @param character - The character
 * @param accessors - The accessors to use
 * @param abilityIds - Which ability IDs to extract (defaults to standard DCC)
 */
export declare function extractAbilityScores(character: Character, accessors?: CharacterAccessors, abilityIds?: string[]): Record<string, number>;
//# sourceMappingURL=accessors.d.ts.map