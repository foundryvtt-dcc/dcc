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
import type { ClassProgression, ProgressionSaveType } from "../../types/class-progression.js";
import type { SavingThrows } from "../../types/character.js";
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
export declare function registerClassProgression(progression: ClassProgression): void;
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
export declare function registerClassProgressions(progressions: ClassProgression[]): void;
/**
 * Clear all registered class progressions.
 * Useful for testing or resetting state.
 */
export declare function clearClassProgressions(): void;
/**
 * Get a registered class progression by ID.
 *
 * @param classId - The class ID (e.g., "warrior", "thief")
 * @returns The class progression, or undefined if not registered
 */
export declare function getClassProgression(classId: string): ClassProgression | undefined;
/**
 * Get all registered class IDs.
 *
 * @returns Array of registered class IDs
 */
export declare function getRegisteredClassIds(): string[];
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
export declare function getSaveBonus(classId: string, level: number, save: ProgressionSaveType): number;
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
export declare function getSavingThrows(classId: string, level: number): SavingThrows;
/**
 * Get the attack bonus from a class progression at a specific level.
 * Note: For warriors and dwarves, this returns the deed die as a string.
 * For other classes, this returns a number.
 *
 * @param classId - The class ID
 * @param level - The character level
 * @returns The attack bonus (number or die type string)
 */
export declare function getAttackBonus(classId: string, level: number): number | string;
/**
 * Get the action dice from a class progression at a specific level.
 *
 * @param classId - The class ID
 * @param level - The character level
 * @returns Array of action dice (e.g., ["1d20", "1d14"])
 */
export declare function getActionDice(classId: string, level: number): string[];
/**
 * Get the critical hit data from a class progression at a specific level.
 *
 * @param classId - The class ID
 * @param level - The character level
 * @returns The critical die and table
 */
export declare function getCriticalHitData(classId: string, level: number): {
    die: string;
    table: string;
    range?: number;
};
/**
 * Get the title for a character of a specific class, level, and alignment.
 *
 * @param classId - The class ID
 * @param level - The character level
 * @param alignment - The character alignment ("lawful", "neutral", "chaotic")
 * @returns The title, or undefined if not found
 */
export declare function getTitle(classId: string, level: number, alignment: "lawful" | "neutral" | "chaotic"): string | undefined;
/**
 * Check if a class has deed die (warrior-style attack bonus).
 *
 * @param classId - The class ID
 * @returns True if the class uses deed die
 */
export declare function hasDeedDie(classId: string): boolean;
/**
 * Get the hit die for a class.
 *
 * @param classId - The class ID
 * @returns The hit die (e.g., "d8", "d10")
 */
export declare function getHitDie(classId: string): string;
//# sourceMappingURL=progression-utils.d.ts.map