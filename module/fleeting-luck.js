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
        userId: user.id,
        fleetingLuck: value ? value.toString() : '0',
        name: user.name
      }
      data.users.push(userData)
    }
    return data
  }

  /** @override */
  activateListeners (html) {
    super.activateListeners(html)

    html.find('.minus').click(this._onTakeLuck.bind(this))
    html.find('.plus').click(this._onGiveLuck.bind(this))
    html.find('.clear').click(this._onClearLuck.bind(this))
  }

  /**
   * Handle removing fleeting luck from a player
   * @param {Event} event   The originating click event
   * @private
   */
  async _onTakeLuck (event) {
    event.preventDefault()
    const userId = event.currentTarget.dataset.userId
    await FleetingLuck.take(userId, 1)
    this.render()
  }

  /**
   * Handle giving fleeting luck to a player
   * @param {Event} event   The originating click event
   * @private
   */
  async _onGiveLuck (event) {
    event.preventDefault()
    const userId = event.currentTarget.dataset.userId
    await FleetingLuck.give(userId, 1)
    this.render()
  }

  /**
   * Handle removing all fleeting luck from a player
   * @param {Event} event   The originating click event
   * @private
   */
  async _onClearLuck (event) {
    event.preventDefault()
    const userId = event.currentTarget.dataset.userId
    await FleetingLuck.clear(userId)
    this.render()
  }

  /** @override */
  async _updateObject (event, formData) {
    event.preventDefault()
    this.render()
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
   * Give fleeting luck to a user
   * @param {String} id      Id of the user
   * @param {Number} amount  Amount of luck to give
   * @returns {Promise.<Document>}
   */
  static async give (id, amount) {
    const user = game.users.get(id)
    const currentValue = parseInt(user.getFlag('dcc', FleetingLuck.fleetingLuckFlag) || 0)
    return user.setFlag('dcc', FleetingLuck.fleetingLuckFlag, currentValue + amount)
  }

  /**
   * Take fleeting luck from a user
   * @param {String} id    Id of the user
   * @param {Number} amount  Amount of luck to give
   * @returns {Promise.<Document>}
   */
  static async take (id, amount) {
    const user = game.users.get(id)
    const currentValue = parseInt(user.getFlag('dcc', FleetingLuck.fleetingLuckFlag) || 0)
    return user.setFlag('dcc', FleetingLuck.fleetingLuckFlag, Math.max(currentValue - amount, 0))
  }

  /**
   * Clear all fleeting luck for a user
   * @param {String} id    Id of the user
   * @returns {Promise.<Document>}
   */
  static async clear (id) {
    const user = game.users.get(id)
    return user.setFlag('dcc', FleetingLuck.fleetingLuckFlag, 0)
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
