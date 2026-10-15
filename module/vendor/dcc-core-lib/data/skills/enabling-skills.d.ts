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
 * Per DCC core rules: when a thief strikes from behind, or strikes a
 * foe who has not noticed them, the thief adds an alignment- and
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
 * RAW backstab trigger (DCC core rulebook, Thief class, paraphrased): the
 * attack comes from behind, OR the target is unaware of the attacker.
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
 * Thieves and halflings regain spent Luck overnight: one point per class
 * level, never past the character's natural maximum (DCC RPG core rules,
 * Thief and Halfling class text).
 */
export declare const LUCK_RECOVERY: SkillDefinition;
/**
 * Check if a character can recover luck
 */
export declare function canRecoverLuck(classId: string): boolean;
/** Input to {@link nightlyLuckRecovery}. */
export interface NightlyLuckRecoveryInput {
    /** The character's class level. */
    level: number;
    /** The character's current Luck score. */
    current: number;
    /** The character's natural maximum Luck score. */
    max: number;
}
/**
 * Luck score after a night's rest for a class that recovers Luck: the
 * current score plus one point per level, capped at the natural maximum.
 * A score already at or above the maximum is left unchanged. Callers
 * decide whether the character recovers Luck at all (see
 * {@link canRecoverLuck}).
 */
export declare function nightlyLuckRecovery(input: NightlyLuckRecoveryInput): number;
/**
 * Luck Sharing (Halfling)
 *
 * A halfling can burn their own Luck on an ally's roll when the ally is
 * nearby and visible to them, even outside their turn in the initiative
 * order. The halfling loses the Luck and the ally gets the bonus.
 * Only one halfling in a party can do this. There is no fixed range.
 */
export declare const LUCK_SHARING: SkillDefinition;
/** Optional conditions for {@link canShareLuck}. */
export interface ShareLuckOptions {
    /** Whether the ally is nearby and visible to the halfling. Default true. */
    allyVisible?: boolean | undefined;
    /** Distance to the ally. Only checked when `maxRange` is also given. */
    distanceToAlly?: number | undefined;
    /**
     * A table's own range limit. The rules set none, so there is no default.
     * Ignored unless `distanceToAlly` is also given.
     */
    maxRange?: number | undefined;
}
/**
 * Check if a character can share Luck with an ally. The class must have
 * {@link LUCK_SHARING} and the ally must be visible. A range applies only
 * when the caller supplies `maxRange`. The one-halfling-per-party limit
 * is left to the caller.
 */
export declare function canShareLuck(classId: string, options?: ShareLuckOptions): boolean;
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
