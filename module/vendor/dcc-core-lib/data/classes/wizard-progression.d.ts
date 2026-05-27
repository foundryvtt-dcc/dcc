/**
 * Wizard Class Progression
 *
 * Complete level-by-level advancement data for the Wizard class.
 * Data extracted from DCC RPG core rules.
 *
 * Note: Wizard also has spellcasting data (knownSpells, maxSpellLevel) which
 * are tracked via helper functions below.
 */
import type { ClassProgression } from "../../types/class-progression.js";
export declare const WIZARD_PROGRESSION: ClassProgression;
/**
 * Wizard spellcasting progression by level.
 * Returns the number of known spells and max spell level for a wizard.
 */
export interface WizardSpellProgression {
    /** Number of spells known at this level */
    knownSpells: number;
    /** Maximum spell level that can be cast */
    maxSpellLevel: number;
}
/**
 * Get wizard spellcasting progression for a level.
 *
 * @param level - The wizard's level
 * @returns The spell progression data
 */
export declare function getWizardSpellProgression(level: number): WizardSpellProgression;
//# sourceMappingURL=wizard-progression.d.ts.map