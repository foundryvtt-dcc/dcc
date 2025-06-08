/* global game, CONFIG */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

class SavingThrowConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'saving-throw-config',
    classes: ['dcc', 'sheet', 'saving-throw-config', 'themed', 'theme-light'],
    position: {
      width: 270,
      height: 'fit-content'
    },
    tag: 'form',
    form: {
      handler: SavingThrowConfig.#onSubmitForm,
      closeOnSubmit: true
    },
    actor: {
      type: 'Player'
    },
    window: {
      resizable: true,
      title: 'DCC.SavingThrowConfigTitle'
    }
  }

  static PARTS = {
    form: {
      template: 'systems/dcc/templates/dialog-saving-throw-adjustments.html'
    }
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  async _prepareContext (options = {}) {
    const context = await super._prepareContext(options)
    const data = this.options.document
    context.object = data
    context.actor = data
    context.isNPC = (data.type === 'NPC')
    context.isPC = (data.type === 'Player')
    context.isZero = (data.system.details.level.value === 0)
    context.user = game.user
    context.config = CONFIG.DCC
    return context
  }

  /* -------------------------------------------- */

  /**
   * This method is called upon form submission after form data is validated
   * @param event {Event}       The initial triggering submission event
   * @param form {HTMLFormElement}  The HTML form element that was submitted
   * @param formData {HTMLFormElement}  The object of validated form data with which to update the object
   */
  static async #onSubmitForm(event, form, formData) {
    event.preventDefault()
    // Update the actor
    await this.options.document.update(formData.object)
    // Re-draw the updated sheet
    await this.options.document.sheet.render(true)
  }
}

export default SavingThrowConfig
