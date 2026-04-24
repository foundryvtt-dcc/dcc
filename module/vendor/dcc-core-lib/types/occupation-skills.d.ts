/**
 * Occupation Skill Types
 *
 * Type definitions for occupation-based skills in DCC.
 * Occupations can grant:
 * - Trained weapon proficiency (bonus with specific weapon)
 * - Trade skills (background knowledge checks)
 * - Limited thief skills (reduced effectiveness)
 */
import type { DieType } from "./dice.js";
/**
 * Categories of occupation skills.
 */
export type OccupationSkillCategory = "weapon-training" | "trade-skill" | "limited-thief" | "craft" | "knowledge" | "social";
/**
 * Thief skills that occupations can grant limited access to.
 */
export type ThiefSkillId = "backstab" | "sneak-silently" | "hide-in-shadows" | "pick-pocket" | "climb-sheer-surfaces" | "pick-lock" | "find-trap" | "disable-trap" | "forge-document" | "disguise-self" | "read-languages" | "handle-poison" | "cast-spell-from-scroll";
/**
 * A skill granted by an occupation.
 */
export interface OccupationSkillGrant {
    /** Unique identifier for this skill grant */
    id: string;
    /** Display name */
    name: string;
    /** Description of what this skill allows */
    description: string;
    /** Category of skill */
    category: OccupationSkillCategory;
    /**
     * For trade skills: what ability score applies
     * (e.g., "int" for knowledge, "per" for social, "agl" for physical)
     */
    abilityId?: string;
    /**
     * For limited thief skills: which thief skill this grants access to
     */
    thiefSkillId?: ThiefSkillId;
    /**
     * For limited thief skills: the effective level for the skill
     * (e.g., -2 means treat as 2 levels lower, minimum 0)
     */
    effectiveLevel?: number;
    /**
     * Die used for checks (default: d10 for thief skills, d20 for others)
     */
    die?: DieType;
    /**
     * Fixed bonus to the check (in addition to ability mod)
     */
    bonus?: number;
    /**
     * DC/target for simple pass/fail checks
     */
    baseDC?: number;
    /**
     * Is this a one-time daily ability?
     */
    usesPerDay?: number;
    /**
     * Tags for categorization
     */
    tags?: string[];
}
/**
 * Weapon training from an occupation.
 */
export interface OccupationWeaponTraining {
    /** The weapon name from the occupation */
    weaponName: string;
    /** Normalized weapon type (e.g., "dagger", "club", "longsword") */
    weaponType: string;
    /** Bonus to attack with trained weapon (typically +1 for 0-level) */
    attackBonus: number;
    /** Bonus to damage with trained weapon (typically 0) */
    damageBonus: number;
    /** Special notes (e.g., "Hammer (as club)") */
    notes?: string;
}
/**
 * Extended occupation entry with skill grants.
 * This extends the base OccupationEntry with skill information.
 */
export interface OccupationWithSkills {
    /** Roll value or range */
    roll: number | string;
    /** Occupation name */
    name: string;
    /** Trained weapon */
    trainedWeapon: string;
    /** Trade goods */
    tradeGoods: string;
    /** Starting funds in copper pieces */
    startingFunds?: number;
    /** Is this a farmer? */
    isFarmer?: boolean;
    /** Notes */
    notes?: string;
    /**
     * Skills granted by this occupation.
     * These are in addition to weapon training.
     */
    skills?: OccupationSkillGrant[];
    /**
     * Normalized weapon training data.
     * Parsed from trainedWeapon string.
     */
    weaponTraining?: OccupationWeaponTraining;
}
/**
 * Input for an occupation skill check.
 */
export interface OccupationSkillCheckInput {
    /** The skill being checked */
    skill: OccupationSkillGrant;
    /** Character's level (affects some calculations) */
    level: number;
    /** Character's ability scores */
    abilities: Record<string, number>;
    /** Character's luck score (if applicable) */
    luck?: number;
    /** Luck to burn on this check */
    luckBurn?: number;
    /** Situational modifiers */
    situationalModifiers?: {
        source: string;
        value: number;
    }[];
}
/**
 * Result of an occupation skill check.
 */
export interface OccupationSkillCheckResult {
    /** The skill that was checked */
    skillId: string;
    /** Die used */
    die: DieType;
    /** Complete formula */
    formula: string;
    /** Natural die result */
    natural?: number;
    /** Total after modifiers */
    total?: number;
    /** Was this a critical success? */
    critical?: boolean;
    /** Was this a fumble? */
    fumble?: boolean;
    /** Did the check succeed? (for DC-based checks) */
    success?: boolean;
    /** All modifiers applied */
    modifiers: {
        source: string;
        value: number;
    }[];
    /** Luck burned */
    luckBurned: number;
}
/**
 * Event callbacks for occupation skill system.
 */
export interface OccupationSkillEvents {
    /** Called when a skill check starts */
    onCheckStart?: (input: OccupationSkillCheckInput) => void;
    /** Called when a skill check completes */
    onCheckComplete?: (result: OccupationSkillCheckResult) => void;
    /** Called on critical success */
    onCritical?: (result: OccupationSkillCheckResult) => void;
    /** Called on fumble */
    onFumble?: (result: OccupationSkillCheckResult) => void;
}
//# sourceMappingURL=occupation-skills.d.ts.map