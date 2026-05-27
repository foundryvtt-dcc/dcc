/**
 * Unified Skill System Types
 *
 * All class abilities are modeled as skills. There is no fundamental difference
 * between a thief's "Climb Sheer Surfaces" and a cleric's "Turn Unholy" -
 * they're both skills with different configurations.
 */
import type { DieType, RollModifier } from "./dice.js";
/**
 * Types of skills
 *
 * - check: Standalone roll that produces a result (thief skills, turn unholy)
 * - modifier: Passive bonus that modifies other actions (lucky sign, armor training)
 * - passive: Enables other game mechanics (mighty deed, shield bash)
 */
export type SkillType = "check" | "modifier" | "passive";
/**
 * What action a modifier skill affects
 */
export type ModifiableAction = "attack" | "damage" | "initiative" | "save" | "ac" | "spell-check" | "skill-check";
/**
 * How level affects a skill's roll
 */
export type LevelModifierType = "none" | "full" | "half" | "class-level" | "caster-level" | "custom";
/**
 * Resource types that skills can cost
 */
export type ResourceType = "luck" | "spellburn" | "disapproval" | "hp" | "custom";
/**
 * Modifier effect types
 */
export type ModifierEffectType = "flat" | "luck" | "luck-multiplied" | "die" | "ability";
/**
 * Effect of a modifier skill
 */
export interface ModifierEffect {
    type: ModifierEffectType;
    /** For flat bonuses */
    value?: number;
    /** For luck-multiplied effects */
    multiplier?: number;
    /** For die-based effects */
    die?: DieType;
    /** For ability-based effects */
    ability?: string;
}
/**
 * Configuration for a skill's roll
 */
export interface SkillRollConfig {
    /** Base die to roll (e.g., "d20", "d24") */
    die: DieType;
    /** Can this die be bumped up/down the dice chain? */
    useDiceChain?: boolean;
    /** Which ability modifier applies (if any) */
    ability?: string;
    /** How level affects the roll */
    levelModifier?: LevelModifierType;
    /** Can luck be applied to this roll? */
    allowLuck?: boolean;
    /** Luck multiplier (default 1) */
    luckMultiplier?: number;
}
/**
 * Configuration for table-based results
 */
export interface ResultTableConfig {
    /** ID of the table to look up */
    tableId: string;
    /** Additional modifier to the table roll */
    rollModifier?: string;
    /** Column to use in the table (if multi-column) */
    column?: string;
}
/**
 * Configuration for skills that modify other actions
 */
export interface ModifiesConfig {
    /** What action this skill modifies */
    action: ModifiableAction;
    /** The effect to apply */
    effect: ModifierEffect;
    /** Condition when this applies (e.g., "with-melee-weapon") */
    condition?: string;
}
/**
 * Configuration for skills that enable other mechanics
 */
export interface EnablesConfig {
    /** What action/mechanic this enables */
    action: string;
    /** When this triggers (e.g., "on-attack", "wielding-shield") */
    condition?: string;
    /** Additional data for the enabled action */
    data?: Record<string, unknown>;
}
/**
 * Resource cost for using a skill
 */
export interface SkillCost {
    /** Type of resource consumed */
    resource: ResourceType;
    /** Amount consumed (number or formula) */
    amount: number | string;
    /** When the cost is paid (before roll, after failure, etc.) */
    timing?: "before" | "after-failure" | "after-success" | "always";
}
/**
 * Level-based progression for a skill
 */
export interface SkillProgression {
    /** Die to use at this level */
    die?: DieType;
    /** Flat bonus at this level */
    bonus?: number;
    /** For enabling skills, what's enabled at this level */
    enables?: EnablesConfig;
    /** Any other level-specific data */
    data?: Record<string, unknown>;
}
/**
 * Complete skill definition
 *
 * This is the core of the unified skill system. Every class ability,
 * from thief skills to turn unholy to mighty deeds, is defined as a skill.
 */
export interface SkillDefinition {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Description of what the skill does */
    description?: string;
    /** What type of skill this is */
    type: SkillType;
    /** Roll configuration (for check-type skills) */
    roll?: SkillRollConfig;
    /** Result table configuration */
    resultTable?: ResultTableConfig;
    /** What this skill modifies (for modifier-type skills) */
    modifies?: ModifiesConfig;
    /** What this skill enables (for passive-type skills) */
    enables?: EnablesConfig;
    /** Level-based progression */
    progression?: Record<number, SkillProgression>;
    /** Resource cost to use */
    cost?: SkillCost;
    /** Tags for categorization and filtering */
    tags?: string[];
    /** Which classes have access to this skill */
    classes?: string[];
    /** Alignment restrictions */
    alignments?: string[];
}
/**
 * Input for resolving a skill check
 */
export interface SkillCheckInput {
    /** The skill being used */
    skill: SkillDefinition;
    /** Character's ability scores */
    abilities: Record<string, number>;
    /** Character's level */
    level: number;
    /** Character's class (for class-level modifiers) */
    classId?: string;
    /** Situational modifiers */
    situationalModifiers?: RollModifier[];
    /** Current luck score (for luck-based bonuses) */
    luck?: number;
    /** Luck to burn on this roll */
    luckBurn?: number;
}
/**
 * Result from looking up a result table
 */
export interface TableLookupResult {
    /** The table that was used */
    tableId: string;
    /** The roll result used for lookup */
    rollValue: number;
    /** The text result from the table */
    text: string;
    /** Any structured data from the table entry */
    data?: Record<string, unknown>;
}
/**
 * Effect produced by a skill
 */
export interface SkillEffect {
    /** Type of effect */
    type: string;
    /** Target of the effect */
    target?: string;
    /** Duration of the effect */
    duration?: string;
    /** Numeric value of the effect */
    value?: number;
    /** Description of the effect */
    description?: string;
}
/**
 * Complete result of a skill check
 */
export interface SkillCheckResult {
    /** The skill that was used */
    skillId: string;
    /** The die that was rolled */
    die: DieType;
    /** The natural die result (if evaluated) */
    natural?: number;
    /** All modifiers that were applied */
    modifiers: RollModifier[];
    /** The total result (if evaluated) */
    total?: number;
    /** The complete roll formula */
    formula: string;
    /** Result from table lookup (if applicable) */
    tableResult?: TableLookupResult;
    /** Whether the check succeeded (if determinable) */
    success?: boolean;
    /** Whether this was a critical success */
    critical?: boolean;
    /** Whether this was a fumble */
    fumble?: boolean;
    /** Effects produced by this skill use */
    effects?: SkillEffect[];
    /** Resources consumed */
    resourcesConsumed?: {
        resource: ResourceType;
        amount: number;
    }[];
}
/**
 * Event callbacks for skill resolution
 */
export interface SkillEvents {
    /** Called when skill check starts */
    onSkillCheckStart?: (input: SkillCheckInput) => void;
    /** Called when skill check completes */
    onSkillCheckComplete?: (result: SkillCheckResult) => void;
    /** Called on critical success */
    onCritical?: (result: SkillCheckResult) => void;
    /** Called on fumble */
    onFumble?: (result: SkillCheckResult) => void;
    /** Called when resources are consumed */
    onResourceConsumed?: (resource: ResourceType, amount: number) => void;
    /** Called when a table lookup occurs */
    onTableLookup?: (result: TableLookupResult) => void;
}
//# sourceMappingURL=skills.d.ts.map