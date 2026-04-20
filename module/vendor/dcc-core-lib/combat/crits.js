/**
 * Critical Hit System
 *
 * Handles critical hit roll calculations including:
 * - Crit die rolling
 * - Crit table determination
 * - Luck modifier application
 * - Level-based crit bonuses
 */
import { computeBonuses } from "../types/bonuses.js";
import { evaluateRoll } from "../dice/roll.js";
import { getCriticalHitData } from "../data/classes/progression-utils.js";
// =============================================================================
// Crit Die / Table Resolution
// =============================================================================
//
// Per-class crit die and crit table progressions are rulebook data and live in
// the companion `dcc-official-data` package. At runtime, callers register that
// data via `registerClassProgression()`; the lookups below read from the
// registry via `getCriticalHitData()`.
//
// If no progression is registered for a class (e.g., homebrew class, or tests
// that skip registration), the lookups fall back to defaults.
/**
 * Default crit die when no class progression is registered
 */
export const DEFAULT_CRIT_DIE = "d8";
const VALID_CRIT_TABLES = ["I", "II", "III", "IV", "V"];
function asCritTableId(raw) {
    const upper = raw.toUpperCase();
    return VALID_CRIT_TABLES.includes(upper)
        ? upper
        : "I";
}
/**
 * Get the crit table for a class at a level. Crit tables can vary by level
 * (e.g., warriors use III at L1-2, IV at L3-4, V at L5+), so prefer passing
 * the character's current level. If omitted, defaults to level 1.
 *
 * @param classId - Class identifier
 * @param level - Character level (default 1)
 * @returns Crit table ID
 */
export function getCritTable(classId, level = 1) {
    const data = getCriticalHitData(classId, level);
    return asCritTableId(data.table);
}
/**
 * Get crit die for a class at a level. Reads from the registered class
 * progression data (see `registerClassProgression`). Returns the `DEFAULT_CRIT_DIE`
 * when no progression is registered for the class.
 *
 * @param classId - Class identifier
 * @param level - Character level
 * @returns Crit die formula (e.g., "d12", "2d20", "d30+2")
 */
export function getCritDie(classId, level) {
    const data = getCriticalHitData(classId, level);
    // The registry stores formulas as "1d12" / "2d20" / "1d30+2". Callers here
    // historically expect bare dice where possible ("d12"), so strip a single
    // leading "1d" → "d" but leave multi-dice / mod formulas alone.
    if (/^1d\d+$/.test(data.die)) {
        return data.die.slice(1);
    }
    return data.die;
}
// =============================================================================
// Critical Hit Functions
// =============================================================================
/**
 * Roll a critical hit
 *
 * @param input - Critical hit input parameters
 * @param roller - Optional custom dice roller
 * @param events - Optional event callbacks
 * @returns Critical hit result
 *
 * @example
 * // Warrior critical hit
 * const result = rollCritical({
 *   critTable: "III",
 *   critDie: "d14",
 *   luckModifier: 2,
 *   level: 3,
 * });
 *
 * @example
 * // Thief critical hit
 * const result = rollCritical({
 *   critTable: "II",
 *   critDie: "d12",
 *   luckModifier: -1,
 * });
 */
export function rollCritical(input, roller, events) {
    // Normalise the crit die to a full formula. Bare dice like "d12" get a
    // leading "1"; multi-dice and dice+mod formulas ("2d20", "d30+2") pass
    // through unchanged.
    const formula = /^\d/.test(input.critDie) ? input.critDie : `1${input.critDie}`;
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    const roll = evaluateRoll(formula, rollOptions);
    // Calculate modifiers
    const modifiers = [];
    let total = roll.natural ?? 0;
    // Add luck modifier
    if (input.luckModifier !== 0) {
        modifiers.push({ source: "Luck", value: input.luckModifier });
        total += input.luckModifier;
    }
    // Some classes add level to crit rolls (warriors typically don't,
    // but it can be added via the level field if desired)
    if (input.level !== undefined && input.level > 0) {
        modifiers.push({ source: "level", value: input.level });
        total += input.level;
    }
    // Compute additional bonuses
    if (input.bonuses !== undefined && input.bonuses.length > 0) {
        const computed = computeBonuses(input.bonuses);
        if (computed.totalModifier !== 0) {
            modifiers.push({ source: "bonuses", value: computed.totalModifier });
            total += computed.totalModifier;
        }
    }
    // Minimum crit roll is 1
    total = Math.max(1, total);
    const result = {
        roll: {
            ...roll,
            modifiers,
        },
        total,
        critTable: input.critTable,
    };
    events?.onCriticalResult?.(result);
    return result;
}
/**
 * Calculate total crit modifier
 *
 * @param luckModifier - Luck modifier
 * @param level - Character level (if applicable)
 * @param bonuses - Additional bonuses
 * @returns Total crit roll modifier
 */
export function calculateCritModifier(luckModifier, level, bonuses = []) {
    let total = luckModifier;
    if (level !== undefined) {
        total += level;
    }
    const computed = computeBonuses(bonuses);
    total += computed.totalModifier;
    return total;
}
/**
 * Determine which crit table to use based on class and weapon
 *
 * @param classId - Character's class
 * @param weaponCritTable - Optional weapon-specific crit table override
 * @returns Crit table ID
 */
export function determineCritTable(classId, weaponCritTable) {
    // Weapon can override class crit table
    if (weaponCritTable !== undefined) {
        return weaponCritTable;
    }
    return getCritTable(classId);
}
/**
 * Build crit formula string for display
 *
 * @param critDie - Crit die type
 * @param luckModifier - Luck modifier
 * @param level - Optional level modifier
 * @returns Formatted crit formula
 */
export function buildCritFormula(critDie, luckModifier, level) {
    // Normalise bare dice ("d12") to "1d12"; leave formulas like "2d20" or
    // "d30+2" intact so we don't produce strings like "12d20".
    let formula = /^\d/.test(critDie) ? critDie : `1${critDie}`;
    const totalMod = luckModifier + (level ?? 0);
    if (totalMod > 0) {
        formula += `+${String(totalMod)}`;
    }
    else if (totalMod < 0) {
        formula += String(totalMod);
    }
    return formula;
}
/**
 * Parse crit table result into extra damage
 *
 * This is a utility function for parsing crit table entries.
 * In practice, crit tables vary widely, so this just handles
 * common patterns like "+1d6 damage" or "+2 damage".
 *
 * @param tableResultText - Text from crit table lookup
 * @returns Parsed extra damage info, or undefined if not applicable
 */
export function parseCritExtraDamage(tableResultText) {
    // Match patterns like "+1d6" or "+2d8"
    const diceMatch = /\+(\d+d\d+)/i.exec(tableResultText);
    if (diceMatch?.[1]) {
        return { dice: diceMatch[1] };
    }
    // Match patterns like "+3 damage" or "+2"
    const modMatch = /\+(\d+)(?:\s+damage)?/i.exec(tableResultText);
    if (modMatch?.[1]) {
        return { modifier: parseInt(modMatch[1], 10) };
    }
    return undefined;
}
//# sourceMappingURL=crits.js.map