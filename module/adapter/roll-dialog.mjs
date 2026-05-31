/* global foundry, game */

/**
 * Adapter-side roll-modifier dialog.
 *
 * Companion to the legacy `RollModifierDialog` (`module/roll-modifier.js`),
 * which is wired to the Foundry `DCCRoll.createRoll` path. The adapter
 * path bypasses `DCCRoll.createRoll` and therefore never surfaces that
 * dialog, so it needs its own thin wrapper to surface the same UI when
 * an adapter-routed roll requests `showModifierDialog`.
 *
 * `promptRollModifierDialog` (session 26, open question #7) wraps
 * `game.dcc.DCCRoll.createRoll({ showModifierDialog })` so adapter
 * routes can surface the same general-purpose modifier dialog the
 * legacy `DCCRoll.createRoll` path used. Parses the resulting Foundry
 * Roll into an `actionDie` + flat `modifierTotal` pair the adapter
 * folds into its lib pass. Q7-phase2 (session 27) extended it with
 * an optional Spellburn descriptor so the wizard / naked adapter
 * spell-check routes can collect Str/Agl/Sta burn in the same dialog
 * the legacy path used (retiring the bespoke spellburn pop-up).
 */

/**
 * Open the legacy `RollModifierDialog` as an adapter-side prompt.
 *
 * Reuses `game.dcc.DCCRoll.createRoll({ showModifierDialog: true })` so
 * the dialog UI / term partials / preset buttons stay in one place
 * (`module/roll-modifier.js`). The adapter caller passes the same
 * term-descriptor array the legacy `_rollSkillCheckLegacy` and the
 * pre-adapter `DCCItem.rollSpellCheck` built (Die / Compound / Modifier /
 * CheckPenalty / Spellburn / ...), and gets back the parsed parts it
 * needs to feed the lib pass: the user-selected action die and the
 * flat sum of every non-die term.
 *
 * Attribution is intentionally flattened: the dialog reduces its term
 * list to a single Foundry `Roll` formula, so per-source attribution
 * (skill value vs ability mod vs level) is lost the moment the user
 * submits. The legacy `DCCRoll.createRoll` callers had the same
 * behaviour — anything the user could see in the dialog they could
 * edit to any value, so the post-dialog modifier-list contract was
 * always "trust the user's total."
 *
 * Q7-phase2 (session 27) added the optional `spellburn` descriptor.
 * When set, a Spellburn term is appended to the dialog so the user
 * can allocate Str/Agl/Sta burn alongside the other modifiers; the
 * returned `spellburn` object holds the chosen BURN amounts (current
 * ability − final ability). The burn formula contribution is
 * deliberately removed from `modifierTotal` so callers can forward
 * the commitment through the lib's `input.spellburn` without
 * double-counting (the lib also injects a "spellburn" modifier into
 * its computed total).
 *
 * @param {Array<Object>} terms       Term descriptors. Same shape the
 *                                    legacy callers pass to
 *                                    `DCCRoll.createRoll`.
 * @param {Object}        [options]
 * @param {Object}        [options.rollData]   Foundry roll data for
 *                                             `@`-substitutions.
 * @param {string}        [options.title]      Dialog window title.
 * @param {string}        [options.rollLabel]  Submit button label.
 * @param {{str: number, agl: number, sta: number}} [options.spellburn]
 *                                             Current ability values
 *                                             for the casting actor.
 *                                             When set, the dialog
 *                                             surfaces a Spellburn
 *                                             term and the result
 *                                             carries a `spellburn`
 *                                             field with the chosen
 *                                             burn amounts.
 *
 * @returns {Promise<{
 *   actionDie: string | null,
 *   modifierTotal: number,
 *   formula: string,
 *   roll: Roll,
 *   spellburn: {str: number, agl: number, sta: number} | null
 * } | null>}
 *   Returns `null` if the user cancelled (closed without submitting).
 *   Otherwise returns the user's final action die (e.g. `'1d20'`,
 *   `'1d24'`), the signed flat sum of every non-die / non-spellburn
 *   term in the resulting roll, the underlying Foundry Roll for
 *   callers that want the raw formula, and (when `options.spellburn`
 *   was requested) the chosen burn commitment.
 */
export async function promptRollModifierDialog (terms, options = {}) {
  let spellburnCapture = null
  let effectiveTerms = terms

  if (options.spellburn && typeof options.spellburn === 'object') {
    const sb = options.spellburn
    const originalStr = Number(sb.str) || 0
    const originalAgl = Number(sb.agl) || 0
    const originalSta = Number(sb.sta) || 0

    spellburnCapture = {
      str: originalStr,
      agl: originalAgl,
      sta: originalSta
    }

    const spellburnTerm = {
      type: 'Spellburn',
      formula: '+0',
      str: originalStr,
      agl: originalAgl,
      sta: originalSta,
      callback: (_formula, term) => {
        // `term.str/agl/sta` hold the final (post-burn) ability values
        // after the user clicks the dialog's +/- buttons. The dialog
        // mutates them in `#modifySpellburn` (see roll-modifier.js).
        spellburnCapture.str = Number(term.str) || 0
        spellburnCapture.agl = Number(term.agl) || 0
        spellburnCapture.sta = Number(term.sta) || 0
      }
    }

    effectiveTerms = [...terms, spellburnTerm]
  }

  let roll
  try {
    roll = await game.dcc.DCCRoll.createRoll(effectiveTerms, options.rollData ?? {}, {
      showModifierDialog: true,
      title: options.title,
      rollLabel: options.rollLabel
    })
  } catch (err) {
    console.warn('[DCC adapter] promptRollModifierDialog: dialog threw', { err })
    return null
  }
  if (!roll) return null

  const parsed = parseRollIntoDieAndModifier(roll)
  let modifierTotal = parsed.modifierTotal
  let spellburnResult = null

  if (spellburnCapture) {
    const sb = options.spellburn
    const burn = {
      str: Math.max(0, (Number(sb.str) || 0) - spellburnCapture.str),
      agl: Math.max(0, (Number(sb.agl) || 0) - spellburnCapture.agl),
      sta: Math.max(0, (Number(sb.sta) || 0) - spellburnCapture.sta)
    }
    spellburnResult = burn
    // Subtract the spellburn formula contribution from `modifierTotal`.
    // The dialog wrote `+(str+agl+sta)` into the Roll's formula, but
    // callers forward the commitment through `input.spellburn` and the
    // lib injects its own "spellburn" modifier — keeping both would
    // double-count.
    modifierTotal -= burn.str + burn.agl + burn.sta
  }

  return {
    actionDie: parsed.actionDie,
    modifierTotal,
    formula: roll.formula,
    roll,
    spellburn: spellburnResult
  }
}

/**
 * Walk a Foundry Roll's parsed terms array, pulling out the first Die
 * term as the action die and summing all signed numerics as the flat
 * modifier total. Operator terms drive the running sign.
 *
 * Exported for unit tests; not part of the adapter surface used by
 * `module/actor.js`.
 * @private
 */
export function parseRollIntoDieAndModifier (roll) {
  const Die = foundry?.dice?.terms?.Die
  const Numeric = foundry?.dice?.terms?.NumericTerm
  const Operator = foundry?.dice?.terms?.OperatorTerm

  const matches = (term, Cls, name) => {
    if (Cls && term instanceof Cls) return true
    if (term?.constructor?.name === name) return true
    if (term?.class === name) return true
    return false
  }

  let actionDie = null
  let modifierTotal = 0
  let sign = 1

  for (const term of roll.terms ?? []) {
    if (matches(term, Die, 'Die')) {
      if (!actionDie) {
        actionDie = term.formula ?? `${term.number ?? 1}d${term.faces ?? 20}`
      }
      sign = 1
      continue
    }
    if (matches(term, Operator, 'OperatorTerm')) {
      sign = term.operator === '-' ? -1 : 1
      continue
    }
    if (matches(term, Numeric, 'NumericTerm')) {
      const value = Number(term.number)
      if (Number.isFinite(value)) modifierTotal += sign * value
      sign = 1
      continue
    }
    sign = 1
  }

  return { actionDie, modifierTotal }
}
