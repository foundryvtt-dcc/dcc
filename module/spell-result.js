/* global ChatMessage, CONFIG, CONST, duplicate, game, mergeObject, renderTemplate, TextEditor */

class SpellResult {
  static async addChatMessage (rollTable, result, { messageData = {}, messageOptions = {}, crit = false, fumble = false } = {}) {
    const roll = result.roll
    messageOptions = mergeObject({
      rollMode: game.settings.get('core', 'rollMode')
    }, messageOptions)

    const speaker = ChatMessage.getSpeaker({ user: game.user })

    // Construct chat data
    messageData = mergeObject({
      flavor: game.i18n.localize('DCC.SpellCheckCardMessage'),
      user: game.user._id,
      speaker: speaker,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      roll: roll,
      sound: roll ? CONFIG.sounds.dice : null,
      flags: {
        'core.RollTable': result.id,
        'dcc.SpellCheck': true
      }
    }, messageData)

    // Render the chat card which combines the dice roll with the drawn results
    messageData.content = await renderTemplate(CONFIG.DCC.templates.spellResult, {
      description: TextEditor.enrichHTML(rollTable.data.description, { entities: true }),
      results: result.results.map(r => {
        r = duplicate(r)
        r.text = rollTable._getResultChatText(r)
        r.icon = r.img || CONFIG.RollTable.resultIcon
        return r
      }),
      rollHTML: rollTable.data.displayRoll ? await roll.render() : null,
      table: rollTable,
      crit,
      fumble
    })

    // Create the chat message
    return ChatMessage.create(messageData, messageOptions)
  }

  static async processChatMessage(message, html, data) {
    // No hooks for players, avoid shenanigans
    if (!game.user.isGM) { return; }
  
    if (message.getFlag('dcc', 'SpellCheck')) {
      html.find('.spell-shift-up').click(SpellResult._onNextResult.bind(message))
      html.find('.spell-shift-down').click(SpellResult._onPreviousResult.bind(message))
    }
  }

  static async _onPreviousResult(event) {
    // Pull out the relevant data from the existing HTML
    const tableId = event.target.parentElement.parentElement.parentElement.parentElement.getAttribute('data-table-id')
    const tableCompendium = event.target.parentElement.parentElement.parentElement.parentElement.getAttribute('data-table-compendium')
    const resultId = event.target.parentElement.parentElement.getAttribute('data-result-id')
    const crit = event.target.parentElement.parentElement.getAttribute('data-crit') === 'true'
    const fumble = event.target.parentElement.parentElement.getAttribute('data-fumble') === 'true'

    // Lookup the appropriate table
    let rollTable
    const predicate = t => t._id === tableId
    // If a collection is specified then check the appropriate pack for the spell
    if (tableCompendium) {
      const pack = game.packs.get(tableCompendium)
      if (pack) {
        await pack.getIndex()
        const entry = pack.index.find(predicate)
        rollTable = await pack.getEntity(entry._id)
      }
    }
    // Otherwise fall back to searching the world
    if (!rollTable) {
      rollTable = game.tables.entities.find(predicate)
    }

    if (rollTable) {
      const entryIndex = rollTable.results.findIndex(r => r._id === resultId)
      const newResult = rollTable.results[entryIndex - 1]
      let newContent = await renderTemplate(CONFIG.DCC.templates.spellResult, {
        description: TextEditor.enrichHTML(rollTable.data.description, { entities: true }),
        results: [newResult].map(r => {
          r = duplicate(r)
          r.text = TextEditor.enrichHTML(rollTable._getResultChatText(r), { entities: true }),
          r.icon = r.img || CONFIG.RollTable.resultIcon
          return r
        }),
        rollHTML: rollTable.data.displayRoll ? await this.roll.render() : null,
        table: rollTable,
        crit,
        fumble
      })
  
      this.update({ content: newContent })
    }
  }

  static async _onNextResult(event) {
    // Pull out the relevant data from the existing HTML
    const tableId = event.target.parentElement.parentElement.parentElement.parentElement.getAttribute('data-table-id')
    const tableCompendium = event.target.parentElement.parentElement.parentElement.parentElement.getAttribute('data-table-compendium')
    const resultId = event.target.parentElement.parentElement.getAttribute('data-result-id')
    const crit = event.target.parentElement.parentElement.getAttribute('data-crit') === 'true'
    const fumble = event.target.parentElement.parentElement.getAttribute('data-fumble') === 'true'

    // Lookup the appropriate table
    let rollTable
    const predicate = t => t._id === tableId
    // If a collection is specified then check the appropriate pack for the spell
    if (tableCompendium) {
      const pack = game.packs.get(tableCompendium)
      if (pack) {
        await pack.getIndex()
        const entry = pack.index.find(predicate)
        rollTable = await pack.getEntity(entry._id)
      }
    }
    // Otherwise fall back to searching the world
    if (!rollTable) {
      rollTable = game.tables.entities.find(predicate)
    }

    if (rollTable) {
      const entryIndex = rollTable.results.findIndex(r => r._id === resultId)
      const newResult = rollTable.results[entryIndex + 1]
      let newContent = await renderTemplate(CONFIG.DCC.templates.spellResult, {
        description: TextEditor.enrichHTML(rollTable.data.description, { entities: true }),
        results: [newResult].map(r => {
          r = duplicate(r)
          r.text = TextEditor.enrichHTML(rollTable._getResultChatText(r), { entities: true }),
          r.icon = r.img || CONFIG.RollTable.resultIcon
          return r
        }),
        rollHTML: rollTable.data.displayRoll ? await this.roll.render() : null,
        table: rollTable,
        crit,
        fumble
      })
  
      this.update({ content: newContent })
    }
  }
}

export default SpellResult
