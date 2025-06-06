/* global FormApplication, game, CONFIG */

class DCCActorConfig extends FormApplication {
  static get defaultOptions () {
    const options = super.defaultOptions
    options.template =
      'systems/dcc/templates/dialog-actor-config.html'
    options.width = 380
    return options
  }

  /* -------------------------------------------- */

  /**
   * Add the Entity name into the window title
   * @type {String}
   */
  get title () {
    return `${this.object.name}: ${game.i18n.localize('DCC.SheetConfig')}`
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  getData (options = {}) {
    const data = this.object
    data.isNPC = (this.object.type === 'NPC')
    data.isPC = (this.object.type === 'Player')
    data.isZero = (this.object.system.details.level.value === 0)
    data.user = game.user
    data.config = CONFIG.DCC
    return data
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners (html) {
    super.activateListeners(html)
  }

  /**
   * This method is called upon form submission after form data is validated
   * @param event {Event}       The initial triggering submission event
   * @param formData {Object}   The object of validated form data with which to update the object
   * @private
   */
  async _updateObject (event, formData) {
    event.preventDefault()
    // Update the actor
    await this.object.update(formData)
    // Re-draw the updated sheet
    await this.object.sheet.render(true)
  }
}

export default DCCActorConfig
