/**
 * Class Progression Data Loader
 *
 * Loads and parses class progression data from external JSON sources.
 * Supports loading from file paths, URLs, or raw JSON objects.
 */
import type { ClassProgression, ProgressionLevelData, ProgressionAlignment } from "../../types/class-progression.js";
import type { DieType } from "../../types/dice.js";
/**
 * Raw level data as it appears in source JSON
 */
export interface RawClassLevelData {
    class: string;
    level: string;
    levelData: string;
    levelDataLawful?: string;
    levelDataNeutral?: string;
    levelDataChaotic?: string;
}
/**
 * Parse a single level's raw data into ProgressionLevelData
 */
export declare function parseClassLevel(raw: RawClassLevelData): ProgressionLevelData;
/**
 * Load class progression from an array of raw level data
 */
export declare function loadClassProgression(classId: string, name: string, skills: string[], rawLevels: RawClassLevelData[]): ClassProgression;
/**
 * Get skill bonus for a character from progression data
 */
export declare function getSkillBonusFromProgression(progression: ClassProgression, level: number, alignment: ProgressionAlignment, skillId: string): number | DieType | undefined;
//# sourceMappingURL=class-loader.d.ts.map