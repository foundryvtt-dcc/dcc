/**
 * Subdual damage detection for the apply-damage paths (#966).
 *
 * A weapon with "Subdual Damage" ticked appends a `[subdual]` flavor to its
 * damage formula (`DCCItem#prepareBaseData`). The weapon attack also tags its
 * damage roll (`options.dcc.subdual`) and its card (`flags.dcc.subdual`), so
 * the damage can be told apart from lethal damage at apply time even when the
 * roll's formula no longer shows the flavor. `DCCActor#applyDamage` then
 * tracks it in `system.attributes.hp.subdual` instead of taking it off hit
 * points.
 */

/**
 * Whether a damage roll deals subdual damage.
 * @param {Roll|undefined|null} roll
 * @returns {boolean}
 */
export function isSubdualRoll (roll) {
  if (!roll) return false
  if (roll.options?.dcc?.subdual === true) return true
  return /\[subdual\]/i.test(roll.formula ?? '')
}

/**
 * Whether the damage on a chat card is subdual damage: the card was flagged
 * by the weapon attack that posted it, or one of its rolls is a subdual roll.
 * @param {ChatMessage|undefined|null} message
 * @returns {boolean}
 */
export function messageDealsSubdualDamage (message) {
  if (!message) return false
  if (message.getFlag?.('dcc', 'subdual') === true) return true
  return (message.rolls ?? []).some(isSubdualRoll)
}
