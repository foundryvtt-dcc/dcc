/**
 * Character Class Types
 *
 * Classes are defined as collections of skills plus base statistics.
 * This enables data-driven class definitions for easy homebrew.
 *
 * NOTE: This file contains only type definitions. Actual class data
 * should be loaded from dcc-official-data and registered using
 * registerClassProgression() from data/classes/progression-utils.
 */
import type { CritDieFormula, DieType } from "./dice.js";
import type { Alignment, SaveType } from "./system.js";
/**
 * Attack bonus progression type
 */
export type AttackProgression = "warrior" | "cleric" | "wizard" | "thief" | "dwarf" | "elf" | "halfling" | "custom";
/**
 * Save progression type
 */
export type SaveProgression = "warrior" | "cleric" | "wizard" | "thief" | "dwarf" | "elf" | "halfling" | "custom";
/**
 * Crit table to use
 */
export type CritTable = "I" | "II" | "III" | "IV" | "V" | "custom";
/**
 * Level-specific class data
 */
export interface ClassLevelData {
    /** Attack bonus at this level */
    attackBonus?: number;
    /** Action dice at this level (e.g., "1d20", "1d20+1d14") */
    actionDice?: string;
    /** Crit die formula at this level (e.g., "d12", "2d20", "d30+2") */
    critDie?: CritDieFormula;
    /** Threat range at this level (e.g., 19 for 19-20) */
    threatRange?: number;
    /** Saves at this level */
    saves?: Partial<Record<SaveType, number>>;
    /** Titles at this level */
    title?: string;
    /** Skills unlocked at this level */
    skillsUnlocked?: string[];
    /** Any other level-specific data */
    data?: Record<string, unknown>;
}
/**
 * Requirements to take a class
 */
export interface ClassRequirements {
    /** Minimum ability scores */
    abilities?: Partial<Record<string, number>>;
    /** Allowed alignments */
    alignments?: Alignment[];
    /** Required race (for race-as-class) */
    race?: string;
}
/**
 * Complete class definition
 */
export interface ClassDefinition {
    /** Unique identifier (e.g., "warrior", "wizard") */
    id: string;
    /** Display name */
    name: string;
    /** Class description */
    description?: string;
    /** Hit die (e.g., "d12" for warrior) */
    hitDie: DieType;
    /** Attack bonus progression type */
    attackProgression: AttackProgression;
    /** Save progression type */
    saveProgression: SaveProgression;
    /** Which crit table to use */
    critTable: CritTable;
    /** Custom crit table ID (if critTable is "custom") */
    customCritTable?: string;
    /** Base threat range (20 = only on 20, 19 = 19-20) */
    baseThreatRange?: number;
    /** Skills this class grants */
    skills: string[];
    /** Level-by-level progression */
    levels: Record<number, ClassLevelData>;
    /** Requirements to take this class */
    requirements?: ClassRequirements;
    /** Whether this is a spellcasting class */
    isSpellcaster?: boolean;
    /** Spellcasting ability (if spellcaster) */
    spellcastingAbility?: string;
    /** Maximum spell level by class level */
    maxSpellLevel?: Record<number, number>;
    /** Tags for categorization */
    tags?: string[];
}
/**
 * A character's class instance (for multiclassing support)
 */
export interface CharacterClass {
    /** The class definition ID */
    classId: string;
    /** Level in this class */
    level: number;
    /** XP in this class (if tracking separately) */
    xp?: number;
}
//# sourceMappingURL=classes.d.ts.map