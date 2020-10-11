/* global FormApplication, game, CONFIG */

export class DCCItemConfig extends FormApplication {
  static get defaultOptions () {
    const options = super.defaultOptions
    options.id = 'sheet-config'
    options.width = 380
    return options
  }

  /** @override */
  get template () {
    switch (this.object.data.type) {
      case 'weapon':
        return 'systems/dcc/templates/dialog-item-config-weapon.html'
      case 'spell':
        return 'systems/dcc/templates/dialog-item-config-spell.html'
      case 'skill':
        return 'systems/dcc/templates/dialog-item-config-skill.html'
      default:
    }
  }

  /* -------------------------------------------- */

  /**
   * Add the Entity name into the window title
   * @type {String}
   */
  get title () {
    return `${this.object.name}: ${game.i18n.localize('DCC.ItemConfig')}`
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  getData () {
    const data = this.object.data
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
    this.object.update(formData)
    // Re-draw the updated sheet
    this.object.sheet.render(true)
  }
}

export default DCCItemConfig
