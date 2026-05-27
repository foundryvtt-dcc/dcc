/**
 * Purple Sorcerer Text Format Parser
 *
 * Parses character data from Purple Sorcerer's copy-paste text format.
 */
// =============================================================================
// Text Parser
// =============================================================================
/**
 * Parse generator settings from header line
 * Example: "Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal"
 */
function parseGeneratorSettings(line) {
    if (!line.startsWith("Source:")) {
        return undefined;
    }
    const parts = line.split("|").map((p) => p.trim());
    const settings = {
        source: "Rulebook",
        rollMode: "3d6",
        hpMode: "normal",
        augurMode: "normal",
    };
    for (const part of parts) {
        const [key, value] = part.split(":").map((s) => s.trim());
        if (!key || !value)
            continue;
        switch (key.toLowerCase()) {
            case "source":
                settings.source = value;
                break;
            case "roll mode":
                settings.rollMode = value;
                break;
            case "hp":
                settings.hpMode = value;
                break;
            case "hp-up":
                settings.hpUpMode = value;
                break;
            case "augur":
                settings.augurMode = value;
                break;
        }
    }
    return settings;
}
/**
 * Parse ability score line
 * Example: "Strength: 14 (+1)" or "Strength: 8 (-1)"
 */
function parseAbilityLine(line) {
    const match = /^(\w+):\s*(\d+)\s*\(([+-]?\d+)\)/.exec(line);
    if (!match?.[1] || !match[2] || !match[3]) {
        return undefined;
    }
    return {
        ability: match[1].toLowerCase(),
        score: parseInt(match[2], 10),
        modifier: parseInt(match[3], 10),
    };
}
/**
 * Parse weapon line
 * Examples:
 * - "Hammer (as club) -1 (1d4-1)" (0-level)
 * - "Longsword melee d3+1 (dmg 1d8+1+deed)" (leveled)
 * - "+2 Mace melee +7 (dmg 1d6+4)" (magic weapon)
 */
function parseWeaponLine(line) {
    // Extract magic bonus if present
    const magicMatch = /^\+(\d+)\s+/.exec(line);
    const magicBonus = magicMatch?.[1] ? parseInt(magicMatch[1], 10) : undefined;
    const cleanLine = magicBonus !== undefined ? line.replace(/^\+\d+\s+/, "") : line;
    // Pattern for leveled character weapons: "Longsword melee d3+1 (dmg 1d8+1+deed)"
    const leveledMatch = /^(.+?)\s+(melee|ranged)\s+([d\d+-]+)\s*\(dmg\s+([^)]+)\)/.exec(cleanLine);
    if (leveledMatch) {
        const [, name, type, attackMod, damage] = leveledMatch;
        const weapon = {
            name: name?.trim() ?? "",
            type: (type ?? "melee"),
            attackMod: attackMod ?? "0",
            damage: damage ?? "1d4",
        };
        if (magicBonus !== undefined) {
            weapon.magicBonus = magicBonus;
        }
        return weapon;
    }
    // Pattern for 0-level weapons: "Hammer (as club) -1 (1d4-1)"
    const zeroLevelMatch = /^(.+?)\s+([+-]?\d+)\s*\(([^)]+)\)/.exec(cleanLine);
    if (zeroLevelMatch) {
        const [, rawName, attackMod, damage] = zeroLevelMatch;
        // Determine type from weapon name (simple heuristic)
        const rangedWeapons = ["bow", "crossbow", "sling", "dart", "javelin", "blowgun"];
        const nameLower = (rawName ?? "").toLowerCase();
        const isRanged = rangedWeapons.some((w) => nameLower.includes(w));
        const weapon = {
            name: rawName?.trim() ?? "",
            type: isRanged ? "ranged" : "melee",
            attackMod: attackMod ?? "0",
            damage: damage ?? "1d4",
        };
        if (magicBonus !== undefined) {
            weapon.magicBonus = magicBonus;
        }
        return weapon;
    }
    return undefined;
}
/**
 * Parse armor line
 * Example: "(Leather (+2) Check penalty (-1) Fumble die (d8))"
 * Example: "(Full Plate (+8) Check penalty (-8) Fumble die (d16) Speed (-10))"
 */
function parseArmorLine(line) {
    // Remove outer parentheses if present
    const content = line.replace(/^\(/, "").replace(/\)$/, "");
    // Pattern: "Leather (+2) Check penalty (-1) Fumble die (d8)"
    const match = /^(\w+(?:\s+\w+)?)\s*\(\+?(-?\d+)\)\s*Check penalty\s*\((-?\d+)\)\s*Fumble die\s*\(([d\d]+)\)(?:\s*Speed\s*\((-?\d+)\))?/i.exec(content);
    if (!match) {
        return undefined;
    }
    const [, name, acBonus, checkPenalty, fumbleDie, speedPenalty] = match;
    const armor = {
        name: name?.trim() ?? "Unarmored",
        acBonus: parseInt(acBonus ?? "0", 10),
        checkPenalty: parseInt(checkPenalty ?? "0", 10),
        fumbleDie: (fumbleDie ?? "d4"),
    };
    if (speedPenalty) {
        armor.speedPenalty = parseInt(speedPenalty, 10);
    }
    return armor;
}
/**
 * Parse lucky sign line
 * Example: "Wild child (Speed, each +1 = +5' speed) (-2)"
 * Example: "Lucky sign (Saving throws) (+0)"
 */
function parseLuckySign(line) {
    // Pattern: "Name (effect description) (+/-N)"
    const match = /^(.+?)\s*\(([^)]+)\)\s*\(([+-]?\d+)\)\s*$/.exec(line);
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
 * Parse thief skill line
 * Example: "Backstab: 4 (0)"
 * Example: "Sneak Silently: 7 (-2)"
 */
function parseThiefSkill(line) {
    const match = /^(.+?):\s*(\d+)\s*\((-?\d+)\)/.exec(line);
    if (!match) {
        return undefined;
    }
    const [, name, bonus, penalty] = match;
    return {
        name: name?.trim() ?? "",
        bonus: parseInt(bonus ?? "0", 10),
        checkPenalty: parseInt(penalty ?? "0", 10),
    };
}
/**
 * Parse spell line
 * Example: "1) Cantrip"
 * Example: "2) Wizard Staff"
 */
function parseSpellLine(line) {
    const match = /^(\d+)\)\s*(.+)$/.exec(line);
    if (!match) {
        return undefined;
    }
    const [, level, name] = match;
    return {
        level: parseInt(level ?? "1", 10),
        name: name?.trim() ?? "",
    };
}
/**
 * Parse class and level from header line
 * Examples:
 * - "Neutral Warrior (1st level)"
 * - "Lawful Cleric (5th level)"
 * - "Chaotic Elf (5th level)"
 */
function parseClassHeader(line) {
    const match = /^(Lawful|Neutral|Chaotic)\s+(\w+)\s*\((\d+)(?:st|nd|rd|th)\s+level\)/i.exec(line);
    if (!match) {
        return undefined;
    }
    const [, alignment, className, level] = match;
    const alignmentLower = alignment?.toLowerCase();
    const classLower = className?.toLowerCase();
    return {
        alignment: alignmentLower,
        classType: classLower,
        level: parseInt(level ?? "1", 10),
    };
}
/**
 * Parse a single character block from text
 */
function parseCharacterBlock(lines) {
    const character = {
        level: 0,
        equipment: [],
        languages: [],
    };
    let i = 0;
    // Skip empty lines at the start
    while (i < lines.length && lines[i]?.trim() === "") {
        i++;
    }
    // Parse generator settings if present
    if (lines[i]?.startsWith("Generator Settings")) {
        i++;
        const settingsLine = lines[i];
        if (settingsLine) {
            const settings = parseGeneratorSettings(settingsLine);
            if (settings) {
                character.settings = settings;
            }
        }
        i++;
    }
    // Skip empty lines
    while (i < lines.length && lines[i]?.trim() === "") {
        i++;
    }
    // Parse character header (0-level occupation or class/level)
    const headerLine = lines[i] ?? "";
    if (headerLine.startsWith("0-level Occupation:")) {
        character.occupation = headerLine.replace("0-level Occupation:", "").trim();
        character.level = 0;
        i++;
    }
    else {
        const classInfo = parseClassHeader(headerLine);
        if (classInfo) {
            character.alignment = classInfo.alignment;
            character.classType = classInfo.classType;
            character.level = classInfo.level;
            i++;
            // Next line should be occupation
            const occLine = lines[i];
            if (occLine?.startsWith("Occupation:")) {
                character.occupation = occLine.replace("Occupation:", "").trim();
                i++;
            }
        }
    }
    // Parse ability scores
    const abilities = {};
    while (i < lines.length) {
        const line = lines[i]?.trim() ?? "";
        const abilityData = parseAbilityLine(line);
        if (abilityData) {
            const key = abilityData.ability;
            abilities[key] = { score: abilityData.score, modifier: abilityData.modifier };
            i++;
        }
        else {
            break;
        }
    }
    if (abilities.strength && abilities.agility && abilities.stamina &&
        abilities.personality && abilities.intelligence && abilities.luck) {
        character.abilities = abilities;
    }
    // Skip empty lines
    while (i < lines.length && lines[i]?.trim() === "") {
        i++;
    }
    // Parse remaining lines by keyword
    while (i < lines.length) {
        const line = lines[i]?.trim() ?? "";
        // Empty line - skip
        if (line === "") {
            i++;
            continue;
        }
        // AC and HP line (0-level): "AC: 11; HP: 1"
        if (line.startsWith("AC:") && line.includes("HP:")) {
            const acMatch = /AC:\s*(\d+)/.exec(line);
            const hpMatch = /HP:\s*(\d+)/.exec(line);
            if (acMatch?.[1])
                character.ac = parseInt(acMatch[1], 10);
            if (hpMatch?.[1])
                character.hp = parseInt(hpMatch[1], 10);
            i++;
            continue;
        }
        // HP/Speed/Init line (leveled): "HP: 11; Speed: 30; Init: 1"
        if (line.startsWith("HP:") && line.includes("Speed:")) {
            const hpMatch = /HP:\s*(\d+)/.exec(line);
            const speedMatch = /Speed:\s*(\d+)/.exec(line);
            const initMatch = /Init:\s*([+-]?\d+)/.exec(line);
            if (hpMatch?.[1])
                character.hp = parseInt(hpMatch[1], 10);
            if (speedMatch?.[1])
                character.speed = parseInt(speedMatch[1], 10);
            if (initMatch?.[1])
                character.initiative = parseInt(initMatch[1], 10);
            i++;
            continue;
        }
        // Weapon line (0-level): "Weapon: Hammer (as club) -1 (1d4-1)"
        if (line.startsWith("Weapon:")) {
            const weaponText = line.replace("Weapon:", "").trim();
            const weapon = parseWeaponLine(weaponText);
            if (weapon) {
                character.weapon = weapon;
            }
            i++;
            continue;
        }
        // Speed/Init/saves line (0-level): "Speed: 10; Init: 1; Ref: 1; Fort: 0; Will: -2"
        // Must come before the generic saves line check since this line also contains "Ref:"
        if (line.startsWith("Speed:") && !character.speed) {
            const speedMatch = /Speed:\s*(\d+)/.exec(line);
            const initMatch = /Init:\s*([+-]?\d+)/.exec(line);
            const refMatch = /Ref:\s*([+-]?\d+)/.exec(line);
            const fortMatch = /Fort:\s*([+-]?\d+)/.exec(line);
            const willMatch = /Will:\s*([+-]?\d+)/.exec(line);
            if (speedMatch?.[1])
                character.speed = parseInt(speedMatch[1], 10);
            if (initMatch?.[1])
                character.initiative = parseInt(initMatch[1], 10);
            if (refMatch?.[1])
                character.reflex = parseInt(refMatch[1], 10);
            if (fortMatch?.[1])
                character.fortitude = parseInt(fortMatch[1], 10);
            if (willMatch?.[1])
                character.will = parseInt(willMatch[1], 10);
            i++;
            continue;
        }
        // Saves line (leveled): "Ref: 1; Fort: 0; Will: -2"
        // This line starts with "Ref:" for leveled characters
        if (line.startsWith("Ref:")) {
            const refMatch = /Ref:\s*([+-]?\d+)/.exec(line);
            const fortMatch = /Fort:\s*([+-]?\d+)/.exec(line);
            const willMatch = /Will:\s*([+-]?\d+)/.exec(line);
            if (refMatch?.[1])
                character.reflex = parseInt(refMatch[1], 10);
            if (fortMatch?.[1])
                character.fortitude = parseInt(fortMatch[1], 10);
            if (willMatch?.[1])
                character.will = parseInt(willMatch[1], 10);
            i++;
            continue;
        }
        // Base Attack Mod: "Base Attack Mod: d3" or "Base Attack Mod: 2"
        if (line.startsWith("Base Attack Mod:")) {
            character.baseAttackMod = line.replace("Base Attack Mod:", "").trim();
            i++;
            continue;
        }
        // Attack Dice: "Attack Dice: 1d20; Crit Die/Table: 1d12/III"
        if (line.startsWith("Attack Dice:")) {
            const attackDiceMatch = /Attack Dice:\s*([^;]+)/.exec(line);
            const critMatch = /Crit Die\/Table:\s*([^/]+)\/(\w+)/.exec(line);
            if (attackDiceMatch?.[1])
                character.attackDice = attackDiceMatch[1].trim();
            if (critMatch?.[1])
                character.critDie = critMatch[1].trim();
            if (critMatch?.[2])
                character.critTable = critMatch[2].trim();
            i++;
            continue;
        }
        // Occupation Weapon: "Occupation Weapon: Shortbow ranged d3 (dmg 1d6+deed)"
        if (line.startsWith("Occupation Weapon:")) {
            const weaponText = line.replace("Occupation Weapon:", "").trim();
            const weapon = parseWeaponLine(weaponText);
            if (weapon) {
                character.occupationWeapon = weapon;
            }
            i++;
            continue;
        }
        // Main Weapon: "Main Weapon: Longsword melee d3+1 (dmg 1d8+1+deed)"
        if (line.startsWith("Main Weapon:")) {
            const weaponText = line.replace("Main Weapon:", "").trim();
            const weapon = parseWeaponLine(weaponText);
            if (weapon) {
                character.mainWeapon = weapon;
            }
            i++;
            continue;
        }
        // Secondary Weapon: "Secondary Weapon: Longbow ranged d3 (dmg 1d6+deed)"
        if (line.startsWith("Secondary Weapon:")) {
            const weaponText = line.replace("Secondary Weapon:", "").trim();
            const weapon = parseWeaponLine(weaponText);
            if (weapon) {
                character.secondaryWeapon = weapon;
            }
            i++;
            continue;
        }
        // AC line (leveled): "AC: (12) (Leather (+2) Check penalty (-1) Fumble die (d8))"
        if (line.startsWith("AC:") && line.includes("(") && !line.includes("HP:")) {
            const acMatch = /AC:\s*\((\d+)\)/.exec(line);
            if (acMatch?.[1])
                character.ac = parseInt(acMatch[1], 10);
            // Parse armor details
            const armorStart = line.indexOf("(", line.indexOf(")") + 1);
            if (armorStart !== -1) {
                const armorText = line.slice(armorStart);
                const armor = parseArmorLine(armorText);
                if (armor) {
                    character.armor = armor;
                }
            }
            i++;
            continue;
        }
        // Equipment line
        if (line.startsWith("Equipment:")) {
            const equipment = line.replace("Equipment:", "").trim();
            if (equipment) {
                character.equipment?.push(equipment);
            }
            i++;
            continue;
        }
        // Trade good
        if (line.startsWith("Trade good:")) {
            character.tradeGood = line.replace("Trade good:", "").trim();
            i++;
            continue;
        }
        // Starting Funds
        if (line.startsWith("Starting Funds:")) {
            character.startingFunds = line.replace("Starting Funds:", "").trim();
            i++;
            continue;
        }
        // Lucky sign
        if (line.startsWith("Lucky sign:")) {
            const signText = line.replace("Lucky sign:", "").trim();
            const luckySign = parseLuckySign(signText);
            if (luckySign) {
                character.luckySign = luckySign;
            }
            i++;
            continue;
        }
        // Languages
        if (line.startsWith("Languages:")) {
            const langText = line.replace("Languages:", "").trim();
            character.languages = langText.split(/[,/]/).map((l) => l.trim()).filter(Boolean);
            i++;
            continue;
        }
        // Racial Traits
        if (line.startsWith("Racial Traits:")) {
            const traitsText = line.replace("Racial Traits:", "").trim();
            character.racialTraits = [traitsText];
            i++;
            continue;
        }
        // Class trait (Warrior trait, Dwarf skill, etc.)
        if (/^(Warrior|Dwarf|Elf|Halfling|Thief)\s+(trait|skill|ability):/.test(line)) {
            character.classTrait = line;
            i++;
            continue;
        }
        // Thief Ability line
        if (line.startsWith("Thief Ability:")) {
            // Extract luck die if present
            const luckDieMatch = /roll\s+(d\d+)/.exec(line);
            if (luckDieMatch?.[1]) {
                character.luckDie = luckDieMatch[1];
            }
            i++;
            continue;
        }
        // Thief Skills section
        if (line === "Thief Skills:") {
            character.thiefSkills = [];
            i++;
            // Parse thief skill lines
            while (i < lines.length) {
                const skillLine = lines[i]?.trim() ?? "";
                // Empty line ends the section
                if (skillLine === "") {
                    break;
                }
                // Special case: "Cast Spell From Scroll (d16)" - doesn't have a colon
                if (skillLine.startsWith("Cast Spell From Scroll")) {
                    const dieMatch = /\(([d\d]+)\)/.exec(skillLine);
                    if (dieMatch?.[1]) {
                        character.castSpellFromScrollDie = dieMatch[1];
                    }
                    i++;
                    continue;
                }
                // Exit the loop if line doesn't look like a skill line (has no colon)
                if (!skillLine.includes(":")) {
                    break;
                }
                const skill = parseThiefSkill(skillLine);
                if (skill) {
                    character.thiefSkills.push(skill);
                }
                i++;
            }
            continue;
        }
        // Spells section
        if (line.startsWith("Spells:")) {
            character.spells = [];
            // Parse spell check
            const spellCheckMatch = /Spell Check:\s*([^)]+)\)/.exec(line);
            if (spellCheckMatch?.[1]) {
                character.spellCheck = spellCheckMatch[1].trim();
            }
            i++;
            // Parse spell lines
            while (i < lines.length) {
                const spellLine = lines[i]?.trim() ?? "";
                if (spellLine === "" || !/^\d+\)/.test(spellLine)) {
                    break;
                }
                const spell = parseSpellLine(spellLine);
                if (spell) {
                    character.spells.push(spell);
                }
                i++;
            }
            continue;
        }
        // Halfling skills line: "Halfling skills: Two weapon fighting, Good luck charm, Stealth"
        if (line.startsWith("Halfling skills:")) {
            // Just record in class trait
            character.classTrait = line;
            i++;
            continue;
        }
        // Unknown line - skip
        i++;
    }
    // Validate we have minimum required data
    if (!character.occupation || !character.abilities) {
        return undefined;
    }
    // Set defaults for missing values
    character.ac ??= 10;
    character.hp ??= 1;
    character.speed ??= 30;
    character.initiative ??= 0;
    character.reflex ??= 0;
    character.fortitude ??= 0;
    character.will ??= 0;
    character.startingFunds ??= "0 cp";
    return character;
}
/**
 * Split text into individual character blocks
 * Characters are separated by "0-level Occupation:" or class headers
 */
function splitIntoCharacterBlocks(text) {
    const lines = text.split("\n");
    const blocks = [];
    let currentBlock = [];
    let inCharacter = false;
    for (const line of lines) {
        const trimmed = line.trim();
        // Check if this is a character start
        const isZeroLevel = trimmed.startsWith("0-level Occupation:");
        const isLeveled = /^(Lawful|Neutral|Chaotic)\s+\w+\s*\(\d+(?:st|nd|rd|th)\s+level\)/i.test(trimmed);
        if (isZeroLevel || isLeveled) {
            // Save previous block if it exists and is a character
            if (currentBlock.length > 0 && inCharacter) {
                blocks.push(currentBlock);
                currentBlock = []; // Reset for new character
            }
            // Include any accumulated lines (like generator settings) with the character
            currentBlock.push(line);
            inCharacter = true;
        }
        else if (inCharacter) {
            currentBlock.push(line);
        }
        else if (trimmed.startsWith("Generator Settings") || trimmed.startsWith("Source:")) {
            // Include generator settings - will be associated with the next character
            currentBlock.push(line);
        }
    }
    // Don't forget the last block
    if (currentBlock.length > 0 && inCharacter) {
        blocks.push(currentBlock);
    }
    return blocks;
}
/**
 * Parse Purple Sorcerer text format
 * Handles both single and multiple character outputs
 */
export function parsePurpleSorcererText(text) {
    const result = {
        success: false,
        characters: [],
        errors: [],
        warnings: [],
    };
    if (!text.trim()) {
        result.errors.push("Empty input");
        return result;
    }
    // Split into character blocks
    const blocks = splitIntoCharacterBlocks(text);
    if (blocks.length === 0) {
        result.errors.push("No character data found in input");
        return result;
    }
    // Parse each block
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (!block)
            continue;
        const character = parseCharacterBlock(block);
        if (character) {
            result.characters.push(character);
        }
        else {
            result.warnings.push(`Failed to parse character block ${String(i + 1)}`);
        }
    }
    result.success = result.characters.length > 0;
    return result;
}
//# sourceMappingURL=parse-text.js.map