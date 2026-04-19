/**
 * Dice-related type definitions for DCC
 *
 * @see docs/MODIFIERS.md for the tagged-union RollModifier design and
 * the staged migration plan from LegacyRollModifier to RollModifier.
 */
/**
 * Standard DCC dice chain - the progression of dice sizes
 * d3 → d4 → d5 → d6 → d7 → d8 → d10 → d12 → d14 → d16 → d20 → d24 → d30
 */
export declare const DEFAULT_DICE_CHAIN: readonly [3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30];
export type DiceChainFaces = (typeof DEFAULT_DICE_CHAIN)[number];
/**
 * A die type string like "d20" or "d16"
 */
export type DieType = `d${number}`;
/**
 * How a roll should be handled
 */
export type RollMode = 'formula' | 'evaluate';
/**
 * Function signature for a synchronous custom dice roller.
 * Takes a dice expression (e.g., "1d20") and returns the total.
 */
export type DiceRoller = (expression: string) => number;
/**
 * Function signature for an asynchronous custom dice roller.
 * Use this when the underlying roll machinery is Promise-based
 * (e.g. FoundryVTT's `Roll.evaluate()` returns a Promise).
 */
export type AsyncDiceRoller = (expression: string) => Promise<number>;
/**
 * Options for synchronous roll evaluation.
 */
export interface RollOptions {
    /** Whether to just build the formula or actually evaluate it */
    mode?: RollMode;
    /** Synchronous custom roller — used instead of built-in RNG when provided */
    roller?: DiceRoller;
}
/**
 * Options for asynchronous roll evaluation. Used by evaluateRollAsync
 * and the async-sibling resolveSkillCheckAsync / rollCheckAsync variants.
 */
export interface RollOptionsAsync {
    /** Whether to just build the formula or actually evaluate it */
    mode?: RollMode;
    /** Asynchronous custom roller. Required for async evaluation. */
    roller: AsyncDiceRoller;
}
/**
 * ---------------------------------------------------------------------
 * Modifier types — tagged union
 *
 * See docs/MODIFIERS.md for the full design (principles, application
 * pipeline, DCC case catalogue).
 * ---------------------------------------------------------------------
 */
/**
 * Origin metadata — structured "why this modifier exists" information
 * used by renderers for grouping, filtering, and i18n.
 */
export interface ModifierOrigin {
    /** Which category this modifier falls into. Closed union. */
    category: ModifierCategory;
    /**
     * Stable identifier within the category. Examples:
     * - `'str'` for ability modifiers
     * - `'armor-check-penalty'` for the DCC armor check penalty
     * - `'mighty-deed'` for a warrior's deed die contribution
     * - a Foundry item/AE UUID for equipment or active-effect sources
     */
    id: string;
    /**
     * Human-readable label for display. Typically English at emission;
     * renderers may localize via a catalog. Optional — renderers can
     * synthesize a fallback from `category` + `id`.
     */
    label?: string;
    /**
     * Module identifier, only set when `category === 'module'`.
     * Examples: `'dcc-qol'`, `'xcc'`.
     */
    moduleId?: string;
    /**
     * Optional hint for future stacking-rule engines. Modifiers sharing
     * a stack group may be deduplicated or limited. Not interpreted by
     * the evaluator today; reserved for use by variants and homebrew.
     */
    stackGroup?: string;
}
/**
 * Closed union of origin categories. Adding a new category is a
 * breaking change (by design — it's a natural review point).
 * Use `'other'` as an escape hatch for genuinely ad-hoc cases.
 */
export type ModifierCategory = 'ability' | 'level' | 'progression' | 'luck-burn' | 'penalty' | 'equipment' | 'active-effect' | 'class-feature' | 'spell' | 'situational' | 'dialog-input' | 'module' | 'other';
/**
 * Flat numeric adjustment to the total. The most common case.
 * The evaluator sets `applied` to reflect whether the value contributed.
 */
export interface AddModifier {
    kind: 'add';
    value: number;
    origin: ModifierOrigin;
    /** Output-only: set by the evaluator. True if the value affected the total. */
    applied?: boolean;
}
/**
 * Add a dice expression to the formula (e.g. Mighty Deed "+1d3").
 */
export interface AddDiceModifier {
    kind: 'add-dice';
    /** A bare dice expression, e.g. "1d3", "2d6". */
    dice: string;
    origin: ModifierOrigin;
    /** Output-only: set by the evaluator. */
    applied?: boolean;
}
/**
 * Replace the base die with a specific die. When multiple `set-die`
 * modifiers are present, the LAST in list order wins.
 */
export interface SetDieModifier {
    kind: 'set-die';
    die: DieType;
    origin: ModifierOrigin;
}
/**
 * Shift the die up or down the DCC dice chain. Multiple bumps sum.
 */
export interface BumpDieModifier {
    kind: 'bump-die';
    /** Positive bumps up the chain; negative bumps down. */
    steps: number;
    origin: ModifierOrigin;
}
/**
 * Multiplicative factor applied after additive modifiers. Primarily
 * used by damage rolls (e.g. spell-effect damage doubling, critical
 * multipliers).
 */
export interface MultiplyModifier {
    kind: 'multiply';
    factor: number;
    origin: ModifierOrigin;
}
/**
 * Shift the effective threat range for critical detection.
 * Positive `amount` widens (e.g. 19-20 → 18-20); negative narrows.
 */
export interface ThreatShiftModifier {
    kind: 'threat-shift';
    amount: number;
    origin: ModifierOrigin;
}
/**
 * Shown in the breakdown but NOT added to the total. Informational.
 * Used for things like a 0-value Armor Check Penalty that players
 * still want to see.
 */
export interface DisplayModifier {
    kind: 'display';
    value: number;
    origin: ModifierOrigin;
}
/**
 * The tagged-union RollModifier. Every roll modification is one of
 * these variants; the evaluator dispatches on `kind`.
 *
 * @see docs/MODIFIERS.md §2 for the full design and §3 for the
 * application pipeline.
 */
export type RollModifier = AddModifier | AddDiceModifier | SetDieModifier | BumpDieModifier | MultiplyModifier | ThreatShiftModifier | DisplayModifier;
/**
 * ---------------------------------------------------------------------
 * Legacy modifier type
 *
 * The former flat `{ source, value, label }` shape. Frozen in form.
 * Subsystems that haven't migrated to the tagged-union `RollModifier`
 * yet (combat, spells, patron, occupation — see docs/MODIFIERS.md §9)
 * continue to use this type. It will be deleted when every subsystem
 * has migrated.
 *
 * Do NOT use this type in new code — always reach for `RollModifier`.
 * ---------------------------------------------------------------------
 */
export interface LegacyRollModifier {
    /** Source of the modifier (e.g., "strength", "luck", "situational") */
    source: string;
    /** The modifier value */
    value: number;
    /** Optional label for display */
    label?: string;
}
/**
 * Result of a dice roll
 */
export interface RollResult {
    /** The complete formula (e.g., "1d20+5") */
    formula: string;
    /** Breakdown of all legacy-shape modifiers that contributed. Produced
     *  by evaluateRoll from the parsed formula for backward compatibility
     *  with consumers that haven't migrated to the new RollModifier yet. */
    modifiers: LegacyRollModifier[];
    /** The total result - only present if mode was 'evaluate' */
    total?: number;
    /** The natural die roll before modifiers - only present if mode was 'evaluate' */
    natural?: number;
    /** The die used for the roll (e.g., "d20") */
    die: DieType;
    /** Number of dice rolled */
    diceCount: number;
}
/**
 * A parsed dice expression
 */
export interface ParsedDiceExpression {
    /** Number of dice (e.g., 2 in "2d20") */
    count: number;
    /** Faces on each die (e.g., 20 in "2d20") */
    faces: number;
    /** Any suffix after the dice (e.g., "+5" in "1d20+5") */
    suffix: string;
    /** The original expression */
    original: string;
}
//# sourceMappingURL=dice.d.ts.map