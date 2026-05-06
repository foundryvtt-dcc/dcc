/**
 * Sample/Example Data for Character Creation
 *
 * FAN-MADE CONTENT - NOT OFFICIAL DCC RPG MATERIAL
 *
 * This module provides example data inspired by old-school fantasy RPGs
 * for testing and demonstration purposes. These are original creations
 * and are NOT from any published game system.
 *
 * For official DCC RPG data, use the separate dcc-official-data package.
 */
import type { BirthAugurEntry, BirthAugurEffectType } from "../types/tables.js";
import type { OccupationEntry } from "../character/create.js";
import type { XPThresholds } from "../character/level-up.js";
/**
 * Example birth augur data for testing.
 * These are original fan-made entries, not official DCC content.
 * Roll 1d30 to select a birth augur.
 */
export declare const SAMPLE_BIRTH_AUGURS: BirthAugurEntry[];
/**
 * Example occupation data for testing.
 * These are original fan-made entries, not official DCC content.
 * Roll 1d100 to select an occupation.
 */
export declare const SAMPLE_OCCUPATIONS: OccupationEntry[];
/**
 * Default character creation data using fan-made content.
 * Use this for testing or when official data isn't available.
 *
 * For official DCC RPG data, use the dcc-official-data package instead.
 */
export declare const DEFAULT_CHARACTER_CREATION_DATA: {
    birthAugurs: BirthAugurEntry[];
    occupations: OccupationEntry[];
};
/**
 * Check if a roll matches an occupation entry.
 * Handles both single numbers and ranges like "23-24".
 */
export declare function occupationMatchesRoll(occupation: OccupationEntry, roll: number): boolean;
/**
 * Find an occupation by roll value.
 */
export declare function findOccupationByRoll(occupations: OccupationEntry[], roll: number): OccupationEntry | undefined;
/**
 * Find a birth augur by roll value.
 */
export declare function findBirthAugurByRoll(augurs: BirthAugurEntry[], roll: number): BirthAugurEntry | undefined;
/**
 * Get the effect type ID for programmatic use.
 */
export declare function getBirthAugurEffectType(augur: BirthAugurEntry): BirthAugurEffectType;
/**
 * Sample XP thresholds for all core classes.
 * These are fan-made approximations for testing.
 */
export declare const SAMPLE_XP_THRESHOLDS: XPThresholds[];
//# sourceMappingURL=sample-data.d.ts.map