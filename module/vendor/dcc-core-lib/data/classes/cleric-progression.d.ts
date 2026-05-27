/**
 * Cleric Class Progression
 *
 * Complete level-by-level advancement data for the Cleric class.
 * Data extracted from DCC RPG core rules.
 *
 * Note: Cleric also has spellcasting data (spells per level) which
 * are tracked via helper functions below.
 */
import type { ClassProgression } from "../../types/class-progression.js";
export declare const CLERIC_PROGRESSION: ClassProgression;
/**
 * Cleric spellcasting progression by level.
 * Returns the number of spells per level for a cleric.
 */
export interface ClericSpellProgression {
    /** Spells per day at level 1 */
    level1: number;
    /** Spells per day at level 2 */
    level2: number;
    /** Spells per day at level 3 */
    level3: number;
    /** Spells per day at level 4 */
    level4: number;
    /** Spells per day at level 5 */
    level5: number;
}
/**
 * Get cleric spellcasting progression for a level.
 *
 * @param level - The cleric's level
 * @returns The spell progression data (spells per day at each spell level)
 */
export declare function getClericSpellProgression(level: number): ClericSpellProgression;
//# sourceMappingURL=cleric-progression.d.ts.map