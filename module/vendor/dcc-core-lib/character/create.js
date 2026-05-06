/**
 * Character Creation Functions
 *
 * Pure functions for creating DCC characters.
 * All randomness and data are injected for testability.
 */
import { createInventoryItem } from "../types/character.js";
import { resolveCharacterCreationConfig, BUILT_IN_DICE_METHODS, BUILT_IN_ZERO_LEVEL_HP_METHODS, } from "../types/character-creation.js";
import { defaultRandomSource } from "../types/random.js";
import { getAbilityModifier } from "../data/ability-modifiers.js";
import { generateNameForOccupation, DEFAULT_NAME_DATA, } from "../data/names.js";
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Roll multiple dice and sum them.
 */
function rollDice(count, faces, random) {
    const rolls = random.rollMultiple(count, faces);
    return rolls.reduce((sum, r) => sum + r, 0);
}
// =============================================================================
// Ability Score Generation
// =============================================================================
/**
 * Roll ability scores using the specified method.
 */
export function rollAbilityScores(config, random, customMethods) {
    const abilities = ["str", "agl", "sta", "per", "int", "lck"];
    const rollData = [];
    // Handle manual scores
    if (config.method === "manual") {
        if (!config.manualScores) {
            throw new Error("Manual method requires manualScores to be provided");
        }
        const scores = {
            str: { current: config.manualScores[0], max: config.manualScores[0] },
            agl: { current: config.manualScores[1], max: config.manualScores[1] },
            sta: { current: config.manualScores[2], max: config.manualScores[2] },
            per: { current: config.manualScores[3], max: config.manualScores[3] },
            int: { current: config.manualScores[4], max: config.manualScores[4] },
            lck: { current: config.manualScores[5], max: config.manualScores[5] },
        };
        for (let i = 0; i < 6; i++) {
            const ability = abilities[i];
            if (ability === undefined)
                continue;
            const value = config.manualScores[i];
            if (value === undefined)
                continue;
            rollData.push({
                ability,
                rolls: [value],
                kept: [value],
                total: value,
            });
        }
        return { scores, rolls: rollData };
    }
    // Get the dice method definition
    let methodDef;
    if (config.method === "custom") {
        if (typeof config.customMethod === "object") {
            methodDef = config.customMethod;
        }
        else if (typeof config.customMethod === "string" && customMethods) {
            methodDef = customMethods[config.customMethod];
        }
        if (!methodDef) {
            throw new Error("Custom method requires customMethod definition or valid ID");
        }
    }
    else {
        methodDef = BUILT_IN_DICE_METHODS[config.method];
    }
    // Roll each ability
    const scores = {};
    for (const ability of abilities) {
        const { value, rolls, kept } = rollSingleAbility(methodDef, random);
        scores[ability] = { current: value, max: value };
        rollData.push({
            ability,
            rolls,
            kept,
            total: value,
        });
    }
    return { scores, rolls: rollData };
}
/**
 * Roll a single ability score using a dice method definition.
 */
function rollSingleAbility(method, random) {
    // Roll the dice
    const rolls = random.rollMultiple(method.diceCount, method.dieSize);
    // Determine which dice to keep
    let kept;
    if (method.keep) {
        const sorted = [...rolls].sort((a, b) => method.keep?.which === "highest" ? b - a : a - b);
        kept = sorted.slice(0, method.keep.count);
    }
    else {
        kept = rolls;
    }
    // Calculate total
    let total = kept.reduce((sum, d) => sum + d, 0);
    // Apply modifier
    if (method.modifier) {
        total += method.modifier;
    }
    // Apply divisor
    if (method.divisor) {
        total = Math.floor(total / method.divisor);
    }
    // Apply minimum
    if (method.minimum !== undefined && total < method.minimum) {
        total = method.minimum;
    }
    // Apply maximum
    if (method.maximum !== undefined && total > method.maximum) {
        total = method.maximum;
    }
    return { value: total, rolls, kept };
}
/**
 * Check if ability scores meet the minimum/maximum total modifier constraints.
 */
export function checkAbilityModifierConstraints(scores, config) {
    if (config.minTotalModifier === undefined &&
        config.maxTotalModifier === undefined) {
        return true;
    }
    const totalMod = getAbilityModifier(scores.str.current) +
        getAbilityModifier(scores.agl.current) +
        getAbilityModifier(scores.sta.current) +
        getAbilityModifier(scores.per.current) +
        getAbilityModifier(scores.int.current) +
        getAbilityModifier(scores.lck.current);
    if (config.minTotalModifier !== undefined && totalMod < config.minTotalModifier) {
        return false;
    }
    if (config.maxTotalModifier !== undefined && totalMod > config.maxTotalModifier) {
        return false;
    }
    return true;
}
// =============================================================================
// Hit Point Generation
// =============================================================================
/**
 * Roll hit points for a 0-level character.
 */
export function rollZeroLevelHP(config, staminaScore, random, customMethods) {
    let methodDef;
    if (config.zeroLevelMethod === "custom") {
        if (typeof config.customZeroLevelMethod === "object") {
            methodDef = config.customZeroLevelMethod;
        }
        else if (typeof config.customZeroLevelMethod === "string" &&
            customMethods) {
            methodDef = customMethods[config.customZeroLevelMethod];
        }
        if (!methodDef) {
            throw new Error("Custom HP method requires customZeroLevelMethod definition or valid ID");
        }
    }
    else {
        methodDef = BUILT_IN_ZERO_LEVEL_HP_METHODS[config.zeroLevelMethod];
    }
    const dieSize = methodDef.dieSize ?? 4; // Default d4 for 0-level
    // Handle max/average
    if (methodDef.useMax) {
        return { hp: dieSize, roll: dieSize };
    }
    if (methodDef.useAverage) {
        const avg = Math.ceil((dieSize + 1) / 2);
        return { hp: avg, roll: avg };
    }
    // Handle percentage of max
    if (methodDef.percentageOfMax !== undefined) {
        const maxHP = dieSize + getAbilityModifier(staminaScore);
        const hp = Math.max(1, Math.round(maxHP * methodDef.percentageOfMax));
        return { hp, roll: hp };
    }
    // Roll dice
    const diceCount = methodDef.diceCount ?? 1;
    let rolls = random.rollMultiple(diceCount, dieSize);
    // Re-roll if needed
    if (methodDef.rerollBelow !== undefined) {
        rolls = rolls.map((r) => {
            let result = r;
            while (result <= (methodDef.rerollBelow ?? 0)) {
                result = random.roll(dieSize);
            }
            return result;
        });
    }
    // Take highest/lowest if needed
    let result;
    if (methodDef.takeMultiple) {
        const sorted = [...rolls].sort((a, b) => methodDef.takeMultiple?.which === "highest" ? b - a : a - b);
        const kept = sorted.slice(0, 1);
        result = kept[0] ?? 1;
    }
    else {
        result = rolls.reduce((sum, r) => sum + r, 0);
    }
    // Apply modifier
    if (methodDef.modifier) {
        result += methodDef.modifier;
    }
    // 0-level HP is NOT modified by Stamina (that's a leveled character thing)
    // But we ensure minimum of 1
    const hp = Math.max(1, result);
    return { hp, roll: result };
}
// =============================================================================
// Birth Augur
// =============================================================================
/**
 * Select or roll a birth augur.
 */
export function selectBirthAugur(config, augurs, random) {
    let entry;
    let roll;
    if (config.specificAugurId) {
        // Find by ID/name
        entry = augurs.find((a) => a.name === config.specificAugurId || String(a.roll) === config.specificAugurId);
        roll = entry?.roll ?? 0;
    }
    else {
        // Roll randomly (1-30 for standard DCC)
        roll = random.roll(30);
        entry = augurs.find((a) => a.roll === roll);
    }
    if (!entry) {
        throw new Error(`Birth augur not found for roll ${String(roll)}`);
    }
    // Convert BirthAugurEntry to BirthAugur (character's assigned augur)
    const augur = {
        id: String(entry.roll),
        name: entry.name,
        effect: entry.affects,
        modifies: entry.effectType ?? "unknown",
        multiplier: 1, // Standard multiplier; some augurs have ×2
    };
    return { augur, roll };
}
/**
 * Calculate the effective luck modifier based on the lucky sign mode.
 */
export function calculateLuckySignBonus(luckModifier, mode) {
    switch (mode) {
        case "standard":
            return luckModifier;
        case "hide-if-zero":
            return luckModifier; // Same value, just hidden in display if 0
        case "minimum-plus-one":
            return Math.max(1, luckModifier);
        case "positive-only":
            return Math.max(0, luckModifier);
        case "best-of":
            return Math.max(1, luckModifier);
        case "custom":
            // Custom modes should be handled by the caller
            return luckModifier;
        default:
            return luckModifier;
    }
}
// =============================================================================
// Occupation Selection
// =============================================================================
/**
 * Select or roll an occupation.
 */
export function selectOccupation(occupations, specificOccupation, random) {
    if (specificOccupation) {
        const entry = occupations.find((o) => o.name.toLowerCase() === specificOccupation.toLowerCase() ||
            String(o.roll) === specificOccupation);
        if (!entry) {
            throw new Error(`Occupation not found: ${specificOccupation}`);
        }
        const roll = typeof entry.roll === "number" ? entry.roll : parseInt(entry.roll, 10);
        return { occupation: entry, roll };
    }
    // Roll randomly
    const roll = random.roll(100); // Standard d100 for occupation table
    // Find matching occupation (handle ranges like "1-2")
    const entry = occupations.find((o) => {
        if (typeof o.roll === "number") {
            return o.roll === roll;
        }
        // Handle range like "1-2"
        const [min, max] = o.roll.split("-").map(Number);
        if (min !== undefined && max !== undefined) {
            return roll >= min && roll <= max;
        }
        return false;
    });
    if (!entry) {
        throw new Error(`Occupation not found for roll ${String(roll)}`);
    }
    return { occupation: entry, roll };
}
// =============================================================================
// Main Character Creation Function
// =============================================================================
/**
 * Create a new 0-level character.
 *
 * @param data - Required data (occupations, birth augurs)
 * @param config - Optional creation configuration (defaults to standard DCC rules)
 * @param random - Optional random source (defaults to Math.random)
 * @returns The created character and roll metadata
 */
export function createZeroLevelCharacter(data, config, random = defaultRandomSource) {
    const resolvedConfig = resolveCharacterCreationConfig(config);
    // Roll ability scores (with potential re-rolls for constraints)
    let abilityResult;
    let attempts = 0;
    const maxAttempts = 100;
    do {
        abilityResult = rollAbilityScores(resolvedConfig.abilityScores, random, data.customDiceMethods);
        attempts++;
    } while (!checkAbilityModifierConstraints(abilityResult.scores, resolvedConfig.abilityScores) &&
        attempts < maxAttempts);
    if (attempts >= maxAttempts) {
        throw new Error("Could not generate ability scores meeting constraints after 100 attempts");
    }
    const { scores, rolls: abilityRolls } = abilityResult;
    // Select birth augur
    const { augur, roll: birthAugurRoll } = selectBirthAugur(resolvedConfig.birthAugur, data.birthAugurs, random);
    // Select occupation
    const { occupation, roll: occupationRoll } = selectOccupation(data.occupations, resolvedConfig.occupation.specificOccupation, random);
    // Roll HP
    const { hp, roll: hpRoll } = rollZeroLevelHP(resolvedConfig.hitPoints, scores.sta.current, random, data.customHPMethods);
    // Determine alignment (resolveCharacterCreationConfig always provides a value)
    const alignment = resolvedConfig.alignment;
    // Generate a unique ID
    const id = `pc-${String(Date.now())}-${String(random.roll(10000))}`;
    // Generate name if configured
    let characterName = "";
    const nameConfig = resolvedConfig.name;
    if (nameConfig.generateName) {
        const nameData = data.nameData ?? DEFAULT_NAME_DATA;
        // Build options object, only including properties that have values
        const nameOptions = {};
        if (nameConfig.includeEpithet !== undefined) {
            nameOptions.includeEpithet = nameConfig.includeEpithet;
        }
        if (nameConfig.epithetChance !== undefined) {
            nameOptions.epithetChance = nameConfig.epithetChance;
        }
        const generated = generateNameForOccupation(occupation.name, nameData, nameOptions, random);
        characterName = generated.fullName;
    }
    // Build the character identity
    const identity = {
        id,
        name: characterName,
        occupation: occupation.name,
        alignment,
        birthAugur: augur,
        startingLuck: scores.lck.current,
        languages: ["Common"],
    };
    // Build starting inventory from occupation
    const inventoryItems = [];
    // Add trained weapon
    if (occupation.trainedWeapon) {
        inventoryItems.push(createInventoryItem(occupation.trainedWeapon, "weapon", { equipped: true }));
    }
    // Add trade goods
    if (occupation.tradeGoods) {
        inventoryItems.push(createInventoryItem(occupation.tradeGoods, "trade-goods"));
    }
    const inventory = { items: inventoryItems };
    // Build the character state
    const state = {
        hp: { current: hp, max: hp, temp: 0 },
        abilities: scores,
        xp: { current: 0, nextLevel: 10 },
        saves: { reflex: 0, fortitude: 0, will: 0 },
        combat: {
            attackBonus: 0,
            actionDice: ["d20"],
            critDie: "d4",
            critTable: "I",
            threatRange: 20,
            ac: 10 + getAbilityModifier(scores.agl.current),
            speed: 30,
            initiative: getAbilityModifier(scores.agl.current),
        },
        currency: {
            pp: 0,
            ep: 0,
            gp: 0,
            sp: 0,
            // Roll 5d12 copper pieces for starting funds (DCC standard)
            cp: rollDice(5, 12, random),
        },
        inventory,
        conditions: [],
    };
    const character = {
        identity,
        classInfo: undefined,
        state,
    };
    return {
        character,
        rolls: {
            abilityRolls,
            birthAugurRoll,
            occupationRoll,
            hpRoll,
        },
    };
}
//# sourceMappingURL=create.js.map