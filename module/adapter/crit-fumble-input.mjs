/**
 * Crit + fumble input adapter (Phase 3 session 6).
 *
 * Translates Foundry actor + weapon state into the shapes the lib's
 * `rollCritical` and `rollFumble` consume (`CriticalInput` / `FumbleInput`
 * in `vendor/dcc-core-lib/types/combat.d.ts`). Narrow slice — only the
 * "simplest-weapon happy-path" finisher rolls: the attack itself must
 * have produced a `libResult` (i.e. `attackRollResult.libResult` is
 * present — post-D1 that's every attack that rolled), and
 * `automateDamageFumblesCrits` must be on so the Foundry Roll
 * actually evaluates.
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
 * `defenderLuckModifier` (optional) is a targeted PC's Luck for a monster crit
 * scored against them — per RAW it reduces (positive) or boosts (negative) the
 * monster's crit roll. Only set when truthy so ordinary crits are unchanged.
 *
 * `critAdjustment` (optional) is the actor's `attributes.critical.otherMod`
 * (#1079, e.g. the Warrior's Arm birth augur), passed as a lib `bonuses`
 * entry. Only set when non-zero.
 *
 * @param {{critDie: string, luckModifier: number, defenderLuckModifier?: number, critAdjustment?: number, critTableName: string}} args
 * @returns {import('../vendor/dcc-core-lib/types/combat.js').CriticalInput}
 */
export function buildCriticalInput ({ critDie, luckModifier, defenderLuckModifier, critAdjustment, critTableName }) {
  const input = {
    critTable: critTableName || DEFAULT_CRIT_TABLE,
    critDie: normalizeLibDie(critDie),
    luckModifier
  }
  if (defenderLuckModifier) input.defenderLuckModifier = defenderLuckModifier
  if (critAdjustment) {
    input.bonuses = [{
      id: 'other:crit-adjustment',
      label: 'Crit adjustment',
      source: { type: 'other' },
      category: 'other',
      effect: { type: 'modifier', value: critAdjustment }
    }]
  }
  return input
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
 * `fumbleAdjustment` (optional) is the actor's `attributes.fumble.otherMod`
 * (#1079, e.g. The Broken Star birth augur). It uses Luck's sign (positive
 * = better), and the lib's `FumbleInput` has no other modifier slot, so it
 * is folded into `luckModifier`. The lib then subtracts the sum, matching
 * the extra term in the Foundry formula.
 *
 * @param {{fumbleDie: string, luckModifier: number, fumbleAdjustment?: number}} args
 * @returns {import('../vendor/dcc-core-lib/types/combat.js').FumbleInput}
 */
export function buildFumbleInput ({ fumbleDie, luckModifier, fumbleAdjustment = 0 }) {
  return {
    armorType: FUMBLE_ARMOR_TYPE_PLACEHOLDER,
    luckModifier: luckModifier + fumbleAdjustment,
    fumbleDieOverride: normalizeLibDie(fumbleDie)
  }
}
