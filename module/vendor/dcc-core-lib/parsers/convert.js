/**
 * Purple Sorcerer to Character Converter
 *
 * Converts parsed Purple Sorcerer data to the library's Character type.
 */
import { createEmptyInventory, createInventoryItem } from "../types/character.js";
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Generate a simple unique ID
 */
function generateSimpleId() {
    return `ps-${String(Date.now())}-${String(Math.floor(Math.random() * 10000))}`;
}
/**
 * Convert alignment string to Alignment type
 */
function convertAlignment(alignment) {
    switch (alignment?.toLowerCase()) {
        case "lawful":
            return "l";
        case "chaotic":
            return "c";
        default:
            return "n";
    }
}
/**
 * Parse currency string into Currency object
 * Examples: "26 cp", "37 cp + 33 gp", "30 cp + 1539 gp"
 */
function parseCurrency(funds) {
    const currency = { pp: 0, ep: 0, gp: 0, sp: 0, cp: 0 };
    if (!funds)
        return currency;
    // Split by + and parse each part
    const parts = funds.split("+").map((p) => p.trim());
    for (const part of parts) {
        const match = /(\d+)\s*(pp|ep|gp|sp|cp)/i.exec(part);
        if (match?.[1] && match[2]) {
            const amount = parseInt(match[1], 10);
            const type = match[2].toLowerCase();
            currency[type] = amount;
        }
    }
    return currency;
}
/**
 * Convert equipment strings to inventory items
 */
function createInventory(equipment, tradeGood, weaponName, occupationWeapon, mainWeapon, secondaryWeapon) {
    const inventory = createEmptyInventory();
    // Add equipment
    for (const item of equipment) {
        if (item.trim()) {
            inventory.items.push(createInventoryItem(item, "gear"));
        }
    }
    // Add trade good
    if (tradeGood) {
        inventory.items.push(createInventoryItem(tradeGood, "trade-goods"));
    }
    // Add weapons (0-level has just weapon)
    if (weaponName) {
        inventory.items.push(createInventoryItem(weaponName, "weapon", { equipped: true }));
    }
    // Add weapons (leveled characters)
    if (occupationWeapon) {
        inventory.items.push(createInventoryItem(occupationWeapon, "weapon", { notes: "Occupation weapon" }));
    }
    if (mainWeapon) {
        inventory.items.push(createInventoryItem(mainWeapon, "weapon", { equipped: true }));
    }
    if (secondaryWeapon) {
        inventory.items.push(createInventoryItem(secondaryWeapon, "weapon", { notes: "Secondary weapon" }));
    }
    return inventory;
}
/**
 * Convert PS ability scores to library format
 */
function convertAbilityScores(ps) {
    return {
        str: { current: ps.strength.score, max: ps.strength.score },
        agl: { current: ps.agility.score, max: ps.agility.score },
        sta: { current: ps.stamina.score, max: ps.stamina.score },
        per: { current: ps.personality.score, max: ps.personality.score },
        int: { current: ps.intelligence.score, max: ps.intelligence.score },
        lck: { current: ps.luck.score, max: ps.luck.score },
    };
}
/**
 * Convert lucky sign to birth augur
 */
function convertLuckySign(ps) {
    if (!ps.luckySign) {
        return {
            id: "unknown",
            name: "Unknown",
            effect: "Unknown effect",
            modifies: "unknown",
            multiplier: 1,
        };
    }
    // Generate a simple ID from the name
    const id = ps.luckySign.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    return {
        id,
        name: ps.luckySign.name,
        effect: ps.luckySign.effect,
        modifies: ps.luckySign.effect.toLowerCase(),
        multiplier: 1, // Purple Sorcerer doesn't indicate multiplier
    };
}
/**
 * Get default crit table for class
 */
function getDefaultCritTable(classType) {
    switch (classType) {
        case "warrior":
        case "dwarf":
            return "III";
        case "cleric":
            return "III";
        case "thief":
        case "halfling":
            return "II";
        case "wizard":
        case "elf":
            return "I";
        default:
            return "I";
    }
}
/**
 * Get default crit die for class and level (DieType format: "d20" not "1d20")
 */
function getDefaultCritDie(classType, level = 0) {
    if (level === 0)
        return "d4";
    switch (classType) {
        case "warrior":
        case "dwarf":
            // Warriors/Dwarves progress faster
            if (level >= 9)
                return "d24";
            if (level >= 7)
                return "d20";
            if (level >= 5)
                return "d16";
            if (level >= 3)
                return "d14";
            return "d12";
        case "thief":
            if (level >= 9)
                return "d24";
            if (level >= 7)
                return "d20";
            if (level >= 5)
                return "d16";
            if (level >= 3)
                return "d14";
            return "d10";
        case "halfling":
            if (level >= 9)
                return "d16";
            if (level >= 7)
                return "d14";
            if (level >= 5)
                return "d12";
            return "d10";
        case "cleric":
            if (level >= 7)
                return "d14";
            if (level >= 4)
                return "d10";
            return "d8";
        case "wizard":
        case "elf":
            if (level >= 7)
                return "d12";
            if (level >= 4)
                return "d10";
            return "d6";
        default:
            return "d6";
    }
}
/**
 * Normalize die type from PS format (like "1d20") to library format ("d20")
 */
function normalizeDieType(die) {
    if (!die)
        return "d20";
    // If it's already in "dN" format, return as-is
    if (/^d\d+$/.test(die)) {
        return die;
    }
    // If it's in "NdM" format, extract just "dM"
    const match = /^\d*(d\d+)/.exec(die);
    if (match?.[1]) {
        return match[1];
    }
    return "d20";
}
/**
 * Parse action dice string into array of DieType
 * e.g., "1d20" -> ["d20"], "1d20+1d14" -> ["d20", "d14"]
 */
function parseActionDice(attackDice) {
    if (!attackDice)
        return ["d20"];
    const dice = attackDice.split("+").map((d) => {
        const trimmed = d.trim();
        // Extract die from "1d20" -> "d20"
        const match = /(\d*)(d\d+)/.exec(trimmed);
        if (match?.[2]) {
            return match[2];
        }
        return "d20";
    });
    return dice.length > 0 ? dice : ["d20"];
}
/**
 * Create combat stats from parsed data
 */
function createCombatStats(ps) {
    // Parse attack bonus (could be number or deed die like "d3")
    let attackBonus = 0;
    if (ps.baseAttackMod) {
        const parsed = parseInt(ps.baseAttackMod, 10);
        if (!isNaN(parsed)) {
            attackBonus = parsed;
        }
        // For deed die, the bonus is effectively 0 (deed die is separate)
    }
    // Parse action dice
    const actionDice = parseActionDice(ps.attackDice);
    // Get crit die and table - normalize to "dN" format
    const critDie = ps.critDie
        ? normalizeDieType(ps.critDie)
        : getDefaultCritDie(ps.classType, ps.level);
    const critTable = ps.critTable ?? getDefaultCritTable(ps.classType);
    return {
        attackBonus,
        actionDice,
        critDie,
        critTable,
        threatRange: 20, // Purple Sorcerer doesn't export expanded threat range
        ac: ps.ac,
        speed: ps.speed,
        initiative: ps.initiative,
    };
}
/**
 * Create a spellbook from parsed spells
 */
function createSpellbook(ps) {
    if (!ps.spells || ps.spells.length === 0) {
        return undefined;
    }
    const spells = ps.spells.map((s) => ({
        spellId: s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        lost: false,
    }));
    return { spells };
}
/**
 * Create class-specific state
 */
function createClassState(ps) {
    if (!ps.classType) {
        return undefined;
    }
    const state = {};
    switch (ps.classType) {
        case "warrior": {
            // Parse deed die from baseAttackMod (e.g., "d3" -> "d3")
            let deedDie = "d3";
            if (ps.baseAttackMod?.startsWith("d")) {
                deedDie = ps.baseAttackMod;
            }
            const warriorState = { deedDie };
            state.warrior = warriorState;
            break;
        }
        case "dwarf": {
            let deedDie = "d3";
            if (ps.baseAttackMod?.startsWith("d")) {
                deedDie = ps.baseAttackMod;
            }
            const dwarfState = { deedDie };
            state.dwarf = dwarfState;
            break;
        }
        case "thief": {
            // Parse luck die, normalize to "dN" format
            const luckDie = ps.luckDie ? normalizeDieType(ps.luckDie) : "d3";
            const backstab = ps.thiefSkills?.find((s) => s.name === "Backstab");
            const thiefState = {
                luckDie,
                backstabMultiplier: backstab?.bonus ?? 2,
            };
            state.thief = thiefState;
            break;
        }
        case "halfling": {
            const halflingState = {
                twoWeaponFighting: true,
            };
            state.halfling = halflingState;
            break;
        }
        case "wizard": {
            const wizardState = {
                corruption: [],
            };
            const spellbook = createSpellbook(ps);
            if (spellbook) {
                wizardState.spellbook = spellbook;
            }
            state.wizard = wizardState;
            break;
        }
        case "elf": {
            const elfState = {
                corruption: [],
            };
            const spellbook = createSpellbook(ps);
            if (spellbook) {
                elfState.spellbook = spellbook;
            }
            state.elf = elfState;
            break;
        }
        case "cleric": {
            const clericState = {
                disapprovalRange: 1,
            };
            const spellbook = createSpellbook(ps);
            if (spellbook) {
                clericState.spellbook = spellbook;
            }
            state.cleric = clericState;
            break;
        }
    }
    return Object.keys(state).length > 0 ? state : undefined;
}
/**
 * Get class title (placeholder - actual titles require class data)
 */
function getClassTitle(classType, level = 0) {
    if (!classType || level === 0)
        return undefined;
    // These are placeholder titles - real titles come from class progression data
    const levelStr = level === 1 ? "1st" : level === 2 ? "2nd" : level === 3 ? "3rd" : `${String(level)}th`;
    return `${levelStr} level ${classType}`;
}
// =============================================================================
// Main Converter
// =============================================================================
/**
 * Convert a parsed Purple Sorcerer character to the library's Character type
 */
export function convertPSCharacter(ps, options = {}) {
    const generateId = options.generateId ?? generateSimpleId;
    const defaultName = options.defaultName ?? "Unnamed";
    const defaultAlignment = options.defaultAlignment ?? "n";
    // Determine alignment
    const alignment = ps.alignment
        ? convertAlignment(ps.alignment)
        : defaultAlignment;
    // Build identity
    const identity = {
        id: generateId(),
        name: defaultName, // Purple Sorcerer doesn't generate names
        occupation: ps.occupation,
        alignment,
        birthAugur: convertLuckySign(ps),
        startingLuck: ps.abilities.luck.score,
        languages: ps.languages,
    };
    // Build class info (only for leveled characters)
    let classInfo;
    if (ps.level > 0 && ps.classType) {
        classInfo = {
            classId: ps.classType,
            level: ps.level,
        };
        const title = getClassTitle(ps.classType, ps.level);
        if (title) {
            classInfo.title = title;
        }
    }
    // Build saving throws
    const saves = {
        reflex: ps.reflex,
        fortitude: ps.fortitude,
        will: ps.will,
    };
    // Build HP
    const hp = {
        current: ps.hp,
        max: ps.hp,
        temp: 0,
        // No history available from Purple Sorcerer
    };
    // Build state
    const state = {
        hp,
        abilities: convertAbilityScores(ps.abilities),
        xp: {
            current: 0, // Purple Sorcerer doesn't track XP
            nextLevel: 10, // Placeholder
        },
        saves,
        combat: createCombatStats(ps),
        currency: parseCurrency(ps.startingFunds),
        inventory: createInventory(ps.equipment, ps.tradeGood, ps.weapon?.name, ps.occupationWeapon?.name, ps.mainWeapon?.name, ps.secondaryWeapon?.name),
        conditions: [],
    };
    // Add class state if applicable
    const classState = createClassState(ps);
    if (classState) {
        state.classState = classState;
    }
    // Build character
    const character = {
        identity,
        state,
    };
    // Only add classInfo if present
    if (classInfo) {
        character.classInfo = classInfo;
    }
    return character;
}
/**
 * Convert multiple parsed characters
 */
export function convertPSCharacters(characters, options = {}) {
    return characters.map((ps) => convertPSCharacter(ps, options));
}
//# sourceMappingURL=convert.js.map