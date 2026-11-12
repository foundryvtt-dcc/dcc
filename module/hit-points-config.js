/* global foundry, game */

import { getHealingFromRest } from './vendor/dcc-core-lib/index.js'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

/**
 * A dialog for adjusting an actor's hit points
 * Can apply damage, healing, or set HP to a specific value, edit the running
 * subdual damage total, and heal naturally from rest (#966)
 * @extends {ApplicationV2}
 */
class HitPointsConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'hit-points-config'],
    tag: 'form',
    position: {
      width: 280,
      height: 'auto'
    },
    window: {
      title: 'DCC.AdjustHitPoints',
      resizable: false
    },
    form: {
      handler: HitPointsConfig.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: true
    },
    actions: {
      rest: HitPointsConfig.#onRest
    }
  }

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: 'systems/dcc/templates/dialog-hit-points-config.html'
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare context data for rendering the HTML template
   * @param {Object} options - Rendering options
   * @return {Object} The context data
   */
  async _prepareContext (options = {}) {
    const context = await super._prepareContext(options)
    const actor = this.options.document

    context.actor = actor
    context.hp = actor.system.attributes.hp.value
    context.maxHp = actor.system.attributes.hp.max
    context.actorName = actor.name
    context.trackSubdual = !!game.settings.get('dcc', 'trackSubdualDamage')
    context.subdual = actor.system.attributes.hp.subdual ?? 0
    context.nightsRestHint = game.i18n.format('DCC.NaturalHealingNightHint', { hp: getHealingFromRest('active-adventure') })
    context.bedRestHint = game.i18n.format('DCC.NaturalHealingBedRestHint', { hp: getHealingFromRest('bed-rest') })

    return context
  }

  /**
   * Focus the adjustment input after rendering
   * @param {Object} context - The render context
   * @param {Object} options - The render options
   */
  _onRender (context, options) {
    super._onRender(context, options)
    const input = this.element.querySelector('input[name="adjustment"]')
    if (input) {
      input.focus()
      input.select()
    }
  }

  /**
   * Handle form submission - applies damage, healing, or sets HP based on input
   * - Unsigned number (e.g. "5"): sets HP to that value
   * - Positive signed (e.g. "+3"): heals for that amount
   * - Negative signed (e.g. "-3"): damages for that amount
   * @this {HitPointsConfig}
   * @param {SubmitEvent} event - The form submission event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - The processed form data
   * @private
   */
  static async #onSubmitForm (event, form, formData) {
    event.preventDefault()
    const actor = this.options.document

    // Subdual damage total, edited directly (e.g. cleared when the judge
    // rules the creature has come round)
    const subdual = formData.object.subdual
    if (subdual !== undefined && subdual !== null && subdual !== '') {
      const newSubdual = Math.max(0, parseInt(subdual) || 0)
      if (newSubdual !== (actor.system.attributes.hp.subdual ?? 0)) {
        await actor.update({ 'system.attributes.hp.subdual': newSubdual })
      }
    }

    const adjustment = formData.object.adjustment?.trim()
    if (!adjustment) {
      if (typeof this.options.callback === 'function') this.options.callback()
      return
    }

    const value = Number(adjustment)
    if (isNaN(value)) return

    // Check if the input has an explicit sign
    const hasSign = adjustment.startsWith('+') || adjustment.startsWith('-')

    if (hasSign) {
      // Signed: positive = healing, negative = damage
      if (value > 0) {
        await this.options.document.applyDamage(-value, 1)
      } else if (value < 0) {
        await this.options.document.applyDamage(Math.abs(value), 1)
      }
    } else {
      // Unsigned: set HP directly
      await this.options.document.update({
        'system.attributes.hp.value': value
      })
    }

    // Call the optional callback if provided
    if (typeof this.options.callback === 'function') {
      this.options.callback()
    }
  }

  /**
   * Heal naturally from rest: a night's rest or a day of bed rest, times the
   * number of days entered (#966)
   * @this {HitPointsConfig}
   * @param {PointerEvent} event - The click event
   * @param {HTMLElement} target - The rest button (carries data-rest-type)
   * @private
   */
  static async #onRest (event, target) {
    event.preventDefault()
    const days = this.element.querySelector('input[name="restDays"]')?.value
    await this.options.document.applyNaturalHealing(target.dataset.restType, { days })
    if (typeof this.options.callback === 'function') {
      this.options.callback()
    }
    await this.close()
  }
}

export default HitPointsConfig
