/**
 * Miscellaneous Combat Rules
 *
 * Implements various DCC combat rules including:
 * - Ability loss effects (when abilities reach 0)
 * - Catching fire
 * - Charge attacks
 * - Dropping torches
 * - Falling damage
 * - Firing into melee
 * - Grappling
 * - Recovering armor and missile weapons
 * - Subdual damage
 * - Unarmed combat
 */
import type { DiceRoller, LegacyRollModifier } from "../types/dice.js";
import type { DCCAbilityId } from "../types/system.js";
/**
 * Effect of having an ability reduced to 0
 */
export type AbilityLossEffect = "babbling-idiot" | "immobile" | "unconscious" | "constant-mishaps";
/**
 * Result of checking ability loss effects
 */
export interface AbilityLossResult {
    /** Which ability is at 0 */
    ability: DCCAbilityId;
    /** The effect on the character */
    effect: AbilityLossEffect;
    /** Description of the effect */
    description: string;
    /** Whether the character is incapacitated */
    incapacitated: boolean;
}
/**
 * State of a character on fire
 */
export interface OnFireState {
    /** Damage die per round (default 1d6) */
    damageDie: string;
    /** DC to put out the fire (default 10) */
    extinguishDC: number;
    /** Rounds the character has been on fire */
    roundsOnFire: number;
    /** Source of the fire (for description) */
    source?: string | undefined;
}
/**
 * Result of fire damage for a round
 */
export interface FireDamageResult {
    /** Damage taken this round */
    damage: number;
    /** Whether the character attempted to extinguish */
    attemptedExtinguish: boolean;
    /** The Reflex save roll (if attempted) */
    reflexRoll?: number | undefined;
    /** Whether the fire was extinguished */
    extinguished: boolean;
    /** Updated fire state (undefined if extinguished) */
    newState?: OnFireState | undefined;
}
/**
 * Charge attack modifiers
 */
export interface ChargeModifiers {
    /** Attack bonus from charging (+2) */
    attackBonus: number;
    /** AC penalty from charging (-2) */
    acPenalty: number;
    /** Minimum distance required (half speed) */
    minDistance: number;
}
/**
 * Result of falling damage
 */
export interface FallingDamageResult {
    /** Total damage taken */
    damage: number;
    /** Individual die results */
    diceResults: number[];
    /** Number of broken bones (dice that rolled 6) */
    brokenBones: number;
    /** Distance fallen in feet */
    distanceFallen: number;
    /** Permanent ability loss from broken bones */
    permanentLoss: number;
}
/**
 * Result of firing into melee when missing
 */
export interface FiringIntoMeleeResult {
    /** Whether the shot went wild */
    hitAlly: boolean;
    /** The d100 roll for determining if ally is hit */
    chanceRoll: number;
    /** Index of ally hit (if any) - for random selection */
    allyIndex?: number | undefined;
    /** Re-roll attack result against ally's AC (if hit) */
    allyAttackRoll?: number | undefined;
    /** Whether the re-roll hit the ally */
    allyWasHit?: boolean | undefined;
}
/**
 * Grapple participant stats
 */
export interface GrappleParticipant {
    /** Attack bonus */
    attackBonus: number;
    /** Strength modifier */
    strengthMod: number;
    /** Agility modifier */
    agilityMod: number;
    /** Size category (1 = small, 2 = medium, 3 = large, etc.) */
    sizeCategory: number;
    /** For monsters: hit dice (used instead of ability mods) */
    hitDice?: number | undefined;
}
/**
 * Result of a grapple attempt
 */
export interface GrappleResult {
    /** Attacker's roll */
    attackerRoll: number;
    /** Attacker's total (roll + mods) */
    attackerTotal: number;
    /** Defender's roll */
    defenderRoll: number;
    /** Defender's total (roll + mods) */
    defenderTotal: number;
    /** Whether the attacker won */
    attackerWins: boolean;
    /** Whether target is now pinned */
    targetPinned: boolean;
    /** All modifiers applied */
    modifiers: LegacyRollModifier[];
}
/**
 * Result of armor recovery check
 */
export interface ArmorRecoveryResult {
    /** Whether the armor is usable */
    usable: boolean;
    /** The d100 roll */
    roll: number;
    /** Whether armor fits humans (if checking) */
    humanSized?: boolean | undefined;
    /** Estimated repair cost (fraction of original) */
    repairCostFraction?: number | undefined;
}
/**
 * Result of missile weapon recovery
 */
export interface MissileRecoveryResult {
    /** Number of missiles recovered */
    recovered: number;
    /** Number of missiles destroyed */
    destroyed: number;
    /** Individual roll results */
    rolls: {
        roll: number;
        destroyed: boolean;
    }[];
}
/**
 * Subdual damage info
 */
export interface SubdualDamageResult {
    /** The stepped-down damage die */
    damageDie: string;
    /** Damage rolled */
    damage: number;
    /** Whether this damage is subdual (non-lethal) */
    isSubdual: true;
    /** Original weapon die (before step-down) */
    originalDie: string;
}
/**
 * Get the effect of an ability being reduced to 0
 *
 * @param ability - The ability at 0
 * @returns The effect on the character
 */
export declare function getAbilityLossEffect(ability: DCCAbilityId): AbilityLossResult;
/**
 * Check all abilities for zero values and return effects
 *
 * @param abilities - Record of ability scores
 * @returns Array of ability loss effects (empty if none at 0)
 */
export declare function checkAbilityLoss(abilities: Record<DCCAbilityId, number>): AbilityLossResult[];
/**
 * Create initial on-fire state
 *
 * @param options - Optional configuration
 * @returns Fire state
 */
export declare function createOnFireState(options?: {
    damageDie?: string;
    extinguishDC?: number;
    source?: string;
}): OnFireState;
/**
 * Process a round of being on fire
 *
 * @param state - Current fire state
 * @param attemptExtinguish - Whether character spends action to stop/drop/roll
 * @param reflexSave - Character's Reflex save bonus
 * @param roller - Dice roller
 * @returns Fire damage result
 */
export declare function processFireRound(state: OnFireState, attemptExtinguish: boolean, reflexSave: number, roller?: DiceRoller): FireDamageResult;
/**
 * Get charge attack modifiers
 *
 * @param speed - Character's movement speed
 * @returns Charge modifiers
 */
export declare function getChargeModifiers(speed: number): ChargeModifiers;
/**
 * Check if a charge is valid
 *
 * @param distanceMoved - Distance moved this turn
 * @param speed - Character's movement speed
 * @returns Whether the charge is valid
 */
export declare function isValidCharge(distanceMoved: number, speed: number): boolean;
/**
 * Check if a dropped torch is extinguished
 *
 * @param roller - Dice roller
 * @returns Whether the torch went out
 */
export declare function checkDroppedTorch(roller?: DiceRoller): {
    extinguished: boolean;
    roll: number;
};
/**
 * Calculate falling damage
 *
 * @param distanceFeet - Distance fallen in feet
 * @param roller - Dice roller
 * @returns Falling damage result
 */
export declare function calculateFallingDamage(distanceFeet: number, roller?: DiceRoller): FallingDamageResult;
/**
 * Check if a missed ranged attack hits an ally in melee
 *
 * @param numAlliesInMelee - Number of allies engaged with the target
 * @param allyACs - Array of ally armor classes
 * @param attackRoll - The original attack roll (to re-roll against ally)
 * @param attackBonus - Attacker's bonus
 * @param roller - Dice roller
 * @returns Result of firing into melee
 */
export declare function checkFiringIntoMelee(numAlliesInMelee: number, allyACs: number[], attackBonus: number, roller?: DiceRoller): FiringIntoMeleeResult;
/**
 * Calculate size bonus for grappling
 *
 * @param attackerSize - Attacker's size category
 * @param defenderSize - Defender's size category
 * @returns Bonus to attacker's grapple check
 */
export declare function getGrappleSizeBonus(attackerSize: number, defenderSize: number): number;
/**
 * Get the grapple modifier for a participant
 *
 * @param participant - Grapple participant
 * @returns The modifier to use (higher of STR/AGL, or HD for monsters)
 */
export declare function getGrappleModifier(participant: GrappleParticipant): number;
/**
 * Resolve a grapple attempt
 *
 * @param attacker - Attacker's stats
 * @param defender - Defender's stats
 * @param roller - Dice roller
 * @returns Grapple result
 */
export declare function resolveGrapple(attacker: GrappleParticipant, defender: GrappleParticipant, roller?: DiceRoller): GrappleResult;
/**
 * Check if armor recovered from a fallen foe is usable
 *
 * @param checkHumanSized - Whether to also check if armor is human-sized
 * @param roller - Dice roller
 * @returns Armor recovery result
 */
export declare function checkArmorRecovery(checkHumanSized?: boolean, roller?: DiceRoller): ArmorRecoveryResult;
/**
 * Check recovery of missile weapons
 *
 * @param numMissiles - Number of missiles to recover
 * @param roller - Dice roller
 * @returns Missile recovery result
 */
export declare function checkMissileRecovery(numMissiles: number, roller?: DiceRoller): MissileRecoveryResult;
/**
 * Weapons that can deal subdual damage when the user is proficient
 */
export declare const SUBDUAL_CAPABLE_WEAPONS: readonly ["sword", "longsword", "short sword", "two-handed sword", "axe", "battle axe", "hand axe", "club", "spear", "staff", "quarterstaff"];
/**
 * Check if a weapon can deal subdual damage
 *
 * @param weaponName - Name of the weapon
 * @returns Whether the weapon can deal subdual damage
 */
export declare function canDealSubdualDamage(weaponName: string): boolean;
/**
 * Calculate subdual damage (one die step lower)
 *
 * @param weaponDie - Normal weapon damage die
 * @param strengthMod - Strength modifier
 * @param roller - Dice roller
 * @returns Subdual damage result
 */
export declare function rollSubdualDamage(weaponDie: string, strengthMod: number, roller?: DiceRoller): SubdualDamageResult;
/**
 * Roll unarmed combat damage (always subdual)
 *
 * @param strengthMod - Strength modifier
 * @param roller - Dice roller
 * @returns Subdual damage result
 */
export declare function rollUnarmedDamage(strengthMod: number, roller?: DiceRoller): SubdualDamageResult;
/**
 * Check if a missed melee attack against a grappled creature hits the grappler
 *
 * @param grapplerAC - AC of the ally maintaining the pin
 * @param attackBonus - Attacker's bonus
 * @param roller - Dice roller
 * @returns Result similar to firing into melee
 */
export declare function checkMeleeAgainstGrappled(grapplerAC: number, attackBonus: number, roller?: DiceRoller): FiringIntoMeleeResult;
/**
 * Opponent info for withdrawal attacks of opportunity
 */
export interface WithdrawalOpponent {
    /** Opponent's name/identifier */
    name: string;
    /** Opponent's attack bonus */
    attackBonus: number;
    /** Opponent's damage die */
    damageDie: string;
    /** Opponent's strength modifier for damage */
    strengthMod: number;
}
/**
 * Result of a single attack of opportunity
 */
export interface AttackOfOpportunityResult {
    /** Opponent making the attack */
    opponentName: string;
    /** Attack roll */
    attackRoll: number;
    /** Total attack (roll + bonus) */
    attackTotal: number;
    /** Whether the attack hit */
    hit: boolean;
    /** Damage dealt (if hit) */
    damage?: number | undefined;
}
/**
 * Result of withdrawing from melee
 */
export interface WithdrawalResult {
    /** Number of opponents who got free attacks */
    numOpponents: number;
    /** Results of each attack of opportunity */
    attacks: AttackOfOpportunityResult[];
    /** Total damage taken */
    totalDamage: number;
}
/**
 * Process a withdrawal from melee combat
 *
 * When a character withdraws from an active melee, all engaged opponents
 * receive a single free attack against them.
 *
 * @param withdrawingAC - AC of the withdrawing character
 * @param opponents - Array of opponents engaged in melee
 * @param roller - Dice roller
 * @returns Withdrawal result with all attack of opportunity results
 */
export declare function processWithdrawal(withdrawingAC: number, opponents: WithdrawalOpponent[], roller?: DiceRoller): WithdrawalResult;
/**
 * Check if a character is engaged in melee (for UI purposes)
 *
 * @param numAdjacentEnemies - Number of enemies in melee range
 * @returns Whether the character is engaged
 */
export declare function isEngagedInMelee(numAdjacentEnemies: number): boolean;
/**
 * Format withdrawal result for display
 */
export declare function formatWithdrawalResult(result: WithdrawalResult): string;
/**
 * Type of horse for combat purposes
 */
export type HorseType = "warhorse" | "riding-horse" | "draft-horse" | "pony";
/**
 * State of a mount in combat
 */
export interface MountState {
    /** Type of horse */
    horseType: HorseType;
    /** Whether the horse is trained for combat (warhorses always are) */
    combatTrained: boolean;
    /** Horse's current HP */
    currentHP: number;
    /** Horse's max HP */
    maxHP: number;
    /** Whether first-wounded check has been triggered (for warhorses) */
    halfHPChecked: boolean;
    /** Horse's initiative modifier */
    initiativeMod: number;
    /** Horse's movement speed */
    speed: number;
    /** Horse's AC */
    ac: number;
    /** Horse's attack bonus (if combat trained) */
    attackBonus?: number | undefined;
    /** Horse's damage die (if combat trained) */
    damageDie?: string | undefined;
}
/**
 * Mounted combat bonuses
 */
export interface MountedCombatBonuses {
    /** AC bonus while mounted (+1) */
    acBonus: number;
    /** Attack bonus vs unmounted opponents (+1 higher ground) */
    attackBonusVsUnmounted: number;
    /** Whether lance/spear damage dice are doubled (charging) */
    lanceDamageDoubled: boolean;
}
/**
 * Result of a stay mounted check
 */
export interface StayMountedResult {
    /** The die used (d20 trained, d10 untrained) */
    dieUsed: string;
    /** The roll result */
    roll: number;
    /** The DC to beat */
    dc: number;
    /** Whether the check passed */
    stayedMounted: boolean;
    /** If failed, character is now prone */
    isProne: boolean;
    /** Reason for the check */
    reason: string;
}
/**
 * Result of checking if a horse is spooked
 */
export interface HorseSpookedResult {
    /** Whether the horse is spooked */
    spooked: boolean;
    /** Reason for spook (or why not spooked) */
    reason: string;
    /** Whether a stay mounted check is required */
    requiresStayMountedCheck: boolean;
}
/**
 * Create initial mount state
 *
 * @param horseType - Type of horse
 * @param maxHP - Horse's max HP
 * @param options - Optional overrides
 * @returns Mount state
 */
export declare function createMountState(horseType: HorseType, maxHP: number, options?: {
    speed?: number;
    ac?: number;
    initiativeMod?: number;
    attackBonus?: number;
    damageDie?: string;
}): MountState;
/**
 * Get mounted combat bonuses
 *
 * @param isCharging - Whether the rider is charging
 * @param hasLanceOrSpear - Whether wielding a lance or spear
 * @returns Combat bonuses
 */
export declare function getMountedCombatBonuses(isCharging?: boolean, hasLanceOrSpear?: boolean): MountedCombatBonuses;
/**
 * Calculate mounted initiative modifier
 *
 * Uses the worse (lower) of rider and mount initiative modifiers
 *
 * @param riderInitMod - Rider's initiative modifier
 * @param mountInitMod - Mount's initiative modifier
 * @returns The worse of the two modifiers
 */
export declare function getMountedInitiativeModifier(riderInitMod: number, mountInitMod: number): number;
/**
 * Check if a horse is spooked by damage
 *
 * - Warhorses: only spooked when first dropping below half HP
 * - Other horses: spooked any time they suffer a wound
 *
 * @param mount - Current mount state
 * @param damageDealt - Damage just dealt to the horse
 * @returns Spook check result and updated mount state
 */
export declare function checkHorseSpooked(mount: MountState, damageDealt: number): {
    result: HorseSpookedResult;
    newState: MountState;
};
/**
 * Check if a horse is spooked by an untrained horse attacking
 *
 * @param mount - Mount state
 * @returns Whether a stay mounted check is required
 */
export declare function checkHorseAttackSpook(mount: MountState): HorseSpookedResult;
/**
 * Make a stay mounted check
 *
 * @param agilityScore - Rider's Agility score
 * @param isTrained - Whether rider is trained in horsemanship
 * @param reason - Why the check is being made
 * @param dc - DC to beat (default 10)
 * @param roller - Dice roller
 * @returns Stay mounted result
 */
export declare function makeStayMountedCheck(agilityScore: number, isTrained: boolean, reason: string, dc?: number, roller?: DiceRoller): StayMountedResult;
/**
 * Check if a weapon is a lance or spear (for mounted charge damage)
 *
 * @param weaponName - Name of the weapon
 * @returns Whether it's a lance or spear
 */
export declare function isLanceOrSpear(weaponName: string): boolean;
/**
 * Calculate mounted charge damage multiplier
 *
 * @param isCharging - Whether mounted and charging
 * @param weaponName - Name of weapon being used
 * @returns Damage multiplier (2 for lance/spear charge, 1 otherwise)
 */
export declare function getMountedChargeDamageMultiplier(isCharging: boolean, weaponName: string): number;
/**
 * Format stay mounted result for display
 */
export declare function formatStayMountedResult(result: StayMountedResult): string;
/**
 * Format mounted combat bonuses for display
 */
export declare function formatMountedBonuses(bonuses: MountedCombatBonuses): string;
/**
 * Format falling damage result for display
 */
export declare function formatFallingDamage(result: FallingDamageResult): string;
/**
 * Format grapple result for display
 */
export declare function formatGrappleResult(result: GrappleResult, attackerName: string, defenderName: string): string;
//# sourceMappingURL=misc-rules.d.ts.map