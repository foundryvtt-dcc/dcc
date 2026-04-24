/**
 * Spell Fumble Module
 *
 * Pure functions for handling spell fumbles (natural 1 on spell checks).
 * Spell fumbles can result in misfires, corruption, or patron taint.
 */
import { lookupSimple } from "../tables/lookup.js";
// =============================================================================
// Fumble Rolling
// =============================================================================
/**
 * Default random number generator
 */
function defaultRoller(faces) {
    return Math.floor(Math.random() * faces) + 1;
}
/**
 * Roll on the spell fumble table.
 *
 * In DCC, spell fumbles are typically rolled on 1d4 modified by:
 * - Spell level (higher level = worse fumbles)
 *
 * @param spellLevel - Level of the spell that fumbled
 * @param fumbleTable - Table to look up the result
 * @param options - Roll options
 * @returns The fumble result
 */
export function rollSpellFumble(spellLevel, fumbleTable, options = {}) {
    // Roll 1d4
    let baseRoll;
    if (options.roller) {
        baseRoll = options.roller("1d4");
    }
    else {
        baseRoll = defaultRoller(4);
    }
    // Add spell level to determine severity
    // Higher level spells have worse fumble effects
    const roll = baseRoll + (spellLevel - 1);
    // Look up result
    const tableResult = lookupSimple(fumbleTable, roll);
    // Parse effect flags from the table result
    const effect = tableResult?.effect;
    const misfire = effect?.type === "misfire" || effect?.data?.["misfire"] === true;
    const corruption = effect?.type === "corruption" || effect?.data?.["corruption"] === true;
    const patronTaint = effect?.type === "patron-taint" || effect?.data?.["patronTaint"] === true;
    const result = {
        roll,
        description: tableResult?.text ?? `Spell fumble (roll ${String(roll)})`,
        misfire,
        corruption,
        patronTaint,
    };
    if (tableResult?.effect) {
        result.effect = tableResult.effect;
    }
    return result;
}
/**
 * Roll spell fumble with a modifier (e.g., from luck or other sources).
 */
export function rollSpellFumbleWithModifier(spellLevel, modifier, fumbleTable, options = {}) {
    // Roll 1d4
    let baseRoll;
    if (options.roller) {
        baseRoll = options.roller("1d4");
    }
    else {
        baseRoll = defaultRoller(4);
    }
    // Apply modifiers (luck can reduce fumble severity)
    const roll = Math.max(1, baseRoll + (spellLevel - 1) + modifier);
    // Look up result
    const tableResult = lookupSimple(fumbleTable, roll);
    // Parse effect flags
    const effect = tableResult?.effect;
    const misfire = effect?.type === "misfire" || effect?.data?.["misfire"] === true;
    const corruption = effect?.type === "corruption" || effect?.data?.["corruption"] === true;
    const patronTaint = effect?.type === "patron-taint" || effect?.data?.["patronTaint"] === true;
    const result = {
        roll,
        description: tableResult?.text ?? `Spell fumble (roll ${String(roll)})`,
        misfire,
        corruption,
        patronTaint,
    };
    if (tableResult?.effect) {
        result.effect = tableResult.effect;
    }
    return result;
}
/**
 * Determine fumble severity from the roll.
 */
export function getFumbleSeverity(roll) {
    if (roll <= 2)
        return "minor";
    if (roll <= 4)
        return "moderate";
    if (roll <= 6)
        return "major";
    return "catastrophic";
}
/**
 * Calculate expected fumble range for a spell level.
 */
export function getExpectedFumbleRange(spellLevel) {
    const min = 1 + (spellLevel - 1); // Roll of 1 + level modifier
    const max = 4 + (spellLevel - 1); // Roll of 4 + level modifier
    const avg = Math.floor((min + max) / 2);
    return {
        min,
        max,
        averageSeverity: getFumbleSeverity(avg),
    };
}
// =============================================================================
// Fumble Determination
// =============================================================================
/**
 * Check if a natural roll is a fumble.
 * Fumbles occur on natural 1 for spell checks.
 */
export function isSpellFumble(natural) {
    return natural === 1;
}
/**
 * Check if a fumble result requires a corruption roll.
 */
export function fumbleRequiresCorruption(fumbleResult, profile) {
    // Must use corruption (wizards/elves)
    if (!profile.usesCorruption) {
        return false;
    }
    return fumbleResult.corruption;
}
/**
 * Determine misfire type from fumble result.
 * This is a helper for systems that want to parse misfire effects.
 */
export function parseMisfireType(fumbleResult) {
    if (!fumbleResult.misfire) {
        return undefined;
    }
    const effect = fumbleResult.effect;
    const misfireType = effect?.data?.["misfireType"];
    // Determine the type, defaulting to "other" if not valid
    let type = "other";
    if (misfireType === "target-change" ||
        misfireType === "effect-reverse" ||
        misfireType === "random-effect" ||
        misfireType === "backfire" ||
        misfireType === "other") {
        type = misfireType;
    }
    const result = {
        description: fumbleResult.description,
        type,
    };
    if (effect?.data) {
        result.data = effect.data;
    }
    return result;
}
// =============================================================================
// Cleric Spell Failure (Different from Wizard Fumble)
// =============================================================================
/**
 * Cleric natural 1 handling is different - it's disapproval, not fumble.
 * This function documents the distinction.
 */
export function isClericSpellFailure(natural, profile) {
    if (profile.type !== "cleric") {
        return false;
    }
    // Clerics don't "fumble" - they incur disapproval
    return natural === 1;
}
/**
 * Get the appropriate failure type for a caster.
 */
export function getFailureType(natural, profile) {
    if (natural !== 1) {
        return "none";
    }
    if (profile.type === "cleric") {
        return "disapproval";
    }
    return "fumble";
}
//# sourceMappingURL=fumble.js.map