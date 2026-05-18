/* global foundry, game */

/**
 * Adapter-side roll-modifier dialogs.
 *
 * Companion to the legacy `RollModifierDialog` (`module/roll-modifier.js`),
 * which is wired to the Foundry `DCCRoll.createRoll` path. The adapter
 * path bypasses `DCCRoll.createRoll` and therefore never surfaces that
 * dialog, so it needs its own lightweight prompts for the input that
 * dialog used to collect.
 *
 * Two scaffolds live here:
 *   - `promptSpellburnCommitment` — bespoke modal that asks a wizard /
 *     elf caster how much Str / Agl / Sta to burn. Returns a lib
 *     `SpellburnCommitment`. `DCCActor.rollSpellCheck` forwards it
 *     through to the adapter as `options.spellburn` and the lib's
 *     `onSpellburnApplied` bridge (see `spell-events.mjs`) deducts the
 *     burn from the actor after the cast resolves.
 *   - `promptRollModifierDialog` (session 26, open question #7) — thin
 *     wrapper over `game.dcc.DCCRoll.createRoll({ showModifierDialog })`
 *     so adapter routes can surface the same general-purpose modifier
 *     dialog the legacy `DCCRoll.createRoll` path used. Parses the
 *     resulting Foundry Roll into an `actionDie` + flat `modifierTotal`
 *     pair the adapter can fold into its lib pass. Used by
 *     `_rollSkillCheckViaAdapter` for skill checks with
 *     `showModifierDialog: true`.
 */

/**
 * Prompt the user to commit Spellburn (Str / Agl / Sta) to a wizard
 * or elf spell check.
 *
 * Returns `null` if the user cancels or closes the dialog, so the
 * dispatcher can abort the cast. Returns the zero commitment
 * `{ str: 0, agl: 0, sta: 0 }` if the user confirms without
 * allocating any burn — this lets the adapter path drop the
 * all-zero case before it reaches `buildSpellCheckArgs` (which in
 * turn avoids a no-op Spellburn modifier in the lib's result).
 *
 * Each input is clamped to `[0, currentAbilityValue]` so the user
 * cannot burn more than they have. Stamina below 1 is allowed in
 * principle (RAW has no floor), but the adapter's
 * `onSpellburnApplied` bridge clamps `system.abilities.*.value` at
 * 1 when it applies the burn, so final stats never drop to 0.
 *
 * @param {DCCActor} actor     The casting actor
 * @param {DCCItem}  spellItem The spell being cast (used for the
 *                             dialog title; may be null for naked
 *                             callers, though none exist today)
 * @returns {Promise<{str: number, agl: number, sta: number} | null>}
 */
export async function promptSpellburnCommitment (actor, spellItem) {
  const str = parseInt(actor.system.abilities.str.value) || 0
  const agl = parseInt(actor.system.abilities.agl.value) || 0
  const sta = parseInt(actor.system.abilities.sta.value) || 0

  const title = spellItem
    ? game.i18n.format('DCC.SpellburnDialogTitleForSpell', { spell: spellItem.name })
    : game.i18n.localize('DCC.SpellburnDialogTitle')

  const prompt = game.i18n.localize('DCC.SpellburnDialogPrompt')
  const strLabel = game.i18n.localize('DCC.AbilityStr')
  const aglLabel = game.i18n.localize('DCC.AbilityAgl')
  const staLabel = game.i18n.localize('DCC.AbilitySta')

  const content = `
    <form class="dcc spellburn-dialog">
      <p>${prompt}</p>
      <div class="form-group">
        <label>${strLabel} (${str})</label>
        <input type="number" name="str" value="0" min="0" max="${str}"/>
      </div>
      <div class="form-group">
        <label>${aglLabel} (${agl})</label>
        <input type="number" name="agl" value="0" min="0" max="${agl}"/>
      </div>
      <div class="form-group">
        <label>${staLabel} (${sta})</label>
        <input type="number" name="sta" value="0" min="0" max="${sta}"/>
      </div>
    </form>
  `

  try {
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title },
      position: { width: 360 },
      content,
      buttons: [
        {
          action: 'commit',
          label: game.i18n.localize('DCC.SpellburnCommit'),
          default: true,
          callback: (_event, button) => ({
            str: clampBurn(button.form.elements.str.value, str),
            agl: clampBurn(button.form.elements.agl.value, agl),
            sta: clampBurn(button.form.elements.sta.value, sta)
          })
        },
        {
          action: 'cancel',
          label: game.i18n.localize('Cancel'),
          callback: () => null
        }
      ],
      rejectClose: false
    })

    return result ?? null
  } catch (err) {
    // `rejectClose: false` usually resolves to `null` on close instead
    // of throwing — an actual exception here is unexpected (DialogV2
    // API change, malformed template, localization error in a button
    // callback). Log before returning `null` so broken-build failures
    // don't present as indistinguishable "user cancelled the dialog"
    // no-ops.
    console.warn('[DCC adapter] promptSpellburnCommitment: dialog threw', { actor: actor?.name, spell: spellItem?.name, err })
    return null
  }
}

function clampBurn (raw, max) {
  const value = Math.trunc(Number(raw))
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(value, Math.max(0, max))
}

/**
 * Open the legacy `RollModifierDialog` as an adapter-side prompt.
 *
 * Reuses `game.dcc.DCCRoll.createRoll({ showModifierDialog: true })` so
 * the dialog UI / term partials / preset buttons stay in one place
 * (`module/roll-modifier.js`). The adapter caller passes the same
 * term-descriptor array the legacy `_rollSkillCheckLegacy` /
 * `_rollSpellCheckLegacy` built (Die / Compound / Modifier /
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
 * @param {Array<Object>} terms       Term descriptors. Same shape the
 *                                    legacy callers pass to
 *                                    `DCCRoll.createRoll`.
 * @param {Object}        [options]
 * @param {Object}        [options.rollData]   Foundry roll data for
 *                                             `@`-substitutions.
 * @param {string}        [options.title]      Dialog window title.
 * @param {string}        [options.rollLabel]  Submit button label.
 *
 * @returns {Promise<{
 *   actionDie: string | null,
 *   modifierTotal: number,
 *   formula: string,
 *   roll: Roll
 * } | null>}
 *   Returns `null` if the user cancelled (closed without submitting).
 *   Otherwise returns the user's final action die (e.g. `'1d20'`,
 *   `'1d24'`) and the signed flat sum of every non-die term in the
 *   resulting roll, plus the underlying Foundry Roll for callers that
 *   want the raw formula.
 */
export async function promptRollModifierDialog (terms, options = {}) {
  let roll
  try {
    roll = await game.dcc.DCCRoll.createRoll(terms, options.rollData ?? {}, {
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
  return {
    actionDie: parsed.actionDie,
    modifierTotal: parsed.modifierTotal,
    formula: roll.formula,
    roll
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
