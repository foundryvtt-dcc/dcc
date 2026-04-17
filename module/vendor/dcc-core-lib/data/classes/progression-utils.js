/**
 * Class Progression Utilities
 *
 * Helper functions for working with class progression data.
 *
 * This module provides a registry pattern for class progressions.
 * The actual class data should be loaded from external sources
 * (e.g., dcc-official-data) and registered using registerClassProgression().
 *
 * @example
 * ```typescript
 * import { registerClassProgression } from "dcc-core-lib";
 * import { WARRIOR_PROGRESSION } from "dcc-official-data";
 *
 * // Register class data at app startup
 * registerClassProgression(WARRIOR_PROGRESSION);
 *
 * // Then use utility functions
 * const saves = getSavingThrows("warrior", 5);
 * ```
 */
/**
 * Registry of class progressions by class ID.
 * Populated by registerClassProgression() or registerClassProgressions().
 */
const classProgressionRegistry = new Map();
/**
 * Register a class progression in the registry.
 *
 * @param progression - The class progression to register
 *
 * @example
 * ```typescript
 * import { WARRIOR_PROGRESSION } from "dcc-official-data";
 * registerClassProgression(WARRIOR_PROGRESSION);
 * ```
 */
export function registerClassProgression(progression) {
    classProgressionRegistry.set(progression.classId, progression);
}
/**
 * Register multiple class progressions at once.
 *
 * @param progressions - Array of class progressions to register
 *
 * @example
 * ```typescript
 * import { ALL_CLASS_PROGRESSIONS } from "dcc-official-data";
 * registerClassProgressions(ALL_CLASS_PROGRESSIONS);
 * ```
 */
export function registerClassProgressions(progressions) {
    for (const progression of progressions) {
        registerClassProgression(progression);
    }
}
/**
 * Clear all registered class progressions.
 * Useful for testing or resetting state.
 */
export function clearClassProgressions() {
    classProgressionRegistry.clear();
}
/**
 * Get a registered class progression by ID.
 *
 * @param classId - The class ID (e.g., "warrior", "thief")
 * @returns The class progression, or undefined if not registered
 */
export function getClassProgression(classId) {
    return classProgressionRegistry.get(classId);
}
/**
 * Get all registered class IDs.
 *
 * @returns Array of registered class IDs
 */
export function getRegisteredClassIds() {
    return Array.from(classProgressionRegistry.keys());
}
/**
 * Get save bonus from a class progression at a specific level.
 *
 * @param classId - The class ID (e.g., "warrior", "thief")
 * @param level - The character level
 * @param save - The save type ("ref", "frt", or "wil")
 * @returns The save bonus, or 0 if class/level not found
 *
 * @example
 * // Get warrior's fortitude save at level 5
 * const frt = getSaveBonus("warrior", 5, "frt"); // 3
 */
export function getSaveBonus(classId, level, save) {
    const progression = classProgressionRegistry.get(classId);
    if (!progression)
        return 0;
    const levelData = progression.levels[level];
    if (!levelData)
        return 0;
    return levelData.saves[save];
}
/**
 * Get all saving throw bonuses from a class progression at a specific level.
 *
 * @param classId - The class ID (e.g., "warrior", "thief")
 * @param level - The character level
 * @returns The saving throw bonuses
 *
 * @example
 * // Get warrior's saves at level 5
 * const saves = getSavingThrows("warrior", 5);
 * // { reflex: 2, fortitude: 3, will: 1 }
 */
export function getSavingThrows(classId, level) {
    const progression = classProgressionRegistry.get(classId);
    if (!progression) {
        return { reflex: 0, fortitude: 0, will: 0 };
    }
    const levelData = progression.levels[level];
    if (!levelData) {
        return { reflex: 0, fortitude: 0, will: 0 };
    }
    return {
        reflex: levelData.saves.ref,
        fortitude: levelData.saves.frt,
        will: levelData.saves.wil,
    };
}
/**
 * Get the attack bonus from a class progression at a specific level.
 * Note: For warriors and dwarves, this returns the deed die as a string.
 * For other classes, this returns a number.
 *
 * @param classId - The class ID
 * @param level - The character level
 * @returns The attack bonus (number or die type string)
 */
export function getAttackBonus(classId, level) {
    const progression = classProgressionRegistry.get(classId);
    if (!progression)
        return 0;
    const levelData = progression.levels[level];
    if (!levelData)
        return 0;
    return levelData.attackBonus;
}
/**
 * Get the action dice from a class progression at a specific level.
 *
 * @param classId - The class ID
 * @param level - The character level
 * @returns Array of action dice (e.g., ["1d20", "1d14"])
 */
export function getActionDice(classId, level) {
    const progression = classProgressionRegistry.get(classId);
    if (!progression)
        return ["1d20"];
    const levelData = progression.levels[level];
    if (!levelData)
        return ["1d20"];
    return levelData.actionDice;
}
/**
 * Get the critical hit data from a class progression at a specific level.
 *
 * @param classId - The class ID
 * @param level - The character level
 * @returns The critical die and table
 */
export function getCriticalHitData(classId, level) {
    const progression = classProgressionRegistry.get(classId);
    if (!progression) {
        return { die: "1d4", table: "I" };
    }
    const levelData = progression.levels[level];
    if (!levelData) {
        return { die: "1d4", table: "I" };
    }
    const result = {
        die: levelData.criticalDie,
        table: levelData.criticalTable,
    };
    if (levelData.critRange !== undefined) {
        result.range = levelData.critRange;
    }
    return result;
}
/**
 * Get the title for a character of a specific class, level, and alignment.
 *
 * @param classId - The class ID
 * @param level - The character level
 * @param alignment - The character alignment ("lawful", "neutral", "chaotic")
 * @returns The title, or undefined if not found
 */
export function getTitle(classId, level, alignment) {
    const progression = classProgressionRegistry.get(classId);
    if (!progression)
        return undefined;
    const levelData = progression.levels[level];
    if (!levelData)
        return undefined;
    return levelData[alignment]?.title;
}
/**
 * Check if a class has deed die (warrior-style attack bonus).
 *
 * @param classId - The class ID
 * @returns True if the class uses deed die
 */
export function hasDeedDie(classId) {
    return classId === "warrior" || classId === "dwarf";
}
/**
 * Get the hit die for a class.
 *
 * @param classId - The class ID
 * @returns The hit die (e.g., "d8", "d10")
 */
export function getHitDie(classId) {
    const progression = classProgressionRegistry.get(classId);
    if (!progression)
        return "d4";
    // Get from level 1 (all levels have same hit die)
    const levelData = progression.levels[1];
    if (!levelData)
        return "d4";
    return levelData.hitDie;
}
//# sourceMappingURL=progression-utils.js.map