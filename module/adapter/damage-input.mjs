/**
 * Damage-input adapter (Phase 3 session 5).
 *
 * Translates a Foundry weapon damage formula + the resolved attack result
 * into the shape the lib's `rollDamage` consumes (`DamageInput` in
 * `vendor/dcc-core-lib/types/combat.d.ts`). Narrow slice — only the
 * "simplest damage happy-path": a single die plus an optional flat
 * modifier, no per-term flavors, no backstab damage swap, no deed die
 * injection. The dispatcher in `rollWeaponAttack` enforces the gate
 * (`_canRouteDamageViaAdapter`) before calling `buildDamageInput`.
 *
 * Phase 3 session 5 keeps the Foundry `Roll` as the source of truth for
 * chat rendering + the damage total (same two-pass pattern session 2
 * used for attacks). The lib result is called AFTER Foundry evaluates,
 * purely to populate `libDamageResult` on chat flags. No divergence
 * with the displayed total this session.
 */

const SIMPLE_DAMAGE_PATTERN = /^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i

/**
 * Parse a simple Foundry damage formula into its constituent parts.
 *
 * Returns `null` if the formula contains anything more complex than a
 * single `NdM` term with an optional flat modifier (per-term flavors,
 * multiple dice groups, `@ab`-style substitutions, sub-expressions are
 * all bounced out — the gate rejects those before `buildDamageInput`
 * runs, so reaching `null` here is a bug / unexpected input).
 *
 * @param {string} formula
 * @returns {{diceCount: number, die: string, modifier: number} | null}
 */
export function parseDamageFormula (formula) {
  if (typeof formula !== 'string') return null
  const match = formula.match(SIMPLE_DAMAGE_PATTERN)
  if (!match) return null
  const diceCount = match[1] ? parseInt(match[1], 10) : 1
  const die = `d${match[2]}`
  const modifier = match[3] ? parseInt(match[3].replace(/\s+/g, ''), 10) : 0
  if (!Number.isFinite(diceCount) || diceCount < 1) return null
  if (!Number.isFinite(modifier)) return null
  return { diceCount, die, modifier }
}

/**
 * Build a lib `DamageInput` from a parsed damage formula.
 *
 * For the simplest-damage slice, the formula already bakes in the
 * strength modifier + any other Foundry-side derivations from
 * `computeMeleeAndMissileAttackAndDamage`. We pass the flat modifier
 * as `strengthModifier` and leave `deedDieResult` / `magicBonus` /
 * `backstabMultiplier` / `bonuses` absent — the gate ensures those
 * cases don't reach here. A later slice that splits apart class/str
 * contributions can broaden this.
 *
 * @param {{diceCount: number, die: string, modifier: number}} parsed
 * @returns {import('../vendor/dcc-core-lib/types/combat.js').DamageInput}
 */
export function buildDamageInput (parsed) {
  return {
    damageDie: parsed.die,
    diceCount: parsed.diceCount,
    strengthModifier: parsed.modifier
  }
}
