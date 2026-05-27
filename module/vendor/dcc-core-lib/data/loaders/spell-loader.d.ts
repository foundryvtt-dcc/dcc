/**
 * Spell Data Loader
 *
 * Loads and parses spell definition data from external JSON sources.
 * Supports loading from raw JSON objects with validation.
 */
import type { SpellDefinition, CasterType } from "../../types/spells.js";
import type { MercurialTable } from "../../spells/mercurial.js";
/**
 * Raw spell definition from JSON source
 */
export interface RawSpellDefinition {
    id: string;
    name: string;
    level: number;
    casterTypes: string[];
    description?: string;
    range?: string;
    duration?: string;
    castingTime?: string;
    save?: string;
    tags?: string[];
    source?: string;
}
/**
 * Raw mercurial effect data from JSON source
 */
export interface RawMercurialEffectData {
    type: string;
    modifier?: number;
    dice?: string;
    trigger?: string;
    duration?: string;
    data?: Record<string, unknown>;
}
/**
 * Raw mercurial table entry from JSON source
 */
export interface RawMercurialTableEntry {
    min: number;
    max: number;
    summary: string;
    description: string;
    displayOnCast?: boolean;
    effect?: RawMercurialEffectData;
}
/**
 * Raw mercurial table from JSON source
 */
export interface RawMercurialTable {
    id: string;
    name: string;
    entries: RawMercurialTableEntry[];
}
/**
 * Parse a raw spell definition into a typed SpellDefinition
 */
export declare function parseSpellDefinition(raw: RawSpellDefinition): SpellDefinition | undefined;
/**
 * Load multiple spell definitions from raw JSON array
 */
export declare function loadSpellDefinitions(rawSpells: RawSpellDefinition[]): SpellDefinition[];
/**
 * Invalid spell entry with reason
 */
export interface InvalidSpellEntry {
    raw: RawSpellDefinition;
    reason: string;
}
/**
 * Validation result for spell definitions
 */
export interface SpellValidationResult {
    valid: SpellDefinition[];
    invalid: InvalidSpellEntry[];
}
/**
 * Load spell definitions with validation reporting
 */
export declare function loadSpellDefinitionsWithValidation(rawSpells: RawSpellDefinition[]): SpellValidationResult;
/**
 * Load a mercurial table from raw JSON
 */
export declare function loadMercurialTable(raw: RawMercurialTable): MercurialTable;
/**
 * Validation result for mercurial table
 */
export interface MercurialTableValidationResult {
    valid: boolean;
    table?: MercurialTable;
    errors: string[];
}
/**
 * Load mercurial table with validation
 */
export declare function loadMercurialTableWithValidation(raw: RawMercurialTable): MercurialTableValidationResult;
/**
 * Group spells by level
 */
export declare function groupSpellsByLevel(spells: readonly SpellDefinition[]): Map<number, SpellDefinition[]>;
/**
 * Group spells by caster type
 */
export declare function groupSpellsByCasterType(spells: readonly SpellDefinition[]): Map<CasterType, SpellDefinition[]>;
/**
 * Find a spell by ID
 */
export declare function findSpellById(spells: readonly SpellDefinition[], id: string): SpellDefinition | undefined;
/**
 * Find spells by name (case-insensitive partial match)
 */
export declare function findSpellsByName(spells: readonly SpellDefinition[], name: string): SpellDefinition[];
/**
 * Get all spells available to a specific caster type at a given level
 */
export declare function getAvailableSpells(spells: readonly SpellDefinition[], casterType: CasterType, maxLevel: number): SpellDefinition[];
//# sourceMappingURL=spell-loader.d.ts.map