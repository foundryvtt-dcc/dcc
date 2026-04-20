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
import { resolveSkillCheck } from "../skills/resolve.js";
import { getAbilityModifier } from "../data/ability-modifiers.js";
import { evaluateRoll } from "../dice/roll.js";
// =============================================================================
// Skill Definition
// =============================================================================
export const LAY_ON_HANDS_SKILL = {
    id: "lay-on-hands",
    name: "Lay on Hands",
    description: "Channel divine healing power to restore hit points and cure ailments",
    type: "check",
    roll: {
        die: "d20",
        ability: "per",
        levelModifier: "full",
        allowLuck: true,
        luckMultiplier: 1,
    },
    tags: ["cleric", "divine", "healing", "lay-on-hands"],
    classes: ["cleric"],
};
// =============================================================================
// Core function
// =============================================================================
export function layOnHands(input, table, options = {}) {
    // Build situational modifiers — NO alignment modifier here (RAW).
    const modifiers = [...(input.situationalModifiers ?? [])];
    if (input.healingSelf) {
        modifiers.push({
            kind: "add",
            value: -4,
            origin: { category: "situational", id: "self-healing", label: "Healing self" },
        });
    }
    const checkInput = {
        skill: LAY_ON_HANDS_SKILL,
        abilities: { per: input.personality },
        level: input.level,
        classId: "cleric",
        situationalModifiers: modifiers,
    };
    if (input.luck !== undefined)
        checkInput.luck = input.luck;
    if (input.luckBurn !== undefined)
        checkInput.luckBurn = input.luckBurn;
    const check = resolveSkillCheck(checkInput, options);
    const total = check.total ?? 0;
    const row = findRow(table, total);
    const rawDiceCount = row?.dice[input.alignment] ?? 0;
    const success = rawDiceCount > 0;
    const result = {
        check,
        success,
        rawDiceCount,
        diceCount: 0,
        row,
        description: describe(success, input, rawDiceCount, row),
    };
    if (row?.extra !== undefined)
        result.extraEffects = row.extra;
    if (!success)
        return result;
    if (input.healingCondition !== undefined) {
        // Condition healing: no HP cap; dice must meet threshold.
        const threshold = table.conditions?.[input.healingCondition];
        if (threshold === undefined) {
            // Condition not defined in this table — treat as non-curable here.
            result.condition = { id: input.healingCondition, cured: false, threshold: Infinity };
            result.diceCount = rawDiceCount;
            return result;
        }
        result.diceCount = rawDiceCount;
        result.condition = {
            id: input.healingCondition,
            cured: rawDiceCount >= threshold,
            threshold,
        };
        return result;
    }
    // HP healing: cap dice at target HD/level, then roll `diceCount × target.hitDie`.
    const capped = Math.min(rawDiceCount, input.target.hitDice);
    result.diceCount = capped;
    if (capped > 0) {
        const formula = `${String(capped)}${input.target.hitDie}`;
        const rollOpt = { mode: "evaluate" };
        if (options.roller !== undefined)
            rollOpt.roller = options.roller;
        const heal = evaluateRoll(formula, rollOpt);
        result.hpHealed = heal.total ?? 0;
    }
    else {
        result.hpHealed = 0;
    }
    return result;
}
// =============================================================================
// Utilities
// =============================================================================
/**
 * Lay on Hands check-only modifier, useful for showing players before rolling.
 * Note: alignment is NOT a roll modifier (RAW); it only affects the result
 * lookup.
 */
export function getLayOnHandsModifier(level, personality, healingSelf = false) {
    let mod = level + getAbilityModifier(personality);
    if (healingSelf)
        mod -= 4;
    return mod;
}
export function getLayOnHandsDie() {
    return "d20";
}
function findRow(table, total) {
    for (const row of table.rows) {
        if (total >= row.min && total <= row.max)
            return row;
    }
    return undefined;
}
function describe(success, input, dice, row) {
    if (!success)
        return row?.text ?? "Divine healing does not flow through you.";
    if (input.healingCondition !== undefined) {
        return row?.text ?? `Channelled ${String(dice)} healing dice toward the subject's condition.`;
    }
    return row?.text ?? `Channelled ${String(dice)} healing dice into the subject.`;
}
//# sourceMappingURL=lay-on-hands.js.map