/* global CONFIG, game */

class FleetingLuckDialog extends Application {
  static get defaultOptions () {
    const options = super.defaultOptions
    options.template = 'systems/dcc/templates/dialog-fleeting-luck.html'
    return options
  }

  get title () {
    return game.i18n.localize('DCC.FleetingLuck')
  }

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  getData () {
    const data = {}
    data.cssClass = 'dcc'
    data.user = game.user
    data.config = CONFIG.DCC
    data.users = []
    for (const user of game.users.values()) {
      const value = user.getFlag('dcc', FleetingLuck.fleetingLuckFlag)
      const userData = {
        avatar: user.avatar,
        name: user.name,
        fleetingLuck: value ? value.toString() : '0'
      }
      data.users.push(userData)
    }
    return data
  }

  /** @override */
  activateListeners (html) {
    super.activateListeners(html)
  }

  /** @override */
  async _updateObject (event, formData) {
    event.preventDefault()
    // Re-draw the updated sheet
    this.object.sheet.render(true)
  }

  /** @override */
  async close () {
    FleetingLuck.instance = null
    return super.close()
  }
}

class FleetingLuck {
  static instance = null

  static fleetingLuckFlag = 'fleetingLuckValue'

  /**
   * Initialise the Fleeting Luck subsystem
   */
  static init () {
    // TODO: Register listener for chat events
  }

  /**
   * Toggle the Fleeting Luck dialog
   */
  static async show () {
    if (FleetingLuck.instance) {
      await FleetingLuck.instance.close()
      delete FleetingLuck.instance
      FleetingLuck.instance = null
    } else {
      FleetingLuck.instance = new FleetingLuckDialog()
      FleetingLuck.instance.render(true)
    }
  }

  /**
   * Poll the status of the Fleeting Luck dialog
   * @returns {Boolean}     Visibility status of the dialog
   */
  static get visible() {
    return FleetingLuck.instance !== null
  }
}

export default FleetingLuck
