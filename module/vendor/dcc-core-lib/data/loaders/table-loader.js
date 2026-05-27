/**
 * Table Data Loader
 *
 * Loads and parses rollable table data from external JSON sources.
 */
/**
 * Parse a raw table result into a TableEntry
 */
function parseTableResult(raw) {
    const range = raw.range;
    return {
        min: range[0],
        max: range[1],
        text: raw.description,
    };
}
/**
 * Load a rollable table from raw FoundryVTT data
 */
export function loadRollableTable(raw) {
    const entries = raw.results
        .map(parseTableResult)
        .sort((a, b) => a.min - b.min);
    const table = {
        id: raw._id,
        name: raw.name,
        formula: raw.formula,
        entries,
    };
    // Conditionally assign optional properties (exactOptionalPropertyTypes)
    if (raw.description) {
        table.description = raw.description;
    }
    return table;
}
/**
 * Map of keywords to effect types for birth augur parsing
 */
const EFFECT_TYPE_MAPPINGS = [
    { pattern: /all attack rolls/i, type: "attack-all" },
    { pattern: /melee attack rolls/i, type: "attack-melee" },
    { pattern: /missile fire attack rolls/i, type: "attack-missile" },
    { pattern: /unarmed attack rolls/i, type: "attack-unarmed" },
    { pattern: /mounted attack rolls/i, type: "attack-mounted" },
    { pattern: /melee damage rolls/i, type: "damage-melee" },
    { pattern: /missile fire damage rolls/i, type: "damage-missile" },
    { pattern: /^damage rolls$/i, type: "damage-all" },
    { pattern: /skill checks/i, type: "skill-check" },
    { pattern: /find.*disable traps/i, type: "find-trap" },
    { pattern: /find secret doors/i, type: "find-secret-door" },
    { pattern: /spell checks/i, type: "spell-check" },
    { pattern: /spell damage/i, type: "spell-damage" },
    { pattern: /turn unholy/i, type: "turn-unholy" },
    { pattern: /magical healing/i, type: "magical-healing" },
    { pattern: /saving throws.*traps/i, type: "saving-throw-trap" },
    { pattern: /saving throws.*poison/i, type: "saving-throw-poison" },
    { pattern: /reflex saving throws/i, type: "saving-throw-reflex" },
    { pattern: /fortitude saving throws/i, type: "saving-throw-fortitude" },
    { pattern: /willpower saving throws/i, type: "saving-throw-will" },
    { pattern: /^saving throws$/i, type: "saving-throw-all" },
    { pattern: /armor class/i, type: "armor-class" },
    { pattern: /initiative/i, type: "initiative" },
    { pattern: /hit points/i, type: "hit-points" },
    { pattern: /critical hit tables/i, type: "critical-table" },
    { pattern: /fumbles/i, type: "fumble-table" },
    { pattern: /corruption rolls/i, type: "corruption" },
    { pattern: /number of languages/i, type: "languages" },
    { pattern: /speed/i, type: "speed" },
    { pattern: /0-level starting weapon/i, type: "starting-weapon" },
];
/**
 * Parse the effect type from a birth augur description
 */
function parseEffectType(affects) {
    for (const { pattern, type } of EFFECT_TYPE_MAPPINGS) {
        if (pattern.test(affects)) {
            return type;
        }
    }
    return "unknown";
}
/**
 * Parse a birth augur description into name and affects
 *
 * Format: "Name: What it affects"
 * Example: "Harsh winter: All attack rolls"
 */
function parseBirthAugurDescription(description) {
    const colonIndex = description.indexOf(":");
    if (colonIndex === -1) {
        return null;
    }
    const name = description.slice(0, colonIndex).trim();
    const affects = description.slice(colonIndex + 1).trim();
    return { name, affects };
}
/**
 * Load birth augurs from a raw luck table
 */
export function loadBirthAugurs(raw) {
    const augurs = [];
    for (const result of raw.results) {
        const parsed = parseBirthAugurDescription(result.description);
        if (!parsed)
            continue;
        // Birth augurs have single-value ranges (e.g., [1, 1])
        const roll = result.range[0];
        augurs.push({
            roll,
            name: parsed.name,
            affects: parsed.affects,
            effectType: parseEffectType(parsed.affects),
        });
    }
    return augurs.sort((a, b) => a.roll - b.roll);
}
/**
 * Get modifier value based on luck score and birth augur
 *
 * In DCC, the luck modifier applies to the birth augur's affected roll.
 * The modifier is calculated from the luck score using the standard
 * ability modifier table.
 *
 * @param luckScore - The character's current luck score
 * @param luckModifier - The calculated modifier from the luck score
 * @param augur - The character's birth augur
 * @returns Object with the modifier value and what it affects
 */
export function getBirthAugurModifier(luckModifier, augur) {
    return {
        modifier: luckModifier,
        affects: augur.affects,
        effectType: augur.effectType ?? "unknown",
    };
}
//# sourceMappingURL=table-loader.js.map