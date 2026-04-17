/**
 * Combat System
 *
 * Exports all combat-related functions for:
 * - Attack rolls
 * - Damage calculations
 * - Critical hits
 * - Fumbles
 * - Initiative
 * - Death and dying
 * - Healing
 */
// Attack functions
export { makeAttackRoll, calculateAttackBonus, doesAttackHit, getAttackAbility, getTwoWeaponPenalty, isDeedSuccessful, } from "./attack.js";
// Damage functions
export { rollDamage, calculateDamageModifier, getBackstabMultiplier, getTwoHandedDamageDie, buildDamageFormula, applyMinimumDamage, } from "./damage.js";
// Critical hit functions
export { rollCritical, calculateCritModifier, determineCritTable, getCritTable, getCritDie, buildCritFormula, parseCritExtraDamage, WARRIOR_CRIT_DIE, THIEF_CRIT_DIE, DEFAULT_CRIT_DIE, CLASS_CRIT_TABLE, } from "./crits.js";
// Fumble functions
export { rollFumble, calculateFumbleModifier, buildFumbleFormula, isFumble, getFumbleDie, getArmorType, getArmorCheckPenalty, getArmorSpeedPenalty, FUMBLE_DICE, ARMOR_CHECK_PENALTY, ARMOR_SPEED_PENALTY, } from "./fumbles.js";
// Initiative functions
export { rollInitiative, calculateInitiativeModifier, buildInitiativeFormula, getInitiativeDie, sortByInitiative, isInitiativeTied, getTwoWeaponInitiativeBonus, WARRIOR_INITIATIVE_DIE, DEFAULT_INITIATIVE_DIE, } from "./initiative.js";
// Morale functions
export { 
// Constants
DEFAULT_MORALE_DC, MAX_SITUATIONAL_MODIFIER, MIN_SITUATIONAL_MODIFIER, MORALE_IMMUNE_TYPES, 
// Functions
makeMoraleCheck, calculateMoraleModifier, checkGroupMoraleTrigger, checkCreatureMoraleTrigger, checkRetainerMoraleTrigger, createGroupMoraleState, createCreatureMoraleState, createRetainerMoraleState, resetRetainerMoraleForNewAdventure, isImmuneToMorale, hasImmuneTraits, getSuggestedModifier, formatMoraleResult, } from "./morale.js";
// Death and dying functions
export { 
// Functions
getBleedOutRounds, getVitalStatus, applyDamage, canBeSaved, advanceBleedOutRound, createBleedingOutState, stabilizeCharacter, applyBleedOutTrauma, attemptBodyRecovery, applyBodyRecovery, getHealingFromRest, applyNaturalHealing, applyHealingResult, applyMagicalHealing, isAtDeathsDoor, canReceiveHealing, } from "./death-and-dying.js";
// Miscellaneous combat rules
export { 
// Constants
SUBDUAL_CAPABLE_WEAPONS, 
// Ability loss functions
getAbilityLossEffect, checkAbilityLoss, 
// Fire functions
createOnFireState, processFireRound, 
// Charge functions
getChargeModifiers, isValidCharge, 
// Torch functions
checkDroppedTorch, 
// Falling functions
calculateFallingDamage, formatFallingDamage, 
// Firing into melee functions
checkFiringIntoMelee, 
// Grappling functions
getGrappleSizeBonus, getGrappleModifier, resolveGrapple, formatGrappleResult, 
// Equipment recovery functions
checkArmorRecovery, checkMissileRecovery, 
// Subdual functions
canDealSubdualDamage, rollSubdualDamage, rollUnarmedDamage, 
// Melee against grappled
checkMeleeAgainstGrappled, 
// Withdrawal functions
processWithdrawal, isEngagedInMelee, formatWithdrawalResult, 
// Mounted combat functions
createMountState, getMountedCombatBonuses, getMountedInitiativeModifier, checkHorseSpooked, checkHorseAttackSpook, makeStayMountedCheck, isLanceOrSpear, getMountedChargeDamageMultiplier, formatStayMountedResult, formatMountedBonuses, } from "./misc-rules.js";
//# sourceMappingURL=index.js.map