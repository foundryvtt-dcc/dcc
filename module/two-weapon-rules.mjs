import { getTwoWeaponDice } from './vendor/dcc-core-lib/index.js'
import { getClassTrait } from './extension-api.mjs'

/**
 * Two-weapon fighting dice and crit rules (Table 4-3), from the lib (#996).
 *
 * Each hand is rolled as its own attack, so the weapon's derived data takes
 * the hand's die reduction from `getTwoWeaponDice`, and `rollToHit` applies
 * the hand's crit rules to the lib attack result with
 * `applyTwoWeaponHandRules`.
 *
 * Class traits (#998): `twoWeaponMinAgility` raises the Agility used for the
 * table row, and `twoWeaponCritOnMax` selects the lib's halfling rules (crit
 * and auto-hit on the reduced die's max face). The lib's halfling rules also
 * floor the row at Agility 16. The both-1s fumble rule is handled separately
 * by `two-weapon-fumble.mjs`.
 */

/**
 * The weapon's two-weapon hand in lib terms, or `null` when it isn't set up
 * for two-weapon fighting. Primary wins if both flags are (mis)configured.
 * @param {Item|{system:object}} weapon
 * @returns {'primary'|'offHand'|null}
 */
export function twoWeaponHand (weapon) {
  if (weapon?.system?.twoWeaponPrimary) return 'primary'
  if (weapon?.system?.twoWeaponSecondary) return 'offHand'
  return null
}

/**
 * Table 4-3 rules for one two-weapon hand.
 * @param {Actor} actor
 * @param {Item|{system:object}} weapon
 * @returns {{hand:'primary'|'offHand', config:object, dicePenalty:number, canCrit:boolean, critOnMaxOnly:boolean, noAutoHit:boolean}|null}
 *   `null` when the weapon isn't a two-weapon hand. `dicePenalty` is the
 *   (negative) dice-chain step for the hand's action die; `critOnMaxOnly`
 *   marks the Agl 16-17 row, where only the die's max face crits;
 *   `noAutoHit` marks the non-halfling 16-17 primary, whose max face must
 *   still beat AC.
 */
export function twoWeaponRules (actor, weapon) {
  const hand = twoWeaponHand(weapon)
  if (!hand) return null

  let agility = parseInt(actor?.system?.abilities?.agl?.value) || 0
  const minAgility = getClassTrait(actor, 'twoWeaponMinAgility')
  if (typeof minAgility === 'number') agility = Math.max(agility, minAgility)
  const isHalfling = getClassTrait(actor, 'twoWeaponCritOnMax') === true
  const config = getTwoWeaponDice(agility, { isHalfling })

  const primary = hand === 'primary'
  const reduction = primary ? config.primaryDieReduction : config.offHandDieReduction
  return {
    hand,
    config,
    dicePenalty: reduction === 0 ? 0 : -reduction,
    canCrit: primary ? config.primaryCanCrit : config.offHandCanCrit,
    critOnMaxOnly: config.primaryCritRequiresBeatAC || config.halflingAutoCritOnMax,
    noAutoHit: primary && config.primaryCritRequiresBeatAC
  }
}

/**
 * Localization key describing a two-weapon hand's crit rule for the weapon
 * sheet, or `null` when the hand crits as normal.
 * @param {ReturnType<typeof twoWeaponRules>} rules
 * @returns {string|null}
 */
export function twoWeaponCritRuleKey (rules) {
  if (!rules) return null
  if (!rules.canCrit) return 'DCC.TwoWeaponCritNone'
  if (rules.config.halflingAutoCritOnMax) return 'DCC.TwoWeaponCritMaxAutoHit'
  if (rules.noAutoHit) return 'DCC.TwoWeaponCritMaxBeatsAC'
  return null
}
