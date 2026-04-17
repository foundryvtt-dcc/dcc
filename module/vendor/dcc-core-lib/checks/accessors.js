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
export const DEFAULT_ACCESSORS = {
    getAbilityScore: (character, abilityId) => {
        const abilities = character.state.abilities;
        return abilities[abilityId]?.current;
    },
    getSaveBonus: (character, saveId) => {
        const saves = character.state.saves;
        switch (saveId) {
            case "reflex":
                return saves.reflex;
            case "fortitude":
                return saves.fortitude;
            case "will":
                return saves.will;
            default:
                return 0;
        }
    },
    getLevel: (character) => {
        return character.classInfo?.level ?? 0;
    },
    getLuck: (character) => {
        return character.state.abilities.lck.current;
    },
    getClassId: (character) => {
        return character.classInfo?.classId;
    },
};
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
export function extractAbilityScores(character, accessors = DEFAULT_ACCESSORS, abilityIds = ["str", "agl", "sta", "per", "int", "lck"]) {
    const scores = {};
    for (const id of abilityIds) {
        const score = accessors.getAbilityScore(character, id);
        if (score !== undefined) {
            scores[id] = score;
        }
    }
    return scores;
}
//# sourceMappingURL=accessors.js.map