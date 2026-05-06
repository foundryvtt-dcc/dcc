/**
 * Class Progression Types
 *
 * Defines level-by-level advancement data for character classes,
 * including alignment-specific variations.
 *
 * These types are specifically designed for loading and parsing
 * class progression data from external JSON sources.
 */
import type { DieType } from "./dice.js";
/**
 * Alignment types for progression data (long form)
 */
export type ProgressionAlignment = "lawful" | "neutral" | "chaotic";
/**
 * Saving throw short codes (as used in source data)
 */
export type ProgressionSaveType = "ref" | "frt" | "wil";
/**
 * Skill bonuses at a specific level
 */
export type SkillBonuses = Record<string, number | DieType>;
/**
 * Alignment-specific data at a level
 */
export interface AlignmentLevelData {
    /** Title at this level (e.g., "Bravo", "Thug") */
    title: string;
    /** Skill bonuses for this alignment at this level */
    skills: SkillBonuses;
}
/**
 * Core level data (same regardless of alignment)
 */
export interface ProgressionBaseLevelData {
    /** Attack bonus (can be a die like "d3" for warriors) */
    attackBonus: number | DieType;
    /** Critical hit die */
    criticalDie: string;
    /** Critical hit table */
    criticalTable: string;
    /** Action dice available */
    actionDice: string[];
    /** Hit die for this class */
    hitDie: DieType;
    /** Saving throw bonuses */
    saves: Record<ProgressionSaveType, number>;
}
/**
 * Complete level data including alignment variations
 */
export interface ProgressionLevelData extends ProgressionBaseLevelData {
    /** Lawful alignment data */
    lawful?: AlignmentLevelData;
    /** Neutral alignment data */
    neutral?: AlignmentLevelData;
    /** Chaotic alignment data */
    chaotic?: AlignmentLevelData;
    /** Luck die (for thieves, halflings) */
    luckDie?: DieType;
    /** Threat range for critical hits (warriors get 19-20) */
    critRange?: number;
}
/**
 * Complete class progression (all levels)
 */
export interface ClassProgression {
    /** Class ID */
    classId: string;
    /** Class name */
    name: string;
    /** Skill IDs this class has access to */
    skills: string[];
    /** Level-by-level progression data */
    levels: Record<number, ProgressionLevelData>;
}
/**
 * Helper to get skill bonus for a character
 */
export declare function getSkillBonus(progression: ClassProgression, level: number, alignment: ProgressionAlignment, skillId: string): number | DieType | undefined;
//# sourceMappingURL=class-progression.d.ts.map