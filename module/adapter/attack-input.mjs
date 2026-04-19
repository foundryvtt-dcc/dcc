/**
 * Attack-input adapter (Phase 3 session 2).
 *
 * Bridges Foundry actor + weapon state into the shape the lib's
 * `makeAttackRoll` consumes (`AttackInput` in
 * `vendor/dcc-core-lib/types/combat.d.ts`). Narrow slice — only the
 * "simplest weapon happy-path" (no deed die, no backstab, no two-weapon,
 * no `showModifierDialog`). The dispatcher in `rollToHit` enforces the
 * gate before calling `buildAttackInput`.
 *
 * Phase 3 session 2 emits `LegacyRollModifier[]` (via `appliedModifiers`
 * on the lib result) because `vendor/dcc-core-lib/src/combat/*` still
 * imports `LegacyRollModifier` — wave-3 modifier migration hasn't
 * shipped yet. When it does, `renderAttack` and any chat-side consumer
 * should adapt to the tagged-union shape without needing changes here.
 */

/**
 * Normalize a Foundry-style die string (e.g. '1d20') to the lib's
 * `DieType` shape (e.g. 'd20').
 *
 * @param {string} foundryDie
 * @returns {string}
 */
export function normalizeLibDie (foundryDie) {
  if (!foundryDie) return 'd20'
  const match = String(foundryDie).match(/\d*d(\d+)/i)
  return match ? `d${match[1]}` : String(foundryDie)
}

/**
 * Parse a toHit string like '+3' or '-1' into an integer. Returns 0 for
 * unparseable input (the gate should have rejected dice toHits before
 * this point).
 *
 * @param {string|number} toHit
 * @returns {number}
 */
function parseToHitBonus (toHit) {
  if (typeof toHit === 'number') return toHit
  const s = String(toHit ?? '').trim()
  if (!s) return 0
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : 0
}

/**
 * Build a lib `AttackInput` from a Foundry actor + weapon, for the
 * simplest-weapon happy-path slice.
 *
 * `attackBonus` carries the full already-summed to-hit from
 * `weapon.system.toHit` (which bakes in the class attack bonus + ability
 * + actor-side adjustments via `computeMeleeAndMissileAttackAndDamage`
 * and `DCCItem.prepareBaseData`). We pass it as `attackBonus` and set
 * `abilityModifier` to 0 so the lib doesn't double-count — the single
 * combined value is the source of truth.
 *
 * @param {Object} actor
 * @param {Object} weapon
 * @returns {import('../vendor/dcc-core-lib/types/combat.js').AttackInput}
 */
export function buildAttackInput (actor, weapon) {
  const isMelee = weapon.system?.melee !== false
  const attackType = isMelee ? 'melee' : 'missile'
  const toHitText = weapon.system?.toHit ?? '+0'
  const attackBonus = parseToHitBonus(toHitText)
  const actorActionDice = actor.getActionDice({ includeUntrained: true })[0]?.formula || '1d20'
  const actionDie = normalizeLibDie(weapon.system?.actionDie || actorActionDice)
  const threatRange = parseInt(weapon.system?.critRange || actor.system.details?.critRange || 20) || 20
  return {
    attackType,
    attackBonus,
    actionDie,
    threatRange,
    abilityModifier: 0
  }
}

/**
 * Convert hook-injected `dcc.modifyAttackRollTerms` terms into lib
 * `RollBonus[]` entries so they participate in `makeAttackRoll`'s
 * `totalBonus` and `appliedModifiers` aggregation. Phase 3 session 3
 * bridge expansion — lets dcc-qol's firing-into-melee / range penalties
 * surface through `libResult` alongside the base attack bonus.
 *
 * Only `type === 'Modifier'` terms with a parseable signed-integer
 * `formula` are translated. `Die` / `Compound` / `Term` entries
 * (action die, deed dice, custom subclasses) are skipped — the lib's
 * flat-modifier bonus kind can't represent dice-bearing terms today.
 * In-place mutations of existing terms (e.g. a long-range dice-chain
 * bump of `terms[0].formula`) are NOT detected here — those flow
 * through the Foundry `Roll` natively; capturing them on the lib side
 * is a future slice.
 *
 * @param {Array<{type: string, label?: string, formula?: string|number}>} addedTerms
 *   Terms appended by hook listeners (i.e. `terms.slice(termsLengthBefore)`).
 * @returns {Array<import('../vendor/dcc-core-lib/types/bonuses.js').RollBonus>}
 */
export function hookTermsToBonuses (addedTerms) {
  if (!Array.isArray(addedTerms) || addedTerms.length === 0) return []
  const bonuses = []
  for (let i = 0; i < addedTerms.length; i++) {
    const term = addedTerms[i]
    if (!term || term.type !== 'Modifier') continue
    const value = parseIntegerFormula(term.formula)
    if (value === null) continue
    const label = term.label || 'Hook-injected modifier'
    bonuses.push({
      id: `hook:${i}:${label}`,
      label,
      source: { type: 'other', name: label },
      category: 'circumstance',
      effect: { type: 'modifier', value }
    })
  }
  return bonuses
}

function parseIntegerFormula (raw) {
  if (typeof raw === 'number') return Number.isInteger(raw) ? raw : null
  if (raw == null) return null
  const s = String(raw).trim()
  if (!/^[+-]?\d+$/.test(s)) return null
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}
