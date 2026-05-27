/**
 * Damage-input adapter. Translates Foundry weapon damage formulas + the
 * resolved attack result into the lib's `DamageInput` shape
 * (`vendor/dcc-core-lib/types/combat.d.ts`).
 *
 * Phase 3 session 19 broadened coverage to exhaust the damage gate so
 * `_rollDamageLegacy` could retire:
 *   - Multi-type per-term formulas (`1d6[fire]+1d6[cold]`) split into a
 *     base die + `extraDamageDice[]` entries with per-term flavors.
 *   - Dice-bearing magic weapon bonuses (`damageWeaponBonus: '+1d4'`)
 *     surface as `extraDamageDice[]` with `source: 'magic'`.
 *   - Cursed weapons (`damageWeaponBonus: '-1'`) surface as a negative
 *     `DamageInput.magicBonus` so the lib tags the breakdown
 *     `source: 'cursed'`.
 *   - Anything else the parser can't digest (lance `(1d8)*2+3`, homebrew
 *     `damageOverride` shapes) falls to a lossless passthrough via
 *     `buildPassthroughDamageResult`.
 *
 * Foundry keeps ownership of the displayed damage total + chat rendering
 * — the lib result only populates `libDamageResult` on chat flags.
 */

const SIMPLE_DAMAGE_PATTERN = /^\s*(\d*)d(\d+)\s*((?:[+-]\s*\d+\s*)*)$/i
const TRAILING_FLAVOR_PATTERN = /^(.+?)\s*\[([^[\]]*)\]\s*$/
const DAMAGE_WEAPON_BONUS_DICE_PATTERN = /^([+-]?)(\d*)d(\d+)(?:\[([^\]]+)\])?$/i
const DAMAGE_WEAPON_BONUS_FLAT_PATTERN = /^([+-]?)(\d+)$/
const MULTI_TERM_PATTERN = /([+-]?)\s*(?:(\d*)d(\d+)|(\d+))(?:\[([^\]]+)\])?/gi

/**
 * Peel a trailing `[flavor]` bracket off a damage formula, returning the
 * cleaned formula + flavor label. Legacy `_rollDamageLegacy` stripped the
 * trailing bracket the same way and fed `flavor` into `DCCRoll.createRoll`'s
 * `Compound` term so chat rendering showed the damage type tag.
 *
 * Per-term flavor formulas (`1d6[fire]+1d6[cold]`) are handled by
 * `parseMultiTypeFormula` — this helper only peels a single trailing
 * bracket and doesn't attempt to splice multiple labels.
 *
 * @param {string} formula
 * @returns {{formula: string, flavor: string}}
 */
export function peelTrailingFlavor (formula) {
  if (typeof formula !== 'string') return { formula: '', flavor: '' }
  const match = formula.match(TRAILING_FLAVOR_PATTERN)
  if (!match) return { formula, flavor: '' }
  return { formula: match[1].trim(), flavor: match[2] }
}

/**
 * Parse a simple Foundry damage formula into its constituent parts.
 *
 * Accepts a single `NdM` term followed by any number of flat integer
 * modifiers (`+2`, `+2+1`, `-1+3`, etc.) — all summed into `modifier`.
 * The multi-modifier shape is the normal case for a PC with any
 * damageBonus + damageWeaponBonus stack (item.js concatenates them as
 * `NdM+strMod+magicMod`).
 *
 * Returns `null` for per-term flavors, multi-die, `@ab`-style
 * substitutions, or sub-expressions — the caller picks an alternate
 * parser (`parseMultiTypeFormula`) or falls back to passthrough.
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
 * Parse a per-term-flavor damage formula (`1d6[fire]+1d6[cold]`,
 * `1d8+2+1d6[fire]`, etc.) into a base term + extras.
 *
 * The first positive-sign dice term becomes the base; subsequent dice
 * terms become `extraDamageDice[]` entries. Integer terms sum into the
 * modifier (fed to the lib as `strengthModifier`). The base term's
 * flavor, if any, is dropped for the lib (its breakdown hardcodes
 * `source: 'weapon'`) — Foundry's chat rendering preserves it via
 * the native `Roll` path.
 *
 * Only applies to formulas containing a die immediately followed by
 * `[` (the `/\d+d\d+\[/` pattern). Returns `null` for non-per-term
 * inputs or shapes with unrecognized tokens / negative-count extras.
 *
 * @param {string} formula
 * @returns {{base: {diceCount: number, die: string}, modifier: number, extras: Array<{count: number, die: string, flavor?: string}>} | null}
 */
export function parseMultiTypeFormula (formula) {
  if (typeof formula !== 'string') return null
  if (!/\d+d\d+\[/.test(formula)) return null

  const re = new RegExp(MULTI_TERM_PATTERN.source, MULTI_TERM_PATTERN.flags)
  const terms = []
  let consumed = 0
  let match
  while ((match = re.exec(formula)) !== null) {
    if (match[0] === '') break
    if (match.index > consumed) {
      const gap = formula.substring(consumed, match.index).trim()
      if (gap !== '') return null
    }
    consumed = match.index + match[0].length
    const sign = match[1] === '-' ? -1 : 1
    if (match[4] !== undefined) {
      terms.push({ kind: 'int', value: sign * parseInt(match[4], 10) })
    } else {
      const count = match[2] ? parseInt(match[2], 10) : 1
      const term = {
        kind: 'dice',
        sign,
        count,
        die: `d${match[3]}`
      }
      if (match[5] !== undefined) term.flavor = match[5]
      terms.push(term)
    }
  }
  if (formula.substring(consumed).trim() !== '') return null
  if (terms.length === 0) return null

  let base = null
  let modifier = 0
  const extras = []
  for (const t of terms) {
    if (t.kind === 'int') {
      modifier += t.value
      continue
    }
    if (base === null && t.sign === 1) {
      base = { diceCount: t.count, die: t.die }
      continue
    }
    if (t.sign < 0) return null
    const extra = { count: t.count, die: t.die }
    if (t.flavor !== undefined) extra.flavor = t.flavor
    extras.push(extra)
  }
  if (base === null) return null
  return { base, modifier, extras }
}

/**
 * Parse a weapon's `damageWeaponBonus` field into a structured shape
 * for the lib's `DamageInput`.
 *
 * Returns:
 *   - `{ kind: 'none' }` for empty / missing bonuses (non-magical weapons).
 *   - `{ kind: 'flat', value: number }` for integer bonuses. Positive
 *     values map to `DamageInput.magicBonus` (breakdown `source: 'magic'`);
 *     negative values map to cursed bonuses (breakdown `source: 'cursed'`).
 *   - `{ kind: 'dice', count, die, flavor? }` for dice-bearing bonuses
 *     (`+1d4`, `+1d6[fire]`) — route through `DamageInput.extraDamageDice`.
 *   - `null` for shapes this parser can't digest (mixed flat + dice,
 *     etc.). Caller falls back to the passthrough path.
 *
 * Replaces the Phase 3 session 8 helper `extractWeaponMagicBonus` which
 * returned `null` for dice-bearing + cursed bonuses to force them to
 * legacy.
 *
 * @param {Object} weapon
 * @returns {{kind: 'none'} | {kind: 'flat', value: number} | {kind: 'dice', count: number, die: string, flavor?: string} | null}
 */
export function parseWeaponMagicBonus (weapon) {
  const raw = weapon?.system?.damageWeaponBonus
  if (typeof raw !== 'string' || raw.trim() === '') return { kind: 'none' }
  const trimmed = raw.trim()
  const diceMatch = trimmed.match(DAMAGE_WEAPON_BONUS_DICE_PATTERN)
  if (diceMatch) {
    const sign = diceMatch[1] === '-' ? -1 : 1
    const count = (diceMatch[2] ? parseInt(diceMatch[2], 10) : 1) * sign
    if (count <= 0) return null
    const result = { kind: 'dice', count, die: `d${diceMatch[3]}` }
    if (diceMatch[4] !== undefined) result.flavor = diceMatch[4]
    return result
  }
  const flatMatch = trimmed.match(DAMAGE_WEAPON_BONUS_FLAT_PATTERN)
  if (flatMatch) {
    const sign = flatMatch[1] === '-' ? -1 : 1
    return { kind: 'flat', value: sign * parseInt(flatMatch[2], 10) }
  }
  return null
}

/**
 * Build a passthrough `libDamageResult` for damage formulas the parser
 * can't digest into a lib-native `DamageInput` (e.g. lance
 * `(1d8)*2+3` with `doubleIfMounted`, custom `damageOverride` formulas).
 * Foundry's Roll remains authoritative for chat rendering + the damage
 * total; the lib call is skipped.
 *
 * The result shape matches the parseable case's fields so downstream
 * consumers read it uniformly — unknown slots are `null`, and
 * `passthrough: true` marks the breakdown as deliberately empty.
 *
 * @param {{total: number}} damageRoll
 * @returns {{damageDie: null, natural: null, baseDamage: null, modifierDamage: null, total: number, breakdown: Array, passthrough: true}}
 */
export function buildPassthroughDamageResult (damageRoll) {
  return {
    damageDie: null,
    natural: null,
    baseDamage: null,
    modifierDamage: null,
    total: damageRoll.total,
    breakdown: [],
    passthrough: true
  }
}

/**
 * Build a lib `DamageInput` from a parsed simple-formula + optional
 * NPC / magic / extra-dice modifiers.
 *
 * For the single-die happy path, `parsed.modifier` already sums every
 * flat adjustment baked into the Foundry formula (strength + NPC
 * adjustment + flat magic bonus). This helper peels the named
 * contributions back off so the lib breakdown attributes each one
 * correctly:
 *   - `opts.npcDamageAdjustment` → `bonuses[]` entry
 *     (`source: 'NPC attack damage bonus'`).
 *   - `opts.magicBonus` (positive or negative) → `DamageInput.magicBonus`
 *     (breakdown tag `magic` / `cursed`).
 *   - `opts.extraDamageDice` → `DamageInput.extraDamageDice` verbatim
 *     (dice-bearing magic bonuses or per-term flavor extras).
 *
 * @param {{diceCount: number, die: string, modifier: number}} parsed
 * @param {{npcDamageAdjustment?: number, magicBonus?: number, extraDamageDice?: Array}} [opts]
 * @returns {import('../vendor/dcc-core-lib/types/combat.js').DamageInput}
 */
export function buildDamageInput (parsed, opts = {}) {
  const npcAdj = Number.isFinite(opts.npcDamageAdjustment) ? opts.npcDamageAdjustment : 0
  const magicBonus = Number.isFinite(opts.magicBonus) ? opts.magicBonus : 0
  const input = {
    damageDie: parsed.die,
    diceCount: parsed.diceCount,
    strengthModifier: parsed.modifier - npcAdj - magicBonus
  }
  if (magicBonus !== 0) {
    input.magicBonus = magicBonus
  }
  if (Array.isArray(opts.extraDamageDice) && opts.extraDamageDice.length > 0) {
    input.extraDamageDice = opts.extraDamageDice
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
