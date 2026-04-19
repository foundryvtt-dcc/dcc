/**
 * Crit + fumble input adapter (Phase 3 session 6).
 *
 * Translates Foundry actor + weapon state into the shapes the lib's
 * `rollCritical` and `rollFumble` consume (`CriticalInput` / `FumbleInput`
 * in `vendor/dcc-core-lib/types/combat.d.ts`). Narrow slice — only the
 * "simplest-weapon happy-path" finisher rolls: the attack itself must
 * have gone through `_rollToHitViaAdapter` (i.e. `attackRollResult.libResult`
 * is present), and `automateDamageFumblesCrits` must be on so the
 * Foundry Roll actually evaluates.
 *
 * Same two-pass pattern session 5 used for damage: Foundry's
 * `DCCRoll.createRoll` owns the chat render + the visible total; the
 * lib's `rollCritical` / `rollFumble` is called AFTER evaluation with
 * a deterministic sync roller that replays the natural die, purely to
 * populate `dcc.libCritResult` / `dcc.libFumbleResult` on chat flags.
 * No divergence with the displayed total this session.
 */
import { normalizeLibDie } from './attack-input.mjs'

/**
 * Fallback crit-table id when the actor's `attributes.critical.table` and
 * the weapon's `system.critTable` are both empty. Matches the legacy
 * `rollWeaponAttack` default.
 */
const DEFAULT_CRIT_TABLE = 'I'

/**
 * Armor-type placeholder the lib requires on `FumbleInput` but ignores
 * whenever `fumbleDieOverride` is set (which the adapter always does —
 * see `buildFumbleInput` for the rationale).
 */
const FUMBLE_ARMOR_TYPE_PLACEHOLDER = 'unarmored'

/**
 * Build a lib `CriticalInput` for a weapon crit.
 *
 * The caller passes the resolved crit die (Foundry-style, e.g. `'1d10'`)
 * and the luck modifier as a plain integer. `critTableName` is whatever
 * Foundry's `weapon.system.critTable` / `actor.system.attributes.critical.table`
 * resolves to (e.g. `'III'`); the lib records it on the result but does
 * not validate it, so unknown table names pass through untouched.
 *
 * @param {{critDie: string, luckModifier: number, critTableName: string}} args
 * @returns {import('../vendor/dcc-core-lib/types/combat.js').CriticalInput}
 */
export function buildCriticalInput ({ critDie, luckModifier, critTableName }) {
  return {
    critTable: critTableName || DEFAULT_CRIT_TABLE,
    critDie: normalizeLibDie(critDie),
    luckModifier
  }
}

/**
 * Build a lib `FumbleInput` for a weapon fumble.
 *
 * For the adapter slice we always pass `fumbleDieOverride` — the Foundry
 * side already resolves which die to roll (PC fumble die from armor /
 * `this.system.attributes.fumble.die`, or the fixed `'1d10'` NPC fumble
 * table die). The `armorType` field is still required by the lib's
 * `FumbleInput` type but is ignored when `fumbleDieOverride` is set;
 * we pass `FUMBLE_ARMOR_TYPE_PLACEHOLDER` as a stable placeholder.
 *
 * The lib subtracts `luckModifier` from the fumble total (positive luck
 * → lower, better result). That matches the Foundry-side formula
 * `${fumbleDie}${-luck}` built in `rollWeaponAttack`.
 *
 * @param {{fumbleDie: string, luckModifier: number}} args
 * @returns {import('../vendor/dcc-core-lib/types/combat.js').FumbleInput}
 */
export function buildFumbleInput ({ fumbleDie, luckModifier }) {
  return {
    armorType: FUMBLE_ARMOR_TYPE_PLACEHOLDER,
    luckModifier,
    fumbleDieOverride: normalizeLibDie(fumbleDie)
  }
}
