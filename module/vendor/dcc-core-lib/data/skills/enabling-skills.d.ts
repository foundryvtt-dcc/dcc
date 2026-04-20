/**
 * Enabling Skill Definitions
 *
 * These are passive-type skills that enable game mechanics rather than
 * producing direct roll results. They unlock abilities like mighty deeds,
 * shield bashes, backstabs, two-weapon fighting, and luck recovery.
 */
import type { DieType } from "../../types/dice.js";
import type { SkillDefinition } from "../../types/skills.js";
import type { ClassProgression, ProgressionAlignment } from "../../types/class-progression.js";
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
 * Canonical `RollBonus.id` for the thief's Table 1-9 backstab attack
 * bonus. Use this when constructing the `RollBonus` that carries the
 * precomputed backstab value into `makeAttackRoll`.
 */
export declare const BACKSTAB_BONUS_ID = "class:backstab";
/**
 * Backstab
 *
 * Per DCC core rules: when a thief attacks a target from behind OR a
 * target that is otherwise unaware, the thief adds an alignment- and
 * level-scaled attack bonus (Table 1-9) and, on a hit, automatically
 * scores a critical hit rolled on Crit Table II with the thief's
 * level-scaled crit die (Table 1-7).
 *
 * There is no RAW damage multiplier; bonus damage, where it applies,
 * comes from backstab-friendly weapons (see `WeaponStats.backstabDamage`).
 */
export declare const BACKSTAB: SkillDefinition;
/**
 * Look up the thief's backstab attack-roll bonus for a given level and
 * alignment from class progression data (Table 1-9).
 *
 * The value comes from the loaded class progression, which mirrors the
 * rulebook table (e.g., L1 Lawful +1, L1 Chaotic +3, L10 Chaotic +15).
 *
 * @returns The attack bonus, or `undefined` when the progression has
 *   no entry for the given level/alignment (out-of-range level, wrong
 *   class, or missing skill entry). A legitimate +0 is still returned
 *   as `0` — `undefined` is reserved for "no data".
 */
export declare function getBackstabAttackBonus(progression: ClassProgression, level: number, alignment: ProgressionAlignment): number | undefined;
/**
 * RAW backstab trigger: "attacking a target from behind OR a target
 * that is otherwise unaware" (DCC core rulebook, Thief class).
 *
 * This helper covers only the rulebook trigger. Extensions (extra
 * classes, magic items, spells, special effects) that grant backstab
 * under broader circumstances should OR their own conditions in and
 * hand the combined boolean to `canBackstab`.
 *
 * @param attackerIsBehind - True if the attacker is attacking from
 *   behind the target.
 * @param targetIsUnaware - True if the target is otherwise unaware of
 *   the attacker (surprise round, sleeping, blinded, distracted,
 *   flanked-and-engaged, etc.). Not limited to the surprise round.
 */
export declare function isBackstabTriggeredRaw(attackerIsBehind: boolean, targetIsUnaware: boolean): boolean;
/**
 * Check if the preconditions for a backstab attempt are met.
 *
 * The *trigger* (RAW: behind or unaware) is intentionally a boolean
 * the caller computes — typically via `isBackstabTriggeredRaw` for
 * stock rules, or by OR-ing the RAW trigger with any extension-supplied
 * conditions (magic item, spell effect, homebrew class ability).
 *
 * This function owns the class and anatomy gates, which an extension
 * should not be able to bypass:
 *  - Only thieves have backstab.
 *  - Target must have clear anatomical vulnerabilities (oozes,
 *    elementals, and amorphous monsters typically do not).
 *
 * @param isBackstabTriggered - Whether the in-world trigger conditions
 *   are met (RAW: behind or unaware; or any extension's equivalent).
 * @param classId - The attacker's class.
 * @param targetHasAnatomy - Whether the target has clear anatomical
 *   vulnerabilities. Defaults to true for callers that don't yet
 *   thread monster anatomy data.
 */
export declare function canBackstab(isBackstabTriggered: boolean, classId: string, targetHasAnatomy?: boolean): boolean;
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