/**
 * Elf Class Progression
 *
 * Complete level-by-level advancement data for the Elf class.
 * Data extracted from DCC RPG core rules.
 *
 * Elves are warrior-mages who combine martial prowess with arcane spellcasting.
 * They are sensitive to iron and must wear mithril armor or suffer penalties.
 */
import type { ClassProgression } from "../../types/class-progression.js";
export declare const ELF_PROGRESSION: ClassProgression;
/**
 * Elf spellcasting progression by level.
 * Returns the number of known spells and max spell level for an elf.
 */
export interface ElfSpellProgression {
    /** Number of spells known at this level */
    knownSpells: number;
    /** Maximum spell level that can be cast */
    maxSpellLevel: number;
}
/**
 * Get elf spellcasting progression for a level.
 *
 * @param level - The elf's level
 * @returns The spell progression data
 */
export declare function getElfSpellProgression(level: number): ElfSpellProgression;
//# sourceMappingURL=elf-progression.d.ts.map