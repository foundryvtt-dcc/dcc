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
      flags: { 'core.RollTable': result.id }
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
}

export default SpellResult
