/**
 * Lay on Hands (RAW DCC p.31)
 *
 * Pure functions for the cleric's Lay on Hands ability. Implements the
 * rules-as-written mechanic:
 *
 *   1. Cleric declares alignment relationship (same/adjacent/opposed) and
 *      optionally a condition to heal instead of HP.
 *   2. Spell check = d20 + Personality mod + caster level + luck burn.
 *      Alignment does NOT modify the roll — it selects a column on the
 *      result table (see `LayOnHandsTable`).
 *   3. (check total, alignment) → dice count.
 *   4. If healing HP: roll `diceCount × target.hitDie`, but the dice count is
 *      capped at `min(diceCount, target.hitDice)`. Dice type matches the
 *      subject's hit die.
 *   5. If healing a condition: no cap; if dice count ≥ threshold, condition
 *      is cured (no "overflow" HP).
 *   6. Natural 1 triggers disapproval (handled by the caller via the
 *      spell-check pipeline).
 */
import type { DieType, RollModifier, RollOptions } from "../types/dice.js";
import type { SkillDefinition, SkillCheckResult } from "../types/skills.js";
import type { LayOnHandsAlignment, LayOnHandsExtraEffects, LayOnHandsRow, LayOnHandsTable } from "../tables/types.js";
export declare const LAY_ON_HANDS_SKILL: SkillDefinition;
export interface LayOnHandsTarget {
    /** Target's hit die (d4, d6, d8, d10, d12). Dice type for HP healing. */
    hitDie: DieType;
    /** Target's hit dice or class level. Caps the dice count when healing HP. */
    hitDice: number;
}
export interface LayOnHandsInput {
    /** Cleric level */
    level: number;
    /** Cleric Personality score */
    personality: number;
    /** Cleric–subject alignment relationship */
    alignment: LayOnHandsAlignment;
    /** Healing target (HD type + HD count for the cap) */
    target: LayOnHandsTarget;
    /**
     * If set, heal a condition instead of HP. The value is a condition id
     * matched against `LayOnHandsTable.conditions` thresholds. RAW examples:
     * "broken-limb", "organ-damage", "disease", "paralysis", "poison",
     * "blindness". Declared BEFORE rolling per RAW.
     */
    healingCondition?: string | undefined;
    /** Optional Luck score */
    luck?: number | undefined;
    /** Luck points burned on this check */
    luckBurn?: number | undefined;
    /** Judge-discretion self-healing penalty (common house rule: -4) */
    healingSelf?: boolean | undefined;
    /** Extra situational modifiers on the spell check (NOT alignment) */
    situationalModifiers?: RollModifier[] | undefined;
}
export interface LayOnHandsResult {
    /** The underlying spell-check roll */
    check: SkillCheckResult;
    /** True if at least 1 die was granted (check total met the minimum row) */
    success: boolean;
    /** Dice count from the (total, alignment) lookup, before HP cap */
    rawDiceCount: number;
    /** Dice actually rolled — min(rawDiceCount, target.hitDice) for HP; rawDiceCount for conditions */
    diceCount: number;
    /** HP restored (only when healing HP, not conditions) */
    hpHealed?: number | undefined;
    /** If condition healing was requested, the id, and whether it was cured */
    condition?: {
        id: string;
        cured: boolean;
        threshold: number;
    } | undefined;
    /** Extra row-level effects (disease cure, limb restore, etc.) */
    extraEffects?: LayOnHandsExtraEffects | undefined;
    /** The matched row (for UI display / debugging) */
    row?: LayOnHandsRow | undefined;
    /** Human-readable description */
    description: string;
}
export declare function layOnHands(input: LayOnHandsInput, table: LayOnHandsTable, options?: RollOptions): LayOnHandsResult;
/**
 * Lay on Hands check-only modifier, useful for showing players before rolling.
 * Note: alignment is NOT a roll modifier (RAW); it only affects the result
 * lookup.
 */
export declare function getLayOnHandsModifier(level: number, personality: number, healingSelf?: boolean): number;
export declare function getLayOnHandsDie(): DieType;
//# sourceMappingURL=lay-on-hands.d.ts.map