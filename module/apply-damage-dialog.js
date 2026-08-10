/* global foundry, game */

import { logAbilityChange } from './ability-score-log.js'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

/**
 * A dialog for adjusting the damage (or healing) amount at apply time (#401).
 *
 * Opened by ctrl/cmd-clicking an Apply Damage / Apply Healing chat context
 * menu entry (or by a plain click when "Show Roll Modifier by Default" is on).
 * Pre-filled with the amount from the chat card; the user can edit the final
 * number — e.g. after deciding to spend Luck post-roll — before it is applied
 * to the selected tokens.
 *
 * Optionally a Luck spend can be recorded at the same time: the points are
 * deducted from the roller (the damage message's speaker) through the Ability
 * Score Change Log helper so the spend lands in that actor's history and
 * emits the usual chat card. The spend does not change the amount field —
 * how Luck modifies a roll is a table ruling, so the user edits the final
 * number themselves.
 *
 * @extends {ApplicationV2}
 */
class ApplyDamageDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'apply-damage-dialog'],
    tag: 'form',
    position: {
      width: 300,
      height: 'auto'
    },
    window: {
      title: 'DCC.ChatContextDamage',
      resizable: false
    },
    form: {
      handler: ApplyDamageDialog.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: true
    }
  }

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: 'systems/dcc/templates/dialog-apply-damage.html'
    }
  }

  /** @inheritDoc */
  get title () {
    const key = this.options.multiplier < 0 ? 'DCC.ChatContextHealing' : 'DCC.ChatContextDamage'
    return game.i18n.localize(key)
  }

  /**
   * Prepare context data for rendering the HTML template
   * @param {Object} options - Rendering options
   * @return {Object} The context data
   */
  async _prepareContext (options = {}) {
    const context = await super._prepareContext(options)

    context.amount = this.options.amount
    context.isHealing = this.options.multiplier < 0
    context.targetNames = this.options.targets.map(a => a.name).join(', ')

    const luckActor = this.options.luckActor
    context.luckActor = luckActor ?? null
    context.luckValue = luckActor?.system?.abilities?.lck?.value

    return context
  }

  /**
   * Focus the amount input after rendering
   * @param {Object} context - The render context
   * @param {Object} options - The render options
   */
  _onRender (context, options) {
    super._onRender(context, options)
    const input = this.element.querySelector('input[name="amount"]')
    if (input) {
      input.focus()
      input.select()
    }
  }

  /**
   * Handle form submission — record the optional Luck spend, then apply the
   * (possibly edited) amount to each target actor.
   * @this {ApplyDamageDialog}
   * @param {SubmitEvent} event - The form submission event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - The processed form data
   * @private
   */
  static async #onSubmitForm (event, form, formData) {
    event.preventDefault()

    const amount = Number(formData.object.amount)
    if (isNaN(amount)) return

    const luckSpend = parseInt(formData.object.luckSpend) || 0
    const luckActor = this.options.luckActor
    if (luckSpend > 0 && luckActor) {
      await logAbilityChange(luckActor, {
        ability: 'lck',
        change: -luckSpend,
        type: 'luckSpend',
        source: this.title
      }, { announce: true })
    }

    if (amount !== 0) {
      await Promise.all(this.options.targets.map(a => a.applyDamage(amount, this.options.multiplier)))
    }
  }
}

export default ApplyDamageDialog
