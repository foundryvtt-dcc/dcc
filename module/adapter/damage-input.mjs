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

const SIMPLE_DAMAGE_PATTERN = /^\s*(\d*)d(\d+)\s*((?:[+-]\s*\d+\s*)*)$/i

/**
 * Parse a simple Foundry damage formula into its constituent parts.
 *
 * Accepts a single `NdM` term followed by any number of flat integer
 * modifiers (`+2`, `+2+1`, `-1+3`, etc.) — all summed into `modifier`.
 * The multi-modifier shape is the normal case for a PC with any
 * damageBonus + damageWeaponBonus stack (item.js concatenates them as
 * `NdM+strMod+magicMod`).
 *
 * Returns `null` for per-term flavors, dice-bearing modifiers (e.g.
 * `+1d4`), `@ab`-style substitutions, or sub-expressions — the gate
 * rejects those before `buildDamageInput` runs, so reaching `null` here
 * is a bug / unexpected input.
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
  const modifierTail = (match[3] || '').replace(/\s+/g, '')
  let modifier = 0
  if (modifierTail) {
    const parts = modifierTail.match(/[+-]\d+/g) || []
    for (const part of parts) modifier += parseInt(part, 10)
  }
  if (!Number.isFinite(diceCount) || diceCount < 1) return null
  if (!Number.isFinite(modifier)) return null
  return { diceCount, die, modifier }
}

/**
 * Extract the magic weapon bonus from a weapon item, if any, as a
 * non-negative integer. Returns `0` when the weapon has no bonus,
 * and `null` when the bonus is dice-bearing (e.g. `+1d4`) or negative
 * (cursed) — both cases the damage-adapter gate bounces to legacy
 * until a later slice broadens support.
 *
 * Positive magic bonuses flow into the lib's native
 * `DamageInput.magicBonus` slot so the breakdown attributes them as
 * `source: 'magic'` rather than silently folding into Strength.
 *
 * @param {Object} weapon
 * @returns {number | null}
 */
export function extractWeaponMagicBonus (weapon) {
  const raw = weapon?.system?.damageWeaponBonus
  if (typeof raw !== 'string' || raw.trim() === '') return 0
  if (raw.includes('d')) return null
  const trimmed = raw.trim()
  const match = trimmed.match(/^([+-]?)(\d+)$/)
  if (!match) return null
  const sign = match[1] === '-' ? -1 : 1
  const value = parseInt(match[2], 10)
  if (!Number.isFinite(value)) return null
  const signed = sign * value
  if (signed < 0) return null
  return signed
}

/**
 * Build a lib `DamageInput` from a parsed damage formula.
 *
 * For the simplest-damage slice, the formula already bakes in the
 * strength modifier + any other Foundry-side derivations from
 * `computeMeleeAndMissileAttackAndDamage`. We pass the flat modifier
 * as `strengthModifier` and leave `deedDieResult` /
 * `backstabMultiplier` absent — the gate ensures those cases don't
 * reach here.
 *
 * NPC damage-bonus adjustment (Phase 3 session 7): when present, the
 * `rollWeaponAttack` body baked it into the formula's flat modifier
 * (so the legacy path keeps working). For the adapter path we peel it
 * back off and surface it as a `RollBonus` on `bonuses[]` so the lib's
 * breakdown attributes it correctly (`source: 'NPC attack damage bonus'`)
 * instead of misattributing as Strength.
 *
 * Magic weapon bonus (Phase 3 session 8): `item.js` appends the
 * `damageWeaponBonus` (e.g. `'+1'` for a +1 sword) onto the derived
 * `damage` formula. For the adapter path we peel the positive integer
 * bonus back off `strengthModifier` and set it on `input.magicBonus`
 * so the lib's breakdown attributes it as `source: 'magic'`.
 *
 * @param {{diceCount: number, die: string, modifier: number}} parsed
 * @param {{npcDamageAdjustment?: number, magicBonus?: number}} [opts]
 * @returns {import('../vendor/dcc-core-lib/types/combat.js').DamageInput}
 */
export function buildDamageInput (parsed, opts = {}) {
  const npcAdj = Number.isFinite(opts.npcDamageAdjustment) ? opts.npcDamageAdjustment : 0
  const magicBonus = Number.isFinite(opts.magicBonus) && opts.magicBonus > 0 ? opts.magicBonus : 0
  const input = {
    damageDie: parsed.die,
    diceCount: parsed.diceCount,
    strengthModifier: parsed.modifier - npcAdj - magicBonus
  }
  if (magicBonus > 0) {
    input.magicBonus = magicBonus
  }
  if (npcAdj !== 0) {
    input.bonuses = [{
      id: 'npc:attack-damage-bonus',
      label: 'NPC attack damage bonus',
      source: { type: 'other', id: 'npc-attack-damage-bonus' },
      category: 'inherent',
      effect: { type: 'modifier', value: npcAdj }
    }]
  }
  return input
}
