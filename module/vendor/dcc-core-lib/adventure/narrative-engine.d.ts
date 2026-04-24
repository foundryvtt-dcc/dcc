/**
 * Narrative Encounter Engine
 *
 * Pure functions for creating and resolving narrative encounters.
 */
import type { NarrativeEncounterState, NarrativeTemplate, NarrativeOption, NarrativeCheckResult, NarrativeCategory } from "./types.js";
import type { Character } from "../types/character.js";
/**
 * Dice roller function type
 */
type DiceRoller = (sides: number) => number;
/**
 * Create a new narrative encounter from a template.
 */
export declare function createNarrativeEncounter(template: NarrativeTemplate): NarrativeEncounterState;
/**
 * Create a narrative encounter from a category (random template).
 */
export declare function createNarrativeEncounterFromCategory(category: NarrativeCategory): NarrativeEncounterState | null;
/**
 * Create a narrative encounter from a template ID.
 */
export declare function createNarrativeEncounterFromId(templateId: string): NarrativeEncounterState | null;
/**
 * Result of choosing an option
 */
export interface ChooseOptionResult {
    /** Updated encounter state */
    encounter: NarrativeEncounterState;
    /** The chosen option */
    option: NarrativeOption;
    /** Whether a skill check was required */
    requiredCheck: boolean;
    /** Skill check result if applicable */
    checkResult?: NarrativeCheckResult;
    /** Whether the outcome was successful */
    success: boolean;
    /** The outcome text */
    outcomeText: string;
}
/**
 * Choose an option in a narrative encounter.
 * If the option requires a skill check, it will be rolled.
 */
export declare function chooseOption(encounter: NarrativeEncounterState, optionId: string, character: Character, playerInfo: {
    playerId: string;
    playerName: string;
}, roller?: DiceRoller): ChooseOptionResult | null;
/**
 * Get the available options for an encounter.
 */
export declare function getAvailableOptions(encounter: NarrativeEncounterState): NarrativeOption[];
/**
 * Check if an encounter is resolved.
 */
export declare function isEncounterResolved(encounter: NarrativeEncounterState): boolean;
/**
 * Format an option for display, including skill check info.
 */
export declare function formatOptionDisplay(option: NarrativeOption): string;
/**
 * Format a skill check result for display.
 */
export declare function formatCheckResult(result: NarrativeCheckResult): string;
export {};
//# sourceMappingURL=narrative-engine.d.ts.map