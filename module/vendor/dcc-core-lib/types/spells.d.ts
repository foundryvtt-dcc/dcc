/**
 * Spell System Types
 *
 * Comprehensive types for DCC spell casting including:
 * - Spell definitions (external JSON data)
 * - Spellbooks (character-specific spell knowledge)
 * - Mercurial magic effects
 * - Spell casting input/output
 * - Corruption and fumble results
 */
import type { DieType, LegacyRollModifier, RollOptions } from "./dice.js";
import type { DCCAbilityId } from "./system.js";
import type { ResultTier, TableEffect, SimpleTable, TieredTable } from "../tables/types.js";
/**
 * Spell casting mode determines how the spell is cast.
 * Used in spell data catalogs to categorize spells.
 */
export type SpellCastingMode = "wizard" | "cleric" | "patron";
/**
 * Range bracket for a spell result
 */
export interface SpellResultRange {
    /** Minimum roll (inclusive) */
    min: number;
    /** Maximum roll (inclusive) */
    max: number;
}
/**
 * A single result entry in a spell result table
 */
export interface SpellResult {
    /** The roll range that triggers this result (inclusive) */
    range: SpellResultRange;
    /** Description of the spell effect at this roll level */
    description: string;
}
/**
 * Complete spell result table for spell check resolution
 */
export interface SpellResultTable {
    /** Spell name this table applies to */
    spellName: string;
    /** Casting mode (wizard, cleric, or patron) */
    castingMode: SpellCastingMode;
    /** Ordered list of results by roll range */
    results: SpellResult[];
}
/**
 * Core spell data structure for spell catalogs.
 * This is the "data" type for spell storage/lookup.
 */
export interface Spell {
    /** Unique identifier for the spell */
    id: string;
    /** Display name */
    name: string;
    /** Spell level (1-5) */
    level: number;
    /** Casting mode */
    castingMode: SpellCastingMode;
    /** Rulebook page reference */
    page: string;
    /** Spell range */
    range: string;
    /** Spell duration */
    duration: string;
    /** Casting time */
    castingTime: string;
    /** Save type (e.g., "None", "Will vs. spell check DC") */
    save: string;
    /** General description of the spell */
    description: string;
}
/**
 * Extended spell data with result table included
 */
export interface SpellWithResults extends Spell {
    /** Result table for spell check resolution */
    resultTable: SpellResultTable;
}
/**
 * Collection of spells organized by level
 */
export interface SpellCollection {
    /** Casting mode for this collection */
    castingMode: SpellCastingMode;
    /** Spells indexed by level */
    spellsByLevel: Record<number, Spell[]>;
}
/**
 * Types of spellcasters in DCC
 */
export type CasterType = "wizard" | "cleric" | "elf";
/**
 * How a caster learns/casts spells (determines which mechanics apply)
 */
export interface CasterProfile {
    /** The caster type */
    type: CasterType;
    /** Which ability is used for spell checks */
    spellCheckAbility: DCCAbilityId;
    /** Does this caster use mercurial magic? */
    usesMercurial: boolean;
    /** Does this caster use corruption? */
    usesCorruption: boolean;
    /** Does this caster use disapproval? */
    usesDisapproval: boolean;
    /** Can this caster spellburn? */
    canSpellburn: boolean;
    /** How lost spells can be recovered */
    lostSpellRecovery: "none" | "rest" | "prayer";
}
/**
 * Standard caster profiles for DCC classes
 */
export declare const CASTER_PROFILES: Record<CasterType, CasterProfile>;
/**
 * A spell result entry (for inline results or loaded from tables)
 */
export interface SpellResultEntry {
    /** Minimum check result */
    min: number;
    /** Maximum check result (optional, defaults to next entry's min - 1) */
    max?: number;
    /** Result tier */
    tier: ResultTier;
    /** Result text */
    text: string;
    /** Structured effect data */
    effect?: TableEffect;
    /** Is the spell lost after this result? */
    lost?: boolean;
    /** Does this trigger corruption? (wizard/elf) */
    corruption?: boolean;
    /** Does this trigger disapproval increase? (cleric) */
    disapproval?: boolean;
    /** Manifestation description for this result */
    manifestation?: string;
}
/**
 * A spell's base definition loaded from external JSON.
 * This is the "template" - character-specific instances are stored in spellbooks.
 */
export interface SpellDefinition {
    /** Unique identifier (e.g., "magic-missile", "bless") */
    id: string;
    /** Display name */
    name: string;
    /** Full description */
    description?: string;
    /** Spell level (1-5 for wizards, 1-5 for clerics) */
    level: number;
    /** Which caster types can use this spell */
    casterTypes: CasterType[];
    /** Range description */
    range?: string;
    /** Duration description */
    duration?: string;
    /** Casting time description */
    castingTime?: string;
    /** Save type if applicable */
    save?: "reflex" | "fortitude" | "will" | "none";
    /** General/school/type tags for filtering */
    tags?: string[];
    /** Source reference (e.g., "DCC Core Rules p.XXX") */
    source?: string;
    /**
     * Result table ID for looking up spell results.
     * If undefined, use inline `results` array.
     */
    resultTableId?: string;
    /**
     * Inline tiered results (alternative to resultTableId).
     * Simpler spells can embed results directly.
     */
    results?: SpellResultEntry[];
    /** Manifestation table ID (optional) */
    manifestationTableId?: string;
}
/**
 * Trigger conditions for mercurial effects
 */
export type MercurialTrigger = "always" | "on-cast" | "on-success" | "on-failure" | "on-crit" | "on-fumble";
/**
 * Structured mercurial effect for programmatic handling
 */
export interface MercurialEffectData {
    /** Effect type (e.g., "modifier", "condition", "damage", "heal") */
    type: string;
    /** Numeric modifier if applicable */
    modifier?: number;
    /** Dice modifier if applicable (e.g., "+1d4") */
    dice?: string;
    /** When this triggers */
    trigger?: MercurialTrigger;
    /** Duration of effect */
    duration?: string;
    /** Additional structured data */
    data?: Record<string, unknown>;
}
/**
 * A mercurial magic effect stored with a spell
 */
export interface MercurialEffect {
    /** The roll result that determined this effect (d100 + luck mod * 10) */
    rollValue: number;
    /** Short summary of the effect (for display) */
    summary: string;
    /** Full description of the effect */
    description: string;
    /** Should this display in chat/output when casting? */
    displayOnCast: boolean;
    /** Structured effect data (if parseable for automation) */
    effect?: MercurialEffectData;
}
/**
 * A single entry in a mercurial magic table
 */
export interface MercurialTableEntry {
    /** Minimum roll value (inclusive) */
    min: number;
    /** Maximum roll value (inclusive) */
    max: number;
    /** Short summary */
    summary: string;
    /** Full description */
    description: string;
    /** Whether to display on each cast */
    displayOnCast: boolean;
    /** Structured effect (optional) */
    effect?: MercurialEffectData;
}
/**
 * A spell known by a specific character.
 * Includes character-specific data like mercurial effect.
 */
export interface SpellbookEntry {
    /** Reference to spell definition ID */
    spellId: string;
    /** When this spell was learned (ISO date string, for tracking) */
    learnedAt?: string;
    /** Is this spell currently lost? (for the day) */
    lost: boolean;
    /** Mercurial magic effect (for wizards/elves) */
    mercurialEffect?: MercurialEffect;
    /** Custom manifestation description (optional override) */
    manifestation?: string;
    /** Last check result rolled (for GM adjustment feature) */
    lastResult?: number;
    /** Player notes about this spell */
    notes?: string;
}
/**
 * A character's complete spellbook
 */
export interface Spellbook {
    /** All known spells */
    spells: SpellbookEntry[];
    /** Maximum spells known per level (from class/level progression) */
    maxSpellsPerLevel?: Partial<Record<number, number>>;
}
/**
 * Create an empty spellbook
 */
export declare function createEmptySpellbook(): Spellbook;
/**
 * Spellburn commitment for a spell check (wizard/elf only)
 * Points are temporarily burned from physical abilities.
 */
export interface SpellburnCommitment {
    /** Points burned from Strength */
    str: number;
    /** Points burned from Agility */
    agl: number;
    /** Points burned from Stamina */
    sta: number;
}
/**
 * Create an empty spellburn commitment
 */
export declare function createEmptySpellburn(): SpellburnCommitment;
/**
 * Calculate total spellburn points
 */
export declare function totalSpellburn(commitment: SpellburnCommitment): number;
/**
 * Result of rolling on the corruption table
 */
export interface CorruptionResult {
    /** The die roll result */
    roll: number;
    /** Description of the corruption effect */
    description: string;
    /** Structured effect data */
    effect?: TableEffect;
    /** Is this corruption permanent? (most are) */
    permanent: boolean;
    /** Corruption tier (minor, major, greater) */
    tier?: "minor" | "major" | "greater";
}
/**
 * Result of rolling on the spell fumble table
 */
export interface SpellFumbleResult {
    /** The die roll result */
    roll: number;
    /** Description of the fumble effect */
    description: string;
    /** Structured effect data */
    effect?: TableEffect;
    /** Did the spell misfire? */
    misfire: boolean;
    /** Should roll on corruption table? */
    corruption: boolean;
    /** Should roll on patron taint table? (if has patron) */
    patronTaint: boolean;
}
/**
 * Result of rolling on the patron taint table
 */
export interface PatronTaintResult {
    /** The die roll result */
    roll: number;
    /** Patron ID that caused the taint */
    patronId: string;
    /** Description of the taint effect */
    description: string;
    /** Structured effect data */
    effect?: TableEffect;
}
/**
 * Input for casting a spell
 */
export interface SpellCastInput {
    /** The spell being cast (definition) */
    spell: SpellDefinition;
    /** The spellbook entry (character-specific data) */
    spellbookEntry: SpellbookEntry;
    /** Caster's profile (determines mechanics) */
    casterProfile: CasterProfile;
    /** Caster level */
    casterLevel: number;
    /** Spell check ability score (current value) */
    abilityScore: number;
    /** Ability modifier (pre-calculated) */
    abilityModifier: number;
    /** Current luck score (for luck burn calculations) */
    luck?: number;
    /** Starting luck score (for birth augur effects) */
    startingLuck?: number;
    /** Luck to burn on this check */
    luckBurn?: number;
    /** Luck modifier multiplier from birth augur (default 1) */
    luckMultiplier?: number;
    /** Spellburn commitment (wizard/elf only) */
    spellburn?: SpellburnCommitment;
    /** Current disapproval range (cleric only, starts at 1) */
    disapprovalRange?: number;
    /** Patron ID (for patron taint acquisition) */
    patron?: string;
    /**
     * Current patron-taint chance as an integer percent (1-100).
     * RAW (DCC core): every patron-based cast rolls d100 vs this value;
     * on acquisition the chance resets to 1, otherwise it increments by 1.
     * Defaults to 1 when omitted.
     */
    patronTaintChance?: number;
    /**
     * Caller override for "is this cast a patron-based spell?" When set, the
     * lib honors it directly. When omitted, the lib falls back to
     * `spell.tags?.includes('patron')`. Foundry-style systems that detect
     * patron spells by name prefix ("Patron Bond", "Invoke Patron") or by a
     * per-item flag should pass this explicitly.
     */
    isPatronSpell?: boolean;
    /** Situational modifiers to apply */
    situationalModifiers?: LegacyRollModifier[];
    /** Action die override (if not d20) */
    actionDie?: DieType;
    /** Result table for spell effects (pre-loaded) */
    resultTable?: TieredTable;
    /** Fumble table (pre-loaded) */
    fumbleTable?: SimpleTable;
    /** Corruption table (pre-loaded) */
    corruptionTable?: SimpleTable;
    /** Patron taint table (pre-loaded, if applicable) */
    patronTaintTable?: SimpleTable;
}
/**
 * Result of casting a spell
 */
export interface SpellCastResult {
    /** The spell that was cast */
    spellId: string;
    /** Die used for the check */
    die: DieType;
    /** Natural die result (before modifiers) */
    natural?: number;
    /** Total check result (after all modifiers) */
    total?: number;
    /** The formula used */
    formula: string;
    /** All modifiers applied */
    modifiers: LegacyRollModifier[];
    /** Was this a critical (natural 20)? */
    critical: boolean;
    /** Was this a fumble (natural 1)? */
    fumble: boolean;
    /** Result tier (lost, failure, success levels) */
    tier?: ResultTier;
    /** Result text from table lookup */
    resultText?: string;
    /** Structured effect from result */
    effect?: TableEffect;
    /** Was the spell lost for the day? */
    spellLost: boolean;
    /** Was corruption triggered? (wizard/elf only) */
    corruptionTriggered: boolean;
    /** Corruption result (if rolled, filled by corruption module) */
    corruptionResult?: CorruptionResult;
    /** Fumble result (if applicable) */
    fumbleResult?: SpellFumbleResult;
    /**
     * Did the per-cast creeping-chance patron-taint check fire this cast?
     * True when `patron` is set AND `isPatronCast` returns true — regardless
     * of spell outcome (success, failure, fumble all still check).
     */
    patronTaintChecked: boolean;
    /** The d100 rolled for the creeping-chance check (only present when checked). */
    patronTaintRoll?: number;
    /**
     * Was patron taint acquired on this cast? True when either:
     * 1. Creeping-chance check hit (roll <= chance), OR
     * 2. The spell's result-table entry carries a patron-taint outcome
     *    (`effect.type === 'patron-taint'` or `effect.data.patronTaint === true`).
     */
    patronTaintAcquired: boolean;
    /** Which trigger acquired the taint (only present when acquired). */
    patronTaintSource?: "creeping-chance" | "result-table";
    /**
     * Post-cast patron-taint chance. Only set when `patronTaintChecked`.
     * RAW: resets to 1 on acquisition, else currentChance + 1.
     */
    newPatronTaintChance?: number;
    /**
     * Patron-taint manifestation (only present when acquired AND a
     * `patronTaintTable` was provided). Rolled via `rollPatronTaint`.
     */
    patronTaintResult?: PatronTaintResult;
    /** Disapproval increase amount (cleric) */
    disapprovalIncrease: number;
    /** New disapproval range after this cast (cleric) */
    newDisapprovalRange?: number;
    /** Mercurial effect that applied (if any) */
    mercurialEffect?: MercurialEffect;
    /** Spellburn that was applied */
    spellburnApplied?: SpellburnCommitment;
    /** Luck points burned */
    luckBurned: number;
    /** Manifestation description (if rolled/provided) */
    manifestation?: string;
}
/**
 * Event callbacks for spell casting
 * Allows UI layer to react to spell events without coupling.
 */
export interface SpellEvents {
    /** Called when spell check starts */
    onSpellCheckStart?: (input: SpellCastInput) => void;
    /** Called when spell check completes */
    onSpellCheckComplete?: (result: SpellCastResult) => void;
    /** Called on critical (natural 20) */
    onCritical?: (result: SpellCastResult) => void;
    /** Called on fumble (natural 1) */
    onFumble?: (result: SpellCastResult) => void;
    /** Called when spell is lost */
    onSpellLost?: (result: SpellCastResult) => void;
    /** Called when corruption is triggered */
    onCorruptionTriggered?: (result: SpellCastResult, corruption: CorruptionResult) => void;
    /** Called when disapproval range increases */
    onDisapprovalIncreased?: (result: SpellCastResult, newRange: number) => void;
    /** Called when spellburn is applied */
    onSpellburnApplied?: (burn: SpellburnCommitment) => void;
    /** Called when mercurial effect triggers */
    onMercurialEffect?: (effect: MercurialEffect, result: SpellCastResult) => void;
    /** Called when patron taint is triggered */
    onPatronTaint?: (result: SpellCastResult, taint: PatronTaintResult) => void;
}
/**
 * Options for looking up spells
 */
export interface SpellLookupOptions {
    /** Filter by caster type */
    casterType?: CasterType;
    /** Filter by spell level */
    level?: number;
    /** Filter by tags */
    tags?: string[];
    /** Search by name (partial match) */
    nameSearch?: string;
}
/**
 * Options for rolling spell checks
 */
export interface SpellCheckOptions extends RollOptions {
    /** Skip mercurial magic application */
    skipMercurial?: boolean;
    /** Skip corruption rolling (even on trigger) */
    skipCorruption?: boolean;
    /** Skip fumble table rolling */
    skipFumble?: boolean;
    /** Force a specific tier result (for testing/GM override) */
    forceTier?: ResultTier;
    /** Override the natural die roll (for testing/GM override) */
    forceNatural?: number;
}
//# sourceMappingURL=spells.d.ts.map