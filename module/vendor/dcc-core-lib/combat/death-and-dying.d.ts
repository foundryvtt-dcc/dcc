/**
 * Death and Dying System
 *
 * Handles character death, bleeding out, recovery, and healing according to DCC rules:
 *
 * - 0-level characters die immediately at 0 HP
 * - 1st+ level characters "bleed out" and can be saved if healed within (level) rounds
 * - Characters saved from bleeding out lose 1 Stamina permanently and gain a scar
 * - Dead characters can be recovered within 1 hour with a Luck check
 * - Natural healing: 1 HP/night with rest, 2 HP/night with bed rest
 * - Ability damage heals at same rate (except Luck, which doesn't heal naturally)
 */
import type { Character } from "../types/character.js";
import type { DCCAbilityId } from "../types/system.js";
import type { DiceRoller } from "../types/dice.js";
/**
 * Character's vital status
 */
export type VitalStatus = "alive" | "unconscious" | "bleeding-out" | "dead" | "permanently-dead";
/**
 * Result of checking a character's vital status after taking damage
 */
export interface DamageApplicationResult {
    /** New current HP */
    newHP: number;
    /** New vital status */
    status: VitalStatus;
    /** Rounds remaining before permanent death (if bleeding out) */
    roundsUntilDeath?: number | undefined;
    /** Whether the character was instantly killed (0-level or massive damage) */
    instantDeath: boolean;
    /** Whether the character just started bleeding out */
    startedBleedingOut: boolean;
}
/**
 * State of a bleeding out character
 */
export interface BleedingOutState {
    /** Number of rounds remaining before permanent death */
    roundsRemaining: number;
    /** Maximum rounds (equal to level) */
    maxRounds: number;
    /** Round combat started (for tracking) */
    startRound: number;
}
/**
 * Result of attempting to stabilize/save a bleeding out character
 */
export interface StabilizeResult {
    /** Whether the character was saved */
    saved: boolean;
    /** New HP after healing (if saved) */
    newHP?: number | undefined;
    /** Whether character suffered permanent Stamina loss */
    staminaLoss: boolean;
    /** The permanent scar gained */
    scar?: string | undefined;
    /** Reason for failure (if not saved) */
    failureReason?: string | undefined;
}
/**
 * Result of recovering a dead body
 */
export interface BodyRecoveryResult {
    /** Whether the Luck check succeeded */
    success: boolean;
    /** The Luck roll made */
    luckRoll: number;
    /** Target number needed */
    targetDC: number;
    /** If success, the character recovers to this HP */
    newHP?: number | undefined;
    /** Penalty duration (-4 to all rolls for 1 hour) */
    groggyDuration?: string | undefined;
    /** Permanent ability penalty */
    permanentPenalty?: {
        ability: DCCAbilityId;
        amount: number;
    } | undefined;
}
/**
 * Type of rest for healing
 */
export type RestType = "active-adventure" | "bed-rest";
/**
 * Result of natural healing from rest
 */
export interface HealingResult {
    /** HP healed */
    hpHealed: number;
    /** New current HP */
    newHP: number;
    /** Ability points healed (if any ability damage) */
    abilityHealed: Partial<Record<DCCAbilityId, number>>;
}
/**
 * Get the number of rounds a character can bleed out before dying
 *
 * @param level - Character's level
 * @returns Rounds until permanent death, or 0 for instant death
 */
export declare function getBleedOutRounds(level: number): number;
/**
 * Determine a character's vital status based on current HP and level
 *
 * @param currentHP - Current hit points
 * @param level - Character level (0 for 0-level)
 * @returns Vital status
 */
export declare function getVitalStatus(currentHP: number, level: number): VitalStatus;
/**
 * Apply damage to a character and determine the result
 *
 * @param character - The character taking damage
 * @param damage - Amount of damage taken
 * @returns Damage result with new status
 */
export declare function applyDamage(character: Character, damage: number): DamageApplicationResult;
/**
 * Check if a character can be saved from bleeding out
 *
 * @param level - Character level
 * @param roundsElapsed - Rounds since reaching 0 HP
 * @returns Whether the character can still be saved
 */
export declare function canBeSaved(level: number, roundsElapsed: number): boolean;
/**
 * Advance the bleeding out timer by one round
 *
 * @param state - Current bleeding out state
 * @returns Updated state, or undefined if character is now permanently dead
 */
export declare function advanceBleedOutRound(state: BleedingOutState): BleedingOutState | undefined;
/**
 * Create initial bleeding out state for a character
 *
 * @param level - Character level
 * @param currentRound - Current combat round
 * @returns Bleeding out state
 */
export declare function createBleedingOutState(level: number, currentRound: number): BleedingOutState;
/**
 * Attempt to stabilize a bleeding out character
 *
 * This should be called when a character receives healing while bleeding out.
 * The character is saved if healing is applied before their rounds run out.
 *
 * @param bleedingState - Current bleeding out state
 * @param healingAmount - Amount of HP healed
 * @returns Stabilization result
 */
export declare function stabilizeCharacter(bleedingState: BleedingOutState, healingAmount: number): StabilizeResult;
/**
 * Apply the permanent trauma from being saved from bleeding out
 *
 * Returns a new character with:
 * - 1 Stamina lost permanently
 * - A scar added to conditions
 *
 * @param character - Character to update
 * @param newHP - HP to set (from healing)
 * @param scar - Description of the scar
 * @returns Updated character
 */
export declare function applyBleedOutTrauma(character: Character, newHP: number, scar: string): Character;
/**
 * Attempt to recover a dead character's body
 *
 * Per DCC rules: If body is recovered within 1 hour, character makes a Luck
 * check. On success, they were just unconscious and recover to 1 HP with
 * -4 penalty for 1 hour and permanent -1 to STR/AGL/STA.
 *
 * @param luckScore - Character's current Luck score
 * @param roller - Dice roller function
 * @returns Body recovery result
 */
export declare function attemptBodyRecovery(luckScore: number, roller: DiceRoller): BodyRecoveryResult;
/**
 * Apply body recovery result to a character
 *
 * @param character - The "dead" character
 * @param recovery - Recovery result
 * @returns Updated character, or undefined if recovery failed
 */
export declare function applyBodyRecovery(character: Character, recovery: BodyRecoveryResult): Character | undefined;
/**
 * Calculate natural healing from rest
 *
 * @param restType - Type of rest taken
 * @returns HP healed per night
 */
export declare function getHealingFromRest(restType: RestType): number;
/**
 * Apply natural healing to a character
 *
 * @param character - Character to heal
 * @param restType - Type of rest taken
 * @returns Healing result
 */
export declare function applyNaturalHealing(character: Character, restType: RestType): HealingResult;
/**
 * Apply healing result to a character
 *
 * @param character - Character to update
 * @param healing - Healing result
 * @returns Updated character
 */
export declare function applyHealingResult(character: Character, healing: HealingResult): Character;
/**
 * Apply magical healing to a character
 *
 * @param character - Character to heal
 * @param amount - HP to restore
 * @returns Updated character
 */
export declare function applyMagicalHealing(character: Character, amount: number): Character;
/**
 * Check if a character is at death's door (1 HP or less)
 *
 * @param currentHP - Current hit points
 * @returns Whether character is at death's door
 */
export declare function isAtDeathsDoor(currentHP: number): boolean;
/**
 * Check if a character can receive healing
 *
 * @param status - Character's vital status
 * @returns Whether healing can be applied
 */
export declare function canReceiveHealing(status: VitalStatus): boolean;
//# sourceMappingURL=death-and-dying.d.ts.map