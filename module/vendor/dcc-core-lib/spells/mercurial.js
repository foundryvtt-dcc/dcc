/**
 * Mercurial Magic Module
 *
 * Pure functions for wizard mercurial magic mechanics.
 * Mercurial magic is rolled once when a wizard learns a spell,
 * creating a permanent unique effect for that character's casting of that spell.
 */
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
 * Roll for mercurial magic effect.
 *
 * In DCC, mercurial magic is rolled on d100 + (Luck modifier × 10).
 * This creates a range roughly from -20 to 130+.
 *
 * @param luckModifier - Character's luck modifier
 * @param table - Mercurial magic table to look up the result
 * @param options - Roll options
 * @returns The mercurial effect
 */
export function rollMercurialMagic(luckModifier, table, options = {}) {
    // Roll d100
    let baseRoll;
    if (options.roller) {
        baseRoll = options.roller("1d100");
    }
    else {
        baseRoll = defaultRoller(100);
    }
    // Apply luck modifier (×10)
    const roll = baseRoll + luckModifier * 10;
    // Look up result
    return lookupMercurialEffect(roll, table);
}
/**
 * Look up a mercurial effect by roll value.
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
    return result;
}
// =============================================================================
// Mercurial Effect Application
// =============================================================================
/**
 * Check if a mercurial effect should trigger based on the spell check result.
 *
 * @param effect - The mercurial effect to check
 * @param natural - The natural roll on the spell check
 * @param success - Whether the spell check succeeded
 * @returns True if the effect should trigger
 */
export function shouldMercurialTrigger(effect, natural, success) {
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
 */
export function getMercurialModifier(effect) {
    return effect.effect?.modifier ?? 0;
}
/**
 * Get the dice modifier from a mercurial effect (e.g., "+1d4").
 * Returns undefined if the effect doesn't provide a dice modifier.
 */
export function getMercurialDiceModifier(effect) {
    return effect.effect?.dice;
}
/**
 * Get the duration adjustment from a mercurial effect.
 * Returns undefined if the effect doesn't modify duration.
 */
export function getMercurialDuration(effect) {
    return effect.effect?.duration;
}
/**
 * Get custom data from a mercurial effect.
 * Returns undefined if no custom data exists.
 */
export function getMercurialData(effect) {
    return effect.effect?.data;
}
/**
 * Classify a mercurial effect as beneficial, detrimental, neutral, or mixed.
 */
export function classifyMercurialEffect(effect) {
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
 */
export function summarizeMercurialEffect(effect) {
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
//# sourceMappingURL=mercurial.js.map