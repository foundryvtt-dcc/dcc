/**
 * Character Creation Functions
 *
 * Pure functions for creating DCC characters.
 * All randomness and data are injected for testability.
 */
import type { Character, AbilityScores, BirthAugur } from "../types/character.js";
import type { CharacterCreationConfig, DiceMethodDefinition, AbilityScoreConfig, HPMethodDefinition, HitPointConfig, BirthAugurConfig, LuckySignMode } from "../types/character-creation.js";
import type { RandomSource } from "../types/random.js";
import type { DCCAbilityId } from "../types/system.js";
import type { BirthAugurEntry } from "../types/tables.js";
import { type NameGenerationData } from "../data/names.js";
/**
 * An occupation entry from the occupation table.
 */
export interface OccupationEntry {
    /** Roll value or range (e.g., 1, or "1-2") */
    roll: number | string;
    /** Occupation name */
    name: string;
    /** Trained weapon */
    trainedWeapon: string;
    /** Trade goods */
    tradeGoods: string;
    /** Starting funds (in copper pieces) */
    startingFunds?: number;
    /** Whether this is a farmer (gets additional trade goods) */
    isFarmer?: boolean;
    /** Special notes */
    notes?: string;
}
/**
 * Data required for character creation.
 * Injected to keep functions pure and testable.
 */
export interface CharacterCreationData {
    /** Occupation entries to roll/select from */
    occupations: OccupationEntry[];
    /** Birth augur entries to roll/select from */
    birthAugurs: BirthAugurEntry[];
    /** Custom dice methods (if using method: "custom" with string ID) */
    customDiceMethods?: Record<string, DiceMethodDefinition>;
    /** Custom HP methods (if using method: "custom" with string ID) */
    customHPMethods?: Record<string, HPMethodDefinition>;
    /** Name generation data (defaults to DEFAULT_NAME_DATA if not provided) */
    nameData?: NameGenerationData;
}
/**
 * Result of character creation, including the character and metadata.
 */
export interface CharacterCreationResult {
    /** The created character */
    character: Character;
    /** Metadata about the creation process */
    rolls: {
        /** Individual ability score rolls */
        abilityRolls: {
            ability: DCCAbilityId;
            rolls: number[];
            kept: number[];
            total: number;
        }[];
        /** Birth augur roll (1-30) */
        birthAugurRoll: number;
        /** Occupation roll */
        occupationRoll: number;
        /** HP roll */
        hpRoll: number;
    };
}
/**
 * Roll ability scores using the specified method.
 */
export declare function rollAbilityScores(config: AbilityScoreConfig, random: RandomSource, customMethods?: Record<string, DiceMethodDefinition>): {
    scores: AbilityScores;
    rolls: CharacterCreationResult["rolls"]["abilityRolls"];
};
/**
 * Check if ability scores meet the minimum/maximum total modifier constraints.
 */
export declare function checkAbilityModifierConstraints(scores: AbilityScores, config: AbilityScoreConfig): boolean;
/**
 * Roll hit points for a 0-level character.
 */
export declare function rollZeroLevelHP(config: HitPointConfig, staminaScore: number, random: RandomSource, customMethods?: Record<string, HPMethodDefinition>): {
    hp: number;
    roll: number;
};
/**
 * Select or roll a birth augur.
 */
export declare function selectBirthAugur(config: BirthAugurConfig, augurs: BirthAugurEntry[], random: RandomSource): {
    augur: BirthAugur;
    roll: number;
};
/**
 * Calculate the effective luck modifier based on the lucky sign mode.
 */
export declare function calculateLuckySignBonus(luckModifier: number, mode: LuckySignMode): number;
/**
 * Select or roll an occupation.
 */
export declare function selectOccupation(occupations: OccupationEntry[], specificOccupation: string | undefined, random: RandomSource): {
    occupation: OccupationEntry;
    roll: number;
};
/**
 * Create a new 0-level character.
 *
 * @param data - Required data (occupations, birth augurs)
 * @param config - Optional creation configuration (defaults to standard DCC rules)
 * @param random - Optional random source (defaults to Math.random)
 * @returns The created character and roll metadata
 */
export declare function createZeroLevelCharacter(data: CharacterCreationData, config?: CharacterCreationConfig, random?: RandomSource): CharacterCreationResult;
//# sourceMappingURL=create.d.ts.map