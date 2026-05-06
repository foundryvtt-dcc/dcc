/**
 * Hit Point Calculation System
 *
 * Functions for calculating and recalculating character HP based on
 * level, stamina modifier, and roll history.
 *
 * @example
 * ```typescript
 * // Calculate max HP from history (for recalculation when stamina changes)
 * const maxHP = calculateMaxHP(character);
 *
 * // Recalculate HP when stamina modifier changes
 * const updated = recalculateHP(character);
 *
 * // Estimate expected HP for a given level (no history needed)
 * const expected = estimateMaxHP("warrior", 5, 1); // level 5 warrior with +1 STA
 * ```
 */
import { getAbilityModifier } from "../data/ability-modifiers.js";
import { getHitDie } from "../data/classes/progression-utils.js";
// =============================================================================
// HP Calculation from History
// =============================================================================
/**
 * Calculate max HP from roll history with current stamina modifier
 *
 * If no history is available, returns the current max HP unchanged.
 *
 * @param character - The character to calculate HP for
 * @returns Calculated max HP based on history and current stamina
 *
 * @example
 * ```typescript
 * const maxHP = calculateMaxHP(character);
 * ```
 */
export function calculateMaxHP(character) {
    const history = character.state.hp.history;
    // If no history, return current max (can't recalculate)
    if (!history || history.length === 0) {
        return character.state.hp.max;
    }
    // Get current stamina modifier
    const currentStaMod = getAbilityModifier(character.state.abilities.sta.current);
    // Sum up HP from each level's roll with current stamina modifier
    let total = 0;
    for (const record of history) {
        // Recalculate with current stamina modifier
        const hpForLevel = Math.max(1, record.rolled + currentStaMod);
        total += hpForLevel;
    }
    return total;
}
/**
 * Recalculate character HP based on history and current stamina
 *
 * Returns a new character with updated HP values. If stamina has changed,
 * this will adjust max HP accordingly. Current HP is adjusted proportionally.
 *
 * @param character - The character to recalculate HP for
 * @returns New character with recalculated HP
 *
 * @example
 * ```typescript
 * // After stamina damage heals
 * const updated = recalculateHP(character);
 * ```
 */
export function recalculateHP(character) {
    const history = character.state.hp.history;
    // If no history, can't recalculate
    if (!history || history.length === 0) {
        return character;
    }
    const oldMax = character.state.hp.max;
    const newMax = calculateMaxHP(character);
    // If no change, return as-is
    if (newMax === oldMax) {
        return character;
    }
    // Adjust current HP proportionally
    // If max decreased, current can't exceed new max
    // If max increased, current increases by the same amount
    const hpDiff = newMax - oldMax;
    const newCurrent = Math.max(1, Math.min(character.state.hp.current + hpDiff, newMax));
    return {
        ...character,
        state: {
            ...character.state,
            hp: {
                ...character.state.hp,
                current: newCurrent,
                max: newMax,
            },
        },
    };
}
// =============================================================================
// HP Estimation (without history)
// =============================================================================
/**
 * Estimate expected max HP for a character of given class and level
 *
 * Uses average die rolls. Useful for NPC generation or validation.
 *
 * @param classId - Class ID (for hit die lookup)
 * @param level - Character level (0 for 0-level)
 * @param staminaModifier - Stamina modifier to apply per level
 * @returns Estimated max HP
 *
 * @example
 * ```typescript
 * // Expected HP for level 5 warrior with +2 STA mod
 * const hp = estimateMaxHP("warrior", 5, 2); // ~45 HP
 * ```
 */
export function estimateMaxHP(classId, level, staminaModifier) {
    let total = 0;
    // 0-level: 1d4 + STA mod
    const zeroLevelAvg = 2.5 + staminaModifier;
    total += Math.max(1, zeroLevelAvg);
    // If level 0, we're done
    if (level === 0) {
        return Math.floor(total);
    }
    // Get class hit die (default d6 if class not registered)
    const hitDie = classId ? getHitDie(classId) : "d6";
    const hitDieAvg = getAverageDieRoll(hitDie);
    // Add HP for each class level
    for (let i = 1; i <= level; i++) {
        const hpForLevel = hitDieAvg + staminaModifier;
        total += Math.max(1, hpForLevel);
    }
    return Math.floor(total);
}
/**
 * Calculate minimum possible HP for a character
 *
 * Assumes minimum rolls on all dice. Useful for validation.
 *
 * @param level - Character level (0 for 0-level)
 * @returns Minimum possible HP (at least 1 per level)
 */
export function calculateMinimumHP(level) {
    // Minimum 1 HP per level (0-level + class levels)
    return level + 1;
}
/**
 * Calculate maximum possible HP for a character
 *
 * Assumes maximum rolls on all dice with given stamina modifier.
 *
 * @param classId - Class ID (for hit die lookup)
 * @param level - Character level (0 for 0-level)
 * @param staminaModifier - Stamina modifier to apply per level
 * @returns Maximum possible HP
 */
export function calculateMaximumHP(classId, level, staminaModifier) {
    let total = 0;
    // 0-level: max d4 (4) + STA mod
    total += Math.max(1, 4 + staminaModifier);
    if (level === 0) {
        return total;
    }
    // Get class hit die
    const hitDie = classId ? getHitDie(classId) : "d6";
    const hitDieMax = getMaxDieRoll(hitDie);
    // Add max HP for each class level
    for (let i = 1; i <= level; i++) {
        total += Math.max(1, hitDieMax + staminaModifier);
    }
    return total;
}
// =============================================================================
// HP History Management
// =============================================================================
/**
 * Create an HP roll record for a level-up
 *
 * @param level - Level at which HP is being gained
 * @param die - Die being rolled
 * @param rolled - Raw die result
 * @param staminaModifier - Current stamina modifier
 * @returns HP roll record
 */
export function createHPRollRecord(level, die, rolled, staminaModifier) {
    return {
        level,
        die,
        rolled,
        staminaModifier,
        gained: Math.max(1, rolled + staminaModifier),
    };
}
/**
 * Add an HP roll to a character's history
 *
 * @param character - Character to update
 * @param record - HP roll record to add
 * @returns Updated character with new HP history entry
 */
export function addHPRollToHistory(character, record) {
    const currentHistory = character.state.hp.history ?? [];
    return {
        ...character,
        state: {
            ...character.state,
            hp: {
                ...character.state.hp,
                history: [...currentHistory, record],
            },
        },
    };
}
/**
 * Get total HP gained from history
 *
 * @param history - HP roll history
 * @returns Total HP from all recorded rolls
 */
export function getTotalHPFromHistory(history) {
    return history.reduce((sum, record) => sum + record.gained, 0);
}
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Get average roll for a die type
 */
function getAverageDieRoll(die) {
    const match = /d(\d+)/.exec(die);
    if (!match?.[1])
        return 3.5; // Default to d6 average
    const sides = parseInt(match[1], 10);
    return (1 + sides) / 2;
}
/**
 * Get maximum roll for a die type
 */
function getMaxDieRoll(die) {
    const match = /d(\d+)/.exec(die);
    if (!match?.[1])
        return 6; // Default to d6 max
    return parseInt(match[1], 10);
}
//# sourceMappingURL=hit-points.js.map