/**
 * Morale System
 *
 * Implements DCC morale rules for monsters, retainers, and NPCs.
 *
 * Key rules:
 * - Roll 1d20 + Will save vs DC 11 (or higher for magical effects)
 * - 11+ = success (keeps fighting), 10 or less = flees
 * - Retainers add employer's Personality modifier
 * - Situational modifiers of +4 to -4
 * - Some creatures are immune (automatons, golems, mindless creatures)
 *
 * Morale check triggers:
 * - Group: when first creature slain, when half killed/incapacitated
 * - Single monster: when lost half HP
 * - Retainer: first combat/danger per adventure, end of adventure
 */
import { evaluateRoll } from "../dice/roll.js";
// =============================================================================
// Constants
// =============================================================================
/** Default morale DC */
export const DEFAULT_MORALE_DC = 11;
/** Maximum situational modifier */
export const MAX_SITUATIONAL_MODIFIER = 4;
/** Minimum situational modifier */
export const MIN_SITUATIONAL_MODIFIER = -4;
// =============================================================================
// Morale Check Functions
// =============================================================================
/**
 * Make a morale check for a creature, retainer, or NPC
 *
 * @param input - Morale check input
 * @param roller - Optional dice roller
 * @returns Morale check result
 *
 * @example
 * // Monster morale check when half HP lost
 * const result = makeMoraleCheck({
 *   entityType: "monster",
 *   willSave: 2,
 *   trigger: "half-hp-lost",
 * });
 *
 * @example
 * // Retainer morale check with employer bonus
 * const result = makeMoraleCheck({
 *   entityType: "retainer",
 *   willSave: 1,
 *   trigger: "first-combat",
 *   employerPersonalityMod: 2,
 * });
 */
export function makeMoraleCheck(input, roller) {
    // Check for immunity
    if (input.isImmune) {
        return {
            roll: 0,
            total: 0,
            dc: input.dc ?? DEFAULT_MORALE_DC,
            passed: true,
            immune: true,
            modifiers: [],
            trigger: input.trigger,
            outcome: "immune",
        };
    }
    const dc = input.dc ?? DEFAULT_MORALE_DC;
    // Build modifiers
    const modifiers = [];
    // Will save
    if (input.willSave !== 0) {
        modifiers.push({
            source: "will",
            value: input.willSave,
            label: "Will save",
        });
    }
    // Employer's Personality modifier (retainers only)
    if (input.entityType === "retainer" && input.employerPersonalityMod !== undefined) {
        modifiers.push({
            source: "employer",
            value: input.employerPersonalityMod,
            label: "Employer's Personality",
        });
    }
    // Situational modifier (clamped to -4 to +4)
    if (input.situationalModifier !== undefined && input.situationalModifier !== 0) {
        const clamped = clampSituationalModifier(input.situationalModifier);
        modifiers.push({
            source: "situational",
            value: clamped,
            label: getSituationalLabel(clamped),
        });
    }
    // Additional modifiers
    if (input.additionalModifiers) {
        modifiers.push(...input.additionalModifiers);
    }
    // Roll the check
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    const rollResult = evaluateRoll("1d20", rollOptions);
    const roll = rollResult.natural ?? rollResult.total ?? 10;
    // Calculate total
    const modifierTotal = modifiers.reduce((sum, m) => sum + m.value, 0);
    const total = roll + modifierTotal;
    // Determine result
    const passed = total >= dc;
    return {
        roll,
        total,
        dc,
        passed,
        immune: false,
        modifiers,
        trigger: input.trigger,
        outcome: passed ? "fights" : "flees",
    };
}
/**
 * Calculate the total morale modifier for display
 *
 * @param willSave - Creature's Will save
 * @param situationalModifier - Situational modifier
 * @param employerPersonalityMod - Employer's Personality mod (retainers only)
 * @returns Total modifier
 */
export function calculateMoraleModifier(willSave, situationalModifier = 0, employerPersonalityMod = 0) {
    const clampedSituational = clampSituationalModifier(situationalModifier);
    return willSave + clampedSituational + employerPersonalityMod;
}
// =============================================================================
// Morale Trigger Detection
// =============================================================================
/**
 * Check if a group morale check is triggered and update state
 *
 * @param state - Current group morale state
 * @param casualtyCount - Number of casualties just inflicted
 * @returns Trigger type if check is needed, undefined otherwise
 */
export function checkGroupMoraleTrigger(state, casualtyCount) {
    const newActiveCount = state.activeCreatures - casualtyCount;
    const wasFirstCasualty = state.activeCreatures === state.totalCreatures && newActiveCount < state.totalCreatures;
    const isHalfDown = newActiveCount <= Math.floor(state.totalCreatures / 2);
    // Check for first casualty trigger
    if (wasFirstCasualty && !state.firstCasualtyChecked) {
        return {
            trigger: "first-ally-slain",
            newState: {
                ...state,
                activeCreatures: newActiveCount,
                firstCasualtyChecked: true,
            },
        };
    }
    // Check for half-down trigger
    if (isHalfDown && !state.halfDownChecked) {
        return {
            trigger: "half-allies-down",
            newState: {
                ...state,
                activeCreatures: newActiveCount,
                halfDownChecked: true,
            },
        };
    }
    // No trigger, just update state
    return undefined;
}
/**
 * Check if a single creature morale check is triggered
 *
 * @param state - Current creature morale state
 * @param damageDealt - Damage just dealt
 * @returns Trigger type if check is needed, undefined otherwise
 */
export function checkCreatureMoraleTrigger(state, damageDealt) {
    const newHP = state.currentHP - damageDealt;
    const halfHP = Math.floor(state.maxHP / 2);
    const wasAboveHalf = state.currentHP > halfHP;
    const nowAtOrBelowHalf = newHP <= halfHP;
    // Check for half-HP trigger
    if (wasAboveHalf && nowAtOrBelowHalf && !state.halfHPChecked) {
        return {
            trigger: "half-hp-lost",
            newState: {
                ...state,
                currentHP: newHP,
                halfHPChecked: true,
            },
        };
    }
    return undefined;
}
/**
 * Check if a retainer morale check is triggered
 *
 * @param state - Current retainer morale state
 * @param situation - What situation occurred
 * @returns Trigger type if check is needed, undefined otherwise
 */
export function checkRetainerMoraleTrigger(state, situation) {
    if (situation === "combat" && !state.firstCombatChecked) {
        return {
            trigger: "first-combat",
            newState: {
                ...state,
                firstCombatChecked: true,
            },
        };
    }
    if (situation === "danger" && !state.firstDangerChecked) {
        return {
            trigger: "first-danger",
            newState: {
                ...state,
                firstDangerChecked: true,
            },
        };
    }
    if (situation === "end-of-adventure") {
        // End of adventure always triggers (state doesn't change)
        return {
            trigger: "end-of-adventure",
            newState: state,
        };
    }
    return undefined;
}
// =============================================================================
// State Creation Helpers
// =============================================================================
/**
 * Create initial morale state for a group of creatures
 *
 * @param totalCreatures - Number of creatures in the group
 * @returns Initial group morale state
 */
export function createGroupMoraleState(totalCreatures) {
    return {
        totalCreatures,
        activeCreatures: totalCreatures,
        firstCasualtyChecked: false,
        halfDownChecked: false,
    };
}
/**
 * Create initial morale state for a single creature
 *
 * @param maxHP - Creature's maximum hit points
 * @returns Initial creature morale state
 */
export function createCreatureMoraleState(maxHP) {
    return {
        maxHP,
        currentHP: maxHP,
        halfHPChecked: false,
    };
}
/**
 * Create initial morale state for a retainer
 *
 * @returns Initial retainer morale state
 */
export function createRetainerMoraleState() {
    return {
        firstCombatChecked: false,
        firstDangerChecked: false,
    };
}
/**
 * Reset retainer morale state for a new adventure
 *
 * @param _state - Current state (unused, for API consistency)
 * @returns Fresh retainer morale state
 */
export function resetRetainerMoraleForNewAdventure(_state) {
    return createRetainerMoraleState();
}
// =============================================================================
// Immunity Helpers
// =============================================================================
/**
 * Common creature types that are immune to morale
 */
export const MORALE_IMMUNE_TYPES = [
    "automaton",
    "construct",
    "golem",
    "animated",
    "mindless",
    "undead-mindless",
    "ooze",
    "elemental",
];
/**
 * Check if a creature type is immune to morale
 *
 * @param creatureType - Creature type string
 * @returns Whether the creature is immune
 */
export function isImmuneToMorale(creatureType) {
    const normalized = creatureType.toLowerCase();
    return MORALE_IMMUNE_TYPES.some(immuneType => normalized.includes(immuneType));
}
/**
 * Check if a creature is immune based on traits/keywords
 *
 * @param traits - Array of trait strings
 * @returns Whether the creature is immune
 */
export function hasImmuneTraits(traits) {
    const immuneKeywords = [
        "mindless",
        "fearless",
        "immune to fear",
        "immune to morale",
        "no morale",
        "automaton",
        "construct",
    ];
    return traits.some(trait => {
        const normalized = trait.toLowerCase();
        return immuneKeywords.some(keyword => normalized.includes(keyword));
    });
}
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Clamp situational modifier to valid range
 */
function clampSituationalModifier(modifier) {
    return Math.max(MIN_SITUATIONAL_MODIFIER, Math.min(MAX_SITUATIONAL_MODIFIER, modifier));
}
/**
 * Get a descriptive label for situational modifier
 */
function getSituationalLabel(modifier) {
    if (modifier >= 3)
        return "Strong motivation to fight";
    if (modifier >= 1)
        return "Motivated to fight";
    if (modifier <= -3)
        return "Strong motivation to flee";
    if (modifier <= -1)
        return "Motivated to flee";
    return "Situational";
}
/**
 * Get suggested situational modifier based on common scenarios
 */
export function getSuggestedModifier(scenario) {
    const normalized = scenario.toLowerCase();
    // Strong motivation to fight (+4)
    if (normalized.includes("defending young") ||
        normalized.includes("defending cubs") ||
        normalized.includes("defending children") ||
        normalized.includes("sacred shrine") ||
        normalized.includes("holy ground") ||
        normalized.includes("protecting hoard") ||
        normalized.includes("cornered") ||
        normalized.includes("no escape")) {
        return 4;
    }
    // Moderate motivation to fight (+2)
    if (normalized.includes("defending home") ||
        normalized.includes("defending lair") ||
        normalized.includes("outnumber") ||
        normalized.includes("winning")) {
        return 2;
    }
    // Moderate motivation to flee (-2)
    if (normalized.includes("outmatched") ||
        normalized.includes("losing") ||
        normalized.includes("wounded leader") ||
        normalized.includes("no treasure")) {
        return -2;
    }
    // Strong motivation to flee (-4)
    if (normalized.includes("slave") ||
        normalized.includes("unwilling") ||
        normalized.includes("coerced") ||
        normalized.includes("just hungry") ||
        normalized.includes("leader slain") ||
        normalized.includes("hates master")) {
        return -4;
    }
    return 0;
}
/**
 * Format morale check result for display
 */
export function formatMoraleResult(result) {
    if (result.immune) {
        return "Immune to morale (mindless/fearless)";
    }
    const modifierStr = result.modifiers.length > 0
        ? ` (${result.modifiers.map(m => `${m.value >= 0 ? "+" : ""}${String(m.value)} ${m.label ?? m.source}`).join(", ")})`
        : "";
    const outcomeStr = result.passed
        ? "PASSES - continues fighting"
        : "FAILS - attempts to flee";
    return `Morale check: ${String(result.roll)}${modifierStr} = ${String(result.total)} vs DC ${String(result.dc)} - ${outcomeStr}`;
}
//# sourceMappingURL=morale.js.map