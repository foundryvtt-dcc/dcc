/**
 * Occupation Skills
 *
 * Pure functions for occupation-based skill checks.
 * Handles:
 * - Trained weapon proficiency
 * - Trade skills (background knowledge)
 * - Limited thief skill access
 */
import type { DieType, RollModifier, RollOptions } from "../types/dice.js";
import type { OccupationSkillGrant, OccupationSkillCheckInput, OccupationSkillCheckResult, OccupationSkillEvents, OccupationWeaponTraining, ThiefSkillId } from "../types/occupation-skills.js";
/**
 * Default die for trade skill checks.
 */
export declare const DEFAULT_TRADE_SKILL_DIE: DieType;
/**
 * Default die for limited thief skill checks.
 */
export declare const DEFAULT_THIEF_SKILL_DIE: DieType;
/**
 * Default attack bonus for trained weapon proficiency.
 */
export declare const DEFAULT_WEAPON_TRAINING_BONUS = 0;
/**
 * Minimum effective level for limited thief skills.
 */
export declare const MIN_EFFECTIVE_LEVEL = 0;
/**
 * Parse weapon training from an occupation's trained weapon string.
 *
 * @param trainedWeapon - The trained weapon string (e.g., "Hammer (as club)")
 * @returns Parsed weapon training data
 */
export declare function parseWeaponTraining(trainedWeapon: string): OccupationWeaponTraining;
/**
 * Check if a weapon matches the character's trained weapon.
 *
 * @param weaponName - The weapon being used
 * @param training - The character's weapon training
 * @returns True if the weapon matches
 */
export declare function isTrainedWeapon(weaponName: string, training: OccupationWeaponTraining): boolean;
/**
 * Get attack bonus for using trained weapon.
 *
 * @param weaponName - The weapon being used
 * @param training - The character's weapon training
 * @returns Attack bonus (0 if not trained weapon)
 */
export declare function getTrainedWeaponBonus(weaponName: string, training: OccupationWeaponTraining): number;
/**
 * Calculate effective level for a limited thief skill.
 *
 * @param characterLevel - The character's actual level
 * @param levelAdjustment - The skill's level adjustment (usually negative)
 * @returns Effective level (minimum 0)
 */
export declare function calculateEffectiveLevel(characterLevel: number, levelAdjustment?: number): number;
/**
 * Check if a character has access to a limited thief skill from their occupation.
 *
 * @param occupationSkills - Skills granted by the occupation
 * @param thiefSkillId - The thief skill to check
 * @returns The skill grant if available, undefined otherwise
 */
export declare function getOccupationThiefSkill(occupationSkills: OccupationSkillGrant[], thiefSkillId: ThiefSkillId): OccupationSkillGrant | undefined;
/**
 * Check if an occupation grants a specific thief skill.
 *
 * @param occupationSkills - Skills granted by the occupation
 * @param thiefSkillId - The thief skill to check
 * @returns True if the occupation grants access to this skill
 */
export declare function hasOccupationThiefSkill(occupationSkills: OccupationSkillGrant[], thiefSkillId: ThiefSkillId): boolean;
/**
 * Build modifiers for an occupation skill check.
 *
 * @param input - The skill check input
 * @returns Array of roll modifiers
 */
export declare function buildOccupationSkillModifiers(input: OccupationSkillCheckInput): RollModifier[];
/**
 * Resolve an occupation skill check.
 *
 * @param input - The skill check input
 * @param options - Roll options
 * @param events - Event callbacks
 * @returns The skill check result
 */
export declare function resolveOccupationSkillCheck(input: OccupationSkillCheckInput, options?: RollOptions, events?: OccupationSkillEvents): OccupationSkillCheckResult;
/**
 * Get all trade skills from occupation skills.
 *
 * @param occupationSkills - Skills granted by the occupation
 * @returns Array of trade skills
 */
export declare function getTradeSkills(occupationSkills: OccupationSkillGrant[]): OccupationSkillGrant[];
/**
 * Get all knowledge skills from occupation skills.
 *
 * @param occupationSkills - Skills granted by the occupation
 * @returns Array of knowledge skills
 */
export declare function getKnowledgeSkills(occupationSkills: OccupationSkillGrant[]): OccupationSkillGrant[];
/**
 * Get all limited thief skills from occupation skills.
 *
 * @param occupationSkills - Skills granted by the occupation
 * @returns Array of limited thief skills
 */
export declare function getLimitedThiefSkills(occupationSkills: OccupationSkillGrant[]): OccupationSkillGrant[];
/**
 * Check if an occupation skill check result was successful.
 *
 * @param result - The check result
 * @returns True if successful
 */
export declare function isOccupationSkillSuccess(result: OccupationSkillCheckResult): boolean;
/**
 * Get a summary of the occupation skill check result.
 *
 * @param result - The check result
 * @returns Summary string
 */
export declare function getOccupationSkillSummary(result: OccupationSkillCheckResult): string;
//# sourceMappingURL=skills.d.ts.map