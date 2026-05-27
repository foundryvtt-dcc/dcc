/**
 * Character Creation Configuration Types
 *
 * Options for customizing character generation rules.
 * Supports standard DCC rules plus common house rules and variants.
 *
 * Uses hybrid approach: built-in methods as union types + "custom" option
 * that references data-defined methods for extensibility.
 */
/**
 * Default name configuration (no automatic generation)
 */
export const DEFAULT_NAME_CONFIG = {
    generateName: false,
};
// =============================================================================
// Defaults
// =============================================================================
/**
 * Default ability score configuration (standard DCC rules)
 */
export const DEFAULT_ABILITY_SCORE_CONFIG = {
    method: "3d6",
    rerollLowPrimaryStats: false,
};
/**
 * Default hit point configuration (standard DCC rules)
 */
export const DEFAULT_HIT_POINT_CONFIG = {
    zeroLevelMethod: "1d4",
    leveledMethod: "standard",
};
/**
 * Default birth augur configuration (standard DCC rules)
 */
export const DEFAULT_BIRTH_AUGUR_CONFIG = {
    mode: "standard",
};
/**
 * Default occupation configuration (standard DCC rules)
 */
export const DEFAULT_OCCUPATION_CONFIG = {
    source: "core",
};
/**
 * Default class selection configuration
 */
export const DEFAULT_CLASS_SELECTION_CONFIG = {
    allowRandom: true,
};
/**
 * Default equipment configuration (standard DCC rules)
 */
export const DEFAULT_EQUIPMENT_CONFIG = {
    includeFunds: true,
    includeTradeGoods: true,
    includeOccupationEquipment: true,
    includeOccupationWeapon: true,
};
/**
 * Default language configuration (standard DCC rules)
 */
export const DEFAULT_LANGUAGE_CONFIG = {
    determineBonusLanguages: true,
    alwaysGrantRacialLanguage: false,
};
/**
 * Default dwarf rules configuration (standard DCC rules)
 */
export const DEFAULT_DWARF_RULES_CONFIG = {
    ignoreArmorSpeedPenalty: false,
};
/**
 * Complete default configuration (standard DCC rules)
 */
export const DEFAULT_CHARACTER_CREATION_CONFIG = {
    abilityScores: DEFAULT_ABILITY_SCORE_CONFIG,
    hitPoints: DEFAULT_HIT_POINT_CONFIG,
    birthAugur: DEFAULT_BIRTH_AUGUR_CONFIG,
    occupation: DEFAULT_OCCUPATION_CONFIG,
    classSelection: DEFAULT_CLASS_SELECTION_CONFIG,
    equipment: DEFAULT_EQUIPMENT_CONFIG,
    languages: DEFAULT_LANGUAGE_CONFIG,
    dwarfRules: DEFAULT_DWARF_RULES_CONFIG,
    name: DEFAULT_NAME_CONFIG,
    alignment: "n",
    allowRandomAlignment: true,
};
// =============================================================================
// Built-in Method Definitions
// =============================================================================
/**
 * Built-in dice method definitions.
 * These correspond to the AbilityScoreMethod union values.
 */
export const BUILT_IN_DICE_METHODS = {
    "3d6": {
        id: "3d6",
        name: "3d6 (Standard)",
        description: "Roll 3d6 in order, as Crom intended",
        diceCount: 3,
        dieSize: 6,
    },
    "4d6-drop-lowest": {
        id: "4d6-drop-lowest",
        name: "4d6 Drop Lowest",
        description: "Roll 4d6, drop the lowest die",
        diceCount: 4,
        dieSize: 6,
        keep: { count: 3, which: "highest" },
    },
    "2d6+6": {
        id: "2d6+6",
        name: "2d6+6 (Heroic)",
        description: "Roll 2d6 and add 6 for heroic characters",
        diceCount: 2,
        dieSize: 6,
        modifier: 6,
    },
    "2d10": {
        id: "2d10",
        name: "2d10 (Flat Distribution)",
        description: "Roll 2d10 for a flatter distribution (2-20 range)",
        diceCount: 2,
        dieSize: 10,
    },
};
/**
 * Built-in 0-level HP method definitions.
 */
export const BUILT_IN_ZERO_LEVEL_HP_METHODS = {
    "1d4": {
        id: "1d4",
        name: "1d4 (Standard)",
        description: "Roll 1d4 for starting HP",
        dieSize: 4,
    },
    "1d4-reroll-ones": {
        id: "1d4-reroll-ones",
        name: "1d4 (Re-roll 1s)",
        description: "Roll 1d4, re-roll any 1s",
        dieSize: 4,
        rerollBelow: 1,
    },
    "2d4-take-high": {
        id: "2d4-take-high",
        name: "2d4 Take High",
        description: "Roll 2d4 and take the higher result",
        dieSize: 4,
        takeMultiple: { count: 2, which: "highest" },
    },
    "1d2+2": {
        id: "1d2+2",
        name: "1d2+2",
        description: "Roll 1d2 and add 2 (3-4 HP)",
        dieSize: 2,
        modifier: 2,
    },
    "1d4+2": {
        id: "1d4+2",
        name: "1d4+2 (Snake's Method)",
        description: "Roll 1d4 and add 2 (3-6 HP)",
        dieSize: 4,
        modifier: 2,
    },
    max: {
        id: "max",
        name: "Maximum",
        description: "Always start with maximum HP (4)",
        dieSize: 4,
        useMax: true,
    },
};
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Merge user config with defaults
 */
export function resolveCharacterCreationConfig(userConfig) {
    if (!userConfig) {
        return { ...DEFAULT_CHARACTER_CREATION_CONFIG };
    }
    return {
        abilityScores: {
            ...DEFAULT_ABILITY_SCORE_CONFIG,
            ...userConfig.abilityScores,
        },
        hitPoints: {
            ...DEFAULT_HIT_POINT_CONFIG,
            ...userConfig.hitPoints,
        },
        birthAugur: {
            ...DEFAULT_BIRTH_AUGUR_CONFIG,
            ...userConfig.birthAugur,
        },
        occupation: {
            ...DEFAULT_OCCUPATION_CONFIG,
            ...userConfig.occupation,
        },
        classSelection: {
            ...DEFAULT_CLASS_SELECTION_CONFIG,
            ...userConfig.classSelection,
        },
        equipment: {
            ...DEFAULT_EQUIPMENT_CONFIG,
            ...userConfig.equipment,
        },
        languages: {
            ...DEFAULT_LANGUAGE_CONFIG,
            ...userConfig.languages,
        },
        dwarfRules: {
            ...DEFAULT_DWARF_RULES_CONFIG,
            ...userConfig.dwarfRules,
        },
        name: {
            ...DEFAULT_NAME_CONFIG,
            ...userConfig.name,
        },
        alignment: userConfig.alignment ?? DEFAULT_CHARACTER_CREATION_CONFIG.alignment,
        allowRandomAlignment: userConfig.allowRandomAlignment ??
            DEFAULT_CHARACTER_CREATION_CONFIG.allowRandomAlignment,
    };
}
/**
 * Get dice method definition by ID or built-in name.
 * Returns undefined if not found.
 */
export function getDiceMethodDefinition(method, customMethod, customMethodsRegistry) {
    // Built-in methods
    if (method !== "custom" && method !== "manual") {
        return BUILT_IN_DICE_METHODS[method];
    }
    // Custom method - inline definition
    if (method === "custom" && typeof customMethod === "object") {
        return customMethod;
    }
    // Custom method - lookup by ID
    if (method === "custom" && typeof customMethod === "string" && customMethodsRegistry) {
        return customMethodsRegistry[customMethod];
    }
    return undefined;
}
//# sourceMappingURL=character-creation.js.map