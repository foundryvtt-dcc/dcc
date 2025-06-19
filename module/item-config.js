/* global game, CONFIG, foundry */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

class DCCItemConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'item-config', 'themed'],
    tag: 'form',
    position: {
      width: 380,
      height: 'auto'
    },
    window: {
      title: 'DCC.ItemConfig',
      resizable: false
    },
    form: {
      handler: DCCItemConfig.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: true
    }
  }

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: null // Will be set dynamically
    }
  }

  /**
   * Get the appropriate template based on item type
   * @returns {string} Template path
   */
  _getTemplate () {
    switch (this.document.type) {
      case 'spell':
        return 'systems/dcc/templates/dialog-item-config-spell.html'
      case 'skill':
        return 'systems/dcc/templates/dialog-item-config-skill.html'
      default:
        return 'systems/dcc/templates/dialog-item-config-spell.html'
    }
  }

  /** @inheritDoc */
  _configureRenderParts (options) {
    const parts = super._configureRenderParts(options)
    parts.form.template = this._getTemplate()
    return parts
  }

  /* -------------------------------------------- */

  /**
   * Prepare context data for rendering the HTML template
   * @param {Object} options - Rendering options
   * @return {Object} The context data
   */
  async _prepareContext (options = {}) {
    const context = await super._prepareContext(options)
    const item = this.options.document

    // Copy item data to context
    Object.assign(context, item)
    context.user = game.user
    context.config = CONFIG.DCC
    context.item = item

    return context
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners (html) {
    super.activateListeners(html)
  }

  /**
   * Handle form submission
   * @this {DCCItemConfig}
   * @param {SubmitEvent} event - The form submission event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - The processed form data
   * @private
   */
  static async #onSubmitForm (event, form, formData) {
    event.preventDefault()
    // Update the item with the form data
    await this.document.update(formData.object)
    // Re-draw the updated sheet
    await this.document.sheet.render(true)
  }
}

export default DCCItemConfig
