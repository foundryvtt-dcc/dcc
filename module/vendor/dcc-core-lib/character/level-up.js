/**
 * Level Advancement System
 *
 * Functions for managing character experience and level progression.
 *
 * XP thresholds are loaded via registry pattern (like class progressions)
 * to keep official data separate from the library code.
 *
 * @example
 * ```typescript
 * import { registerXPThresholds, canLevelUp, levelUp } from "dcc-core-lib";
 * import { ALL_XP_THRESHOLDS } from "dcc-official-data";
 *
 * // Register XP data at startup
 * registerXPThresholds(ALL_XP_THRESHOLDS);
 *
 * // Check if character can level up
 * if (canLevelUp(character)) {
 *   const leveledUp = levelUp(character, randomSource);
 * }
 * ```
 */
import { getAbilityModifier } from "../data/ability-modifiers.js";
import { getClassProgression, getSavingThrows, getAttackBonus, getActionDice, getCriticalHitData, getTitle, hasDeedDie, getHitDie, getLuckDie, } from "../data/classes/progression-utils.js";
// =============================================================================
// XP Threshold Registry
// =============================================================================
/**
 * Registry of XP thresholds by class ID
 */
const xpThresholdRegistry = new Map();
/**
 * Default XP thresholds (standard DCC progression)
 * These are fan-made approximations for classes not yet registered.
 */
const DEFAULT_XP_THRESHOLDS = [
    10, // Level 1
    50, // Level 2
    110, // Level 3
    190, // Level 4
    290, // Level 5
    410, // Level 6
    550, // Level 7
    710, // Level 8
    890, // Level 9
    1090, // Level 10
];
/**
 * Register XP thresholds for a class
 *
 * @param thresholds - XP thresholds to register
 */
export function registerXPThresholds(thresholds) {
    xpThresholdRegistry.set(thresholds.classId, thresholds);
}
/**
 * Register multiple XP thresholds at once
 *
 * @param thresholds - Array of XP thresholds to register
 */
export function registerAllXPThresholds(thresholds) {
    for (const t of thresholds) {
        registerXPThresholds(t);
    }
}
/**
 * Clear all registered XP thresholds (for testing)
 */
export function clearXPThresholds() {
    xpThresholdRegistry.clear();
}
/**
 * Get XP thresholds for a class
 *
 * @param classId - Class ID
 * @returns XP thresholds, or default if not registered
 */
export function getXPThresholds(classId) {
    const registered = xpThresholdRegistry.get(classId);
    if (registered) {
        return registered.thresholds;
    }
    return DEFAULT_XP_THRESHOLDS;
}
// =============================================================================
// XP Calculation Functions
// =============================================================================
/**
 * Get XP required to reach a specific level
 *
 * @param classId - Class ID
 * @param level - Target level (1-10)
 * @returns XP required, or undefined if level out of range
 *
 * @example
 * const xpForLevel5 = getXPForLevel("warrior", 5); // 290
 */
export function getXPForLevel(classId, level) {
    if (level < 1 || level > 10) {
        return undefined;
    }
    const thresholds = getXPThresholds(classId);
    return thresholds[level - 1];
}
/**
 * Get XP required for next level
 *
 * @param classId - Class ID
 * @param currentLevel - Current level (0-9)
 * @returns XP required for next level, or undefined if at max
 */
export function getXPForNextLevel(classId, currentLevel) {
    return getXPForLevel(classId, currentLevel + 1);
}
/**
 * Calculate what level a character should be based on XP
 *
 * @param classId - Class ID
 * @param xp - Current XP total
 * @returns Level the character should be (0-10)
 */
export function calculateLevelFromXP(classId, xp) {
    const thresholds = getXPThresholds(classId);
    for (let level = thresholds.length; level >= 1; level--) {
        const threshold = thresholds[level - 1];
        if (threshold !== undefined && xp >= threshold) {
            return level;
        }
    }
    return 0;
}
/**
 * Check if a character can level up
 *
 * @param character - The character to check
 * @returns True if character has enough XP for next level
 */
export function canLevelUp(character) {
    const classInfo = character.classInfo;
    if (!classInfo) {
        // 0-level characters need 10 XP to reach level 1 (any class)
        return character.state.xp.current >= 10;
    }
    const currentLevel = classInfo.level;
    if (currentLevel >= 10) {
        return false; // Max level
    }
    const nextLevelXP = getXPForNextLevel(classInfo.classId, currentLevel);
    if (nextLevelXP === undefined) {
        return false;
    }
    return character.state.xp.current >= nextLevelXP;
}
/**
 * Get how much XP is needed for next level
 *
 * @param character - The character to check
 * @returns XP needed, or undefined if at max level
 */
export function getXPNeeded(character) {
    const classInfo = character.classInfo;
    if (!classInfo) {
        // 0-level needs 10 XP
        return Math.max(0, 10 - character.state.xp.current);
    }
    const currentLevel = classInfo.level;
    const nextLevelXP = getXPForNextLevel(classInfo.classId, currentLevel);
    if (nextLevelXP === undefined) {
        return undefined;
    }
    return Math.max(0, nextLevelXP - character.state.xp.current);
}
/**
 * Roll HP for a new level
 *
 * @param hitDie - The hit die to roll (e.g., "d8")
 * @param staminaModifier - Stamina modifier to add
 * @param random - Random source for rolling
 * @returns Object with roll result and final HP (minimum 1)
 */
export function rollHPForLevel(hitDie, staminaModifier, random) {
    // Roll the hit die
    const dieMax = getDieMax(hitDie);
    const rolled = random ? random.roll(dieMax) : Math.floor(Math.random() * dieMax) + 1;
    // Add stamina modifier, minimum 1 HP per level
    const gained = Math.max(1, rolled + staminaModifier);
    return { rolled, gained, staminaModifier, die: hitDie };
}
/**
 * Create an HP roll record from a roll result
 */
function createHPRecord(level, result) {
    return {
        level,
        die: result.die,
        rolled: result.rolled,
        staminaModifier: result.staminaModifier,
        gained: result.gained,
    };
}
/**
 * Get maximum value of a die
 */
function getDieMax(die) {
    const match = /d(\d+)/.exec(die);
    return match ? parseInt(match[1] ?? "4", 10) : 4;
}
// =============================================================================
// Level-Up Functions
// =============================================================================
/**
 * Level up a 0-level character to 1st level
 *
 * @param character - The 0-level character
 * @param classId - The class to take
 * @param random - Random source for HP roll
 * @returns Level-up result
 */
export function levelUpFrom0(character, classId, random) {
    // Validate character is 0-level
    if (character.classInfo !== undefined) {
        return {
            success: false,
            error: "Character already has a class",
        };
    }
    // Validate XP requirement
    if (character.state.xp.current < 10) {
        return {
            success: false,
            error: "Insufficient XP (need 10)",
        };
    }
    // Validate class exists
    const progression = getClassProgression(classId);
    if (!progression) {
        return {
            success: false,
            error: `Class progression not registered: ${classId}`,
        };
    }
    // Get alignment for title lookup
    const alignment = alignmentToLong(character.identity.alignment);
    // Roll HP for level 1
    const hitDie = getHitDie(classId);
    const staMod = getAbilityModifier(character.state.abilities.sta.current);
    const hpResult = rollHPForLevel(hitDie, staMod, random);
    // Get level 1 data
    const saves = getSavingThrows(classId, 1);
    const attackBonus = getAttackBonus(classId, 1);
    const actionDice = getActionDice(classId, 1);
    const critData = getCriticalHitData(classId, 1);
    const title = getTitle(classId, 1, alignment);
    // Calculate save bonuses (class bonus + ability modifier)
    const aglMod = getAbilityModifier(character.state.abilities.agl.current);
    const perMod = getAbilityModifier(character.state.abilities.per.current);
    // Build HP history (preserve 0-level roll if exists, add level 1 roll)
    const existingHistory = character.state.hp.history ?? [];
    const newHistory = [...existingHistory, createHPRecord(1, hpResult)];
    // Build new character state
    const newCharacter = {
        ...character,
        classInfo: {
            classId,
            level: 1,
            title,
        },
        state: {
            ...character.state,
            hp: {
                ...character.state.hp,
                current: character.state.hp.current + hpResult.gained,
                max: character.state.hp.max + hpResult.gained,
                history: newHistory,
            },
            xp: {
                ...character.state.xp,
                nextLevel: getXPForNextLevel(classId, 1) ?? 50,
            },
            saves: {
                reflex: saves.reflex + aglMod,
                fortitude: saves.fortitude + staMod,
                will: saves.will + perMod,
            },
            combat: {
                ...character.state.combat,
                attackBonus: typeof attackBonus === "number" ? attackBonus : 0,
                actionDice: actionDice,
                critDie: critData.die,
                critTable: critData.table,
                threatRange: critData.range ?? 20,
            },
            classState: buildClassState(classId, 1, character.state.abilities),
        },
    };
    // Handle deed die for warriors/dwarves
    if (hasDeedDie(classId) && typeof attackBonus === "string") {
        const classState = newCharacter.state.classState ?? {};
        if (classId === "warrior") {
            classState.warrior = {
                deedDie: attackBonus,
            };
        }
        else if (classId === "dwarf") {
            classState.dwarf = {
                deedDie: attackBonus,
            };
        }
        newCharacter.state.classState = classState;
    }
    return {
        success: true,
        character: newCharacter,
        changes: {
            previousLevel: 0,
            newLevel: 1,
            hpRolled: hpResult.rolled,
            hpGained: hpResult.gained,
            newTitle: title,
            newSaves: saves,
            newAttackBonus: attackBonus,
            newActionDice: actionDice,
            newCritData: critData,
        },
    };
}
/**
 * Level up a character to the next level
 *
 * @param character - The character to level up
 * @param random - Random source for HP roll
 * @returns Level-up result
 */
export function levelUp(character, random) {
    // If 0-level, error - use levelUpFrom0 instead
    if (!character.classInfo) {
        return {
            success: false,
            error: "Use levelUpFrom0() to level a 0-level character",
        };
    }
    const { classId, level: currentLevel } = character.classInfo;
    // Validate not at max level
    if (currentLevel >= 10) {
        return {
            success: false,
            error: "Character is already at maximum level (10)",
        };
    }
    // Validate XP requirement
    const nextLevelXP = getXPForNextLevel(classId, currentLevel);
    if (nextLevelXP === undefined || character.state.xp.current < nextLevelXP) {
        return {
            success: false,
            error: `Insufficient XP (need ${String(nextLevelXP ?? "unknown")})`,
        };
    }
    // Validate class progression exists
    const progression = getClassProgression(classId);
    if (!progression) {
        return {
            success: false,
            error: `Class progression not registered: ${classId}`,
        };
    }
    const newLevel = currentLevel + 1;
    const alignment = alignmentToLong(character.identity.alignment);
    // Roll HP for new level
    const hitDie = getHitDie(classId);
    const staMod = getAbilityModifier(character.state.abilities.sta.current);
    const hpResult = rollHPForLevel(hitDie, staMod, random);
    // Get new level data
    const saves = getSavingThrows(classId, newLevel);
    const attackBonus = getAttackBonus(classId, newLevel);
    const actionDice = getActionDice(classId, newLevel);
    const critData = getCriticalHitData(classId, newLevel);
    const title = getTitle(classId, newLevel, alignment);
    // Calculate save bonuses
    const aglMod = getAbilityModifier(character.state.abilities.agl.current);
    const perMod = getAbilityModifier(character.state.abilities.per.current);
    // Build HP history
    const existingHistory = character.state.hp.history ?? [];
    const newHistory = [...existingHistory, createHPRecord(newLevel, hpResult)];
    // Build new character state
    const newCharacter = {
        ...character,
        classInfo: {
            ...character.classInfo,
            level: newLevel,
            title,
        },
        state: {
            ...character.state,
            hp: {
                ...character.state.hp,
                current: character.state.hp.current + hpResult.gained,
                max: character.state.hp.max + hpResult.gained,
                history: newHistory,
            },
            xp: {
                ...character.state.xp,
                nextLevel: getXPForNextLevel(classId, newLevel) ?? 0,
            },
            saves: {
                reflex: saves.reflex + aglMod,
                fortitude: saves.fortitude + staMod,
                will: saves.will + perMod,
            },
            combat: {
                ...character.state.combat,
                attackBonus: typeof attackBonus === "number" ? attackBonus : 0,
                actionDice: actionDice,
                critDie: critData.die,
                critTable: critData.table,
                threatRange: critData.range ?? 20,
            },
        },
    };
    // Update class-specific state
    updateClassState(newCharacter, classId, newLevel, attackBonus);
    return {
        success: true,
        character: newCharacter,
        changes: {
            previousLevel: currentLevel,
            newLevel,
            hpRolled: hpResult.rolled,
            hpGained: hpResult.gained,
            newTitle: title,
            newSaves: saves,
            newAttackBonus: attackBonus,
            newActionDice: actionDice,
            newCritData: critData,
        },
    };
}
/**
 * Add XP to a character
 *
 * @param character - The character to update
 * @param xp - Amount of XP to add
 * @returns Updated character
 */
export function addXP(character, xp) {
    const newXP = character.state.xp.current + xp;
    return {
        ...character,
        state: {
            ...character.state,
            xp: {
                ...character.state.xp,
                current: newXP,
            },
        },
    };
}
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Convert short alignment to long form
 */
function alignmentToLong(alignment) {
    switch (alignment) {
        case "l":
            return "lawful";
        case "c":
            return "chaotic";
        default:
            return "neutral";
    }
}
/**
 * Build initial class state for level 1
 */
function buildClassState(classId, _level, _abilities) {
    const state = {};
    switch (classId) {
        case "cleric":
            state.cleric = {
                disapprovalRange: 1,
            };
            break;
        case "wizard":
            state.wizard = {
                corruption: [],
            };
            break;
        case "thief":
            state.thief = {
                luckDie: "d3",
            };
            break;
        case "elf":
            state.elf = {
                corruption: [],
            };
            break;
        case "halfling":
            state.halfling = {
                twoWeaponFighting: true,
            };
            break;
    }
    return state;
}
/**
 * Update class-specific state on level up
 */
function updateClassState(character, classId, level, attackBonus) {
    const classState = character.state.classState ?? {};
    switch (classId) {
        case "warrior":
            classState.warrior = {
                ...classState.warrior,
                deedDie: typeof attackBonus === "string" ? attackBonus : "d3",
            };
            break;
        case "dwarf":
            classState.dwarf = {
                ...classState.dwarf,
                deedDie: typeof attackBonus === "string" ? attackBonus : "d3",
            };
            break;
        case "thief":
            classState.thief = {
                ...classState.thief,
                luckDie: getLuckDie("thief", level) ?? "d3",
            };
            break;
    }
    character.state.classState = classState;
}
//# sourceMappingURL=level-up.js.map