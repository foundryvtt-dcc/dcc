/* global game, CONFIG, foundry */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

class MeleeMissileBonusConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'melee-missile-bonus-config', 'themed', 'theme-light'],
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
   * Get the document being configured
   * @type {Actor}
   */
  get document () {
    return this.options.document
  }

  /**
   * Get the window title including the actor name
   * @type {String}
   */
  get title () {
    return `${this.document.name}: ${game.i18n.localize('DCC.MeleeMissileBonusConfigTitle')}`
  }

  /* -------------------------------------------- */

  /**
   * Prepare context data for rendering the HTML template
   * @param {Object} options - Rendering options
   * @return {Object} The context data
   */
  async _prepareContext (options = {}) {
    const context = await super._prepareContext(options)
    const actor = this.document

    context.isNPC = (actor.type === 'NPC')
    context.isPC = (actor.type === 'Player')
    context.isZero = (actor.system.details.level.value === 0)
    context.user = game.user
    context.config = CONFIG.DCC
    context.system = actor.system

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
    await this.document.update(formData.object)
    // Re-draw the updated sheet
    await this.document.sheet.render(true)
  }
}

export default MeleeMissileBonusConfig
