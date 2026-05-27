/**
 * Morale System
 *
 * Implements DCC morale rules for monsters, retainers, and NPCs.
 *
 * Key rules:
 * - Roll 1d20 + Will save vs DC 11 (or higher for magical effects)
 * - 11+ = success (keeps fighting), 10 or less = flees
 * - Retainers add employer's Personality modifier
 * - Situational modifiers of +4 to -4
 * - Some creatures are immune (automatons, golems, mindless creatures)
 *
 * Morale check triggers:
 * - Group: when first creature slain, when half killed/incapacitated
 * - Single monster: when lost half HP
 * - Retainer: first combat/danger per adventure, end of adventure
 */
import type { DiceRoller, LegacyRollModifier } from "../types/dice.js";
/**
 * Type of entity making the morale check
 */
export type MoraleEntityType = "monster" | "retainer" | "npc";
/**
 * Trigger that caused the morale check
 */
export type MoraleTrigger = "first-ally-slain" | "half-allies-down" | "half-hp-lost" | "first-combat" | "first-danger" | "end-of-adventure" | "magical-effect" | "other";
/**
 * Morale state for a group of creatures
 */
export interface GroupMoraleState {
    /** Total creatures in the group at start */
    totalCreatures: number;
    /** Currently alive/active creatures */
    activeCreatures: number;
    /** Whether first casualty check has been made */
    firstCasualtyChecked: boolean;
    /** Whether half-down check has been made */
    halfDownChecked: boolean;
}
/**
 * Morale state for a single creature
 */
export interface CreatureMoraleState {
    /** Maximum hit points */
    maxHP: number;
    /** Current hit points */
    currentHP: number;
    /** Whether half-HP check has been made */
    halfHPChecked: boolean;
}
/**
 * Morale state for a retainer
 */
export interface RetainerMoraleState {
    /** Whether first combat check has been made this adventure */
    firstCombatChecked: boolean;
    /** Whether first danger check has been made this adventure */
    firstDangerChecked: boolean;
}
/**
 * Input for making a morale check
 */
export interface MoraleCheckInput {
    /** Type of entity */
    entityType: MoraleEntityType;
    /** Creature's Will save bonus */
    willSave: number;
    /** What triggered the check */
    trigger: MoraleTrigger;
    /** DC to beat (default 11) */
    dc?: number | undefined;
    /** Situational modifier (-4 to +4) */
    situationalModifier?: number | undefined;
    /** For retainers: employer's Personality modifier */
    employerPersonalityMod?: number | undefined;
    /** Whether creature is immune to morale (automatons, golems, etc.) */
    isImmune?: boolean | undefined;
    /** Additional modifiers */
    additionalModifiers?: LegacyRollModifier[] | undefined;
}
/**
 * Result of a morale check
 */
export interface MoraleCheckResult {
    /** The d20 roll result */
    roll: number;
    /** Total after all modifiers */
    total: number;
    /** DC that needed to be met */
    dc: number;
    /** Whether the check passed (creature keeps fighting) */
    passed: boolean;
    /** Whether the check was skipped due to immunity */
    immune: boolean;
    /** All modifiers applied */
    modifiers: LegacyRollModifier[];
    /** What triggered this check */
    trigger: MoraleTrigger;
    /** Description of outcome */
    outcome: "fights" | "flees" | "immune";
}
/** Default morale DC */
export declare const DEFAULT_MORALE_DC = 11;
/** Maximum situational modifier */
export declare const MAX_SITUATIONAL_MODIFIER = 4;
/** Minimum situational modifier */
export declare const MIN_SITUATIONAL_MODIFIER = -4;
/**
 * Make a morale check for a creature, retainer, or NPC
 *
 * @param input - Morale check input
 * @param roller - Optional dice roller
 * @returns Morale check result
 *
 * @example
 * // Monster morale check when half HP lost
 * const result = makeMoraleCheck({
 *   entityType: "monster",
 *   willSave: 2,
 *   trigger: "half-hp-lost",
 * });
 *
 * @example
 * // Retainer morale check with employer bonus
 * const result = makeMoraleCheck({
 *   entityType: "retainer",
 *   willSave: 1,
 *   trigger: "first-combat",
 *   employerPersonalityMod: 2,
 * });
 */
export declare function makeMoraleCheck(input: MoraleCheckInput, roller?: DiceRoller): MoraleCheckResult;
/**
 * Calculate the total morale modifier for display
 *
 * @param willSave - Creature's Will save
 * @param situationalModifier - Situational modifier
 * @param employerPersonalityMod - Employer's Personality mod (retainers only)
 * @returns Total modifier
 */
export declare function calculateMoraleModifier(willSave: number, situationalModifier?: number, employerPersonalityMod?: number): number;
/**
 * Check if a group morale check is triggered and update state
 *
 * @param state - Current group morale state
 * @param casualtyCount - Number of casualties just inflicted
 * @returns Trigger type if check is needed, undefined otherwise
 */
export declare function checkGroupMoraleTrigger(state: GroupMoraleState, casualtyCount: number): {
    trigger: MoraleTrigger;
    newState: GroupMoraleState;
} | undefined;
/**
 * Check if a single creature morale check is triggered
 *
 * @param state - Current creature morale state
 * @param damageDealt - Damage just dealt
 * @returns Trigger type if check is needed, undefined otherwise
 */
export declare function checkCreatureMoraleTrigger(state: CreatureMoraleState, damageDealt: number): {
    trigger: MoraleTrigger;
    newState: CreatureMoraleState;
} | undefined;
/**
 * Check if a retainer morale check is triggered
 *
 * @param state - Current retainer morale state
 * @param situation - What situation occurred
 * @returns Trigger type if check is needed, undefined otherwise
 */
export declare function checkRetainerMoraleTrigger(state: RetainerMoraleState, situation: "combat" | "danger" | "end-of-adventure"): {
    trigger: MoraleTrigger;
    newState: RetainerMoraleState;
} | undefined;
/**
 * Create initial morale state for a group of creatures
 *
 * @param totalCreatures - Number of creatures in the group
 * @returns Initial group morale state
 */
export declare function createGroupMoraleState(totalCreatures: number): GroupMoraleState;
/**
 * Create initial morale state for a single creature
 *
 * @param maxHP - Creature's maximum hit points
 * @returns Initial creature morale state
 */
export declare function createCreatureMoraleState(maxHP: number): CreatureMoraleState;
/**
 * Create initial morale state for a retainer
 *
 * @returns Initial retainer morale state
 */
export declare function createRetainerMoraleState(): RetainerMoraleState;
/**
 * Reset retainer morale state for a new adventure
 *
 * @param _state - Current state (unused, for API consistency)
 * @returns Fresh retainer morale state
 */
export declare function resetRetainerMoraleForNewAdventure(_state: RetainerMoraleState): RetainerMoraleState;
/**
 * Common creature types that are immune to morale
 */
export declare const MORALE_IMMUNE_TYPES: readonly ["automaton", "construct", "golem", "animated", "mindless", "undead-mindless", "ooze", "elemental"];
export type MoraleImmuneType = (typeof MORALE_IMMUNE_TYPES)[number];
/**
 * Check if a creature type is immune to morale
 *
 * @param creatureType - Creature type string
 * @returns Whether the creature is immune
 */
export declare function isImmuneToMorale(creatureType: string): boolean;
/**
 * Check if a creature is immune based on traits/keywords
 *
 * @param traits - Array of trait strings
 * @returns Whether the creature is immune
 */
export declare function hasImmuneTraits(traits: string[]): boolean;
/**
 * Get suggested situational modifier based on common scenarios
 */
export declare function getSuggestedModifier(scenario: string): number;
/**
 * Format morale check result for display
 */
export declare function formatMoraleResult(result: MoraleCheckResult): string;
//# sourceMappingURL=morale.d.ts.map