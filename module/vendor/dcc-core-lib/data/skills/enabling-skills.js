/**
 * Enabling Skill Definitions
 *
 * These are passive-type skills that enable game mechanics rather than
 * producing direct roll results. They unlock abilities like mighty deeds,
 * shield bashes, backstabs, two-weapon fighting, and luck recovery.
 */
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
    progression: {
        1: { data: { deedDie: "d3" } },
        2: { data: { deedDie: "d3" } },
        3: { data: { deedDie: "d4" } },
        4: { data: { deedDie: "d4" } },
        5: { data: { deedDie: "d5" } },
        6: { data: { deedDie: "d5" } },
        7: { data: { deedDie: "d6" } },
        8: { data: { deedDie: "d6" } },
        9: { data: { deedDie: "d7" } },
        10: { data: { deedDie: "d7" } },
    },
    tags: ["combat", "melee"],
    classes: ["warrior", "dwarf"],
};
/**
 * Get the deed die for a given level from the skill definition
 */
export function getDeedDieFromSkill(level) {
    if (level <= 0)
        return "d3";
    const progression = MIGHTY_DEED.progression?.[level];
    if (progression?.data) {
        const deedDie = progression.data["deedDie"];
        if (typeof deedDie === "string") {
            return deedDie;
        }
    }
    // For levels beyond 10, extrapolate
    if (level > 10) {
        const bonus = Math.floor((level - 7) / 2);
        const dieNum = Math.min(7 + bonus, 12); // Cap at d12
        return `d${String(dieNum)}`;
    }
    return "d3";
}
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
 * Backstab
 *
 * Thieves can deal massive damage when attacking a surprised or
 * unaware opponent from behind. The damage multiplier increases
 * with level.
 *
 * Note: This replaces the existing BACKSTAB in thief-skills.ts
 * with a proper enabling skill definition.
 */
export const BACKSTAB_ENABLING = {
    id: "backstab",
    name: "Backstab",
    description: "When attacking a surprised or unaware opponent from behind, " +
        "multiply your damage by your backstab multiplier. " +
        "Alignment affects the multiplier at certain levels.",
    type: "passive",
    enables: {
        action: "backstab",
        condition: "surprised-target-from-behind",
        data: {
            multipliesDamage: true,
            requiresSurprise: true,
            requiresBehind: true,
        },
    },
    progression: {
        1: { data: { multiplier: 2 } },
        2: { data: { multiplier: 2 } },
        3: { data: { multiplier: 3 } },
        4: { data: { multiplier: 3 } },
        5: { data: { multiplier: 4 } },
        6: { data: { multiplier: 4 } },
        7: { data: { multiplier: 5 } },
        8: { data: { multiplier: 5 } },
        9: { data: { multiplier: 5 } },
        10: { data: { multiplier: 5 } },
    },
    tags: ["combat", "stealth", "melee"],
    classes: ["thief"],
};
/**
 * Get the backstab multiplier for a given level from the skill definition
 */
export function getBackstabMultiplierFromSkill(level) {
    if (level <= 0)
        return 1;
    const progression = BACKSTAB_ENABLING.progression?.[level];
    if (progression?.data) {
        const multiplier = progression.data["multiplier"];
        if (typeof multiplier === "number") {
            return multiplier;
        }
    }
    // For levels beyond 10, cap at 5
    if (level > 10)
        return 5;
    return 2;
}
/**
 * Check if conditions are met for a backstab
 */
export function canBackstab(targetIsSurprised, attackerIsBehind, classId) {
    const hasSkill = BACKSTAB_ENABLING.classes?.includes(classId) ?? false;
    return hasSkill && targetIsSurprised && attackerIsBehind;
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
    progression: {
        // Thief luck die progression
        1: { die: "d3" },
        2: { die: "d3" },
        3: { die: "d4" },
        4: { die: "d4" },
        5: { die: "d5" },
        6: { die: "d5" },
        7: { die: "d6" },
        8: { die: "d6" },
        9: { die: "d7" },
        10: { die: "d7" },
    },
    tags: ["luck"],
    classes: ["thief", "halfling"],
};
/**
 * Get the luck die for a thief at a given level from the skill definition
 */
export function getLuckDieFromSkill(level) {
    if (level <= 0)
        return "d3";
    const progression = LUCK_RECOVERY.progression?.[level];
    if (progression?.die) {
        return progression.die;
    }
    // For levels beyond 10, extrapolate
    if (level > 10) {
        const bonus = Math.floor((level - 7) / 2);
        const dieNum = Math.min(7 + bonus, 12); // Cap at d12
        return `d${String(dieNum)}`;
    }
    return "d3";
}
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
    backstab: BACKSTAB_ENABLING,
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