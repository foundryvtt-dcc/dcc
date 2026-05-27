/**
 * Spellburn Module
 *
 * Pure functions for wizard/elf spellburn mechanics.
 * Spellburn allows casters to temporarily sacrifice physical ability
 * scores for bonuses to spell checks.
 */
import { totalSpellburn } from "../types/spells.js";
/**
 * Validate that a spellburn commitment is possible given current ability scores.
 *
 * Rules:
 * - Cannot burn more than current score minus 1 (can't go below 1)
 * - Can only burn from STR, AGL, STA
 * - Total burn must be positive to have any effect
 */
export function validateSpellburn(abilities, commitment) {
    const errors = [];
    const warnings = [];
    // Check each ability
    const checks = [
        { ability: "str", burn: commitment.str, name: "Strength" },
        { ability: "agl", burn: commitment.agl, name: "Agility" },
        { ability: "sta", burn: commitment.sta, name: "Stamina" },
    ];
    for (const { ability, burn, name } of checks) {
        if (burn < 0) {
            errors.push(`Cannot burn negative ${name}`);
            continue;
        }
        if (burn === 0) {
            continue;
        }
        const current = abilities[ability].current;
        const maxBurn = current - 1; // Can't go below 1
        if (burn > maxBurn) {
            errors.push(`Cannot burn ${String(burn)} ${name} (current: ${String(current)}, max burn: ${String(maxBurn)})`);
        }
        // Warn if burning to dangerous levels
        if (current - burn <= 3) {
            warnings.push(`Burning ${String(burn)} ${name} will reduce it to ${String(current - burn)}`);
        }
    }
    // Check total
    const total = totalSpellburn(commitment);
    if (total === 0 && (commitment.str > 0 || commitment.agl > 0 || commitment.sta > 0)) {
        // This shouldn't happen, but just in case
        errors.push("Invalid spellburn commitment");
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
/**
 * Get the maximum spellburn possible for each ability
 */
export function getMaxSpellburn(abilities) {
    return {
        str: Math.max(0, abilities.str.current - 1),
        agl: Math.max(0, abilities.agl.current - 1),
        sta: Math.max(0, abilities.sta.current - 1),
    };
}
/**
 * Get total maximum spellburn across all abilities
 */
export function getTotalMaxSpellburn(abilities) {
    const max = getMaxSpellburn(abilities);
    return max.str + max.agl + max.sta;
}
// =============================================================================
// Spellburn Application
// =============================================================================
/**
 * Apply spellburn to ability scores.
 * Returns new ability scores with reduced current values.
 *
 * Note: This function does NOT validate - call validateSpellburn first.
 */
export function applySpellburn(abilities, commitment) {
    return {
        str: applyBurnToAbility(abilities.str, commitment.str),
        agl: applyBurnToAbility(abilities.agl, commitment.agl),
        sta: applyBurnToAbility(abilities.sta, commitment.sta),
        per: { ...abilities.per },
        int: { ...abilities.int },
        lck: { ...abilities.lck },
    };
}
/**
 * Apply burn to a single ability score
 */
function applyBurnToAbility(ability, burn) {
    if (burn === 0) {
        return { ...ability };
    }
    return {
        current: Math.max(1, ability.current - burn),
        max: ability.max,
    };
}
// =============================================================================
// Spellburn Recovery
// =============================================================================
/**
 * Recover spellburn damage (1 point per day per ability).
 * Returns new ability scores with recovered values.
 */
export function recoverSpellburn(abilities, pointsPerAbility = 1) {
    return {
        str: recoverAbility(abilities.str, pointsPerAbility),
        agl: recoverAbility(abilities.agl, pointsPerAbility),
        sta: recoverAbility(abilities.sta, pointsPerAbility),
        per: { ...abilities.per },
        int: { ...abilities.int },
        lck: { ...abilities.lck },
    };
}
/**
 * Recover a single ability score
 */
function recoverAbility(ability, points) {
    if (ability.current >= ability.max) {
        return { ...ability };
    }
    return {
        current: Math.min(ability.max, ability.current + points),
        max: ability.max,
    };
}
/**
 * Fully recover all spellburn damage.
 * Restores all physical abilities to their max values.
 */
export function fullyRecoverSpellburn(abilities) {
    return {
        str: { current: abilities.str.max, max: abilities.str.max },
        agl: { current: abilities.agl.max, max: abilities.agl.max },
        sta: { current: abilities.sta.max, max: abilities.sta.max },
        per: { ...abilities.per },
        int: { ...abilities.int },
        lck: { ...abilities.lck },
    };
}
/**
 * Get the current spellburn damage (difference between max and current).
 */
export function getSpellburnDamage(abilities) {
    return {
        str: Math.max(0, abilities.str.max - abilities.str.current),
        agl: Math.max(0, abilities.agl.max - abilities.agl.current),
        sta: Math.max(0, abilities.sta.max - abilities.sta.current),
    };
}
/**
 * Check if any spellburn damage remains
 */
export function hasSpellburnDamage(abilities) {
    return (abilities.str.current < abilities.str.max ||
        abilities.agl.current < abilities.agl.max ||
        abilities.sta.current < abilities.sta.max);
}
//# sourceMappingURL=spellburn.js.map