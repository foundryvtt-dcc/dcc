/* global ChatMessage, CONFIG, CONST, duplicate, game, mergeObject, renderTemplate, TextEditor */

class SpellResult {
  /**
   * Create a chat message for a Spell Check result
   * @param {Object} rollTable    The RollTable representing spell results
   * @param {Object} result       The result object drawn from the table
   * @param {Object} messageData  Additional message data for the ChatMessage object
   * @param {Object} messageOptions  Additional options for the ChatMessage object
   * @param {boolean} crit        The Spell Check was a nat 20
   * @param {boolean} fumble      The Spell Check was a nat 1
   * @param {String} itemId       ID of the spell item
   */
  static async addChatMessage (rollTable, result, { messageData = {}, messageOptions = {}, crit = false, fumble = false, itemId = undefined } = {}) {
    const roll = result.roll
    messageOptions = mergeObject({
      rollMode: game.settings.get('core', 'rollMode')
    }, messageOptions)

    const speaker = ChatMessage.getSpeaker({ user: game.user })

    // construct flags for the message
    const flags = {
      'core.RollTable': result.id,
      'dcc.SpellCheck': true,
      'dcc.RollType': 'SpellCheck',
      'dcc.ItemId': itemId
    }

    if (crit) {
      game.dcc.FleetingLuck.updateFlagsForCrit(flags)
    } else if (fumble) {
      game.dcc.FleetingLuck.updateFlagsForFumble(flags)
    }

    // Construct chat data
    messageData = mergeObject({
      flavor: game.i18n.localize('DCC.SpellCheckCardMessage'),
      user: game.user.id,
      speaker: speaker,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      roll: roll,
      sound: roll ? CONFIG.sounds.dice : null,
      flags
    }, messageData)

    // Render the chat card which combines the dice roll with the drawn results
    messageData.content = await renderTemplate(CONFIG.DCC.templates.spellResult, {
      description: await TextEditor.enrichHTML(rollTable.description, { entities: true, async: true }),
      results: result.results.map(r => {
        return duplicate(r)
      }),
      rollHTML: rollTable.displayRoll ? await roll.render() : null,
      table: rollTable,
      crit,
      fumble
    })

    // Create the chat message
    return ChatMessage.create(messageData, messageOptions)
  }

  /**
   * Process an incoming chat message and add relevant hooks
   * @param {Object} message  The ChatMessage entity
   * @param {Object} html     The HTML content of the message
   * @param {Object} data     Extra data about the message
   */
  static async processChatMessage (message, html, data) {
    // No hooks for players, avoid shenanigans
    if (!game.user.isGM) { return }

    // Check it's a DCC spellcheck, otherwise leave it alone
    if (message.getFlag('dcc', 'SpellCheck')) {
      html.find('.spell-shift-up').click(SpellResult._onNextResult.bind(message))
      html.find('.spell-shift-down').click(SpellResult._onPreviousResult.bind(message))
    }
  }

  /**
   * Event handler for adjusting a spell check down
   * @param {Object} event      The originating click event
   */
  static async _onPreviousResult (event) {
    SpellResult._adjustResult.bind(this)(event, -1)
  }

  /**
   * Event handler for adjusting a spell check up
   * @param {Object} event      The originating click event
   */
  static async _onNextResult (event) {
    SpellResult._adjustResult.bind(this)(event, +1)
  }

  /**
   * Adjust a Spell Check chat result by moving the result up or down
   * @param {Object} event      The originating click event
   * @param {Object} direction  Adjust up (+1) or down (-1)
   */
  static async _adjustResult (event, direction) {
    // Pull out the relevant data from the existing HTML
    const tableId = event.target.parentElement.parentElement.parentElement.parentElement.getAttribute('data-table-id')
    const tableCompendium = event.target.parentElement.parentElement.parentElement.parentElement.getAttribute('data-table-compendium')
    const resultId = event.target.parentElement.parentElement.getAttribute('data-result-id')
    const crit = event.target.parentElement.parentElement.getAttribute('data-crit') === 'true'
    const fumble = event.target.parentElement.parentElement.getAttribute('data-fumble') === 'true'

    // Lookup the appropriate table
    let rollTable
    // If a collection is specified then check the appropriate pack for the spell
    if (tableCompendium) {
      const pack = game.packs.get(tableCompendium)
      if (pack) {
        await pack.getIndex()
        const entry = pack.index.get(tableId)
        rollTable = await pack.getDocument(entry._id)
      }
    }
    // Otherwise fall back to searching the world
    if (!rollTable) {
      rollTable = game.tables.get(tableId)
    }

    if (rollTable) {
      // Find the next result up or down, if available
      const entry = rollTable.results.get(resultId)
      const newResultRoll = (direction > 0) ? (entry.range[1]) + 1 : (entry.range[0] - 1)
      const newResult = rollTable.getResultsForRoll(newResultRoll)[0]
      const newContent = await renderTemplate(CONFIG.DCC.templates.spellResult, {
        description: await TextEditor.enrichHTML(rollTable.description, { entities: true, async: true }),
        results: [newResult].map(r => {
          return duplicate(r)
        }),
        rollHTML: rollTable.displayRoll ? await this.roll.render() : null,
        table: rollTable,
        crit,
        fumble
      })

      this.update({ content: newContent })
    }
  }
}

export default SpellResult
