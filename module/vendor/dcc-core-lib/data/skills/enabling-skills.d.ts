/**
 * Enabling Skill Definitions
 *
 * These are passive-type skills that enable game mechanics rather than
 * producing direct roll results. They unlock abilities like mighty deeds,
 * shield bashes, backstabs, two-weapon fighting, and luck recovery.
 */
import type { DieType } from "../../types/dice.js";
import type { SkillDefinition } from "../../types/skills.js";
/**
 * Mighty Deed of Arms
 *
 * Warriors and dwarves can attempt spectacular combat maneuvers.
 * On any attack, they roll a deed die alongside their attack roll.
 * If the deed die shows 3+, they can attempt a special action in
 * addition to dealing bonus damage.
 *
 * The deed die improves with level.
 */
export declare const MIGHTY_DEED: SkillDefinition;
/**
 * Get the deed die for a given level from the skill definition
 */
export declare function getDeedDieFromSkill(level: number): DieType;
/**
 * Get the deed success threshold from the skill definition
 */
export declare function getDeedSuccessThreshold(): number;
/**
 * Shield Bash
 *
 * Dwarves can use their shield as an offensive weapon, making an
 * extra attack each round while wielding a shield.
 */
export declare const SHIELD_BASH: SkillDefinition;
/**
 * Check if a character can perform a shield bash
 */
export declare function canShieldBash(hasShieldEquipped: boolean, classId: string): boolean;
/**
 * Get the shield bash damage die from the skill definition
 */
export declare function getShieldBashDamageDie(): DieType;
/**
 * Backstab
 *
 * Thieves can deal massive damage when attacking a surprised or
 * unaware opponent from behind. The damage multiplier increases
 * with level.
 *
 * Note: This replaces the existing BACKSTAB in thief-skills.ts
 * with a proper enabling skill definition.
 */
export declare const BACKSTAB_ENABLING: SkillDefinition;
/**
 * Get the backstab multiplier for a given level from the skill definition
 */
export declare function getBackstabMultiplierFromSkill(level: number): number;
/**
 * Check if conditions are met for a backstab
 */
export declare function canBackstab(targetIsSurprised: boolean, attackerIsBehind: boolean, classId: string): boolean;
/**
 * Two-Weapon Fighting
 *
 * Halflings are skilled at fighting with two weapons. They suffer
 * reduced penalties compared to other classes and gain an initiative
 * bonus when doing so.
 */
export declare const TWO_WEAPON_FIGHTING: SkillDefinition;
/**
 * Check if a character has two-weapon fighting capability
 */
export declare function hasTwoWeaponFighting(classId: string): boolean;
/**
 * Get the two-weapon fighting attack penalty from skill definition
 */
export declare function getTwoWeaponAttackPenalty(classId: string): number;
/**
 * Get the initiative bonus for two-weapon fighting from skill definition
 */
export declare function getTwoWeaponInitBonus(classId: string): number;
/**
 * Luck Recovery
 *
 * Thieves and halflings can recover spent luck points. Thieves recover
 * luck when they succeed at certain thief skills. Halflings can share
 * their luck recovery with nearby allies.
 */
export declare const LUCK_RECOVERY: SkillDefinition;
/**
 * Get the luck die for a thief at a given level from the skill definition
 */
export declare function getLuckDieFromSkill(level: number): DieType;
/**
 * Check if a character can recover luck
 */
export declare function canRecoverLuck(classId: string): boolean;
/**
 * Get daily luck recovery amount for halflings from skill definition
 */
export declare function getHalflingDailyLuckRecovery(): number;
/**
 * Check if a thief should recover luck (on natural 20 of thief skill)
 */
export declare function thiefShouldRecoverLuck(naturalRoll: number, isThiefSkill: boolean): boolean;
/**
 * Luck Sharing (Halfling)
 *
 * Halflings can spend their luck to aid allies within 30 feet.
 */
export declare const LUCK_SHARING: SkillDefinition;
/**
 * Check if a halfling can share luck with an ally
 */
export declare function canShareLuck(classId: string, distanceToAlly: number): boolean;
/**
 * All enabling skills indexed by ID
 */
export declare const ENABLING_SKILLS: Record<string, SkillDefinition>;
/**
 * List of enabling skill IDs
 */
export declare const ENABLING_SKILL_IDS: string[];
/**
 * Get all enabling skills for a given class
 */
export declare function getEnablingSkillsForClass(classId: string): SkillDefinition[];
/**
 * Check if a class has a specific enabling skill
 */
export declare function classHasEnablingSkill(classId: string, skillId: string): boolean;
//# sourceMappingURL=enabling-skills.d.ts.map