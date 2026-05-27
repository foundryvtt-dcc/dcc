/**
 * Invoke Patron Mechanics
 *
 * Pure functions for the Invoke Patron spell check.
 * Invoke Patron is a level 1 wizard spell that calls upon the caster's patron
 * for supernatural aid. Results are determined by a spell check against the
 * patron's unique invoke table.
 */
import { lookupTiered, lookupSimple } from "../tables/lookup.js";
import { totalSpellburn } from "../types/spells.js";
// =============================================================================
// Constants
// =============================================================================
/**
 * Minimum check result for patron to answer.
 * Below this threshold, the invocation fails.
 */
export const INVOKE_PATRON_MIN_SUCCESS = 12;
/**
 * Natural 1 always triggers patron taint on invoke.
 */
export const INVOKE_PATRON_FUMBLE_TRIGGERS_TAINT = true;
// =============================================================================
// Modifier Calculation
// =============================================================================
/**
 * Calculate all modifiers for an Invoke Patron check.
 *
 * @param input - Invoke patron input
 * @returns Array of roll modifiers
 */
export function buildInvokeModifiers(input) {
    const modifiers = [];
    // Caster level
    if (input.casterLevel > 0) {
        modifiers.push({
            source: "Caster Level",
            value: input.casterLevel,
        });
    }
    // Ability modifier (Intelligence)
    if (input.abilityModifier !== 0) {
        modifiers.push({
            source: "Intelligence",
            value: input.abilityModifier,
        });
    }
    // Luck modifier (if provided)
    if (input.luckModifier !== undefined && input.luckModifier !== 0) {
        modifiers.push({
            source: "Luck Modifier",
            value: input.luckModifier,
        });
    }
    // Luck burn
    if (input.luckBurn !== undefined && input.luckBurn > 0) {
        modifiers.push({
            source: "Luck Burn",
            value: input.luckBurn,
        });
    }
    // Spellburn
    if (input.spellburn) {
        const burn = totalSpellburn(input.spellburn);
        if (burn > 0) {
            modifiers.push({
                source: "Spellburn",
                value: burn,
            });
        }
    }
    // Situational modifiers
    if (input.situationalModifiers) {
        for (const mod of input.situationalModifiers) {
            if (mod.value !== 0) {
                modifiers.push({
                    source: mod.source,
                    value: mod.value,
                });
            }
        }
    }
    return modifiers;
}
/**
 * Sum all modifiers to get total modifier value.
 *
 * @param modifiers - Array of roll modifiers
 * @returns Total modifier value
 */
export function sumModifiers(modifiers) {
    return modifiers.reduce((sum, mod) => sum + mod.value, 0);
}
/**
 * Build the formula string for display.
 *
 * @param natural - The natural die roll
 * @param modifiers - Array of roll modifiers
 * @returns Formula string (e.g., "15 + 3 + 2 = 20")
 */
export function buildInvokeFormula(natural, modifiers) {
    const total = natural + sumModifiers(modifiers);
    const parts = [String(natural)];
    for (const mod of modifiers) {
        if (mod.value >= 0) {
            parts.push(`+${String(mod.value)}`);
        }
        else {
            parts.push(String(mod.value));
        }
    }
    return `${parts.join(" ")} = ${String(total)}`;
}
// =============================================================================
// Invoke Patron Check
// =============================================================================
/**
 * Default random number generator for d20.
 */
function defaultRoll() {
    return Math.floor(Math.random() * 20) + 1;
}
/**
 * Invoke a patron.
 *
 * This performs the Invoke Patron spell check:
 * 1. Roll d20 + modifiers
 * 2. Check for fumble (natural 1) - triggers patron taint
 * 3. Check for critical (natural 20) - enhanced result
 * 4. Look up result in patron's invoke table
 * 5. Determine if patron answers based on total
 *
 * @param input - Invoke patron input
 * @param options - Roll options (including custom roller)
 * @param events - Event callbacks
 * @returns Invoke patron result
 */
export function invokePatron(input, options = {}, events) {
    // Emit start event
    events?.onInvokeStart?.(input);
    // Build modifiers
    const modifiers = buildInvokeModifiers(input);
    const totalModifier = sumModifiers(modifiers);
    // Roll the die
    let natural;
    if (options.roller) {
        natural = options.roller("1d20");
    }
    else {
        natural = defaultRoll();
    }
    const total = natural + totalModifier;
    const formula = buildInvokeFormula(natural, modifiers);
    // Check for critical and fumble
    const critical = natural === 20;
    const fumble = natural === 1;
    // Determine if patron taint is incurred
    let taintIncurred = false;
    let taintDescription;
    // INVOKE_PATRON_FUMBLE_TRIGGERS_TAINT is always true per DCC rules
    if (fumble && input.taintTable) {
        taintIncurred = true;
        const taintResult = rollPatronTaint(input.taintTable, options);
        taintDescription = taintResult.description;
        events?.onTaintIncurred?.(input.patronId, taintDescription);
    }
    // Check result against invoke table
    let tier;
    let resultText;
    if (input.invokeTable) {
        const tableResult = lookupTiered(input.invokeTable, total);
        if (tableResult) {
            tier = tableResult.tier;
            resultText = tableResult.text;
        }
    }
    // Determine success (patron answers)
    const success = !fumble && total >= INVOKE_PATRON_MIN_SUCCESS;
    // Spell is lost on fumble
    const spellLost = fumble;
    // Build result (handle optional properties for exactOptionalPropertyTypes)
    const result = {
        patronId: input.patronId,
        natural,
        total,
        formula,
        critical,
        fumble,
        success,
        taintIncurred,
        spellLost,
        modifiers: modifiers.map((m) => ({ source: m.source, value: m.value })),
    };
    // Only add optional properties if they have values
    if (tier !== undefined) {
        result.tier = tier;
    }
    if (resultText !== undefined) {
        result.resultText = resultText;
    }
    if (taintDescription !== undefined) {
        result.taintDescription = taintDescription;
    }
    // Emit completion events
    events?.onInvokeComplete?.(result);
    if (success) {
        events?.onPatronAnswers?.(result);
    }
    else {
        events?.onPatronIgnores?.(result);
    }
    return result;
}
/**
 * Roll patron taint from the taint table.
 *
 * @param taintTable - The patron's taint table
 * @param options - Roll options
 * @returns Taint result with roll and description
 */
function rollPatronTaint(taintTable, options = {}) {
    // Taint is typically 1d6
    let roll;
    if (options.roller) {
        roll = options.roller("1d6");
    }
    else {
        roll = Math.floor(Math.random() * 6) + 1;
    }
    const result = lookupSimple(taintTable, roll);
    return {
        roll,
        description: result?.text ?? `Patron taint (roll ${String(roll)})`,
    };
}
// =============================================================================
// Result Helpers
// =============================================================================
/**
 * Check if an invoke result was successful.
 *
 * @param result - The invoke patron result
 * @returns True if patron answered
 */
export function isInvokeSuccess(result) {
    return result.success;
}
/**
 * Check if an invoke result was a fumble.
 *
 * @param result - The invoke patron result
 * @returns True if natural 1 was rolled
 */
export function isInvokeFumble(result) {
    return result.fumble;
}
/**
 * Get a summary of the invoke result for display.
 *
 * @param result - The invoke patron result
 * @returns Summary string
 */
export function getInvokeSummary(result) {
    const parts = [];
    // Roll info
    parts.push(`Roll: ${String(result.natural)} → ${String(result.total)}`);
    // Critical/Fumble
    if (result.critical) {
        parts.push("CRITICAL!");
    }
    if (result.fumble) {
        parts.push("FUMBLE!");
    }
    // Success/Failure
    if (result.success) {
        parts.push("Patron Answers!");
    }
    else {
        parts.push("Patron Ignores");
    }
    // Result tier
    if (result.tier) {
        parts.push(`Effect: ${result.tier}`);
    }
    // Taint
    if (result.taintIncurred && result.taintDescription) {
        parts.push(`Taint: ${result.taintDescription}`);
    }
    // Spell lost
    if (result.spellLost) {
        parts.push("Spell Lost");
    }
    return parts.join(" | ");
}
/**
 * Calculate the minimum check needed for a specific invoke result tier.
 * This helps players understand what they need to roll for desired effects.
 *
 * @param invokeTable - The patron's invoke table
 * @param desiredTier - The tier to achieve
 * @returns Minimum check total needed, or undefined if tier not in table
 */
export function getMinimumForInvokeTier(invokeTable, desiredTier) {
    for (const entry of invokeTable.entries) {
        if (entry.tier === desiredTier) {
            return entry.min;
        }
    }
    return undefined;
}
/**
 * Estimate the chance of success given modifiers.
 * Assumes a d20 roll.
 *
 * @param totalModifier - Total modifier to the roll
 * @param targetDC - Target DC (default INVOKE_PATRON_MIN_SUCCESS)
 * @returns Probability of success (0-1)
 */
export function estimateInvokeSuccessChance(totalModifier, targetDC = INVOKE_PATRON_MIN_SUCCESS) {
    // Need to roll (targetDC - totalModifier) or higher on d20
    // But natural 1 always fails
    const needed = targetDC - totalModifier;
    // If needed is 1 or less, success on anything but natural 1
    if (needed <= 1) {
        return 0.95; // 19/20 (natural 1 always fails)
    }
    // If needed is 21 or more, only natural 20 can succeed
    if (needed >= 21) {
        return 0.05; // 1/20 (natural 20 auto-success? DCC doesn't have this for spells)
    }
    // Normal case: success on (21 - needed) outcomes, minus natural 1
    const successOutcomes = Math.min(21 - needed, 19); // Can't count natural 1
    return Math.max(0, successOutcomes) / 20;
}
//# sourceMappingURL=invoke.js.map