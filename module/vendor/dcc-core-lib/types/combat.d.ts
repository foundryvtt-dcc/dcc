/**
 * Combat System Types
 *
 * Types for attack rolls, damage calculations, critical hits, fumbles,
 * and initiative in DCC.
 */
import type { CritDieFormula, DieType, RollResult, LegacyRollModifier } from "./dice.js";
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
    /**
     * Thief backstab attack: a hit is automatically a critical threat
     * (DCC core rules, Crit Table II). A natural 1 is still a fumble
     * and does NOT auto-crit. This flag controls ONLY the auto-crit
     * behavior.
     *
     * The Table 1-9 alignment/level attack bonus is NOT derived from
     * this flag — callers must precompute it via
     * `getBackstabAttackBonus(progression, level, alignment)` and pass
     * it as a full `RollBonus` in `bonuses` (e.g. with `id: "class:backstab"`,
     * `source: { type: "class", id: "thief" }`, `effect: { type: "modifier",
     * value: N }`). See `makeAttackRoll` docstring for a full example.
     */
    isBackstab?: boolean | undefined;
}
/**
 * Two-weapon fighting configuration derived from the attacker's Agility
 * (DCC core rules Table 4-3, plus halfling class overrides). Reductions
 * step each hand's action die DOWN the dice chain.
 */
export interface TwoWeaponDiceConfig {
    /** Number of dice-chain steps to reduce the primary hand's action die. */
    primaryDieReduction: number;
    /** Number of dice-chain steps to reduce the off-hand's action die. */
    offHandDieReduction: number;
    /** Whether the primary hand is capable of scoring a critical hit at all. */
    primaryCanCrit: boolean;
    /** Whether the off-hand is capable of scoring a critical hit at all. */
    offHandCanCrit: boolean;
    /**
     * Agl-16-17 row (non-halfling): the primary hand crits only on a
     * natural max that ALSO beats the target's AC. The natural max does
     * NOT auto-hit — the attacker must actually beat AC.
     */
    primaryCritRequiresBeatAC: boolean;
    /**
     * Halfling class override on the clamped Agl-16 row: a natural max
     * on the reduced die is both an auto-hit AND an auto-crit, applied
     * to both hands (halflings crit with either hand on a natural max).
     * Replaces the non-halfling `primaryCritRequiresBeatAC` rule.
     */
    halflingAutoCritOnMax: boolean;
    /**
     * Halfling class override: a natural 1 on a single hand is NOT a
     * fumble — halflings fumble only when BOTH hands roll natural 1.
     */
    halflingFumbleRequiresBoth1s: boolean;
}
/**
 * Input for rolling a full two-weapon attack round (both hands).
 *
 * The primary and off-hand attack inputs should omit `actionDie` —
 * the wrapper computes each hand's die from `baseActionDie` via
 * the Table 4-3 reductions.
 */
export interface TwoWeaponAttackInput {
    /** Attacker's Agility score (raw, pre-halfling-clamp). */
    agility: number;
    /**
     * When true, applies the halfling class overrides: min effective
     * Agility 16 for row lookup, auto-crit/auto-hit on natural max of
     * the reduced die, and "both rolls must be natural 1" fumble rule.
     */
    isHalfling?: boolean | undefined;
    /**
     * Base action die before two-weapon reduction. Typically `d20`, or
     * `d16` when already two-handing a single weapon (rare combo).
     */
    baseActionDie: DieType;
    /** Primary-hand attack input (without `actionDie`). */
    primary: Omit<AttackInput, "actionDie">;
    /** Off-hand attack input (without `actionDie`). */
    offHand: Omit<AttackInput, "actionDie">;
}
/**
 * Result of a two-weapon attack round.
 */
export interface TwoWeaponAttackResult {
    primary: AttackResult;
    offHand: AttackResult;
    config: TwoWeaponDiceConfig;
}
/**
 * Why a critical threat fired. Drives downstream crit-table selection
 * (a backstab auto-crit always rolls on Crit Table II regardless of
 * the attacker's normal crit table).
 */
export type CritSource = "threat-range" | "backstab-auto" | "natural-max";
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
    /**
     * When `isCriticalThreat` is true, what caused it. `undefined` when
     * the attack is not a critical threat.
     */
    critSource?: CritSource | undefined;
    /** Whether this is a fumble (natural 1) */
    isFumble: boolean;
    /** Whether the attack hits (if targetAC was provided) */
    isHit?: boolean | undefined;
    /** All modifiers that were applied */
    appliedModifiers: LegacyRollModifier[];
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
    /** Crit die formula (e.g., "d12", "2d20", or "d30+2"). */
    critDie: CritDieFormula;
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
export type ArmorType = "unarmored" | "padded" | "leather" | "studded-leather" | "hide" | "scale" | "chainmail" | "banded" | "half-plate" | "full-plate";
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
 *
 * RAW (Core Book Ch. 4): roll 1d20 + Agility mod. A character wielding a
 * two-handed weapon rolls d16 instead of d20. Warriors add their class
 * level as a flat modifier — pass it as `classModifier`.
 */
export interface InitiativeInput {
    /**
     * Initiative die. Callers should pass `d20` by default, or `d16` when
     * wielding a two-handed weapon. See `getInitiativeDie`.
     */
    initiativeDie: DieType;
    /** Agility modifier */
    agilityModifier: number;
    /**
     * Flat class-based initiative modifier. Warriors pass their class
     * level here (RAW: warriors add level to initiative).
     */
    classModifier?: number | undefined;
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
    modifiers: LegacyRollModifier[];
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
 * Alternate damage expression used when a thief succeeds in a backstab
 * attempt with a backstab-friendly weapon (DCC Table 3-1 footnote).
 *
 * The thief rolls this expression *instead of* the weapon's normal
 * damage — it is a full replacement, not an additive bonus.
 */
export interface BackstabDamage {
    /** Alternate damage die rolled on a successful backstab */
    damageDie: DieType;
    /** Number of damage dice (defaults to 1) */
    diceCount?: number | undefined;
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
    /**
     * Alternate damage used on a successful thief backstab. Only a small
     * set of weapons has this (DCC Table 3-1 footnote: dagger, blackjack,
     * blowgun, garrote). When the attacker is a thief AND the attack is
     * a backstab, roll this instead of the normal damage.
     */
    backstabDamage?: BackstabDamage | undefined;
}
/**
 * Common weapon stats
 */
export declare const COMMON_WEAPONS: Record<string, WeaponStats>;
//# sourceMappingURL=combat.d.ts.map