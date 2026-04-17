/**
 * Warrior Class Progression
 *
 * Complete level-by-level advancement data for the Warrior class.
 * Data extracted from DCC RPG core rules.
 *
 * Note: At levels 7+, the deed die has a flat bonus (e.g., d10+1 at level 7).
 * The attackBonus stores the deed die, and the flat bonus progression is:
 * Level 7: +1, Level 8: +2, Level 9: +3, Level 10: +4
 */
import type { ClassProgression } from "../../types/class-progression.js";
export declare const WARRIOR_PROGRESSION: ClassProgression;
/**
 * Get the flat attack bonus for warriors at high levels.
 * At levels 7+, warriors gain a flat bonus in addition to their deed die.
 *
 * @param level - The warrior's level
 * @returns The flat bonus (0 for levels 1-6)
 */
export declare function getWarriorDeedDieBonus(level: number): number;
//# sourceMappingURL=warrior-progression.d.ts.map