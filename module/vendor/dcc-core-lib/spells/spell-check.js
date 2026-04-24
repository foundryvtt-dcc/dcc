/**
 * Spell Check Orchestration
 *
 * High-level function that orchestrates the complete spell check process:
 * 1. Builds spell check input from character state
 * 2. Performs the spell check roll
 * 3. Handles follow-up rolls (corruption, fumble, disapproval)
 * 4. Returns comprehensive result
 *
 * This is the main entry point for spell casting in applications.
 */
import { getAbilityModifier } from "../data/ability-modifiers.js";
import { castSpell, getCasterProfile } from "./cast.js";
import { findSpellEntry, markSpellLost } from "./spellbook.js";
import { rollSpellFumble, fumbleRequiresCorruption } from "./fumble.js";
import { rollCorruption, determineCorruptionTier } from "./corruption.js";
import { checkAndRollDisapproval, rollTriggersDisapproval, increaseDisapprovalRange } from "./disapproval.js";
import { applyPatronTaintAcquisition, effectTriggersTaint, isPatronCast, rollPatronTaintChanceCheck, } from "./patron-taint-check.js";
// =============================================================================
// Character State Extraction
// =============================================================================
/**
 * Get the caster level from character
 */
export function getCasterLevel(character) {
    return character.classInfo?.level ?? 0;
}
/**
 * Get the caster profile from character class
 */
export function getCasterProfileFromCharacter(character) {
    const classId = character.classInfo?.classId;
    if (!classId)
        return undefined;
    return getCasterProfile(classId);
}
/**
 * Get the spell check ability score and modifier from character
 */
export function getSpellCheckAbility(character, profile) {
    const abilityId = profile.spellCheckAbility;
    const score = character.state.abilities[abilityId].current;
    const modifier = getAbilityModifier(score);
    return { score, modifier };
}
/**
 * Get current luck from character
 */
export function getCurrentLuck(character) {
    return character.state.abilities.lck.current;
}
/**
 * Get starting luck from character identity
 */
export function getStartingLuck(character) {
    return character.identity.startingLuck;
}
/**
 * Get luck modifier multiplier from birth augur
 */
export function getLuckMultiplier(character) {
    return character.identity.birthAugur.multiplier;
}
/**
 * Get disapproval range for cleric
 */
export function getDisapprovalRange(character) {
    return character.state.classState?.cleric?.disapprovalRange ?? 1;
}
/**
 * Get patron ID for wizard/elf
 */
export function getPatronId(character) {
    return character.state.classState?.wizard?.patron ?? character.state.classState?.elf?.patron;
}
/**
 * Get spellbook entry for a spell
 */
export function getSpellbookEntry(character, spellId) {
    const spellbook = character.state.classState?.wizard?.spellbook ??
        character.state.classState?.cleric?.spellbook ??
        character.state.classState?.elf?.spellbook;
    if (!spellbook)
        return undefined;
    return findSpellEntry(spellbook, spellId);
}
// =============================================================================
// Spell Check Input Builder
// =============================================================================
/**
 * Build the full SpellCastInput from character state and simplified input
 */
export function buildSpellCastInput(character, input, profile) {
    // Get spellbook entry
    const spellbookEntry = getSpellbookEntry(character, input.spell.id);
    if (!spellbookEntry) {
        return { error: `Spell "${input.spell.name}" not found in spellbook` };
    }
    // Check if spell is lost
    if (spellbookEntry.lost) {
        return { error: `Spell "${input.spell.name}" is lost for the day` };
    }
    // Get ability score and modifier
    const { score, modifier } = getSpellCheckAbility(character, profile);
    // Build the full input - start with required fields
    const castInput = {
        spell: input.spell,
        spellbookEntry,
        casterProfile: profile,
        casterLevel: getCasterLevel(character),
        abilityScore: score,
        abilityModifier: modifier,
    };
    // Add optional fields (these are always defined from character)
    castInput.luck = getCurrentLuck(character);
    castInput.startingLuck = getStartingLuck(character);
    castInput.luckMultiplier = getLuckMultiplier(character);
    // Add optional fields only if they have values (exactOptionalPropertyTypes)
    if (input.luckBurn !== undefined) {
        castInput.luckBurn = input.luckBurn;
    }
    if (input.spellburn !== undefined) {
        castInput.spellburn = input.spellburn;
    }
    if (input.actionDie !== undefined) {
        castInput.actionDie = input.actionDie;
    }
    if (input.resultTable !== undefined) {
        castInput.resultTable = input.resultTable;
    }
    if (input.fumbleTable !== undefined) {
        castInput.fumbleTable = input.fumbleTable;
    }
    if (input.corruptionTable !== undefined) {
        castInput.corruptionTable = input.corruptionTable;
    }
    if (input.patronTaintTable !== undefined) {
        castInput.patronTaintTable = input.patronTaintTable;
    }
    if (input.situationalModifiers !== undefined) {
        castInput.situationalModifiers = input.situationalModifiers;
    }
    if (input.patronTaintChance !== undefined) {
        castInput.patronTaintChance = input.patronTaintChance;
    }
    if (input.isPatronSpell !== undefined) {
        castInput.isPatronSpell = input.isPatronSpell;
    }
    // Add cleric-specific fields
    if (profile.usesDisapproval) {
        castInput.disapprovalRange = getDisapprovalRange(character);
    }
    // Add patron for wizard/elf
    if (profile.usesCorruption) {
        const patron = getPatronId(character);
        if (patron !== undefined) {
            castInput.patron = patron;
        }
    }
    return castInput;
}
// =============================================================================
// Main Orchestration Function
// =============================================================================
/**
 * Calculate a complete spell check with all follow-up effects.
 *
 * This is the main entry point for spell casting. It:
 * 1. Validates the character can cast the spell
 * 2. Builds the full spell check input
 * 3. Performs the spell check roll
 * 4. Handles fumbles (for wizards/elves)
 * 5. Handles corruption (for wizards/elves)
 * 6. Handles disapproval (for clerics)
 * 7. Marks spell as lost if applicable
 * 8. Returns comprehensive result
 *
 * @param character - The character casting the spell
 * @param input - Simplified spell check input
 * @param options - Roll options
 * @param events - Event callbacks for UI integration
 * @returns Complete spell check result
 */
export function calculateSpellCheck(character, input, options = {}, events) {
    // Get caster profile
    const profile = getCasterProfileFromCharacter(character);
    if (!profile) {
        return createErrorResult(input.spell.id, "Character is not a spellcaster");
    }
    // Check if character can cast this spell type
    if (!input.spell.casterTypes.includes(profile.type)) {
        return createErrorResult(input.spell.id, `${profile.type} cannot cast ${input.spell.name}`);
    }
    // Build full spell cast input
    const castInputOrError = buildSpellCastInput(character, input, profile);
    if ("error" in castInputOrError) {
        return createErrorResult(input.spell.id, castInputOrError.error);
    }
    const castInput = castInputOrError;
    // Perform the spell check
    const baseResult = castSpell(castInput, options, events);
    // Build the complete result
    const result = { ...baseResult };
    // Handle fumble for wizard/elf
    if (baseResult.fumble && profile.usesCorruption && !options.skipFumble) {
        const fumbleResult = handleWizardFumble(input.spell.level, profile, input.fumbleTable, input.corruptionTable, options, events, result);
        if (fumbleResult !== undefined) {
            result.fumbleResult = fumbleResult;
        }
    }
    // Handle patron taint. RAW has two independent triggers:
    //   1. Creeping chance — every patron-based cast rolls d100 vs the
    //      caster's `patronTaintChance`; on hit, taint is acquired and the
    //      chance resets to 1. On miss, chance increments by 1.
    //   2. Result-table entry — some patron-spell result-table rows list
    //      taint as an outcome (e.g. "Lost, failure, and patron taint"),
    //      tagged by content via `effect.type === 'patron-taint'` or
    //      `effect.data.patronTaint === true`. These acquire taint
    //      unconditionally when the row is hit. Fumble's forcing of the
    //      result-table lookup to row 1 (handled in castSpell) is what
    //      makes this path fire on natural 1s for high-modifier wizards.
    //
    // Both triggers run; either acquires. The fumble-gated taint path that
    // previously lived in handleWizardFumble has been removed — patron taint
    // has no RAW connection to spell or combat fumble tables.
    if (castInput.patron && isPatronCast(input.spell, castInput)) {
        handlePatronTaintTriggers(castInput, result, input.patronTaintTable, options, events);
    }
    // Handle corruption trigger (separate from fumble)
    if (baseResult.corruptionTriggered &&
        !baseResult.fumble && // Don't double-roll corruption from fumble
        !options.skipCorruption &&
        input.corruptionTable) {
        result.corruptionResult = handleCorruption(input.spell.level, input.corruptionTable, options, events, result);
    }
    // Handle disapproval for cleric
    if (profile.usesDisapproval &&
        baseResult.natural !== undefined &&
        castInput.disapprovalRange !== undefined) {
        const disapproval = handleClericDisapproval(baseResult.natural, castInput.disapprovalRange, input.disapprovalTable, options, events, result);
        if (disapproval) {
            result.disapprovalResult = disapproval;
        }
    }
    // Mark spell as lost if applicable
    if (baseResult.spellLost) {
        const spellbook = character.state.classState?.wizard?.spellbook ??
            character.state.classState?.cleric?.spellbook ??
            character.state.classState?.elf?.spellbook;
        if (spellbook) {
            const updatedSpellbook = markSpellLost(spellbook, input.spell.id);
            const updatedEntry = findSpellEntry(updatedSpellbook, input.spell.id);
            if (updatedEntry) {
                result.updatedSpellbookEntry = updatedEntry;
            }
        }
    }
    return result;
}
// =============================================================================
// Follow-up Roll Handlers
// =============================================================================
/**
 * Handle fumble for wizard/elf.
 *
 * Rolls on the spell fumble table and — when a fumble entry is tagged
 * for corruption — rolls on the corruption table. Patron taint is NOT
 * handled here: RAW routes taint through the creeping-chance check and
 * patron-spell result-table entries, neither of which is the spell
 * fumble table. See `handlePatronTaintTriggers`.
 */
function handleWizardFumble(spellLevel, profile, fumbleTable, corruptionTable, options, events, result) {
    if (!fumbleTable)
        return undefined;
    const fumbleResult = rollSpellFumble(spellLevel, fumbleTable, options);
    // Check if fumble triggers corruption
    if (fumbleRequiresCorruption(fumbleResult, profile) && corruptionTable) {
        const corruptionTier = determineCorruptionTier(spellLevel);
        const corruptionResult = rollCorruption(corruptionTable, corruptionTier, options);
        result.corruptionResult = corruptionResult;
        events?.onCorruptionTriggered?.(result, corruptionResult);
    }
    return fumbleResult;
}
/**
 * Run patron-taint checks for a patron-based cast. Merges the two RAW
 * acquisition paths (creeping chance, result-table entry) and populates
 * the corresponding fields on `result`:
 *
 *   - `patronTaintChecked`: always true when this function runs (callers
 *     must gate on `castInput.patron && isPatronCast(...)`).
 *   - `patronTaintRoll`: the creeping-chance d100.
 *   - `patronTaintAcquired`: true if either trigger fired.
 *   - `patronTaintSource`: which trigger fired first-wins order is
 *     creeping-chance, then result-table.
 *   - `newPatronTaintChance`: 1 on acquisition (RAW reset), else
 *     `currentChance + 1`.
 *   - `patronTaintResult`: populated when acquired AND a
 *     `patronTaintTable` is provided (via `applyPatronTaintAcquisition`).
 */
function handlePatronTaintTriggers(castInput, result, patronTaintTable, options, events) {
    const patron = castInput.patron;
    if (patron === undefined)
        return; // caller-gated; defensive only
    const currentChance = castInput.patronTaintChance ?? 1;
    const chanceCheck = rollPatronTaintChanceCheck(currentChance, options);
    const resultTableTriggered = effectTriggersTaint(result.effect);
    result.patronTaintChecked = true;
    result.patronTaintRoll = chanceCheck.roll;
    const acquired = chanceCheck.acquired || resultTableTriggered;
    result.patronTaintAcquired = acquired;
    if (acquired) {
        result.patronTaintSource = chanceCheck.acquired ? "creeping-chance" : "result-table";
        result.newPatronTaintChance = 1;
        const taintResult = applyPatronTaintAcquisition(patron, patronTaintTable, options, events, result);
        if (taintResult !== undefined) {
            result.patronTaintResult = taintResult;
        }
    }
    else {
        result.newPatronTaintChance = currentChance + 1;
    }
}
/**
 * Handle corruption (non-fumble trigger)
 */
function handleCorruption(spellLevel, corruptionTable, options, events, result) {
    const tier = determineCorruptionTier(spellLevel);
    const corruptionResult = rollCorruption(corruptionTable, tier, options);
    events?.onCorruptionTriggered?.(result, corruptionResult);
    return corruptionResult;
}
/**
 * Handle disapproval for cleric
 */
function handleClericDisapproval(natural, disapprovalRange, disapprovalTable, options, events, result) {
    // Check if natural roll triggers disapproval
    if (!rollTriggersDisapproval(natural, disapprovalRange)) {
        return undefined;
    }
    // Roll disapproval if table is provided
    if (disapprovalTable) {
        const disapprovalResult = checkAndRollDisapproval(natural, disapprovalRange, disapprovalTable, options);
        if (disapprovalResult) {
            // Update the new disapproval range in result
            result.newDisapprovalRange = increaseDisapprovalRange(disapprovalRange);
            events?.onDisapprovalIncreased?.(result, result.newDisapprovalRange);
            return disapprovalResult;
        }
    }
    return undefined;
}
// =============================================================================
// Utility Functions
// =============================================================================
/**
 * Create an error result
 */
function createErrorResult(spellId, error) {
    return {
        spellId,
        die: "d20",
        formula: "",
        modifiers: [],
        critical: false,
        fumble: false,
        spellLost: false,
        corruptionTriggered: false,
        disapprovalIncrease: 0,
        luckBurned: 0,
        patronTaintChecked: false,
        patronTaintAcquired: false,
        error,
    };
}
/**
 * Check if a spell check result is successful
 */
export function isSpellCheckSuccess(result) {
    if (result.error)
        return false;
    if (!result.tier)
        return false;
    return result.tier.startsWith("success");
}
/**
 * Check if a spell check result is a failure
 */
export function isSpellCheckFailure(result) {
    if (result.error)
        return true;
    if (!result.tier)
        return true;
    return result.tier === "failure" || result.tier === "lost";
}
/**
 * Get a summary of the spell check result for display
 */
export function getSpellCheckSummary(result) {
    if (result.error) {
        return `Error: ${result.error}`;
    }
    const parts = [];
    // Roll info
    if (result.natural !== undefined && result.total !== undefined) {
        parts.push(`Roll: ${String(result.natural)} → ${String(result.total)}`);
    }
    // Result tier
    if (result.tier) {
        const tierDisplay = result.tier.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        parts.push(`Result: ${tierDisplay}`);
    }
    // Critical/Fumble
    if (result.critical) {
        parts.push("CRITICAL!");
    }
    if (result.fumble) {
        parts.push("FUMBLE!");
    }
    // Spell lost
    if (result.spellLost) {
        parts.push("Spell Lost");
    }
    // Corruption
    if (result.corruptionResult) {
        parts.push(`Corruption: ${result.corruptionResult.description}`);
    }
    // Disapproval
    if (result.disapprovalResult) {
        parts.push(`Disapproval: ${result.disapprovalResult.description}`);
    }
    // Fumble effect
    if (result.fumbleResult) {
        parts.push(`Fumble: ${result.fumbleResult.description}`);
    }
    return parts.join(" | ");
}
//# sourceMappingURL=spell-check.js.map