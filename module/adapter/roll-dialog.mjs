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
 * Phase 3 session 1 scope: only Spellburn. The legacy dialog's Spellburn
 * term (`DCCSpellburnTerm` in `roll-modifier.js:115`) lets a wizard / elf
 * caster burn Str / Agl / Sta points for a bonus on the spell check.
 * `promptSpellburnCommitment` asks the user for those three amounts and
 * returns a lib `SpellburnCommitment`; `DCCActor.rollSpellCheck` forwards
 * it through to the adapter as `options.spellburn`, and the lib's
 * `onSpellburnApplied` bridge (see `spell-events.mjs`) applies the burn
 * to the actor after the cast resolves.
 *
 * Later sessions extend this module with attack / damage dialog prompts
 * as the Phase 3 attack migration needs them.
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
  } catch {
    // `rejectClose: false` usually returns `null` on close, but fall
    // through defensively — a cancel is equivalent to no commitment.
    return null
  }
}

function clampBurn (raw, max) {
  const value = Math.trunc(Number(raw))
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(value, Math.max(0, max))
}
