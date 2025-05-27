/* global CONFIG, CONST, FormApplicationV2, game, Hooks, foundry, ui */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

class FleetingLuckDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'fleeting-luck',
    classes: ['dcc', 'sheet', 'fleeting-luck', 'themed', 'theme-light'],
    position: {
      width: 400,
      height: 'fit-content'
    },
    actions: {
      openUserConfiguration: this.#onOpenUserConfiguration,
      takeLuck: this.#onTakeLuck,
      giveLuck: this.#onGiveLuck,
      clearLuck: this.#onClearLuck,
      toggleFilter: this.#onToggleFilter,
      spendLuck: this.#onSpendLuck,
      clearAllLuck: this.#onClearAllLuck,
      resetAllLuck: this.#onResetAllLuck
    },
    window: {
      resizable: true,
      title: 'DCC.FleetingLuck'
    }
  }

  static PARTS = {
    form: {
      template: 'systems/dcc/templates/dialog-fleeting-luck.html'
    }
  }

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  _prepareContext (options = {}) {
    const data = {}
    data.cssClass = 'dcc'
    data.user = game.user
    data.config = CONFIG.DCC
    data.users = []
    const filterEnabled = FleetingLuck.isFilterEnabled()
    for (const user of game.users.values()) {
      if (FleetingLuck.isTrackedForUser(user)) {
        if (game.user.isGM || !filterEnabled || user === game.user) {
          const value = user.getFlag('dcc', FleetingLuck.fleetingLuckFlag)
          const userData = {
            avatar: user.avatar,
            userId: user.id,
            fleetingLuck: value ? value.toString() : '0',
            name: user.name
          }
          data.users.push(userData)
        }
      }
    }
    return data
  }

  /** @override */
  setPosition ({ left, top, width, height, scale } = {}) {
    const position = super.setPosition({ left, top, width, height, scale })
    position.height = 'fit-content'
    return position
  }

  /**
   * Open the User Configuration if permissions allow
   * @this {FleetingLuckDialog}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<Document[]>}
   */
  static async #onOpenUserConfiguration (event, target) {
    const userId = target.dataset.userId
    const user = game.users.get(userId)
    if (game.user.isGM || userId === game.user.id) {
      await user.sheet.render(true)
    }
  }

  /**
   * Handle removing fleeting luck from a player
   * @this {FleetingLuckDialog}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<Document[]>}
   */
  static async #onTakeLuck (event, target) {
    const userId = target.dataset.userId
    await FleetingLuck.take(userId, 1)
  }

  /**
   * Handle giving fleeting luck to a player
   * @this {FleetingLuckDialog}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<Document[]>}
   */
  static async #onGiveLuck (event, target) {
    const userId = target.dataset.userId
    await FleetingLuck.give(userId, 1)
  }

  /**
   * Handle spending fleeting luck
   * @this {FleetingLuckDialog}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<Document[]>}
   */
  static async #onSpendLuck (event, target) {
    const userId = target.dataset.userId
    const fleetingLuckValue = FleetingLuck.getValue(userId)

    if (fleetingLuckValue <= 0) {
      const user = game.users.get(userId)
      ui.notifications.warn(game.i18n.format('DCC.FleetingLuckSpendNoLuckWarning', { user: user.name }))
      return Promise.reject(new Error(game.i18n.localize('DCC.FleetingLuckSpendNoLuckWarning')))
    }

    const terms = [
      {
        type: 'FleetingLuck',
        formula: Math.min(1, fleetingLuckValue),
        fleetingLuck: fleetingLuckValue
      }
    ]
    const options = {
      showModifierDialog: true,
      title: game.i18n.localize('DCC.FleetingLuckSpendTitle'),
      rollLabel: game.i18n.localize('DCC.FleetingLuckSpendButton')
    }

    const roll = await game.dcc.DCCRoll.createRoll(terms, {}, options)
    await roll.evaluate()

    await FleetingLuck.spend(userId, roll.total)
  }

  /**
   * Handle removing all fleeting luck from a player
   * @this {FleetingLuckDialog}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<Document[]>}
   */
  static async #onClearLuck (event, target) {
    const userId = target.dataset.userId
    await FleetingLuck.clear(userId)
  }

  /**
   * Handle removing all fleeting luck from all players
   * @this {FleetingLuckDialog}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<Document[]>}
   */
  static async #onClearAllLuck (event, target) {
    await FleetingLuck.clearAll()
  }

  /**
   * Handle resetting fleeting luck for all players
   * @this {FleetingLuckDialog}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<Document[]>}
   */
  static async #onResetAllLuck (event, target) {
    await FleetingLuck.resetAll()
  }

  /**
   * Handle filter toggle
   * @this {FleetingLuckDialog}
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise<Document[]>}
   */
  static async #onToggleFilter (event, target) {
    await FleetingLuck.toggleFilter()
  }

  // /** @override */
  // async _updateObject (event, formData) {
  //   event.preventDefault()
  //   this.render()
  // }

  /** @override */
  async close (options = {}) {
    FleetingLuck.dialog = null
    return super.close()
  }
}

class FleetingLuck {
  /**
   * Initialise the Fleeting Luck subsystem
   */
  static init () {
    if (game.user.isGM) {

      if (!FleetingLuck.enabled) {
        const element = document.querySelector('[data-tool="fleetingLuck"]')
        if (element) {
          element.remove()
        }
      }

      // For GM, register hooks to manage fleeting luck
      Hooks.on('createChatMessage', (message) => {
        // Early out if automation is not enabled
        if (!FleetingLuck.automationEnabled) { return }

        // Check for Roll Type data to determine if we can handle this roll
        const effect = message.getFlag('dcc', 'FleetingLuckEffect')
        if (effect !== undefined) {
          if (FleetingLuck.isTrackedForUser(message.author)) {
            switch (effect) {
              case 'Gain':
                FleetingLuck.give(message.author.id, 1)
                break
              case 'Lose':
                FleetingLuck.clearAll()
                break
            }
          }
        }
      })

      Hooks.on('getUserContextOptions', (html, options) => {
        options.push({
          name: game.i18n.localize('DCC.FleetingLuckGive'),
          icon: '<i class="fas fa-balance-scale-left"></i>',
          condition: li => {
            const userId = li[0].dataset.userId
            const user = game.users.get(userId)
            return game.user.isGM && FleetingLuck.isTrackedForUser(user)
          },
          callback: li => {
            FleetingLuck.give(li[0].dataset.userId, 1)
          }
        })
      })
    }

    // All users refresh fleeting luck after user updates
    Hooks.on('updateUser', (doc, change) => {
      if (change.avatar || change.flags?.dcc) {
        FleetingLuck.refresh()
      }
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
   * Get fleeting luck for a user
   * @param {String} id      Id of the user
   * @returns {Number}
   */
  static getValue (id) {
    const user = game.users.get(id)
    return user.getFlag('dcc', FleetingLuck.fleetingLuckFlag) || 0
  }

  /**
   * Set fleeting luck for a user
   * @param {String} id      Id of the user
   * @param {Number} value   New value
   * @returns {Promise}
   */
  static async _set (id, value) {
    const user = game.users.get(id)
    await user.setFlag('dcc', FleetingLuck.fleetingLuckFlag, value)
    return await FleetingLuck.refresh()
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
    if (amount !== 0) {
      await FleetingLuck.addChatMessage(game.i18n.format('DCC.FleetingLuckGiveMessage', { user: user.name, amount }))
    }
    return await FleetingLuck.refresh()
  }

  /**
   * Take fleeting luck from a user
   * @param {String} id    Id of the user
   * @param {Number} amount  Amount of luck to take
   * @returns {Promise}
   */
  static async take (id, amount) {
    const user = game.users.get(id)
    const currentValue = parseInt(user.getFlag('dcc', FleetingLuck.fleetingLuckFlag) || 0)
    const newValue = Math.max(currentValue - amount, 0)
    await user.setFlag('dcc', FleetingLuck.fleetingLuckFlag, newValue)
    if (currentValue !== newValue) {
      await FleetingLuck.addChatMessage(game.i18n.format('DCC.FleetingLuckTakeMessage', { user: user.name, amount: currentValue - newValue }))
    }
    return await FleetingLuck.refresh()
  }

  /**
   * Spend fleeting luck for a user
   * @param {String} id    Id of the user
   * @param {Number} amount  Amount of luck to spend
   * @returns {Promise}
   */
  static async spend (id, amount) {
    const user = game.users.get(id)
    const currentValue = parseInt(user.getFlag('dcc', FleetingLuck.fleetingLuckFlag) || 0)
    const newValue = Math.max(currentValue - amount, 0)
    await user.setFlag('dcc', FleetingLuck.fleetingLuckFlag, newValue)
    if (currentValue !== newValue) {
      await FleetingLuck.addChatMessage(game.i18n.format('DCC.FleetingLuckSpendMessage', { user: user.name, amount: currentValue - newValue }))
    }
    return await FleetingLuck.refresh()
  }

  /**
   * Clear all fleeting luck for a user
   * @param {String} id    Id of the user
   * @returns {Promise}
   */
  static async clear (id) {
    return await FleetingLuck._clear(id)
  }

  static async _clear (id) {
    const user = game.users.get(id)
    await user.setFlag('dcc', FleetingLuck.fleetingLuckFlag, 0)
    return await FleetingLuck.refresh()
  }

  /**
   * Clear all fleeting luck
   */
  static async clearAll () {
    await game.users.forEach(user => {
      if (FleetingLuck.isTrackedForUser(user)) {
        FleetingLuck._clear(user.id)
      }
    })
    await FleetingLuck.addChatMessage(game.i18n.localize('DCC.FleetingLuckClearMessage'))
  }

  /**
   * Reset all fleeting luck
   */
  static async resetAll () {
    await game.users.forEach(user => {
      if (FleetingLuck.isTrackedForUser(user)) {
        FleetingLuck._set(user.id, 1)
      }
    })
    await FleetingLuck.addChatMessage(game.i18n.localize('DCC.FleetingLuckResetMessage'))
  }

  /**
   * Poll the status of the Fleeting Luck dialog
   * @returns {Boolean}     Visibility status of the dialog
   */
  static get visible () {
    return FleetingLuck.dialog !== null
  }

  /**
   * Check if a user should be considered for Fleeting Luck
   * @param {Object} user    User object
   * @returns {Boolean}
   */
  static isTrackedForUser (user) {
    return !user.isGM
  }

  /**
   * Toggle fleeting luck filter for the current user
   * @returns {Promise}
   */
  static async toggleFilter () {
    const currentValue = FleetingLuck.isFilterEnabled()
    await game.user.setFlag('dcc', FleetingLuck.fleetingLuckFilterFlag, !currentValue)
    return await FleetingLuck.refresh()
  }

  /**
   * Get fleeting luck filter status for the current user
   * Defaults to true if undefined
   * @returns {Boolean}
   */
  static isFilterEnabled () {
    const value = game.user.getFlag('dcc', FleetingLuck.fleetingLuckFilterFlag)
    if (value !== undefined) {
      return value
    }
    return true
  }

  /**
   * Set flags for a chat message based on a roll object
   * @param {Object} flags    Flags object to update
   * @param {Object} roll     Roll object to inspect
   */
  static updateFlags (flags, roll) {
    if (!roll?.dice?.length) return

    const d = roll.dice[0].values[0]

    // Use Natural Crit flag if available
    if (flags['dcc.isNaturalCrit'] !== undefined && flags['dcc.isNaturalCrit'] === true) {
      flags['dcc.isCrit'] = true
    }

    // Natural 20 or natural 1
    if (d === 20 || flags['dcc.isCrit']) {
      FleetingLuck.updateFlagsForCrit(flags)
    }

    if (d === 1 || flags['dcc.isFumble']) {
      FleetingLuck.updateFlagsForFumble(flags)
    }
  }

  /**
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

  /*
   * Send a chat message notifying of Fleeting Luck changes
   * @param {String} content    Message Content
   * @return {Promise}
   */
  static async addChatMessage (content) {
    const messageData = {
      user: game.user.id,
      type: CONST.CHAT_MESSAGE_STYLES.EMOTE,
      content,
      sound: CONFIG.sounds.notification
    }
    return CONFIG.ChatMessage.documentClass.create(messageData)
  }

  /*
   * Is Fleeting Luck enabled?
   * @return {Boolean}
   */
  static get enabled () {
    return game.settings.get('dcc', 'enableFleetingLuck')
  }

  /*
   * Is Fleeting Luck automation enabled?
   * @return {Boolean}
   */
  static get automationEnabled () {
    return FleetingLuck.enabled && game.settings.get('dcc', 'automateFleetingLuck')
  }
}

FleetingLuck.dialog = null
FleetingLuck.fleetingLuckFilterFlag = 'fleetingLuckFilter'
FleetingLuck.fleetingLuckFlag = 'fleetingLuckValue'

export default FleetingLuck
