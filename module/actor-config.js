/* global FormApplication, game, CONFIG */

export class DCCActorConfig extends FormApplication {
  static get defaultOptions () {
    const options = super.defaultOptions
    options.id = 'sheet-config'
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
  getData () {
    const data = this.object.data
    data.isNPC = (this.object.data.type === 'NPC')
    data.izPC = (this.object.data.type === 'Player')
    data.isZero = (this.object.data.data.details.level === 0)
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
    this.object.sheet.render(true)
  }
}

export default DCCActorConfig
