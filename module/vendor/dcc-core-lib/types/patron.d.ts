/**
 * Patron Types
 *
 * Type definitions for DCC patron system including:
 * - Patron definitions (external JSON data)
 * - Invoke patron results
 * - Patron bond mechanics
 * - Patron spell grants
 */
import type { SimpleTable, TieredTable } from "../tables/types.js";
/**
 * A patron spell granted to bound wizards/elves.
 * These are spells unique to a patron that aren't in the standard spell list.
 */
export interface PatronSpellGrant {
    /** Spell ID reference */
    spellId: string;
    /** Minimum level to learn this patron spell */
    minLevel: number;
    /** Description of how/when this spell is granted */
    description?: string;
}
/**
 * Patron definition loaded from external JSON.
 * Each patron has unique invoke results, taint, and granted spells.
 */
export interface PatronDefinition {
    /** Unique identifier (e.g., "bobugbubilz", "the-king-of-elfland") */
    id: string;
    /** Display name */
    name: string;
    /** Full description of the patron */
    description?: string;
    /** Domain or sphere of influence (e.g., "demons", "nature", "chaos") */
    domain?: string;
    /** Typical alignment of patron (informational) */
    alignment?: "lawful" | "neutral" | "chaotic";
    /** Source reference (e.g., "DCC Core Rules p.321") */
    source?: string;
    /**
     * Invoke Patron result table ID.
     * References a TieredTable with results for different check totals.
     */
    invokeTableId: string;
    /**
     * Patron taint table ID.
     * References a SimpleTable rolled on fumbles or certain spell results.
     */
    taintTableId: string;
    /**
     * Spells granted by this patron.
     * These become available when the bond is formed.
     */
    grantedSpells: PatronSpellGrant[];
    /**
     * Special requirements for bonding with this patron.
     */
    bondRequirements?: string;
}
/**
 * Record of the bond between character and patron.
 * Stored in character's class state.
 */
export interface PatronBond {
    /** Patron ID */
    patronId: string;
    /** When the bond was formed (ISO date string) */
    bondedAt: string;
    /** Current bond strength (optional, for systems that track this) */
    bondStrength?: "weak" | "normal" | "strong";
    /** Accumulated taint count (for tracking how much taint received) */
    taintCount: number;
    /** Notes about the bond relationship */
    notes?: string;
}
/**
 * Input for invoking a patron.
 * This is used when a wizard/elf casts Invoke Patron spell.
 */
export interface InvokePatronInput {
    /** The patron being invoked */
    patronId: string;
    /** Caster level */
    casterLevel: number;
    /** Spell check ability modifier (Intelligence for wizard/elf) */
    abilityModifier: number;
    /** Luck to burn on this check */
    luckBurn?: number;
    /** Luck modifier (from current luck score) */
    luckModifier?: number;
    /** Spellburn commitment */
    spellburn?: {
        str: number;
        agl: number;
        sta: number;
    };
    /** Additional situational modifiers */
    situationalModifiers?: {
        source: string;
        value: number;
    }[];
    /** Pre-loaded invoke patron table */
    invokeTable?: TieredTable;
    /** Pre-loaded taint table (for fumbles) */
    taintTable?: SimpleTable;
}
/**
 * Result of invoking a patron.
 */
export interface InvokePatronResult {
    /** The patron that was invoked */
    patronId: string;
    /** Natural die result (d20) */
    natural: number;
    /** Total check result (after all modifiers) */
    total: number;
    /** Formula used for display */
    formula: string;
    /** Was this a critical (natural 20)? */
    critical: boolean;
    /** Was this a fumble (natural 1)? */
    fumble: boolean;
    /** Result tier from the invoke table */
    tier?: string;
    /** Result text describing the patron's aid */
    resultText?: string;
    /** Did the invocation succeed (patron answered)? */
    success: boolean;
    /** Was patron taint incurred? */
    taintIncurred: boolean;
    /** Taint description if incurred */
    taintDescription?: string;
    /** Is the spell lost for the day? */
    spellLost: boolean;
    /** All modifiers that were applied */
    modifiers: {
        source: string;
        value: number;
    }[];
}
/**
 * Event callbacks for patron system.
 */
export interface PatronEvents {
    /** Called when Invoke Patron starts */
    onInvokeStart?: (input: InvokePatronInput) => void;
    /** Called when Invoke Patron completes */
    onInvokeComplete?: (result: InvokePatronResult) => void;
    /** Called when patron answers (success) */
    onPatronAnswers?: (result: InvokePatronResult) => void;
    /** Called when patron ignores (failure) */
    onPatronIgnores?: (result: InvokePatronResult) => void;
    /** Called when patron taint is incurred */
    onTaintIncurred?: (patronId: string, description: string) => void;
    /** Called when bond is formed */
    onBondFormed?: (bond: PatronBond) => void;
}
/**
 * Options for filtering/searching patrons
 */
export interface PatronLookupOptions {
    /** Filter by alignment */
    alignment?: "lawful" | "neutral" | "chaotic";
    /** Filter by domain */
    domain?: string;
    /** Search by name (partial match) */
    nameSearch?: string;
}
//# sourceMappingURL=patron.d.ts.map