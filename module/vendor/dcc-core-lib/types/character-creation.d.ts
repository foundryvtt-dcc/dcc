/**
 * Character Creation Configuration Types
 *
 * Options for customizing character generation rules.
 * Supports standard DCC rules plus common house rules and variants.
 *
 * Uses hybrid approach: built-in methods as union types + "custom" option
 * that references data-defined methods for extensibility.
 */
import type { Alignment } from "./system.js";
/**
 * Definition for a custom dice rolling method.
 * Used when ability score method is "custom".
 */
export interface DiceMethodDefinition {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Description of the method */
    description?: string;
    /** Number of dice to roll */
    diceCount: number;
    /** Die size (e.g., 6 for d6) */
    dieSize: number;
    /**
     * How many dice to keep after rolling.
     * If undefined, keep all dice.
     */
    keep?: {
        count: number;
        which: "highest" | "lowest";
    };
    /**
     * Flat modifier to add after rolling.
     * e.g., +6 for "2d6+6"
     */
    modifier?: number;
    /**
     * Divisor to apply after rolling.
     * e.g., 2 for "6d6/2"
     */
    divisor?: number;
    /**
     * Minimum result (floor).
     * e.g., 3 for methods that can't go below 3
     */
    minimum?: number;
    /**
     * Maximum result (ceiling).
     * e.g., 18 for standard ability scores
     */
    maximum?: number;
}
/**
 * Definition for a custom hit point rolling method.
 */
export interface HPMethodDefinition {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Description of the method */
    description?: string;
    /**
     * Die size override.
     * If undefined, uses class hit die.
     */
    dieSize?: number;
    /**
     * Number of dice to roll.
     * Default: 1
     */
    diceCount?: number;
    /**
     * Re-roll dice that show this value or lower.
     * e.g., 1 for "re-roll 1s"
     */
    rerollBelow?: number;
    /**
     * Roll multiple dice and take highest/lowest.
     */
    takeMultiple?: {
        count: number;
        which: "highest" | "lowest";
    };
    /**
     * Flat modifier to add.
     */
    modifier?: number;
    /**
     * Use maximum possible value instead of rolling.
     */
    useMax?: boolean;
    /**
     * Use average (rounded up) instead of rolling.
     */
    useAverage?: boolean;
    /**
     * Use percentage of maximum possible.
     * e.g., 0.5 for 50%
     */
    percentageOfMax?: number;
}
/**
 * Definition for a custom lucky sign mode.
 */
export interface LuckySignModeDefinition {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Description of the mode */
    description?: string;
    /**
     * Hide the lucky sign if luck modifier meets this condition.
     * e.g., "zero" to hide when modifier is 0
     */
    hideWhen?: "zero" | "negative" | "non-positive";
    /**
     * Minimum bonus to apply (floor).
     * e.g., 1 for "always at least +1"
     */
    minimumBonus?: number;
    /**
     * Only apply if luck modifier is positive.
     */
    positiveOnly?: boolean;
    /**
     * Use the better of luck modifier or this value.
     * e.g., 1 for "luck mod OR +1, whichever higher"
     */
    minimumOrLuck?: number;
}
/**
 * Built-in methods for generating ability scores.
 * Use "custom" with a DiceMethodDefinition for other methods.
 */
export type AbilityScoreMethod = "3d6" | "4d6-drop-lowest" | "2d6+6" | "2d10" | "manual" | "custom";
/**
 * Configuration for ability score generation
 */
export interface AbilityScoreConfig {
    /** Method for rolling ability scores */
    method: AbilityScoreMethod;
    /**
     * Custom method definition (required if method is "custom").
     * Can be inline definition or string ID referencing loaded data.
     */
    customMethod?: DiceMethodDefinition | string;
    /** For manual method: the scores to use [str, agl, sta, per, int, lck] */
    manualScores?: [number, number, number, number, number, number];
    /**
     * Minimum total ability modifier sum allowed.
     * Characters below this are re-rolled.
     * undefined = no minimum
     */
    minTotalModifier?: number;
    /**
     * Maximum total ability modifier sum allowed.
     * Characters above this are re-rolled.
     * undefined = no maximum
     */
    maxTotalModifier?: number;
    /**
     * Re-roll if primary class stats are below threshold.
     * When true, re-rolls if primary stat < 11 or secondary stat < 8.
     */
    rerollLowPrimaryStats?: boolean;
}
/**
 * Built-in methods for rolling 0-level hit points.
 * Use "custom" with an HPMethodDefinition for other methods.
 */
export type ZeroLevelHPMethod = "1d4" | "1d4-reroll-ones" | "2d4-take-high" | "1d2+2" | "1d4+2" | "max" | "custom";
/**
 * Built-in methods for rolling leveled character hit points.
 * Use "custom" with an HPMethodDefinition for other methods.
 */
export type LeveledHPMethod = "standard" | "reroll-ones" | "average" | "max" | "percentage" | "custom";
/**
 * Configuration for hit point generation
 */
export interface HitPointConfig {
    /** Method for 0-level HP */
    zeroLevelMethod: ZeroLevelHPMethod;
    /**
     * Custom 0-level HP method (required if zeroLevelMethod is "custom").
     * Can be inline definition or string ID referencing loaded data.
     */
    customZeroLevelMethod?: HPMethodDefinition | string;
    /** Method for leveled HP */
    leveledMethod: LeveledHPMethod;
    /**
     * Custom leveled HP method (required if leveledMethod is "custom").
     * Can be inline definition or string ID referencing loaded data.
     */
    customLeveledMethod?: HPMethodDefinition | string;
    /**
     * For percentage method: what % of max HP (0.25 to 1.0)
     * e.g., 0.5 = 50% of maximum possible HP
     */
    hpPercentage?: number;
    /**
     * Minimum HP per level (after STA mod).
     * Common house rule: minimum 1 HP per level.
     */
    minHPPerLevel?: number;
}
/**
 * Built-in modes for handling the birth augur / lucky sign.
 * Use "custom" with a LuckySignModeDefinition for other modes.
 */
export type LuckySignMode = "standard" | "hide-if-zero" | "minimum-plus-one" | "positive-only" | "best-of" | "custom";
/**
 * Configuration for birth augur handling
 */
export interface BirthAugurConfig {
    /** How to handle the lucky sign bonus */
    mode: LuckySignMode;
    /**
     * Custom mode definition (required if mode is "custom").
     * Can be inline definition or string ID referencing loaded data.
     */
    customMode?: LuckySignModeDefinition | string;
    /**
     * Specific augur ID to assign (if not random).
     * If undefined, roll randomly.
     */
    specificAugurId?: string;
}
/**
 * Built-in sources for occupation tables.
 * Use "custom" with a table ID for other sources.
 */
export type OccupationSource = "core" | "core-human" | "core-demihuman" | "custom";
/**
 * Configuration for occupation selection
 */
export interface OccupationConfig {
    /** Source for occupation table */
    source: OccupationSource;
    /**
     * Custom occupation table ID (required if source is "custom").
     */
    customTableId?: string;
    /**
     * Specific occupation to assign (if not random).
     * If undefined, roll randomly from source table.
     */
    specificOccupation?: string;
}
/**
 * Configuration for class selection
 */
export interface ClassSelectionConfig {
    /**
     * Specific class to assign.
     * If undefined, either random or determined by other means.
     */
    classId?: string;
    /**
     * If true and classId is undefined, pick randomly.
     * If false and classId is undefined, error.
     */
    allowRandom?: boolean;
    /**
     * Classes to include in random selection.
     * If undefined, all classes from system config are available.
     */
    availableClasses?: string[];
}
/**
 * Configuration for starting equipment and funds
 */
export interface EquipmentConfig {
    /** Include starting funds from occupation */
    includeFunds: boolean;
    /** Include trade goods from occupation */
    includeTradeGoods: boolean;
    /** Include occupation-based equipment */
    includeOccupationEquipment: boolean;
    /** Include occupation weapon */
    includeOccupationWeapon: boolean;
}
/**
 * Configuration for language assignment
 */
export interface LanguageConfig {
    /** Determine bonus languages from INT */
    determineBonusLanguages: boolean;
    /**
     * Non-humans always get racial language regardless of INT.
     * Standard rule: need INT 8+ for racial language.
     */
    alwaysGrantRacialLanguage: boolean;
}
/**
 * Configuration for automatic name generation
 */
export interface NameConfig {
    /** Generate a random name for the character */
    generateName: boolean;
    /**
     * Include epithet in generated name.
     * e.g., "the Bold", "Ironfoot"
     */
    includeEpithet?: boolean;
    /**
     * Chance of including epithet if enabled (0-1).
     * Default: 0.3 (30%)
     */
    epithetChance?: number;
}
/**
 * Default name configuration (no automatic generation)
 */
export declare const DEFAULT_NAME_CONFIG: NameConfig;
/**
 * Configuration for dwarf-specific rules
 */
export interface DwarfRulesConfig {
    /**
     * Ignore armor speed penalty for dwarves.
     * House rule: dwarves are unaffected by heavy armor.
     */
    ignoreArmorSpeedPenalty: boolean;
}
/**
 * Complete configuration for character creation.
 *
 * All fields are optional - unspecified fields use defaults.
 */
export interface CharacterCreationConfig {
    /** Ability score generation options */
    abilityScores?: Partial<AbilityScoreConfig>;
    /** Hit point generation options */
    hitPoints?: Partial<HitPointConfig>;
    /** Birth augur / lucky sign options */
    birthAugur?: Partial<BirthAugurConfig>;
    /** Occupation selection options */
    occupation?: Partial<OccupationConfig>;
    /** Class selection options (for leveled characters) */
    classSelection?: Partial<ClassSelectionConfig>;
    /** Equipment and funds options */
    equipment?: Partial<EquipmentConfig>;
    /** Language options */
    languages?: Partial<LanguageConfig>;
    /** Dwarf-specific rules */
    dwarfRules?: Partial<DwarfRulesConfig>;
    /** Name generation options */
    name?: Partial<NameConfig>;
    /** Alignment (if not random) */
    alignment?: Alignment;
    /** Allow random alignment if not specified */
    allowRandomAlignment?: boolean;
}
/**
 * Default ability score configuration (standard DCC rules)
 */
export declare const DEFAULT_ABILITY_SCORE_CONFIG: AbilityScoreConfig;
/**
 * Default hit point configuration (standard DCC rules)
 */
export declare const DEFAULT_HIT_POINT_CONFIG: HitPointConfig;
/**
 * Default birth augur configuration (standard DCC rules)
 */
export declare const DEFAULT_BIRTH_AUGUR_CONFIG: BirthAugurConfig;
/**
 * Default occupation configuration (standard DCC rules)
 */
export declare const DEFAULT_OCCUPATION_CONFIG: OccupationConfig;
/**
 * Default class selection configuration
 */
export declare const DEFAULT_CLASS_SELECTION_CONFIG: ClassSelectionConfig;
/**
 * Default equipment configuration (standard DCC rules)
 */
export declare const DEFAULT_EQUIPMENT_CONFIG: EquipmentConfig;
/**
 * Default language configuration (standard DCC rules)
 */
export declare const DEFAULT_LANGUAGE_CONFIG: LanguageConfig;
/**
 * Default dwarf rules configuration (standard DCC rules)
 */
export declare const DEFAULT_DWARF_RULES_CONFIG: DwarfRulesConfig;
/**
 * Complete default configuration (standard DCC rules)
 */
export declare const DEFAULT_CHARACTER_CREATION_CONFIG: Required<CharacterCreationConfig>;
/**
 * Built-in dice method definitions.
 * These correspond to the AbilityScoreMethod union values.
 */
export declare const BUILT_IN_DICE_METHODS: Record<Exclude<AbilityScoreMethod, "manual" | "custom">, DiceMethodDefinition>;
/**
 * Built-in 0-level HP method definitions.
 */
export declare const BUILT_IN_ZERO_LEVEL_HP_METHODS: Record<Exclude<ZeroLevelHPMethod, "custom">, HPMethodDefinition>;
/**
 * Merge user config with defaults
 */
export declare function resolveCharacterCreationConfig(userConfig?: CharacterCreationConfig): Required<CharacterCreationConfig>;
/**
 * Get dice method definition by ID or built-in name.
 * Returns undefined if not found.
 */
export declare function getDiceMethodDefinition(method: AbilityScoreMethod, customMethod?: DiceMethodDefinition | string, customMethodsRegistry?: Record<string, DiceMethodDefinition>): DiceMethodDefinition | undefined;
//# sourceMappingURL=character-creation.d.ts.map