/* global CONFIG, FormApplication, game, Hooks, mergeObject */

class FleetingLuckDialog extends FormApplication {
  /** @override */
  static get defaultOptions () {
    return mergeObject(super.defaultOptions, {
      id: 'fleeting-luck',
      template: 'systems/dcc/templates/dialog-fleeting-luck.html',
      height: 'fit-content'
    })
  }

  /** @override */
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
  }

  /** @override */
  async _updateObject (event, formData) {
    event.preventDefault()
    this.render()
  }

  /** @override */
  async close () {
    FleetingLuck.dialog = null
    return super.close()
  }
}

class FleetingLuck {
  static dialog = null

  static fleetingLuckFlag = 'fleetingLuckValue'

  /**
   * Initialise the Fleeting Luck subsystem
   */
  static init () {
    Hooks.on('createChatMessage', (message, options, id) => {
      // Check for Roll Type data to determine if we can handle this roll
      const effect = message.getFlag('dcc', 'FleetingLuckEffect')
      if (effect !== undefined) {
        switch (effect) {
          case 'Gain':
            FleetingLuck.give(message.user.id, 1)
            break
          case 'Lose':
            FleetingLuck.clearAll()
            break
        }
      }
    })

    Hooks.on('getUserContextOptions', (html, options) => {
      options.push( {
        name: game.i18n.localize('DCC.FleetingLuckGive'),
        icon: '<i class="fas fa-balance-scale-left"></i>',
        condition: li => game.user.isGM,
        callback: li => {
          FleetingLuck.give(li[0].dataset.userId, 1)
        }
      })
    })
  }

  /**
   * Toggle the Fleeting Luck dialog
   */
  static async show () {
    if (FleetingLuck.dialog) {
      await FleetingLuck.dialog.close()
      delete FleetingLuck.dialog
      FleetingLuck.dialog = null
    } else {
      FleetingLuck.dialog = new FleetingLuckDialog()
      FleetingLuck.dialog.render(true)
    }
  }

  /**
   * Refresh the dialog if open
   * @returns {Promise}
   */
  static async refresh () {
    if (FleetingLuck.dialog) {
      return await FleetingLuck.dialog.render(false)
    }
  }

  /**
   * Give fleeting luck to a user
   * @param {String} id      Id of the user
   * @param {Number} amount  Amount of luck to give
   * @returns {Promise}
   */
  static async give (id, amount) {
    const user = game.users.get(id)
    const currentValue = parseInt(user.getFlag('dcc', FleetingLuck.fleetingLuckFlag) || 0)
    await user.setFlag('dcc', FleetingLuck.fleetingLuckFlag, currentValue + amount)
    return await FleetingLuck.refresh()
  }

  /**
   * Take fleeting luck from a user
   * @param {String} id    Id of the user
   * @param {Number} amount  Amount of luck to give
   * @returns {Promise}
   */
  static async take (id, amount) {
    const user = game.users.get(id)
    const currentValue = parseInt(user.getFlag('dcc', FleetingLuck.fleetingLuckFlag) || 0)
    await user.setFlag('dcc', FleetingLuck.fleetingLuckFlag, Math.max(currentValue - amount, 0))
    return await FleetingLuck.refresh()
  }

  /**
   * Clear all fleeting luck for a user
   * @param {String} id    Id of the user
   * @returns {Promise}
   */
  static async clear (id) {
    const user = game.users.get(id)
    await user.setFlag('dcc', FleetingLuck.fleetingLuckFlag, 0)
    return await FleetingLuck.refresh()
  }

  /**
   * Clear all fleeting luck
   */
  static async clearAll () {
    await game.users.forEach(user => {
      FleetingLuck.clear(user.id)
    })
  }

  /**
   * Poll the status of the Fleeting Luck dialog
   * @returns {Boolean}     Visibility status of the dialog
   */
  static get visible() {
    return FleetingLuck.dialog !== null
  }

  /**
   * Set flags for a chat message based on a roll object
   * @param {Object} flags    Flags object to update
   * @param {Object} roll     Roll object to inspect
   */
  static updateFlags (flags, roll) {
    // Extract the first dice from the roll
    if (!roll?.dice?.length) return
    const d = roll.dice[0]

    // Natural 20 or natural 1
    if (d.results.length === 1) {
      if (d.results[0].result === 20) {
        FleetingLuck.updateFlagsForCrit(flags)
      } else if (d.results[0].result === 1) {
        FleetingLuck.updateFlagsForFumble(flags)
      }
    }
  }

  /*
   * Set flags for a chat message assuming critical success
   * @param {Object} flags    Flags object to update
   */
  static updateFlagsForCrit (flags) {
    if (flags) {
      Object.assign(flags, {
        'dcc.FleetingLuckEffect': 'Gain'
      })
    }
  }
  /**
   * Set flags for a chat message assuming critical failure
   * @param {Object} flags    Flags object to update
   */
  static updateFlagsForFumble (flags) {
    if (flags) {
      Object.assign(flags, {
        'dcc.FleetingLuckEffect': 'Lose'
      })
    }
  }
}

export default FleetingLuck
