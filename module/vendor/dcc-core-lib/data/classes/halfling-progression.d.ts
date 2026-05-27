/**
 * Halfling Class Progression
 *
 * Complete level-by-level advancement data for the Halfling class.
 * Data extracted from DCC RPG core rules.
 *
 * Halflings are skilled at fighting with two weapons and are excellent
 * at sneaking and hiding. They have good luck abilities and can share
 * their luck with others.
 */
import type { ClassProgression } from "../../types/class-progression.js";
export declare const HALFLING_PROGRESSION: ClassProgression;
/**
 * Get halfling sneak and hide bonus for a level.
 *
 * @param level - The halfling's level
 * @returns The sneak and hide bonus
 */
export declare function getHalflingSneakAndHideBonus(level: number): number;
//# sourceMappingURL=halfling-progression.d.ts.map