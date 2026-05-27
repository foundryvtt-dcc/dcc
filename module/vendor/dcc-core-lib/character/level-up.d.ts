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
import type { DieType } from "../types/dice.js";
import type { Character } from "../types/character.js";
import type { RandomSource } from "../types/random.js";
/**
 * XP thresholds for a single class (XP needed to reach each level)
 *
 * Index 0 = XP to reach level 1 (from 0-level)
 * Index 1 = XP to reach level 2
 * ...
 * Index 9 = XP to reach level 10
 */
export interface XPThresholds {
    /** Class ID this threshold applies to */
    classId: string;
    /** XP needed to reach each level (index 0 = level 1) */
    thresholds: number[];
}
/**
 * Result of a level-up operation
 */
export interface LevelUpResult {
    /** Whether the level-up was successful */
    success: boolean;
    /** Error message if not successful */
    error?: string;
    /** The updated character (if successful) */
    character?: Character;
    /** Details about what changed */
    changes?: LevelUpChanges;
}
/**
 * Details of what changed during level-up
 */
export interface LevelUpChanges {
    /** Previous level */
    previousLevel: number;
    /** New level */
    newLevel: number;
    /** HP rolled for this level */
    hpRolled: number;
    /** HP gained (after modifiers, minimum 1) */
    hpGained: number;
    /** New title (if any) */
    newTitle?: string | undefined;
    /** New save bonuses */
    newSaves: {
        reflex: number;
        fortitude: number;
        will: number;
    };
    /** New attack bonus */
    newAttackBonus: number | string;
    /** New action dice */
    newActionDice: string[];
    /** New crit data */
    newCritData: {
        die: string;
        table: string;
        range?: number;
    };
}
/**
 * Register XP thresholds for a class
 *
 * @param thresholds - XP thresholds to register
 */
export declare function registerXPThresholds(thresholds: XPThresholds): void;
/**
 * Register multiple XP thresholds at once
 *
 * @param thresholds - Array of XP thresholds to register
 */
export declare function registerAllXPThresholds(thresholds: XPThresholds[]): void;
/**
 * Clear all registered XP thresholds (for testing)
 */
export declare function clearXPThresholds(): void;
/**
 * Get XP thresholds for a class
 *
 * @param classId - Class ID
 * @returns XP thresholds, or default if not registered
 */
export declare function getXPThresholds(classId: string): number[];
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
export declare function getXPForLevel(classId: string, level: number): number | undefined;
/**
 * Get XP required for next level
 *
 * @param classId - Class ID
 * @param currentLevel - Current level (0-9)
 * @returns XP required for next level, or undefined if at max
 */
export declare function getXPForNextLevel(classId: string, currentLevel: number): number | undefined;
/**
 * Calculate what level a character should be based on XP
 *
 * @param classId - Class ID
 * @param xp - Current XP total
 * @returns Level the character should be (0-10)
 */
export declare function calculateLevelFromXP(classId: string, xp: number): number;
/**
 * Check if a character can level up
 *
 * @param character - The character to check
 * @returns True if character has enough XP for next level
 */
export declare function canLevelUp(character: Character): boolean;
/**
 * Get how much XP is needed for next level
 *
 * @param character - The character to check
 * @returns XP needed, or undefined if at max level
 */
export declare function getXPNeeded(character: Character): number | undefined;
/**
 * Result of rolling HP for a level
 */
export interface HPRollResult {
    /** Raw die result */
    rolled: number;
    /** HP actually gained (after minimum 1 rule) */
    gained: number;
    /** Stamina modifier applied */
    staminaModifier: number;
    /** Die that was rolled */
    die: string;
}
/**
 * Roll HP for a new level
 *
 * @param hitDie - The hit die to roll (e.g., "d8")
 * @param staminaModifier - Stamina modifier to add
 * @param random - Random source for rolling
 * @returns Object with roll result and final HP (minimum 1)
 */
export declare function rollHPForLevel(hitDie: DieType, staminaModifier: number, random?: RandomSource): HPRollResult;
/**
 * Level up a 0-level character to 1st level
 *
 * @param character - The 0-level character
 * @param classId - The class to take
 * @param random - Random source for HP roll
 * @returns Level-up result
 */
export declare function levelUpFrom0(character: Character, classId: string, random?: RandomSource): LevelUpResult;
/**
 * Level up a character to the next level
 *
 * @param character - The character to level up
 * @param random - Random source for HP roll
 * @returns Level-up result
 */
export declare function levelUp(character: Character, random?: RandomSource): LevelUpResult;
/**
 * Add XP to a character
 *
 * @param character - The character to update
 * @param xp - Amount of XP to add
 * @returns Updated character
 */
export declare function addXP(character: Character, xp: number): Character;
//# sourceMappingURL=level-up.d.ts.map