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
export { makeAttackRoll, calculateAttackBonus, doesAttackHit, getAttackAbility, getTwoWeaponPenalty, isDeedSuccessful, } from "./attack.js";
export { rollDamage, calculateDamageModifier, getBackstabMultiplier, getTwoHandedDamageDie, buildDamageFormula, applyMinimumDamage, } from "./damage.js";
export { rollCritical, calculateCritModifier, determineCritTable, getCritTable, getCritDie, buildCritFormula, parseCritExtraDamage, WARRIOR_CRIT_DIE, THIEF_CRIT_DIE, DEFAULT_CRIT_DIE, CLASS_CRIT_TABLE, } from "./crits.js";
export { rollFumble, calculateFumbleModifier, buildFumbleFormula, isFumble, getFumbleDie, getArmorType, getArmorCheckPenalty, getArmorSpeedPenalty, FUMBLE_DICE, ARMOR_CHECK_PENALTY, ARMOR_SPEED_PENALTY, } from "./fumbles.js";
export { rollInitiative, calculateInitiativeModifier, buildInitiativeFormula, getInitiativeDie, sortByInitiative, isInitiativeTied, getTwoWeaponInitiativeBonus, WARRIOR_INITIATIVE_DIE, DEFAULT_INITIATIVE_DIE, } from "./initiative.js";
export { type MoraleEntityType, type MoraleTrigger, type GroupMoraleState, type CreatureMoraleState, type RetainerMoraleState, type MoraleCheckInput, type MoraleCheckResult, type MoraleImmuneType, DEFAULT_MORALE_DC, MAX_SITUATIONAL_MODIFIER, MIN_SITUATIONAL_MODIFIER, MORALE_IMMUNE_TYPES, makeMoraleCheck, calculateMoraleModifier, checkGroupMoraleTrigger, checkCreatureMoraleTrigger, checkRetainerMoraleTrigger, createGroupMoraleState, createCreatureMoraleState, createRetainerMoraleState, resetRetainerMoraleForNewAdventure, isImmuneToMorale, hasImmuneTraits, getSuggestedModifier, formatMoraleResult, } from "./morale.js";
export { type VitalStatus, type DamageApplicationResult, type BleedingOutState, type StabilizeResult, type BodyRecoveryResult, type RestType, type HealingResult, getBleedOutRounds, getVitalStatus, applyDamage, canBeSaved, advanceBleedOutRound, createBleedingOutState, stabilizeCharacter, applyBleedOutTrauma, attemptBodyRecovery, applyBodyRecovery, getHealingFromRest, applyNaturalHealing, applyHealingResult, applyMagicalHealing, isAtDeathsDoor, canReceiveHealing, } from "./death-and-dying.js";
export { type AbilityLossEffect, type AbilityLossResult, type OnFireState, type FireDamageResult, type ChargeModifiers, type FallingDamageResult, type FiringIntoMeleeResult, type GrappleParticipant, type GrappleResult, type ArmorRecoveryResult, type MissileRecoveryResult, type SubdualDamageResult, type WithdrawalOpponent, type AttackOfOpportunityResult, type WithdrawalResult, type HorseType, type MountState, type MountedCombatBonuses, type StayMountedResult, type HorseSpookedResult, SUBDUAL_CAPABLE_WEAPONS, getAbilityLossEffect, checkAbilityLoss, createOnFireState, processFireRound, getChargeModifiers, isValidCharge, checkDroppedTorch, calculateFallingDamage, formatFallingDamage, checkFiringIntoMelee, getGrappleSizeBonus, getGrappleModifier, resolveGrapple, formatGrappleResult, checkArmorRecovery, checkMissileRecovery, canDealSubdualDamage, rollSubdualDamage, rollUnarmedDamage, checkMeleeAgainstGrappled, processWithdrawal, isEngagedInMelee, formatWithdrawalResult, createMountState, getMountedCombatBonuses, getMountedInitiativeModifier, checkHorseSpooked, checkHorseAttackSpook, makeStayMountedCheck, isLanceOrSpear, getMountedChargeDamageMultiplier, formatStayMountedResult, formatMountedBonuses, } from "./misc-rules.js";
//# sourceMappingURL=index.d.ts.map