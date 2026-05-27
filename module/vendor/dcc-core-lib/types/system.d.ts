/**
 * System configuration types
 *
 * These types define a game system (DCC, MCC, XCrawl, etc.)
 * allowing the core library to work with different rule variants.
 */
/**
 * Definition of an ability score
 */
export interface AbilityDefinition {
    /** Unique identifier (e.g., "str", "agl") */
    id: string;
    /** Full name (e.g., "Strength", "Agility") */
    name: string;
    /** Abbreviation for display (e.g., "STR", "AGL") */
    abbrev: string;
    /** Optional description */
    description?: string;
}
/**
 * Standard DCC ability IDs
 */
export type DCCAbilityId = "str" | "agl" | "sta" | "per" | "int" | "lck";
/**
 * Alignment options
 */
export type Alignment = "l" | "n" | "c";
/**
 * Alignment definition with display info
 */
export interface AlignmentDefinition {
    id: Alignment;
    name: string;
    abbrev: string;
}
/**
 * Mapping of abilities to their common uses
 */
export interface AbilityMappings {
    /** Ability used for melee attack rolls */
    meleeAttack: string;
    /** Ability used for melee damage */
    meleeDamage: string;
    /** Ability used for missile attack rolls */
    missileAttack: string;
    /** Ability used for missile damage (if any) */
    missileDamage?: string;
    /** Ability used for armor class */
    armorClass: string;
    /** Ability used for hit points */
    hitPoints: string;
    /** Ability used for Reflex saves */
    reflexSave: string;
    /** Ability used for Fortitude saves */
    fortSave: string;
    /** Ability used for Will saves */
    willSave: string;
    /** Ability used for initiative */
    initiative: string;
    /** Ability used for spell checks (wizards) */
    wizardSpellCheck?: string;
    /** Ability used for spell checks (clerics) */
    clericSpellCheck?: string;
}
/**
 * Save type identifiers
 */
export type SaveType = "reflex" | "fortitude" | "will";
/**
 * Save definition
 */
export interface SaveDefinition {
    id: SaveType;
    name: string;
    abbrev: string;
    ability: string;
}
/**
 * System-specific mechanics flags
 */
export interface SystemMechanics {
    /** Does this system use cleric disapproval? */
    hasDisapproval?: boolean;
    /** Does this system use wizard mercurial magic? */
    hasMercurial?: boolean;
    /** Does this system have mutations (MCC)? */
    hasMutations?: boolean;
    /** Does this system have wetware/cyberware (MCC)? */
    hasWetware?: boolean;
    /** Does this system have AI artifacts (MCC)? */
    hasArtifacts?: boolean;
    /** Does this system use luck for specific rolls? */
    hasLuckDie?: boolean;
    /** Does this system use fleeting luck? */
    hasFleetingLuck?: boolean;
}
/**
 * Complete system configuration
 *
 * This defines everything needed to run a DCC-family game system.
 */
export interface SystemConfig {
    /** Unique system identifier (e.g., "dcc", "mcc", "xcrawl") */
    id: string;
    /** Display name (e.g., "Dungeon Crawl Classics") */
    name: string;
    /** System version */
    version?: string;
    /** Ability scores used in this system */
    abilities: AbilityDefinition[];
    /** How abilities map to common game uses */
    abilityMappings: AbilityMappings;
    /** Alignments available in this system */
    alignments: AlignmentDefinition[];
    /** Saving throws in this system */
    saves: SaveDefinition[];
    /** Character classes available (IDs reference class data) */
    classes: string[];
    /** Custom dice chain (if different from standard DCC) */
    diceChain?: number[];
    /** System-specific mechanics */
    mechanics: SystemMechanics;
}
/**
 * Standard DCC abilities
 */
export declare const DCC_ABILITIES: readonly AbilityDefinition[];
/**
 * Standard DCC alignments
 */
export declare const DCC_ALIGNMENTS: readonly AlignmentDefinition[];
/**
 * Standard DCC saves
 */
export declare const DCC_SAVES: readonly SaveDefinition[];
/**
 * Standard DCC ability mappings
 */
export declare const DCC_ABILITY_MAPPINGS: AbilityMappings;
/**
 * Standard DCC system configuration
 */
export declare const DCC_SYSTEM: SystemConfig;
/**
 * Helper to find an ability by ID
 */
export declare function findAbility(abilities: readonly AbilityDefinition[], id: string): AbilityDefinition | undefined;
/**
 * Helper to find a save by ID
 */
export declare function findSave(saves: readonly SaveDefinition[], id: SaveType): SaveDefinition | undefined;
//# sourceMappingURL=system.d.ts.map