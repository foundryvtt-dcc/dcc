/**
 * Enabling Skill Definitions
 *
 * These are passive-type skills that enable game mechanics rather than
 * producing direct roll results. They unlock abilities like mighty deeds,
 * shield bashes, backstabs, two-weapon fighting, and luck recovery.
 */
import { getSkillBonus } from "../../types/class-progression.js";
// =============================================================================
// Mighty Deed of Arms (Warrior, Dwarf)
// =============================================================================
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
export const MIGHTY_DEED = {
    id: "mighty-deed",
    name: "Mighty Deed of Arms",
    description: "On each attack, roll a deed die. On a 3+, the deed succeeds and " +
        "you may attempt a special combat maneuver (disarm, trip, push, etc.) " +
        "in addition to adding the deed die result to attack and damage.",
    type: "passive",
    enables: {
        action: "deed-attempt",
        condition: "on-melee-attack",
        data: {
            successThreshold: 3,
            addsToAttack: true,
            addsToDamage: true,
            allowsManeuver: true,
        },
    },
    tags: ["combat", "melee"],
    classes: ["warrior", "dwarf"],
};
/**
 * Get the deed success threshold from the skill definition
 */
export function getDeedSuccessThreshold() {
    const data = MIGHTY_DEED.enables?.data;
    if (data) {
        const threshold = data["successThreshold"];
        if (typeof threshold === "number") {
            return threshold;
        }
    }
    return 3;
}
// =============================================================================
// Shield Bash (Dwarf)
// =============================================================================
/**
 * Shield Bash
 *
 * Dwarves can use their shield as an offensive weapon, making an
 * extra attack each round while wielding a shield.
 */
export const SHIELD_BASH = {
    id: "shield-bash",
    name: "Shield Bash",
    description: "While wielding a shield, you can make an additional attack with " +
        "the shield, dealing 1d3 damage. This attack uses your deed die " +
        "(if any) but does not add Strength to damage.",
    type: "passive",
    enables: {
        action: "shield-bash-attack",
        condition: "wielding-shield",
        data: {
            damageDie: "d3",
            bonusAttack: true,
            addStrengthToDamage: false,
            usesDeedDie: true,
        },
    },
    tags: ["combat", "melee", "shield"],
    classes: ["dwarf"],
};
/**
 * Check if a character can perform a shield bash
 */
export function canShieldBash(hasShieldEquipped, classId) {
    return hasShieldEquipped && (SHIELD_BASH.classes?.includes(classId) ?? false);
}
/**
 * Get the shield bash damage die from the skill definition
 */
export function getShieldBashDamageDie() {
    const data = SHIELD_BASH.enables?.data;
    if (data) {
        const damageDie = data["damageDie"];
        if (typeof damageDie === "string") {
            return damageDie;
        }
    }
    return "d3";
}
// =============================================================================
// Backstab (Thief)
// =============================================================================
/**
 * Canonical `RollBonus.id` for the thief's Table 1-9 backstab attack
 * bonus. Use this when constructing the `RollBonus` that carries the
 * precomputed backstab value into `makeAttackRoll`.
 */
export const BACKSTAB_BONUS_ID = "class:backstab";
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
export const BACKSTAB = {
    id: "backstab",
    name: "Backstab",
    description: "When attacking a target from behind or an unaware target, add the " +
        "alignment- and level-scaled attack bonus from Table 1-9. On a hit, " +
        "the attack automatically scores a critical hit on Crit Table II " +
        "using the thief's level-scaled crit die. Target must have clear " +
        "anatomical vulnerabilities.",
    type: "passive",
    enables: {
        action: "backstab",
        condition: "target-behind-or-unaware",
        data: {
            grantsAutoCrit: true,
            critTable: "II",
            requiresAnatomy: true,
        },
    },
    tags: ["combat", "stealth", "melee", "thief"],
    classes: ["thief"],
};
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
export function getBackstabAttackBonus(progression, level, alignment) {
    const raw = getSkillBonus(progression, level, alignment, "backstab");
    return typeof raw === "number" ? raw : undefined;
}
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
export function isBackstabTriggeredRaw(attackerIsBehind, targetIsUnaware) {
    return attackerIsBehind || targetIsUnaware;
}
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
export function canBackstab(isBackstabTriggered, classId, targetHasAnatomy = true) {
    const hasSkill = BACKSTAB.classes?.includes(classId) ?? false;
    return hasSkill && targetHasAnatomy && isBackstabTriggered;
}
// =============================================================================
// Two-Weapon Fighting (Halfling)
// =============================================================================
/**
 * Two-Weapon Fighting
 *
 * Halflings are skilled at fighting with two weapons. They suffer
 * reduced penalties compared to other classes and gain an initiative
 * bonus when doing so.
 */
export const TWO_WEAPON_FIGHTING = {
    id: "two-weapon-fighting",
    name: "Two-Weapon Fighting",
    description: "When wielding two weapons, you suffer only a -1 penalty to each " +
        "attack (instead of -2). You also gain +1 to initiative when " +
        "fighting with two weapons.",
    type: "passive",
    enables: {
        action: "two-weapon-attacks",
        condition: "wielding-two-weapons",
        data: {
            attackPenalty: -1, // vs -2 for non-halflings
            initiativeBonus: 1,
            grantsExtraAttack: true,
        },
    },
    tags: ["combat", "melee"],
    classes: ["halfling"],
};
/**
 * Check if a character has two-weapon fighting capability
 */
export function hasTwoWeaponFighting(classId) {
    return TWO_WEAPON_FIGHTING.classes?.includes(classId) ?? false;
}
/**
 * Get the two-weapon fighting attack penalty from skill definition
 */
export function getTwoWeaponAttackPenalty(classId) {
    if (TWO_WEAPON_FIGHTING.classes?.includes(classId)) {
        const data = TWO_WEAPON_FIGHTING.enables?.data;
        if (data) {
            const penalty = data["attackPenalty"];
            if (typeof penalty === "number") {
                return penalty;
            }
        }
        return -1;
    }
    return -2; // Standard penalty for non-halflings
}
/**
 * Get the initiative bonus for two-weapon fighting from skill definition
 */
export function getTwoWeaponInitBonus(classId) {
    if (TWO_WEAPON_FIGHTING.classes?.includes(classId)) {
        const data = TWO_WEAPON_FIGHTING.enables?.data;
        if (data) {
            const bonus = data["initiativeBonus"];
            if (typeof bonus === "number") {
                return bonus;
            }
        }
        return 1;
    }
    return 0;
}
// =============================================================================
// Luck Recovery (Thief, Halfling)
// =============================================================================
/**
 * Luck Recovery
 *
 * Thieves and halflings can recover spent luck points. Thieves recover
 * luck when they succeed at certain thief skills. Halflings can share
 * their luck recovery with nearby allies.
 */
export const LUCK_RECOVERY = {
    id: "luck-recovery",
    name: "Luck Recovery",
    description: "You can recover spent luck points. Thieves recover luck equal to " +
        "their luck die when rolling a natural 20 on a thief skill check. " +
        "Halflings recover 1 luck point per day and can share luck with allies.",
    type: "passive",
    enables: {
        action: "luck-recovery",
        condition: "varies-by-class",
        data: {
            thiefTrigger: "natural-20-on-thief-skill",
            halflingDailyRecovery: 1,
            halflingCanShareLuck: true,
        },
    },
    tags: ["luck"],
    classes: ["thief", "halfling"],
};
/**
 * Check if a character can recover luck
 */
export function canRecoverLuck(classId) {
    return LUCK_RECOVERY.classes?.includes(classId) ?? false;
}
/**
 * Get daily luck recovery amount for halflings from skill definition
 */
export function getHalflingDailyLuckRecovery() {
    const data = LUCK_RECOVERY.enables?.data;
    if (data) {
        const recovery = data["halflingDailyRecovery"];
        if (typeof recovery === "number") {
            return recovery;
        }
    }
    return 1;
}
/**
 * Check if a thief should recover luck (on natural 20 of thief skill)
 */
export function thiefShouldRecoverLuck(naturalRoll, isThiefSkill) {
    return isThiefSkill && naturalRoll === 20;
}
// =============================================================================
// Halfling Luck Sharing
// =============================================================================
/**
 * Luck Sharing (Halfling)
 *
 * Halflings can spend their luck to aid allies within 30 feet.
 */
export const LUCK_SHARING = {
    id: "luck-sharing",
    name: "Good Fortune",
    description: "You can spend your own luck to aid allies within 30 feet, adding " +
        "your luck modifier to their rolls. The ally must be aware of your aid.",
    type: "passive",
    enables: {
        action: "share-luck",
        condition: "ally-within-30-feet",
        data: {
            range: 30,
            requiresAwareness: true,
            usesLuckModifier: true,
        },
    },
    tags: ["luck", "support"],
    classes: ["halfling"],
};
/**
 * Check if a halfling can share luck with an ally
 */
export function canShareLuck(classId, distanceToAlly) {
    if (!LUCK_SHARING.classes?.includes(classId))
        return false;
    const data = LUCK_SHARING.enables?.data;
    let range = 30;
    if (data) {
        const dataRange = data["range"];
        if (typeof dataRange === "number") {
            range = dataRange;
        }
    }
    return distanceToAlly <= range;
}
// =============================================================================
// Skill Registry
// =============================================================================
/**
 * All enabling skills indexed by ID
 */
export const ENABLING_SKILLS = {
    "mighty-deed": MIGHTY_DEED,
    "shield-bash": SHIELD_BASH,
    backstab: BACKSTAB,
    "two-weapon-fighting": TWO_WEAPON_FIGHTING,
    "luck-recovery": LUCK_RECOVERY,
    "luck-sharing": LUCK_SHARING,
};
/**
 * List of enabling skill IDs
 */
export const ENABLING_SKILL_IDS = Object.keys(ENABLING_SKILLS);
/**
 * Get all enabling skills for a given class
 */
export function getEnablingSkillsForClass(classId) {
    return Object.values(ENABLING_SKILLS).filter((skill) => skill.classes?.includes(classId) ?? false);
}
/**
 * Check if a class has a specific enabling skill
 */
export function classHasEnablingSkill(classId, skillId) {
    const skill = ENABLING_SKILLS[skillId];
    if (!skill)
        return false;
    return skill.classes?.includes(classId) ?? false;
}
//# sourceMappingURL=enabling-skills.js.map