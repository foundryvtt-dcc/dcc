/* global game, foundry */

/**
 * Missile-weapon range checking + penalties (DCC core rulebook p. 96).
 *
 * Listens to the system's own `dcc.modifyAttackRollTerms` hook — the same
 * extension point the dcc-qol module uses — and, for a ranged weapon fired at
 * a selected target, applies the RAW range penalty: medium range = -2 to the
 * attack roll, long range = -1d (the action die steps down one rung), beyond
 * long range = an out-of-range confirmation dialog.
 *
 * The *rule* (band thresholds + penalty values) lives in `dcc-core-lib`
 * (`parseMissileRange` / `getMissileRangePenalty`); only the Foundry-specific
 * pieces live here — token-distance measurement and the confirmation dialog.
 *
 * Gated twice: it stands down entirely when the dcc-qol module is active (it
 * drives this — see `qolHandlingCombat`) and when the `checkWeaponRange`
 * setting is off (the default), so existing worlds are unaffected until they
 * opt in.
 */

import { parseMissileRange, getMissileRangePenalty } from './vendor/dcc-core-lib/index.js'
import { qolHandlingCombat } from './integrations.mjs'

/**
 * Distance between two token documents, in scene distance units, using the DCC
 * "diagonals count as one" (Chebyshev) movement rule and edge-to-edge spacing.
 * Ported from dcc-qol's `measureTokenDistance` so range behaviour matches the
 * module the system is absorbing. Adjacent tokens read as one space
 * (`scene.distance`, typically 5 ft), never 0.
 *
 * @param {TokenDocument} token1 - attacker token document
 * @param {TokenDocument} token2 - target token document
 * @returns {number} distance in scene units, or Infinity if either is missing
 */
export function measureTokenDistance (token1, token2) {
  if (!token1 || !token2) return Infinity
  const d = game.canvas?.dimensions
  if (!d) return Infinity
  const gs = d.size

  const r1 = { left: token1.x, right: token1.x + token1.width * gs, top: token1.y, bottom: token1.y + token1.height * gs }
  const r2 = { left: token2.x, right: token2.x + token2.width * gs, top: token2.y, bottom: token2.y + token2.height * gs }

  const dx = Math.max(0, r1.left - r2.right, r2.left - r1.right)
  const dy = Math.max(0, r1.top - r2.bottom, r2.top - r1.bottom)

  const spacesBetween = Math.max(Math.floor(dx / gs), Math.floor(dy / gs))
  return spacesBetween * d.distance + d.distance
}

/**
 * The first targeted token's document, or null. `options.targets` is a
 * `Set<Token>` (the user's current targets at roll time).
 */
function getFirstTargetDoc (targets) {
  if (!(targets instanceof Set) || targets.size === 0) return null
  return targets.first()?.document ?? null
}

/**
 * Resolve the attacker's token document: an explicit `options.token` wins,
 * otherwise the actor's first active token on the canvas.
 */
function getAttackerTokenDoc (actor, options) {
  const token = options?.token
  if (token) {
    if (typeof token === 'object' && 'x' in token) return token
    if (typeof token?.object !== 'undefined') return token
  }
  return actor?.getActiveTokens?.()?.[0]?.document ?? null
}

/**
 * Show the out-of-range confirmation dialog. Resolves true if the user elects
 * to fire anyway, false otherwise.
 */
function confirmOutOfRange (weapon, distance) {
  const content = `<p>${game.i18n.format('DCC.WeaponOutOfRangeContent', {
    weapon: weapon?.name ?? '',
    distance: Math.round(distance)
  })}</p>`
  return foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize('DCC.WeaponOutOfRangeTitle') },
    content,
    yes: { label: game.i18n.localize('DCC.AttackAnyway') },
    no: { label: game.i18n.localize('DCC.Cancel'), default: true }
  }).catch(() => false)
}

/**
 * `dcc.modifyAttackRollTerms` handler. Returns `true` to let the roll proceed
 * (the default), or `false` to cancel it while the out-of-range dialog is
 * shown — on confirmation the dialog re-invokes the attack with
 * `_rangeDialogConfirmed` set so this pass applies the penalty instead.
 *
 * @param {object[]} terms - mutable roll-term array; `terms[0]` is the action die
 * @param {DCCActor} actor - the attacking actor
 * @param {DCCItem} weapon - the weapon being fired
 * @param {object} options - roll options (targets, token, re-invoke flags)
 * @returns {boolean}
 */
export function onModifyAttackRollTermsForRange (terms, actor, weapon, options = {}) {
  // Gates: defer to dcc-qol when it's active, and respect the opt-in setting.
  if (qolHandlingCombat()) return true
  if (!game.settings.get('dcc', 'checkWeaponRange')) return true

  // Ranged weapons only; melee adjacency is a separate concern.
  if (weapon?.system?.melee) return true

  const targetDoc = getFirstTargetDoc(options?.targets)
  const attackerDoc = getAttackerTokenDoc(actor, options)
  if (!targetDoc || !attackerDoc) return true // need both tokens on the canvas

  const bands = parseMissileRange(weapon?.system?.range || '')
  if (!bands) return true // unparseable / no range — nothing to enforce

  const actionDie = terms[0]?.type === 'Die' ? terms[0].formula : undefined
  const distance = measureTokenDistance(attackerDoc, targetDoc)
  const penalty = getMissileRangePenalty(distance, bands, actionDie)

  if (penalty.outOfRange) {
    if (!options._rangeDialogConfirmed) {
      // Cancel this roll; re-invoke with the confirm flag if the user agrees.
      confirmOutOfRange(weapon, distance).then(async (confirmed) => {
        if (!confirmed) return
        await actor.rollWeaponAttack(weapon.id, { ...options, _rangeDialogConfirmed: true })
      })
      return false
    }
    // Confirmed out-of-range: system policy is to fire at the long-range
    // penalty (the harshest defined band) rather than scot-free.
    if (terms[0]?.type === 'Die' && actionDie) {
      terms[0].formula = getMissileRangePenalty(bands.long, bands, actionDie).actionDie
    }
    return true
  }

  if (penalty.band === 'medium') {
    terms.push({
      type: 'Modifier',
      label: game.i18n.localize('DCC.MediumRangePenalty'),
      formula: penalty.attackModifier // -2
    })
  } else if (penalty.band === 'long' && terms[0]?.type === 'Die' && penalty.actionDie) {
    terms[0].formula = penalty.actionDie // step the action die down one rung
  }

  return true
}
