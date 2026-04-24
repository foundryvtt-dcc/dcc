/**
 * Corruption Module
 *
 * Pure functions for wizard/elf corruption mechanics.
 * Corruption represents the physical and mental toll of channeling
 * arcane energies, resulting in permanent mutations and deformities.
 */
import { lookupSimple } from "../tables/lookup.js";
// =============================================================================
// Corruption Rolling
// =============================================================================
/**
 * Default random number generator
 */
function defaultRoller(faces) {
    return Math.floor(Math.random() * faces) + 1;
}
/**
 * Roll for corruption effect.
 *
 * In DCC, corruption is typically rolled on d10 for minor,
 * d10+10 for major, or d10+20 for greater corruption.
 *
 * @param corruptionTable - Table to look up the result
 * @param tier - Corruption tier (determines die modifier)
 * @param options - Roll options
 * @returns The corruption result
 */
export function rollCorruption(corruptionTable, tier = "minor", options = {}) {
    // Determine base roll and modifier
    let baseRoll;
    if (options.roller) {
        baseRoll = options.roller("1d10");
    }
    else {
        baseRoll = defaultRoller(10);
    }
    // Apply tier modifier
    const tierModifiers = {
        minor: 0,
        major: 10,
        greater: 20,
    };
    const roll = baseRoll + tierModifiers[tier];
    // Look up result
    const tableResult = lookupSimple(corruptionTable, roll);
    const result = {
        roll,
        description: tableResult?.text ?? `Corruption (roll ${String(roll)})`,
        permanent: true, // Most corruptions are permanent
        tier,
    };
    if (tableResult?.effect) {
        result.effect = tableResult.effect;
    }
    return result;
}
/**
 * Roll corruption with a specific modifier (e.g., from luck).
 */
export function rollCorruptionWithModifier(corruptionTable, modifier, tier = "minor", options = {}) {
    // Roll base
    let baseRoll;
    if (options.roller) {
        baseRoll = options.roller("1d10");
    }
    else {
        baseRoll = defaultRoller(10);
    }
    // Apply tier modifier and luck modifier
    const tierModifiers = {
        minor: 0,
        major: 10,
        greater: 20,
    };
    const roll = Math.max(1, baseRoll + tierModifiers[tier] + modifier);
    // Look up result
    const tableResult = lookupSimple(corruptionTable, roll);
    const result = {
        roll,
        description: tableResult?.text ?? `Corruption (roll ${String(roll)})`,
        permanent: true,
        tier,
    };
    if (tableResult?.effect) {
        result.effect = tableResult.effect;
    }
    return result;
}
// =============================================================================
// Corruption Application
// =============================================================================
/**
 * Add a corruption to a character's corruption list.
 * Returns the updated corruption array.
 */
export function addCorruption(currentCorruptions, newCorruption) {
    return [...currentCorruptions, newCorruption.description];
}
/**
 * Get corruptions from a character's class state.
 * Works for both wizards and elves.
 */
export function getCorruptions(character) {
    const wizardState = character.state.classState?.wizard;
    const elfState = character.state.classState?.elf;
    if (wizardState) {
        return wizardState.corruption;
    }
    if (elfState) {
        return elfState.corruption;
    }
    return [];
}
/**
 * Count the number of corruptions a character has.
 */
export function getCorruptionCount(character) {
    return getCorruptions(character).length;
}
/**
 * Check if a character has any corruptions.
 */
export function hasCorruptions(character) {
    return getCorruptionCount(character) > 0;
}
// =============================================================================
// Corruption Severity
// =============================================================================
/**
 * Determine corruption tier based on spell level.
 * Higher level spells risk greater corruption.
 */
export function determineCorruptionTier(spellLevel) {
    if (spellLevel <= 2)
        return "minor";
    if (spellLevel <= 4)
        return "major";
    return "greater";
}
/**
 * Determine corruption tier based on roll result.
 */
export function getCorruptionSeverity(roll) {
    if (roll <= 10)
        return "minor";
    if (roll <= 20)
        return "major";
    return "greater";
}
// =============================================================================
// Patron Taint
// =============================================================================
/**
 * Roll for patron taint.
 * Patron taint is similar to corruption but specific to the patron.
 *
 * @param patronId - The patron's identifier
 * @param taintTable - Table to look up the result
 * @param options - Roll options
 * @returns The patron taint result
 */
export function rollPatronTaint(patronId, taintTable, options = {}) {
    // Patron taint typically uses 1d6
    let roll;
    if (options.roller) {
        roll = options.roller("1d6");
    }
    else {
        roll = defaultRoller(6);
    }
    const tableResult = lookupSimple(taintTable, roll);
    const result = {
        roll,
        patronId,
        description: tableResult?.text ?? `Patron taint from ${patronId} (roll ${String(roll)})`,
    };
    if (tableResult?.effect) {
        result.effect = tableResult.effect;
    }
    return result;
}
// =============================================================================
// Un-corruption (Rare)
// =============================================================================
/**
 * Remove a corruption from a character (very rare in DCC).
 * Returns the updated corruption array.
 *
 * Note: In most DCC games, corruption is permanent. This function
 * exists for special cases like divine intervention or powerful magic.
 */
export function removeCorruption(currentCorruptions, indexToRemove) {
    return currentCorruptions.filter((_, index) => index !== indexToRemove);
}
/**
 * Remove all corruptions from a character (extremely rare).
 */
export function clearAllCorruptions() {
    return [];
}
//# sourceMappingURL=corruption.js.map