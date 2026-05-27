/**
 * Patron Taint Check Module
 *
 * RAW (DCC core rulebook): patron taint is triggered by two paths, both
 * of which acquire taint unconditionally when they fire:
 *
 *   1. **Creeping chance.** On every patron-based cast, roll 1d100 vs the
 *      caster's current `patronTaintChance`. If the roll is <= chance,
 *      taint is acquired and the chance resets to 1. Otherwise the chance
 *      increments by 1.
 *   2. **Result-table entry.** Certain patron-spell result tables include
 *      taint as an explicit outcome on specific rows (e.g. Bobugbubilz's
 *      *Tadpole Transformation* roll of 1: "Lost, failure, and patron
 *      taint"). Content modules tag such entries either via
 *      `effect.type === 'patron-taint'` or `effect.data.patronTaint === true`.
 *
 * Neither the combat fumble table (attack natural 1s) nor the spell
 * fumble table (spell natural 1s) carries patron taint in RAW — they
 * cover misfires, corruption, and other hazards.
 *
 * This module exposes pure helpers for both paths; orchestration lives
 * in `spell-check.ts::calculateSpellCheck`.
 */
import { rollPatronTaint } from "./corruption.js";
/**
 * Default random number generator (1..faces inclusive).
 */
function defaultRoller(faces) {
    return Math.floor(Math.random() * faces) + 1;
}
/**
 * Determine whether a cast counts as a "patron-based spell" for taint-check
 * purposes. The caller's explicit `isPatronSpell` takes precedence; otherwise
 * fall back to the spell definition's `tags` array.
 */
export function isPatronCast(spell, input) {
    if (input.isPatronSpell !== undefined) {
        return input.isPatronSpell;
    }
    return spell.tags?.includes("patron") ?? false;
}
/**
 * Detect whether a spell result-table entry's effect marks a patron-taint
 * outcome. Accepts two content-authoring forms:
 *
 *   - `effect.type === 'patron-taint'` (primary-effect tagging)
 *   - `effect.data.patronTaint === true` (flag alongside another primary
 *     type, e.g. for compound outcomes like "Lost, failure, and patron
 *     taint" where the entry's primary type may be `lost`)
 */
export function effectTriggersTaint(effect) {
    if (!effect)
        return false;
    if (effect.type === "patron-taint")
        return true;
    return effect.data?.["patronTaint"] === true;
}
/**
 * Roll the per-cast creeping-chance check. Does NOT apply the acquisition
 * consequences (chance reset, manifestation roll) — that is the orchestrator's
 * job, because acquisition may also come from the result-table path and the
 * two must be merged.
 *
 * @param currentChance - integer percent (1-100); values below 1 are clamped to 1.
 * @param options - roll options; honors `options.roller` for deterministic tests.
 */
export function rollPatronTaintChanceCheck(currentChance, options = {}) {
    const chance = Math.max(1, Math.floor(currentChance));
    const roll = options.roller ? options.roller("1d100") : defaultRoller(100);
    return { roll, acquired: roll <= chance };
}
/**
 * Apply patron-taint acquisition consequences. Rolls the manifestation table
 * when provided, fires the `onPatronTaint` event, and returns the manifestation
 * result (if any) so the orchestrator can attach it to the spell result.
 *
 * Intentionally does NOT mutate `patronTaintChance`; the orchestrator computes
 * `newPatronTaintChance` from merged trigger state (reset-to-1 on acquisition).
 */
export function applyPatronTaintAcquisition(patronId, taintTable, options, events, result) {
    if (!taintTable) {
        // No manifestation table authored — fire the event with a minimal result
        // so UI layers can still render a "taint acquired" notice.
        const minimal = {
            roll: 0,
            patronId,
            description: `Patron taint from ${patronId}`,
        };
        events?.onPatronTaint?.(result, minimal);
        return undefined;
    }
    const taintResult = rollPatronTaint(patronId, taintTable, options);
    events?.onPatronTaint?.(result, taintResult);
    return taintResult;
}
//# sourceMappingURL=patron-taint-check.js.map