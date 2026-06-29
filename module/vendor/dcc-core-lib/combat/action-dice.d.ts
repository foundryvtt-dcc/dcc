/**
 * Multiple action dice — the per-round action-die budget.
 *
 * In DCC a character's action die is normally `1d20`; higher-level
 * characters and many monsters get more than one, letting them take more
 * than one action in a round. This module owns the *mechanics* of that
 * budget as pure functions:
 *
 * - parse an authoring string (`"1d20+4, 1d16*spell"`, `"2d20"`) into a
 *   structured list of {@link ActionDieSlot}s;
 * - know what each slot may be spent on (the wizard's second die is
 *   spells-only; every other class is unrestricted — see
 *   {@link classExtraActionDieUse});
 * - pick which die a given action consumes and spend it
 *   ({@link nextActionDie}, {@link spendActionDie});
 * - reconcile a slot's own modifier against the generic attack bonus so a
 *   `"1d20+4"` slot does not double-count ({@link actionDieRollTerms}).
 *
 * The lib does NOT persist per-round state or know about settings — the
 * caller (e.g. the Foundry system) owns the {@link ActionDiceState} and
 * decides whether the feature is active. Everything here is side-effect-free.
 */
import type { ActionDiceState, ActionDieRollTerms, ActionDieSlot, ActionDieUse, ActionType } from "../types/combat.js";
/**
 * The `use` of a class's *extra* (slot ≥ 1) action dice.
 *
 * Verified against the DCC core-book class descriptions: the **wizard** is
 * the only core class that restricts an extra action die ("his second
 * action die can only be used for spell checks"). The elf and cleric are
 * casters too, but their extra dice are explicitly unrestricted, as are the
 * warrior, dwarf, thief, and halfling. The primary die (slot 0) is always
 * `"any"` regardless of class.
 *
 * @param className - The actor's class identifier (case-insensitive).
 * @returns `"spell"` for a wizard, `"any"` for every other class.
 */
export declare function classExtraActionDieUse(className: string | undefined): ActionDieUse;
/**
 * Parse an action-dice authoring value into structured slots.
 *
 * Accepts the comma string used throughout the system (`"1d20,1d16"`), a
 * pre-split array, NPC stat-block forms (`"2d20"`, `"1d24+1d20"`), per-die
 * riders (`"1d20+4"`), and an optional `*use` tag per token
 * (`"1d16*spell"`). Within a token, `+`-separated segments that are dice
 * become their own slots while a bare `+N` number is a rider on the
 * preceding slot; a leading count (`"2d20"`) expands to that many slots.
 *
 * The `use` of each slot is resolved as: an explicit `*tag` wins; otherwise
 * slot 0 is `"any"` and extra slots take {@link classExtraActionDieUse} for
 * `opts.className` (so an unchanged `"1d20,1d16"` yields a spells-only
 * second die for a wizard and two `"any"` dice for everyone else).
 *
 * @param input - Comma string or array of tokens.
 * @param opts.className - Class identifier used to infer extra-die `use`.
 * @returns Slots in authoring order, each with a single die (count 1).
 */
export declare function parseActionDice(input: string | string[], opts?: {
    className?: string;
}): ActionDieSlot[];
/**
 * Whether a slot's `use` tag permits a given action.
 *
 * `"any"` permits everything; a specific tag permits only the matching
 * action (so a spells-only die rejects both attacks and skill checks, and
 * an attack-only die rejects spells and checks). Unknown homebrew tags
 * permit only an action whose name equals the tag.
 */
export declare function actionMatchesUse(use: ActionDieUse, action: ActionType): boolean;
/**
 * The next unspent slot eligible for `action`, in budget order.
 *
 * Use this both to default a roll dialog's action-die preset and to pick
 * the slot to spend when a roll resolves. Returns `null` when the actor is
 * out of eligible dice (over budget, or no remaining die permits the
 * action — e.g. a wizard whose only unspent die is spells-only attempting
 * a weapon attack).
 *
 * @param slots - The actor's action-die budget.
 * @param state - Live per-round spend state (`spent` may be shorter than
 *                `slots`; missing entries count as unspent).
 * @param action - The action being attempted.
 */
export declare function nextActionDie(slots: ActionDieSlot[], state: ActionDiceState, action: ActionType): {
    slot: ActionDieSlot;
    index: number;
} | null;
/**
 * Mark a slot spent, returning a new state (the input is not mutated).
 * Out-of-range indices extend `spent` with unspent entries as needed.
 */
export declare function spendActionDie(state: ActionDiceState, index: number): ActionDiceState;
/**
 * A fresh all-unspent state for the given round, sized to `slots`.
 * Call this on a combatant's turn to reset its budget.
 */
export declare function resetActionDice(slots: ActionDieSlot[], round: number): ActionDiceState;
/**
 * Whether `state` belongs to `round`. The caller resets when this is false
 * at the start of a combatant's turn (the lib does not watch the clock).
 */
export declare function isActionDiceStateCurrent(state: ActionDiceState, round: number): boolean;
/**
 * Resolve the roll terms for a chosen slot, reconciling its own modifier
 * against the generic attack bonus.
 *
 * When a slot carries a non-zero modifier (a `"1d20+4"` rider), that
 * modifier is the authoritative per-die adjustment and the caller must
 * suppress the generic attack-bonus term for this action — otherwise the
 * bonus is counted twice. Slots without a rider fall through to the
 * caller's normal attack-bonus / ability-modifier logic.
 */
export declare function actionDieRollTerms(slot: ActionDieSlot): ActionDieRollTerms;
