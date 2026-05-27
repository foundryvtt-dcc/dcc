/**
 * Purple Sorcerer JSON Format Parser
 *
 * Parses character data from Purple Sorcerer's JSON export format.
 */
// =============================================================================
// JSON Parser
// =============================================================================
/**
 * Detect ancestry from occupation name
 */
function detectAncestryFromOccupation(occupation) {
    const lower = occupation.toLowerCase();
    if (lower.includes("dwarf") || lower.includes("dwarven")) {
        return "dwarf";
    }
    if (lower.includes("elf") || lower.includes("elven")) {
        return "elf";
    }
    if (lower.includes("halfling")) {
        return "halfling";
    }
    return "human";
}
/**
 * Parse lucky sign from string
 * Example: "The Broken Star (Fumbles) (+1)"
 */
function parseLuckySign(text) {
    if (!text.trim()) {
        return undefined;
    }
    // Pattern: "Name (effect description) (+/-N)"
    const match = /^(.+?)\s*\(([^)]+)\)\s*\(([+-]?\d+)\)\s*$/.exec(text);
    if (!match) {
        return undefined;
    }
    const [, name, effect, modifier] = match;
    return {
        name: name?.trim() ?? "",
        effect: effect?.trim() ?? "",
        modifier: parseInt(modifier ?? "0", 10),
    };
}
/**
 * Parse weapon from 0-level JSON data
 */
function parseWeaponFromJson(name, attackMod, damage) {
    // Determine type from weapon name
    const rangedWeapons = ["bow", "crossbow", "sling", "dart", "javelin", "blowgun"];
    const nameLower = name.toLowerCase();
    const isRanged = rangedWeapons.some((w) => nameLower.includes(w));
    return {
        name,
        type: isRanged ? "ranged" : "melee",
        attackMod,
        damage,
    };
}
/**
 * Determine base speed from ancestry
 */
function getBaseSpeed(ancestry) {
    switch (ancestry) {
        case "dwarf":
            return 20;
        case "halfling":
            return 20;
        default:
            return 30;
    }
}
/**
 * Parse a single character from JSON format
 */
function parseJsonCharacter(data) {
    if (!data.occTitle) {
        return undefined;
    }
    const ancestry = detectAncestryFromOccupation(data.occTitle);
    // Parse ability scores
    const abilities = {
        strength: {
            score: parseInt(data.strengthScore, 10) || 10,
            modifier: parseInt(data.strengthMod, 10) || 0,
        },
        agility: {
            score: parseInt(data.agilityScore, 10) || 10,
            modifier: parseInt(data.agilityMod, 10) || 0,
        },
        stamina: {
            score: parseInt(data.staminaScore, 10) || 10,
            modifier: parseInt(data.staminaMod, 10) || 0,
        },
        personality: {
            score: parseInt(data.personalityScore, 10) || 10,
            modifier: parseInt(data.personalityMod, 10) || 0,
        },
        intelligence: {
            score: parseInt(data.intelligenceScore, 10) || 10,
            modifier: parseInt(data.intelligenceMod, 10) || 0,
        },
        luck: {
            score: parseInt(data.luckScore, 10) || 10,
            modifier: parseInt(data.luckMod, 10) || 0,
        },
    };
    // Build equipment list
    const equipment = [];
    if (data.equipment.trim())
        equipment.push(data.equipment);
    if (data.equipment2?.trim())
        equipment.push(data.equipment2);
    if (data.equipment3?.trim())
        equipment.push(data.equipment3);
    // Parse languages
    const languages = data.languages
        .split(/[,/]/)
        .map((l) => l.trim())
        .filter(Boolean);
    // Parse racial traits
    const racialTraits = data.racialTraits.trim()
        ? [data.racialTraits]
        : undefined;
    // Create character
    const character = {
        level: 0,
        occupation: data.occTitle,
        abilities,
        ac: parseInt(data.armorClass, 10) || 10,
        hp: parseInt(data.hitPoints, 10) || 1,
        speed: parseInt(data.speed, 10) || getBaseSpeed(ancestry),
        initiative: parseInt(data.initiative, 10) || 0,
        reflex: parseInt(data.saveReflex, 10) || 0,
        fortitude: parseInt(data.saveFort, 10) || 0,
        will: parseInt(data.saveWill, 10) || 0,
        weapon: parseWeaponFromJson(data.weapon, data.attackMod, data.attackDamage),
        equipment,
        startingFunds: data.startingFunds,
        languages,
    };
    // Only add optional properties if they have values
    const tradeGood = data.tradeGood.trim();
    if (tradeGood) {
        character.tradeGood = tradeGood;
    }
    const luckySign = parseLuckySign(data.luckySign);
    if (luckySign) {
        character.luckySign = luckySign;
    }
    if (racialTraits) {
        character.racialTraits = racialTraits;
    }
    return character;
}
/**
 * Type guard to check if object is a character list
 */
function isCharacterList(data) {
    return (typeof data === "object" &&
        data !== null &&
        "characters" in data &&
        Array.isArray(data.characters));
}
/**
 * Type guard to check if object is a single character
 */
function isSingleCharacter(data) {
    return (typeof data === "object" &&
        data !== null &&
        "occTitle" in data &&
        typeof data.occTitle === "string");
}
/**
 * Parse Purple Sorcerer JSON format
 * Handles both single character and array of characters
 */
export function parsePurpleSorcererJson(jsonString) {
    const result = {
        success: false,
        characters: [],
        errors: [],
        warnings: [],
    };
    if (!jsonString.trim()) {
        result.errors.push("Empty input");
        return result;
    }
    let data;
    try {
        data = JSON.parse(jsonString);
    }
    catch (e) {
        result.errors.push(`Invalid JSON: ${e instanceof Error ? e.message : "parse error"}`);
        return result;
    }
    // Handle array format: { characters: [...] }
    if (isCharacterList(data)) {
        for (let i = 0; i < data.characters.length; i++) {
            const charData = data.characters[i];
            if (!charData)
                continue;
            const character = parseJsonCharacter(charData);
            if (character) {
                result.characters.push(character);
            }
            else {
                result.warnings.push(`Failed to parse character at index ${String(i)}`);
            }
        }
    }
    // Handle single character
    else if (isSingleCharacter(data)) {
        const character = parseJsonCharacter(data);
        if (character) {
            result.characters.push(character);
        }
        else {
            result.errors.push("Failed to parse character data");
        }
    }
    // Handle raw array
    else if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            if (isSingleCharacter(item)) {
                const character = parseJsonCharacter(item);
                if (character) {
                    result.characters.push(character);
                }
                else {
                    result.warnings.push(`Failed to parse character at index ${String(i)}`);
                }
            }
        }
    }
    else {
        result.errors.push("Unrecognized JSON format");
    }
    result.success = result.characters.length > 0;
    return result;
}
//# sourceMappingURL=parse-json.js.map