/**
 * Dwarf Class Progression
 *
 * Complete level-by-level advancement data for the Dwarf class.
 * Data extracted from DCC RPG core rules.
 *
 * Dwarves fight like warriors with deed dice and shield bashing abilities.
 * Note: At levels 7+, the deed die has a flat bonus (e.g., d10+1 at level 7).
 */
import type { ClassProgression } from "../../types/class-progression.js";
export declare const DWARF_PROGRESSION: ClassProgression;
/**
 * Get the flat attack bonus for dwarves at high levels.
 * At levels 7+, dwarves gain a flat bonus in addition to their deed die.
 *
 * @param level - The dwarf's level
 * @returns The flat bonus (0 for levels 1-6)
 */
export declare function getDwarfDeedDieBonus(level: number): number;
//# sourceMappingURL=dwarf-progression.d.ts.map