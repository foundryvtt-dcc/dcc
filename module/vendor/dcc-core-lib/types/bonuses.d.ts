/**
 * Bonus System Types
 *
 * Comprehensive system for representing all types of bonuses that can
 * apply to rolls in DCC. Bonuses can come from many sources:
 *
 * - Inherent: ability modifiers, class features, level
 * - Equipment: magic items, weapons, armor
 * - Circumstance: assist actions, terrain, judge rulings
 * - Luck: burning luck for bonuses
 * - Spell: active magical effects
 *
 * All bonuses stack in DCC (unlike D&D 3.5/Pathfinder).
 */
import type { DieType } from "./dice.js";
/**
 * High-level category of where a bonus comes from.
 * Used for organization and UI grouping.
 */
export type BonusSourceType = "ability" | "class" | "item" | "spell" | "luck" | "assist" | "judge" | "condition" | "other";
/**
 * Category that determines when bonuses apply.
 * Inherent bonuses are always active; situational are per-roll.
 */
export type BonusCategory = "inherent" | "equipment" | "circumstance" | "luck" | "spell" | "other";
/**
 * Detailed source information for a bonus.
 * Allows both simple and detailed tracking.
 */
export interface BonusSource {
    /** High-level source type */
    type: BonusSourceType;
    /**
     * Specific identifier for the source (optional).
     * Examples: "str", "ring-of-protection", "enlarge-person"
     */
    id?: string;
    /**
     * Human-readable name for display.
     * If not provided, can be derived from type/id.
     */
    name?: string;
}
/**
 * What kind of effect the bonus has on the roll.
 */
export type BonusEffectType = "modifier" | "die" | "dice-chain" | "set-die" | "reroll";
/**
 * A flat numeric modifier bonus
 */
export interface BonusFlatModifier {
    type: "modifier";
    /** The numeric value to add (can be negative) */
    value: number;
}
/**
 * A die-based bonus (adds a die roll to the result)
 */
export interface BonusDieRoll {
    type: "die";
    /** The die to roll and add */
    die: DieType;
    /** Number of dice (default 1) */
    count?: number;
}
/**
 * A dice chain bump (changes the action die)
 */
export interface BonusDiceChain {
    type: "dice-chain";
    /** Steps to move on the dice chain (+1 = up one step, -2 = down two) */
    steps: number;
}
/**
 * Sets the die to a specific value (rare, for special abilities)
 */
export interface BonusSetDie {
    type: "set-die";
    /** The die to use instead */
    die: DieType;
}
/**
 * Allows a reroll (like advantage)
 */
export interface BonusReroll {
    type: "reroll";
    /** How the reroll works */
    mode: "take-higher" | "take-lower" | "choice";
}
/**
 * Union of all bonus effect types
 */
export type BonusEffect = BonusFlatModifier | BonusDieRoll | BonusDiceChain | BonusSetDie | BonusReroll;
/**
 * A complete bonus that can apply to a roll.
 *
 * This is the core type for the bonus system. Every bonus - whether from
 * strength, a magic ring, burning luck, or a spell - is represented as
 * a RollBonus.
 *
 * @example
 * // Strength modifier
 * const strBonus: RollBonus = {
 *   id: "ability:str",
 *   label: "Strength",
 *   source: { type: "ability", id: "str" },
 *   category: "inherent",
 *   effect: { type: "modifier", value: 2 },
 * };
 *
 * @example
 * // Luck burn
 * const luckBonus: RollBonus = {
 *   id: "luck-burn",
 *   label: "Luck burn (3 points)",
 *   source: { type: "luck" },
 *   category: "luck",
 *   effect: { type: "modifier", value: 3 },
 * };
 *
 * @example
 * // Judge's dice chain bump
 * const judgeBump: RollBonus = {
 *   id: "judge:favorable-terrain",
 *   label: "High ground",
 *   source: { type: "judge", name: "Favorable terrain" },
 *   category: "circumstance",
 *   effect: { type: "dice-chain", steps: 1 },
 * };
 */
export interface RollBonus {
    /**
     * Unique identifier for this bonus instance.
     * Format: "{source-type}:{specific-id}" recommended.
     * Examples: "ability:str", "item:ring-of-protection", "spell:enlarge"
     */
    id: string;
    /**
     * Human-readable label for display.
     * Should be concise but descriptive.
     */
    label: string;
    /**
     * Where this bonus comes from.
     */
    source: BonusSource;
    /**
     * Category for grouping and application timing.
     */
    category: BonusCategory;
    /**
     * What effect this bonus has on the roll.
     */
    effect: BonusEffect;
    /**
     * Optional condition for when this bonus applies.
     * If not specified, bonus always applies when present.
     *
     * Examples:
     * - "melee-attack" - only on melee attacks
     * - "vs-undead" - only against undead
     * - "in-darkness" - only in dark conditions
     */
    condition?: string;
    /**
     * Priority for ordering when multiple bonuses modify the same thing.
     * Higher priority bonuses are applied first.
     * Default is 0. Dice chain effects should typically be high priority.
     */
    priority?: number;
}
/**
 * A collection of bonuses organized by category.
 * Useful for separating "always on" vs "per-roll" bonuses.
 */
export interface BonusList {
    /** Bonuses that always apply (ability, class, equipment) */
    inherent: RollBonus[];
    /** Bonuses added for this specific roll */
    situational: RollBonus[];
}
/**
 * Create an empty bonus list
 */
export declare function createEmptyBonusList(): BonusList;
/**
 * Create an ability modifier bonus
 */
export declare function createAbilityBonus(abilityId: string, abilityName: string, modifier: number): RollBonus;
/**
 * Create a level/class bonus
 */
export declare function createLevelBonus(classId: string, level: number, modifier: number, label?: string): RollBonus;
/**
 * Create a luck burn bonus
 */
export declare function createLuckBonus(pointsBurned: number, multiplier?: number): RollBonus;
/**
 * Create an equipment bonus
 */
export declare function createEquipmentBonus(itemId: string, itemName: string, modifier: number): RollBonus;
/**
 * Create a spell effect bonus
 */
export declare function createSpellBonus(spellId: string, spellName: string, effect: BonusEffect): RollBonus;
/**
 * Create an assist bonus (another character helping)
 */
export declare function createAssistBonus(helperName: string, modifier?: number): RollBonus;
/**
 * Create a judge's situational bonus
 */
export declare function createJudgeBonus(reason: string, effect: BonusEffect): RollBonus;
/**
 * Create a dice chain bump bonus
 */
export declare function createDiceChainBonus(source: BonusSource, steps: number, label: string): RollBonus;
/**
 * Result of computing bonuses for a roll
 */
export interface ComputedBonuses {
    /** Total flat modifier to add to the roll */
    totalModifier: number;
    /** Net dice chain steps (positive = up, negative = down) */
    diceChainSteps: number;
    /** Additional dice to roll and add to the result */
    additionalDice: {
        die: DieType;
        count: number;
    }[];
    /** Whether a reroll is available */
    hasReroll: boolean;
    rerollMode?: "take-higher" | "take-lower" | "choice";
    /** If a specific die is forced */
    forcedDie?: DieType;
    /** All bonuses that were applied, for display */
    appliedBonuses: RollBonus[];
}
/**
 * Compute the total effect of all bonuses.
 * All bonuses stack in DCC.
 *
 * @param bonuses - Array of bonuses to apply
 * @param condition - Optional condition to filter bonuses (e.g., "melee-attack")
 * @returns Computed totals for modifiers, dice chain, etc.
 */
export declare function computeBonuses(bonuses: RollBonus[], condition?: string): ComputedBonuses;
/**
 * Merge inherent and situational bonuses into a single list
 */
export declare function mergeBonuses(list: BonusList): RollBonus[];
/**
 * Get the total modifier from a list of bonuses (quick helper)
 */
export declare function getTotalModifier(bonuses: RollBonus[]): number;
/**
 * Get net dice chain steps from a list of bonuses
 */
export declare function getDiceChainSteps(bonuses: RollBonus[]): number;
//# sourceMappingURL=bonuses.d.ts.map