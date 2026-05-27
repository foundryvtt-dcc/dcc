/**
 * Table Data Loader
 *
 * Loads and parses rollable table data from external JSON sources.
 */
import type { RollableTable, BirthAugurEntry, BirthAugurEffectType } from "../../types/tables.js";
/**
 * Raw table result from FoundryVTT format
 */
export interface RawTableResult {
    range: [number, number];
    description: string;
    type?: string;
    weight?: number;
}
/**
 * Raw table data from FoundryVTT format
 */
export interface RawTableData {
    _id: string;
    name: string;
    description?: string;
    formula: string;
    results: RawTableResult[];
}
/**
 * Load a rollable table from raw FoundryVTT data
 */
export declare function loadRollableTable(raw: RawTableData): RollableTable;
/**
 * Load birth augurs from a raw luck table
 */
export declare function loadBirthAugurs(raw: RawTableData): BirthAugurEntry[];
/**
 * Get modifier value based on luck score and birth augur
 *
 * In DCC, the luck modifier applies to the birth augur's affected roll.
 * The modifier is calculated from the luck score using the standard
 * ability modifier table.
 *
 * @param luckScore - The character's current luck score
 * @param luckModifier - The calculated modifier from the luck score
 * @param augur - The character's birth augur
 * @returns Object with the modifier value and what it affects
 */
export declare function getBirthAugurModifier(luckModifier: number, augur: BirthAugurEntry): {
    modifier: number;
    affects: string;
    effectType: BirthAugurEffectType;
};
//# sourceMappingURL=table-loader.d.ts.map