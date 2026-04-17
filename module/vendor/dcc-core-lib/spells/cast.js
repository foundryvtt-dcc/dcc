/**
 * Spell Casting Core
 *
 * Pure functions for casting spells and determining results.
 * Handles spell checks, result determination, and integration
 * with the table lookup system.
 */
import { totalSpellburn } from "../types/spells.js";
import { buildFormula, evaluateRoll } from "../dice/roll.js";
import { lookupTiered, determineTier } from "../tables/lookup.js";
// =============================================================================
// Spell Check Modifier Building
// =============================================================================
/**
 * Build the modifier list for a spell check.
 * Combines ability modifier, caster level, luck burn, spellburn, and situational modifiers.
 */
export function buildSpellCheckModifiers(input) {
    const modifiers = [];
    // Ability modifier
    if (input.abilityModifier !== 0) {
        const abilityName = getAbilityDisplayName(input.casterProfile.spellCheckAbility);
        modifiers.push({
            source: input.casterProfile.spellCheckAbility,
            value: input.abilityModifier,
            label: abilityName,
        });
    }
    // Caster level
    if (input.casterLevel > 0) {
        modifiers.push({
            source: "level",
            value: input.casterLevel,
            label: `Caster Level ${String(input.casterLevel)}`,
        });
    }
    // Luck burn
    if (input.luckBurn && input.luckBurn > 0) {
        const multiplier = input.luckMultiplier ?? 1;
        const luckValue = input.luckBurn * multiplier;
        modifiers.push({
            source: "luck",
            value: luckValue,
            label: multiplier === 1
                ? `Luck (${String(input.luckBurn)} burned)`
                : `Luck (${String(input.luckBurn)} × ${String(multiplier)})`,
        });
    }
    // Spellburn
    if (input.spellburn && input.casterProfile.canSpellburn) {
        const burnTotal = totalSpellburn(input.spellburn);
        if (burnTotal > 0) {
            modifiers.push({
                source: "spellburn",
                value: burnTotal,
                label: `Spellburn (${String(burnTotal)})`,
            });
        }
    }
    // Situational modifiers
    if (input.situationalModifiers) {
        for (const mod of input.situationalModifiers) {
            modifiers.push(mod);
        }
    }
    return modifiers;
}
/**
 * Get display name for an ability
 */
function getAbilityDisplayName(abilityId) {
    const names = {
        str: "Strength",
        agl: "Agility",
        sta: "Stamina",
        per: "Personality",
        int: "Intelligence",
        lck: "Luck",
    };
    return names[abilityId] ?? abilityId.toUpperCase();
}
// =============================================================================
// Spell Result Determination
// =============================================================================
/**
 * Find a spell result entry from inline results
 */
export function findInlineResult(results, roll) {
    for (const entry of results) {
        const max = entry.max ?? entry.min;
        if (roll >= entry.min && roll <= max) {
            return entry;
        }
    }
    return undefined;
}
/**
 * Determine the spell result from a check total.
 * Uses inline results if available, otherwise falls back to table lookup.
 */
export function determineSpellResult(total, spell, resultTable) {
    // Try inline results first
    if (spell.results && spell.results.length > 0) {
        const entry = findInlineResult(spell.results, total);
        if (entry) {
            return {
                tier: entry.tier,
                entry,
                text: entry.text,
            };
        }
    }
    // Fall back to table lookup
    if (resultTable) {
        const result = lookupTiered(resultTable, total);
        if (result) {
            return {
                tier: result.tier,
                entry: result.entry,
                text: result.text,
            };
        }
        // If no exact entry, try to at least determine tier
        const tier = determineTier(resultTable, total);
        if (tier) {
            return { tier };
        }
    }
    // Default tiers based on DCC spell check conventions
    if (total <= 1) {
        return { tier: "lost" };
    }
    if (total <= 11) {
        return { tier: "failure" };
    }
    if (total <= 13) {
        return { tier: "success-minor" };
    }
    if (total <= 17) {
        return { tier: "success" };
    }
    if (total <= 23) {
        return { tier: "success-major" };
    }
    return { tier: "success-critical" };
}
/**
 * Check if a result indicates the spell is lost
 */
export function isSpellLostResult(entry, tier) {
    // Check explicit lost flag
    if (entry && "lost" in entry && entry.lost) {
        return true;
    }
    // Lost tier always means spell is lost
    return tier === "lost";
}
/**
 * Check if a result triggers corruption
 */
export function triggersCorruption(entry, natural, profile) {
    // Must be a caster type that uses corruption
    if (!profile.usesCorruption) {
        return false;
    }
    // Check explicit corruption flag on entry
    if (entry && "corruption" in entry && entry.corruption) {
        return true;
    }
    // Natural 1 always triggers corruption check for wizards/elves
    if (natural === 1) {
        return true;
    }
    return false;
}
// =============================================================================
// Disapproval Handling
// =============================================================================
/**
 * Check if a spell check triggers disapproval (clerics only)
 */
export function checkDisapproval(natural, disapprovalRange) {
    return natural <= disapprovalRange;
}
/**
 * Calculate disapproval increase based on result
 */
export function calculateDisapprovalIncrease(natural, profile) {
    if (!profile.usesDisapproval) {
        return 0;
    }
    // Natural 1 increases disapproval range
    if (natural === 1) {
        return 1;
    }
    return 0;
}
// =============================================================================
// Main Spell Casting Function
// =============================================================================
/**
 * Cast a spell, performing the spell check and determining results.
 *
 * This is the main entry point for spell casting. It:
 * 1. Builds the modifier list
 * 2. Rolls the spell check (if mode is evaluate)
 * 3. Determines the result tier
 * 4. Handles critical/fumble detection
 * 5. Triggers events for UI integration
 *
 * Note: Corruption rolling, fumble tables, and mercurial effects
 * are handled by their respective modules - this function sets
 * the flags indicating when they should be triggered.
 */
export function castSpell(input, options = {}, events) {
    // Fire start event
    events?.onSpellCheckStart?.(input);
    // Build modifiers
    const modifiers = buildSpellCheckModifiers(input);
    // Determine die (default d20)
    const die = input.actionDie ?? "d20";
    // Build formula
    const formula = buildFormula(die, 1, modifiers);
    // Evaluate roll if needed
    const rollOptions = {
        mode: options.mode ?? "evaluate",
    };
    if (options.roller) {
        rollOptions.roller = options.roller;
    }
    const rollResult = evaluateRoll(formula, rollOptions);
    // Override natural if forced (for testing/GM)
    let natural = rollResult.natural;
    if (options.forceNatural !== undefined) {
        natural = options.forceNatural;
        // Recalculate total
        if (rollResult.total !== undefined && rollResult.natural !== undefined) {
            rollResult.total = rollResult.total - rollResult.natural + options.forceNatural;
        }
    }
    // Calculate total (natural may have been overridden)
    const total = rollResult.total;
    // Determine critical/fumble
    const critical = natural !== undefined && natural === getDieFaces(die);
    const fumble = natural !== undefined && natural === 1;
    // Determine result tier
    let tier;
    let resultText;
    let resultEntry;
    if (total !== undefined) {
        // Force tier if specified
        if (options.forceTier) {
            tier = options.forceTier;
        }
        else {
            const result = determineSpellResult(total, input.spell, input.resultTable);
            if (result) {
                tier = result.tier;
                resultText = result.text;
                resultEntry = result.entry;
            }
        }
    }
    // Determine if spell is lost
    const spellLost = tier !== undefined && isSpellLostResult(resultEntry, tier);
    // Check for corruption trigger
    const corruptionTriggered = !options.skipCorruption &&
        triggersCorruption(resultEntry, natural, input.casterProfile);
    // Calculate disapproval increase
    const disapprovalIncrease = calculateDisapprovalIncrease(natural, input.casterProfile);
    let newDisapprovalRange;
    if (input.casterProfile.usesDisapproval && input.disapprovalRange !== undefined) {
        newDisapprovalRange = input.disapprovalRange + disapprovalIncrease;
    }
    // Get manifestation from result if available
    let manifestation;
    if (resultEntry && "manifestation" in resultEntry) {
        manifestation = resultEntry.manifestation;
    }
    // Override with spellbook entry manifestation if set
    if (input.spellbookEntry.manifestation) {
        manifestation = input.spellbookEntry.manifestation;
    }
    // Build result - start with required fields
    const result = {
        spellId: input.spell.id,
        die,
        formula,
        modifiers,
        critical,
        fumble,
        spellLost,
        corruptionTriggered,
        disapprovalIncrease,
        luckBurned: input.luckBurn ?? 0,
    };
    // Add optional fields only if they have values (exactOptionalPropertyTypes)
    if (natural !== undefined) {
        result.natural = natural;
    }
    if (total !== undefined) {
        result.total = total;
    }
    if (tier !== undefined) {
        result.tier = tier;
    }
    if (resultText !== undefined) {
        result.resultText = resultText;
    }
    if (resultEntry?.effect !== undefined) {
        result.effect = resultEntry.effect;
    }
    if (newDisapprovalRange !== undefined) {
        result.newDisapprovalRange = newDisapprovalRange;
    }
    if (!options.skipMercurial && input.spellbookEntry.mercurialEffect) {
        result.mercurialEffect = input.spellbookEntry.mercurialEffect;
    }
    if (input.spellburn) {
        result.spellburnApplied = input.spellburn;
    }
    if (manifestation !== undefined) {
        result.manifestation = manifestation;
    }
    // Fire events
    events?.onSpellCheckComplete?.(result);
    if (critical) {
        events?.onCritical?.(result);
    }
    if (fumble) {
        events?.onFumble?.(result);
    }
    if (spellLost) {
        events?.onSpellLost?.(result);
    }
    if (disapprovalIncrease > 0 && newDisapprovalRange !== undefined) {
        events?.onDisapprovalIncreased?.(result, newDisapprovalRange);
    }
    if (input.spellburn && totalSpellburn(input.spellburn) > 0) {
        events?.onSpellburnApplied?.(input.spellburn);
    }
    if (!options.skipMercurial && input.spellbookEntry.mercurialEffect) {
        events?.onMercurialEffect?.(input.spellbookEntry.mercurialEffect, result);
    }
    return result;
}
/**
 * Get the number of faces on a die
 */
function getDieFaces(die) {
    return parseInt(die.slice(1), 10);
}
// =============================================================================
// Utility Functions
// =============================================================================
/**
 * Get the default caster profile for a class
 */
export function getCasterProfile(classId) {
    const profiles = {
        wizard: {
            type: "wizard",
            spellCheckAbility: "int",
            usesMercurial: true,
            usesCorruption: true,
            usesDisapproval: false,
            canSpellburn: true,
            lostSpellRecovery: "rest",
        },
        cleric: {
            type: "cleric",
            spellCheckAbility: "per",
            usesMercurial: false,
            usesCorruption: false,
            usesDisapproval: true,
            canSpellburn: false,
            lostSpellRecovery: "prayer",
        },
        elf: {
            type: "elf",
            spellCheckAbility: "int",
            usesMercurial: true,
            usesCorruption: true,
            usesDisapproval: false,
            canSpellburn: true,
            lostSpellRecovery: "rest",
        },
    };
    return profiles[classId];
}
/**
 * Check if a result is a success (any success tier)
 */
export function isSuccess(tier) {
    if (!tier)
        return false;
    return tier.startsWith("success");
}
/**
 * Check if a result is a failure (failure or lost)
 */
export function isFailure(tier) {
    if (!tier)
        return true;
    return tier === "failure" || tier === "lost";
}
/**
 * Calculate the total modifier sum from a spell check modifiers list
 */
export function getSpellCheckTotalModifier(modifiers) {
    return modifiers.reduce((sum, mod) => sum + mod.value, 0);
}
//# sourceMappingURL=cast.js.map