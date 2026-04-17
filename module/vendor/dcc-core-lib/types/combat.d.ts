/**
 * Combat System Types
 *
 * Types for attack rolls, damage calculations, critical hits, fumbles,
 * and initiative in DCC.
 */
import type { DieType, RollResult, RollModifier } from "./dice.js";
import type { DCCAbilityId } from "./system.js";
import type { RollBonus } from "./bonuses.js";
/**
 * Type of attack being made
 */
export type AttackType = "melee" | "missile" | "special";
/**
 * Input for making an attack roll
 */
export interface AttackInput {
    /** Type of attack */
    attackType: AttackType;
    /** Base attack bonus from class/level */
    attackBonus: number;
    /** Action die to use (e.g., "d20", "d16") */
    actionDie: DieType;
    /** Threat range for critical hits (20 = only on 20, 19 = 19-20, etc.) */
    threatRange: number;
    /** Ability modifier to add (usually STR for melee, AGL for missile) */
    abilityModifier: number;
    /** Deed die for warriors/dwarves (e.g., "d3", "d4") */
    deedDie?: DieType | undefined;
    /** Additional bonuses from equipment, spells, luck, etc. */
    bonuses?: RollBonus[] | undefined;
    /** Target's armor class (optional, for hit determination) */
    targetAC?: number | undefined;
    /** Whether this is a backstab attack (for thieves) */
    isBackstab?: boolean | undefined;
    /** Two-weapon fighting penalty (usually -2 for halflings) */
    twoWeaponPenalty?: number | undefined;
}
/**
 * Result of an attack roll
 */
export interface AttackResult {
    /** The roll result */
    roll: RollResult;
    /** The deed die result (if applicable) */
    deedRoll?: RollResult | undefined;
    /** Total attack bonus after all modifiers */
    totalBonus: number;
    /** Final total (roll + bonus) */
    total: number;
    /** Whether this is a critical threat */
    isCriticalThreat: boolean;
    /** Whether this is a fumble (natural 1) */
    isFumble: boolean;
    /** Whether the attack hits (if targetAC was provided) */
    isHit?: boolean | undefined;
    /** All modifiers that were applied */
    appliedModifiers: RollModifier[];
    /** Whether the deed was successful (roll >= 3) */
    deedSuccess?: boolean | undefined;
}
/**
 * Input for calculating damage
 */
export interface DamageInput {
    /** Base weapon damage die (e.g., "d8" for longsword) */
    damageDie: DieType;
    /** Number of damage dice (usually 1) */
    diceCount?: number | undefined;
    /** Strength modifier for melee, 0 for most missile */
    strengthModifier: number;
    /** Deed die result (added to damage for warriors) */
    deedDieResult?: number | undefined;
    /** Magic weapon bonus */
    magicBonus?: number | undefined;
    /** Backstab multiplier (2, 3, 4, or 5 for thieves) */
    backstabMultiplier?: number | undefined;
    /** Additional bonuses */
    bonuses?: RollBonus[] | undefined;
}
/**
 * Result of a damage roll
 */
export interface DamageResult {
    /** The damage roll result */
    roll: RollResult;
    /** Base damage from dice */
    baseDamage: number;
    /** Modifier damage (str, deed, magic, etc.) */
    modifierDamage: number;
    /** Total damage before multipliers */
    subtotal: number;
    /** Multiplier applied (backstab) */
    multiplier: number;
    /** Final total damage */
    total: number;
    /** Breakdown of damage sources */
    breakdown: DamageBreakdown[];
}
/**
 * Single source of damage
 */
export interface DamageBreakdown {
    /** Source of the damage */
    source: string;
    /** Amount */
    amount: number;
}
/**
 * Crit table identifier
 */
export type CritTableId = "I" | "II" | "III" | "IV" | "V";
/**
 * Input for rolling a critical hit
 */
export interface CriticalInput {
    /** Which crit table to use */
    critTable: CritTableId;
    /** Crit die to roll (e.g., "d12" for warrior) */
    critDie: DieType;
    /** Luck modifier */
    luckModifier: number;
    /** Level (adds to crit roll for some classes) */
    level?: number | undefined;
    /** Additional crit modifiers (from items, spells, etc.) */
    bonuses?: RollBonus[] | undefined;
}
/**
 * Result of a critical hit roll
 */
export interface CriticalResult {
    /** The crit roll result */
    roll: RollResult;
    /** Total crit roll (die + modifiers) */
    total: number;
    /** Which table to look up the result on */
    critTable: CritTableId;
    /** The table result (from lookup) */
    tableResult?: string | undefined;
    /** Extra damage dice from the crit */
    extraDamageDice?: string | undefined;
    /** Extra damage modifier */
    extraDamageModifier?: number | undefined;
    /** Special effect description */
    effect?: string | undefined;
}
/**
 * Armor type affects fumble die
 */
export type ArmorType = "unarmored" | "padded" | "leather" | "hide" | "scale" | "chainmail" | "banded" | "half-plate" | "full-plate";
/**
 * Fumble die by armor type
 */
export declare const FUMBLE_DICE: Record<ArmorType, DieType>;
/**
 * AC bonus by armor type (DCC core rules Table 3-3)
 */
export declare const ARMOR_AC_BONUS: Record<ArmorType, number>;
/**
 * Shield AC bonus
 */
export declare const SHIELD_AC_BONUS = 1;
/**
 * Base AC without any armor or modifiers
 */
export declare const BASE_AC = 10;
/**
 * Armor statistics for equipped armor
 */
export interface ArmorStats {
    /** Armor name */
    name: string;
    /** Armor type */
    type: ArmorType;
    /** AC bonus (can differ from standard for magic armor) */
    acBonus: number;
    /** Magic bonus (if any) */
    magicBonus?: number | undefined;
    /** Check penalty (negative number, can be reduced by magic) */
    checkPenalty: number;
    /** Speed penalty in feet */
    speedPenalty: number;
    /** Fumble die */
    fumbleDie: DieType;
}
/**
 * Shield statistics
 */
export interface ShieldStats {
    /** Shield name */
    name: string;
    /** AC bonus (usually 1, can be higher for magic shields) */
    acBonus: number;
    /** Magic bonus (if any) */
    magicBonus?: number | undefined;
}
/**
 * Input for rolling a fumble
 */
export interface FumbleInput {
    /** Armor type worn (determines fumble die) */
    armorType: ArmorType;
    /** Luck modifier (subtracted from fumble roll - lower is worse!) */
    luckModifier: number;
    /** Override fumble die (for special circumstances) */
    fumbleDieOverride?: DieType | undefined;
}
/**
 * Result of a fumble roll
 */
export interface FumbleResult {
    /** The fumble roll result */
    roll: RollResult;
    /** Total fumble roll (die - luck, minimum 0) */
    total: number;
    /** The fumble die used */
    fumbleDie: DieType;
    /** The table result (from lookup) */
    tableResult?: string | undefined;
    /** Effect description */
    effect?: string | undefined;
}
/**
 * Input for rolling initiative
 */
export interface InitiativeInput {
    /** Initiative die (usually d20, but can vary) */
    initiativeDie: DieType;
    /** Agility modifier */
    agilityModifier: number;
    /** Class-based initiative modifier (if any) */
    classModifier?: number | undefined;
    /** Two-weapon fighting initiative bonus (+1 for halflings) */
    twoWeaponBonus?: number | undefined;
    /** Additional bonuses */
    bonuses?: RollBonus[] | undefined;
}
/**
 * Result of an initiative roll
 */
export interface InitiativeResult {
    /** The initiative roll result */
    roll: RollResult;
    /** Total initiative */
    total: number;
    /** All modifiers applied */
    modifiers: RollModifier[];
}
/**
 * Events emitted during combat
 */
export interface CombatEvents {
    /** Called when an attack roll is made */
    onAttackRoll?: (result: AttackResult) => void;
    /** Called when a critical threat is rolled */
    onCriticalThreat?: (result: AttackResult) => void;
    /** Called when a fumble is rolled */
    onFumbleRoll?: (result: AttackResult) => void;
    /** Called when damage is rolled */
    onDamageRoll?: (result: DamageResult) => void;
    /** Called when a crit table result is determined */
    onCriticalResult?: (result: CriticalResult) => void;
    /** Called when a fumble table result is determined */
    onFumbleResult?: (result: FumbleResult) => void;
    /** Called when initiative is rolled */
    onInitiativeRoll?: (result: InitiativeResult) => void;
    /** Called when a deed is attempted */
    onDeedAttempt?: (deedRoll: RollResult, success: boolean) => void;
}
/**
 * Weapon properties for combat calculations
 */
export interface WeaponStats {
    /** Weapon name */
    name: string;
    /** Damage die */
    damageDie: DieType;
    /** Number of damage dice */
    diceCount?: number | undefined;
    /** Whether this is a melee weapon */
    isMelee: boolean;
    /** Whether this is a ranged weapon */
    isRanged: boolean;
    /** Whether this weapon can be used two-handed for extra damage */
    twoHanded?: boolean | undefined;
    /** Two-handed damage die (if different) */
    twoHandedDamageDie?: DieType | undefined;
    /** Magic bonus (if any) */
    magicBonus?: number | undefined;
    /** Range in feet (for ranged weapons) */
    range?: number | undefined;
    /** Ability used for attack (override default) */
    attackAbility?: DCCAbilityId | undefined;
    /** Ability used for damage (override default) */
    damageAbility?: DCCAbilityId | undefined;
}
/**
 * Common weapon stats
 */
export declare const COMMON_WEAPONS: Record<string, WeaponStats>;
//# sourceMappingURL=combat.d.ts.map