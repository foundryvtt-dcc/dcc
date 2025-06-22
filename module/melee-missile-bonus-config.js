/* global game, CONFIG, foundry */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

class MeleeMissileBonusConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'melee-missile-bonus-config'],
    tag: 'form',
    position: {
      width: 316,
      height: 'auto'
    },
    window: {
      title: 'DCC.MeleeMissileBonusConfigTitle',
      resizable: false
    },
    form: {
      handler: MeleeMissileBonusConfig.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: true
    }
  }

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: 'systems/dcc/templates/dialog-melee-missile-bonus-adjustments.html'
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

    context.isNPC = (this.options.document.type === 'NPC')
    context.isPC = (this.options.document.type === 'Player')
    context.isZero = (this.options.document.system.details.level.value === 0)
    context.user = game.user
    context.config = CONFIG.DCC
    context.system = this.options.document.system

    return context
  }

  /**
   * Handle form submission
   * @this {MeleeMissileBonusConfig}
   * @param {SubmitEvent} event - The form submission event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - The processed form data
   * @private
   */
  static async #onSubmitForm (event, form, formData) {
    event.preventDefault()
    // Update the actor
    await this.options.document.update(formData.object)
    // Re-draw the updated sheet
    await this.options.document.sheet.render(true)
  }
}

export default MeleeMissileBonusConfig
