/**
 * Mercurial Magic Module
 *
 * Pure functions for wizard mercurial magic mechanics.
 * Mercurial magic is rolled once when a wizard learns a spell,
 * creating a permanent unique effect for that character's casting of that spell.
 */
import { evaluateRoll } from "../dice/roll.js";
// =============================================================================
// Mercurial Magic Rolling
// =============================================================================
/**
 * Default random number generator for d100
 */
function defaultRoller(faces) {
    return Math.floor(Math.random() * faces) + 1;
}
/**
 * Maximum recursion depth when expanding `rollAgain` specials. A sub-roll
 * landing on another special entry recurses; past this depth the literal
 * (unexpanded) effect is returned instead so a pathological table cannot
 * loop forever.
 */
export const MAX_MERCURIAL_SPECIAL_DEPTH = 5;
/**
 * Hard ceiling on `special.count` — guards against malformed table data
 * requesting an absurd number of sub-rolls.
 */
const MAX_SPECIAL_COUNT = 10;
/**
 * Evaluate a dice expression via the caller's roller when provided
 * (the roller receives the full expression), or the built-in evaluator
 * otherwise — which handles flat modifiers and additional dice
 * ("1d100+20", "1d100+1d20"). An expression with no rollable dice
 * falls back to 1d100.
 */
function rollExpression(expression, options) {
    if (options.roller) {
        return options.roller(expression);
    }
    const result = evaluateRoll(expression, { mode: "evaluate" });
    if (result.total !== undefined && result.diceCount > 0) {
        return result.total;
    }
    return defaultRoller(100);
}
/**
 * Roll for mercurial magic effect.
 *
 * In DCC, mercurial magic is rolled on d100 + (Luck modifier × 10).
 * This creates a range roughly from -20 to 130+.
 *
 * When the drawn entry carries a `special` instruction (e.g. Table 5-2's
 * 99 "Roll again twice."), the special is expanded: `count` sub-rolls are
 * made with the special's `formula` (default "1d100") plus the same luck
 * modifier, and the returned effect combines the sub-effects (individually
 * available via `subEffects`). Sub-rolls landing on another special entry
 * recurse, capped at {@link MAX_MERCURIAL_SPECIAL_DEPTH}.
 *
 * @param luckModifier - Character's luck modifier
 * @param table - Mercurial magic table to look up the result
 * @param options - Roll options
 * @returns The mercurial effect
 */
export function rollMercurialMagic(luckModifier, table, options = {}) {
    return rollMercurialAtDepth(luckModifier, table, options, 0, "1d100");
}
/**
 * Internal recursive worker for {@link rollMercurialMagic}.
 */
function rollMercurialAtDepth(luckModifier, table, options, depth, formula) {
    const baseRoll = rollExpression(formula, options);
    // Apply luck modifier (×10)
    const roll = baseRoll + luckModifier * 10;
    // Look up result
    const effect = lookupMercurialEffect(roll, table);
    // Expand a special (roll-again) entry unless the recursion cap is hit
    if (effect.special && depth < MAX_MERCURIAL_SPECIAL_DEPTH) {
        return expandMercurialSpecial(effect, luckModifier, table, options, depth);
    }
    return effect;
}
/**
 * Expand a looked-up special (`rollAgain`) effect into its sub-effects.
 *
 * Useful directly for consumers that resolved an effect via
 * {@link lookupMercurialEffect} (e.g. a manual "look up value 99") and
 * want it expanded with real rolls. No-op (returns the effect unchanged)
 * when the effect carries no special or is already expanded.
 *
 * @param effect - A special-carrying effect from `lookupMercurialEffect`
 * @param luckModifier - Character's luck modifier (applied to sub-rolls)
 * @param table - The mercurial table to draw sub-effects from
 * @param options - Roll options (the roller receives the sub-roll formula)
 * @param depth - Current recursion depth (internal; defaults to 0)
 * @returns A combined effect with `subEffects` populated
 */
export function expandMercurialSpecial(effect, luckModifier, table, options = {}, depth = 0) {
    const special = effect.special;
    if (!special || effect.subEffects) {
        return effect;
    }
    const count = Math.max(1, Math.min(MAX_SPECIAL_COUNT, special.count));
    const formula = special.formula ?? "1d100";
    const subEffects = [];
    for (let i = 0; i < count; i++) {
        subEffects.push(rollMercurialAtDepth(luckModifier, table, options, depth + 1, formula));
    }
    return {
        rollValue: effect.rollValue,
        summary: subEffects.map((e) => e.summary).join("; "),
        description: subEffects
            .map((e) => `(${String(e.rollValue)}) ${e.description}`)
            .join("\n\n"),
        displayOnCast: subEffects.some((e) => e.displayOnCast),
        special: { ...special },
        subEffects,
    };
}
/**
 * Look up a mercurial effect by roll value.
 *
 * Pure lookup — a `special` entry is NOT expanded (no roller is available
 * here); its instruction is copied onto the returned effect so callers can
 * detect it (`effect.special && !effect.subEffects`) and expand via
 * {@link expandMercurialSpecial} or their own roll machinery.
 */
export function lookupMercurialEffect(roll, table) {
    // Find the entry that matches this roll
    const entry = table.entries.find((e) => roll >= e.min && roll <= e.max);
    if (!entry) {
        // Fallback for out-of-range rolls (shouldn't happen with proper tables)
        return {
            rollValue: roll,
            summary: "No special effect",
            description: `Mercurial magic roll ${String(roll)} - no special effect`,
            displayOnCast: false,
        };
    }
    const result = {
        rollValue: roll,
        summary: entry.summary,
        description: entry.description,
        displayOnCast: entry.displayOnCast,
    };
    if (entry.effect) {
        result.effect = { ...entry.effect };
    }
    if (entry.special) {
        result.special = { ...entry.special };
    }
    return result;
}
// =============================================================================
// Mercurial Effect Application
// =============================================================================
/**
 * Check if a mercurial effect should trigger based on the spell check result.
 *
 * A combined (roll-again) effect triggers when ANY of its sub-effects
 * would trigger — the sub-effects are independent effects that each
 * apply on their own terms, so callers wanting per-effect precision
 * should iterate `subEffects` and check each individually.
 *
 * @param effect - The mercurial effect to check
 * @param natural - The natural roll on the spell check
 * @param success - Whether the spell check succeeded
 * @returns True if the effect should trigger
 */
export function shouldMercurialTrigger(effect, natural, success) {
    if (effect.subEffects) {
        return effect.subEffects.some((sub) => shouldMercurialTrigger(sub, natural, success));
    }
    const trigger = effect.effect?.trigger;
    if (!trigger) {
        // No trigger specified means "always"
        return true;
    }
    switch (trigger) {
        case "always":
        case "on-cast":
            return true;
        case "on-success":
            return success;
        case "on-failure":
            return !success;
        case "on-crit":
            return natural === 20;
        case "on-fumble":
            return natural === 1;
        default:
            return true;
    }
}
/**
 * Get the spell check modifier from a mercurial effect.
 * Returns 0 if the effect doesn't provide a modifier.
 *
 * For a combined (roll-again) effect the sub-effect modifiers are
 * summed — every sub-effect applies.
 */
export function getMercurialModifier(effect) {
    const own = effect.effect?.modifier ?? 0;
    if (!effect.subEffects) {
        return own;
    }
    return effect.subEffects.reduce((sum, sub) => sum + getMercurialModifier(sub), own);
}
/**
 * Get the dice modifier from a mercurial effect (e.g., "+1d4").
 * Returns undefined if the effect doesn't provide a dice modifier.
 *
 * For a combined (roll-again) effect the sub-effect dice modifiers are
 * concatenated (e.g. "+1d4" and "+1d3" → "+1d4+1d3") — every
 * sub-effect applies.
 */
export function getMercurialDiceModifier(effect) {
    const parts = [];
    if (effect.effect?.dice) {
        parts.push(effect.effect.dice);
    }
    if (effect.subEffects) {
        for (const sub of effect.subEffects) {
            const dice = getMercurialDiceModifier(sub);
            if (dice) {
                parts.push(dice);
            }
        }
    }
    if (parts.length === 0) {
        return undefined;
    }
    return parts.join("");
}
/**
 * Get the duration adjustment from a mercurial effect.
 * Returns undefined if the effect doesn't modify duration.
 *
 * Durations don't combine — for a combined (roll-again) effect this
 * returns the FIRST sub-effect duration found; iterate `subEffects`
 * for per-effect durations.
 */
export function getMercurialDuration(effect) {
    if (effect.effect?.duration) {
        return effect.effect.duration;
    }
    if (effect.subEffects) {
        for (const sub of effect.subEffects) {
            const duration = getMercurialDuration(sub);
            if (duration) {
                return duration;
            }
        }
    }
    return undefined;
}
/**
 * Get custom data from a mercurial effect.
 * Returns undefined if no custom data exists.
 *
 * Custom data doesn't merge — for a combined (roll-again) effect this
 * returns the FIRST sub-effect data found; iterate `subEffects` for
 * per-effect data.
 */
export function getMercurialData(effect) {
    if (effect.effect?.data) {
        return effect.effect.data;
    }
    if (effect.subEffects) {
        for (const sub of effect.subEffects) {
            const data = getMercurialData(sub);
            if (data) {
                return data;
            }
        }
    }
    return undefined;
}
/**
 * Classify a mercurial effect as beneficial, detrimental, neutral, or mixed.
 *
 * A combined (roll-again) effect is classified from its sub-effects:
 * uniformly beneficial/detrimental sub-effects keep that class, any
 * disagreement (or a mixed sub-effect) is "mixed", and all-neutral
 * stays "neutral".
 */
export function classifyMercurialEffect(effect) {
    if (effect.subEffects) {
        const classes = new Set(effect.subEffects.map(classifyMercurialEffect));
        if (classes.has("mixed")) {
            return "mixed";
        }
        if (classes.has("beneficial") && classes.has("detrimental")) {
            return "mixed";
        }
        if (classes.has("beneficial")) {
            return "beneficial";
        }
        if (classes.has("detrimental")) {
            return "detrimental";
        }
        return "neutral";
    }
    const data = effect.effect;
    if (!data) {
        return "neutral";
    }
    const modifier = data.modifier ?? 0;
    // Check for clear beneficial or detrimental modifiers
    if (modifier > 0) {
        // If there's a detrimental trigger (only on failure), it might be mixed
        if (data.trigger === "on-failure" || data.trigger === "on-fumble") {
            return "mixed";
        }
        return "beneficial";
    }
    if (modifier < 0) {
        // If there's a beneficial trigger (only on success), it might be mixed
        if (data.trigger === "on-success" || data.trigger === "on-crit") {
            return "mixed";
        }
        return "detrimental";
    }
    // No numeric modifiers - check for dice modifier
    if (data.dice) {
        // Dice modifiers are typically beneficial if positive
        if (data.dice.startsWith("+")) {
            return "beneficial";
        }
        if (data.dice.startsWith("-")) {
            return "detrimental";
        }
    }
    // Duration modifications alone are typically beneficial
    if (data.duration) {
        return "beneficial";
    }
    return "neutral";
}
/**
 * Get a summary of what the mercurial effect does numerically.
 *
 * A combined (roll-again) effect summarizes each sub-effect and joins
 * them with "; ".
 */
export function summarizeMercurialEffect(effect) {
    if (effect.subEffects) {
        return effect.subEffects.map(summarizeMercurialEffect).join("; ");
    }
    const parts = [];
    const data = effect.effect;
    if (!data) {
        return effect.summary;
    }
    if (data.modifier) {
        const sign = data.modifier > 0 ? "+" : "";
        parts.push(`${sign}${String(data.modifier)} to spell check`);
    }
    if (data.dice) {
        parts.push(`${data.dice} to effect`);
    }
    if (data.duration) {
        parts.push(`Duration: ${data.duration}`);
    }
    if (data.trigger && data.trigger !== "always") {
        const triggerDesc = {
            always: "",
            "on-cast": "on cast",
            "on-success": "on success",
            "on-failure": "on failure",
            "on-crit": "on crit",
            "on-fumble": "on fumble",
        };
        parts.push(`(${triggerDesc[data.trigger]})`);
    }
    if (parts.length === 0) {
        return effect.summary;
    }
    return parts.join(", ");
}
// =============================================================================
// Mercurial Table Utilities
// =============================================================================
/**
 * Validate that a mercurial table has no gaps or overlaps.
 */
export function validateMercurialTable(table) {
    const errors = [];
    const sorted = [...table.entries].sort((a, b) => a.min - b.min);
    for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i];
        if (!entry)
            continue;
        // Check min <= max
        if (entry.min > entry.max) {
            errors.push(`Entry ${String(i)}: min (${String(entry.min)}) > max (${String(entry.max)})`);
        }
        // Check for overlaps/gaps with next entry
        const next = sorted[i + 1];
        if (next) {
            if (entry.max >= next.min) {
                errors.push(`Overlap: entry ${String(i)} (max ${String(entry.max)}) overlaps entry ${String(i + 1)} (min ${String(next.min)})`);
            }
            else if (entry.max + 1 < next.min) {
                errors.push(`Gap: between ${String(entry.max)} and ${String(next.min)}`);
            }
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
/**
 * Get the roll range covered by a mercurial table.
 */
export function getMercurialTableRange(table) {
    if (table.entries.length === 0) {
        return { min: 0, max: 0 };
    }
    const mins = table.entries.map((e) => e.min);
    const maxs = table.entries.map((e) => e.max);
    return {
        min: Math.min(...mins),
        max: Math.max(...maxs),
    };
}
/**
 * Count entries by classification.
 */
export function countMercurialByClassification(table) {
    const counts = {
        beneficial: 0,
        detrimental: 0,
        neutral: 0,
        mixed: 0,
    };
    for (const entry of table.entries) {
        const mercurialEffect = {
            rollValue: entry.min,
            summary: entry.summary,
            description: entry.description,
            displayOnCast: entry.displayOnCast,
        };
        if (entry.effect) {
            mercurialEffect.effect = entry.effect;
        }
        const classification = classifyMercurialEffect(mercurialEffect);
        counts[classification]++;
    }
    return counts;
}
// =============================================================================
// Default Mercurial Effect (for spells without one)
// =============================================================================
/**
 * Create a "no effect" mercurial result for spells that don't use mercurial magic.
 */
export function createNoMercurialEffect() {
    return {
        rollValue: 0,
        summary: "No mercurial effect",
        description: "This spell has no mercurial magic effect.",
        displayOnCast: false,
    };
}
/**
 * Check if a mercurial effect is the "no effect" placeholder.
 */
export function isMercurialEffectPlaceholder(effect) {
    return effect.rollValue === 0 && effect.summary === "No mercurial effect";
}
