/**
 * Roll formula parsing and evaluation
 *
 * Handles dice roll formulas like "1d20+5", supporting:
 * - Formula-only mode (returns formula without rolling)
 * - Built-in random roller
 * - Custom roller injection (for FoundryVTT, testing, etc.)
 */
/**
 * Default random number generator for dice
 * Returns a random integer from 1 to faces (inclusive)
 */
function defaultRoller(faces) {
    return Math.floor(Math.random() * faces) + 1;
}
/**
 * Roll multiple dice and sum them
 */
function rollDice(count, faces, roller) {
    if (roller) {
        // Custom roller handles the full expression
        const total = roller(`${String(count)}d${String(faces)}`);
        return { total, rolls: [total] }; // Can't get individual rolls from custom roller
    }
    const rolls = [];
    let total = 0;
    for (let i = 0; i < count; i++) {
        const roll = defaultRoller(faces);
        rolls.push(roll);
        total += roll;
    }
    return { total, rolls };
}
/**
 * Ensure a modifier string has a + prefix if positive
 *
 * @param value - The value to format
 * @param includeZero - If true, returns "+0" for zero; if false, returns ""
 * @returns Formatted string with + prefix for non-negative values
 *
 * @example
 * ensurePlus("5") // "+5"
 * ensurePlus("-3") // "-3"
 * ensurePlus("0") // "+0"
 * ensurePlus("0", false) // ""
 * ensurePlus("d6") // "+d6"
 */
export function ensurePlus(value, includeZero = true) {
    const numValue = parseInt(value, 10);
    if (!includeZero && numValue === 0) {
        return "";
    }
    // Already has a sign
    if (value.startsWith("+") || value.startsWith("-")) {
        return value;
    }
    // Dice expressions get a +
    if (value.startsWith("d")) {
        return `+${value}`;
    }
    // Positive numbers get a +
    if (numValue >= 0) {
        return `+${value}`;
    }
    return value;
}
/**
 * Extract the first die expression from a formula
 *
 * @param formula - Roll formula like "1d20+5+1d6"
 * @returns First die expression (e.g., "1d20") or empty string
 */
export function getFirstDie(formula) {
    if (!formula) {
        return "";
    }
    const match = /\d{1,2}d\d{1,2}/.exec(formula);
    return match?.[0] ?? "";
}
/**
 * Extract the first numeric modifier from a formula
 *
 * @param formula - Roll formula like "1d20+5-2"
 * @returns First modifier (e.g., "+5") or empty string
 */
export function getFirstMod(formula) {
    if (!formula) {
        return "";
    }
    const match = /[+-]\d{1,2}/.exec(formula);
    return match?.[0] ?? "";
}
/**
 * Build a roll formula from components
 *
 * @param die - Base die (e.g., "d20")
 * @param count - Number of dice
 * @param modifiers - Array of modifiers to add
 * @returns Complete formula string
 */
export function buildFormula(die, count, modifiers) {
    let formula = `${String(count)}${die}`;
    for (const mod of modifiers) {
        if (mod.value !== 0) {
            formula += ensurePlus(String(mod.value));
        }
    }
    return formula;
}
export function parseFormula(formula) {
    const original = formula;
    const normalized = formula.replace(/\s+/g, "");
    // Find all dice expressions
    const diceMatches = [...normalized.matchAll(/(\d+)d(\d+)/g)];
    const allDice = [];
    for (const match of diceMatches) {
        const count = match[1];
        const faces = match[2];
        if (count !== undefined && faces !== undefined) {
            allDice.push({
                count: parseInt(count, 10),
                faces: parseInt(faces, 10),
                suffix: "",
                original: match[0],
            });
        }
    }
    // Find all numeric modifiers (not part of dice)
    // Remove dice expressions first, then find remaining numbers
    let withoutDice = normalized;
    for (const d of allDice) {
        withoutDice = withoutDice.replace(d.original, "");
    }
    const modifierMatches = [...withoutDice.matchAll(/([+-]?\d+)/g)];
    const modifierValues = [];
    for (const match of modifierMatches) {
        const val = match[1];
        if (val !== undefined) {
            modifierValues.push(parseInt(val, 10));
        }
    }
    const totalModifier = modifierValues.reduce((sum, v) => sum + v, 0);
    return {
        dice: allDice[0] ?? null,
        totalModifier,
        modifierValues,
        additionalDice: allDice.slice(1),
        original,
        normalized,
    };
}
/**
 * Evaluate a roll formula
 *
 * @param formula - The roll formula (e.g., "1d20+5")
 * @param options - Roll options (mode, custom roller)
 * @returns Roll result
 */
export function evaluateRoll(formula, options = {}) {
    const parsed = parseFormula(formula);
    const mode = options.mode ?? "formula";
    // Build modifiers list
    const modifiers = [];
    if (parsed.totalModifier !== 0) {
        modifiers.push({
            source: "formula",
            value: parsed.totalModifier,
        });
    }
    // Determine die info
    const diceInfo = parsed.dice ?? { count: 0, faces: 20 };
    const die = `d${String(diceInfo.faces)}`;
    const diceCount = diceInfo.count;
    // Base result
    const result = {
        formula: parsed.normalized,
        modifiers,
        die,
        diceCount,
    };
    // If evaluate mode, actually roll
    if (mode === "evaluate") {
        let total = 0;
        let natural = 0;
        // Roll primary dice
        if (diceCount > 0) {
            const diceResult = rollDice(diceCount, diceInfo.faces, options.roller);
            natural = diceResult.total;
            total = natural;
        }
        // Roll additional dice
        for (const addDice of parsed.additionalDice) {
            const addResult = rollDice(addDice.count, addDice.faces, options.roller);
            total += addResult.total;
        }
        // Add modifiers
        total += parsed.totalModifier;
        result.natural = natural;
        result.total = total;
    }
    return result;
}
/**
 * Create a roll with modifiers
 *
 * This is a higher-level function that builds a formula from
 * components and optionally evaluates it.
 *
 * @param die - The die to roll
 * @param modifiers - Modifiers to apply
 * @param options - Roll options
 * @returns Roll result
 */
export function createRoll(die, modifiers, options = {}) {
    const formula = buildFormula(die, 1, modifiers);
    const result = evaluateRoll(formula, options);
    // Override modifiers with the detailed breakdown
    result.modifiers = modifiers.filter((m) => m.value !== 0);
    return result;
}
/**
 * Roll a simple die
 *
 * Convenience function for quick single-die rolls.
 *
 * @param die - Die type (e.g., "d20")
 * @param modifier - Optional flat modifier
 * @param options - Roll options
 * @returns Roll result
 */
export function rollSimple(die, modifier = 0, options = {}) {
    const modifiers = modifier !== 0 ? [{ source: "modifier", value: modifier }] : [];
    return createRoll(die, modifiers, { ...options, mode: "evaluate" });
}
/**
 * Check if a roll is a natural 20 (or max on the die)
 */
export function isNatural20(result) {
    if (result.natural === undefined) {
        return false;
    }
    const faces = parseInt(result.die.slice(1), 10);
    return result.natural === faces;
}
/**
 * Check if a roll is a natural 1
 */
export function isNatural1(result) {
    return result.natural === 1;
}
/**
 * Adjust threat range for dice larger than d20
 *
 * A threat range represents "top N values of the die". For example:
 * - Threat range 20 on d20 = only 20 (top 1 value)
 * - Threat range 19 on d20 = 19-20 (top 2 values)
 * - Threat range 19 on d24 = 23-24 (top 2 values)
 *
 * Formula: adjustedRange = dieFaces - (20 - threatRange)
 *
 * @param threatRange - Base threat range (designed for d20)
 * @param dieFaces - Number of faces on the die being rolled
 * @returns Adjusted threat range for the die
 */
export function adjustThreatRange(threatRange, dieFaces) {
    // How many values from the top constitute a threat?
    // For d20 with threat 19, that's 20 - 19 + 1 = 2 values (19 and 20)
    // For d24, we want the same count: 24 - 1 = 23 (23 and 24)
    const adjustedRange = dieFaces - (20 - threatRange);
    // Ensure minimum of 1 (can't threaten on less than the max)
    return Math.max(1, adjustedRange);
}
/**
 * Check if a roll meets or exceeds a threat range
 *
 * For dice larger than d20, the threat range is adjusted to preserve
 * the same "top N values" relationship. For example, a threat range
 * of 19-20 on d20 becomes 23-24 on d24.
 *
 * @param result - The roll result
 * @param threatRange - Minimum natural roll for threat (e.g., 19 for 19-20 on d20)
 * @returns True if natural roll meets the adjusted threat range
 */
export function meetsThreatRange(result, threatRange) {
    if (result.natural === undefined) {
        return false;
    }
    const faces = parseInt(result.die.slice(1), 10);
    const adjustedRange = adjustThreatRange(threatRange, faces);
    return result.natural >= adjustedRange;
}
/**
 * Check if a roll is an automatic hit (natural max on the die)
 *
 * Only a natural 20 on d20 (or the maximum value on larger dice)
 * is an automatic hit. This is distinct from threat range - a warrior
 * with 19-20 threat range rolling a 19 does NOT auto-hit.
 *
 * @param result - The roll result
 * @returns True if natural roll equals the die's maximum value
 */
export function isAutoHit(result) {
    if (result.natural === undefined) {
        return false;
    }
    const faces = parseInt(result.die.slice(1), 10);
    return result.natural === faces;
}
//# sourceMappingURL=roll.js.map