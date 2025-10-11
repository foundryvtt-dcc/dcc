/* global ChatMessage, CONFIG, game, foundry */

const { TextEditor } = foundry.applications.ux

class SpellResult {
  /**
   * Create a chat message for a Spell Check result
   * @param {Object} roll   The Roll for the spell check
   * @param {Object} rollTable    The RollTable representing spell results
   * @param {Object} result       The result object drawn from the table
   * @param {Object} messageData  Additional message data for the ChatMessage object
   * @param {Object} messageOptions  Additional options for the ChatMessage object
   * @param {boolean} crit         The Spell Check was a nat 20
   * @param {boolean} fumble       The Spell Check was a nat 1
   * @param {Object} item          The spell item
   * @param {Object} patronTaint  The patron taint data object containing chance and message
   */
  static async addChatMessage (roll, rollTable, result, {
    messageData = {},
    messageOptions = {},
    crit = false,
    fumble = false,
    item = undefined,
    patronTaint = undefined
  } = {}) {
    messageOptions = foundry.utils.mergeObject({
      rollMode: game.settings.get('core', 'rollMode')
    }, messageOptions)

    // construct flags for the message
    const flags = {
      'core.RollTableId': result.id,
      'dcc.SpellCheck': true,
      'dcc.RollType': 'SpellCheck',
      'dcc.ItemId': item?.id || null
    }

    if (crit) {
      game.dcc.FleetingLuck.updateFlagsForCrit(flags)
    } else if (fumble) {
      game.dcc.FleetingLuck.updateFlagsForFumble(flags)
    }

    // Construct chat data
    messageData = foundry.utils.mergeObject({
      flavor: game.i18n.localize('DCC.SpellCheckCardMessage'),
      user: game.user.id,
      speaker: { actor: item?.actor?.id || null, alias: item?.actor?.name || null },
      rolls: [roll],
      sound: roll ? CONFIG.sounds.dice : null,
      system: { spellId: item?.id },
      flags
    }, messageData)

    let manifestation = {}
    let mercurial = {}
    if (item) {
      manifestation = item.system?.manifestation?.displayInChat ? item.system?.manifestation : {}
      mercurial = item.system?.mercurialEffect?.displayInChat ? item.system?.mercurialEffect : {}
    }

    // Render the chat card which combines the dice roll with the drawn results
    messageData.content = await foundry.applications.handlebars.renderTemplate('systems/dcc/templates/chat-card-spell-result.html', {
      description: await TextEditor.enrichHTML(rollTable.description),
      manifestation,
      mercurial,
      patronTaint,
      results: result.map(r => {
        return foundry.utils.duplicate(r)
      }),
      rollHTML: rollTable.displayRoll ? await roll.render() : null,
      table: rollTable,
      crit,
      fumble
    })

    // Use the item name instead of the rollTable name to allow customizing spell names
    if (item && item.name !== rollTable.name) {
      messageData.content = messageData.content.replace(`<h1>${rollTable.name}</h1>`, `<h1>${item.name}</h1>`)
    }

    // Create the chat message
    return ChatMessage.create(messageData, messageOptions)
  }

  /**
   * Process an incoming chat message and add relevant hooks
   * @param {Object} message  The ChatMessage entity
   * @param {Object} html     The HTML content of the message
   */
  static async processChatMessage (message, html) {
    // No hooks for players, avoid shenanigans
    if (!game.user.isGM) { return }

    // Check it's a DCC spellcheck, otherwise leave it alone
    if (message.getFlag('dcc', 'SpellCheck')) {
      html.querySelectorAll('.spell-shift-up').forEach(el => {
        el.addEventListener('click', SpellResult._onNextResult.bind(message))
      })
      html.querySelectorAll('.spell-shift-down').forEach(el => {
        el.addEventListener('click', SpellResult._onPreviousResult.bind(message))
      })
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
      const newContent = await foundry.applications.handlebars.renderTemplate('systems/dcc/templates/chat-card-spell-result.html', {
        description: await TextEditor.enrichHTML(rollTable.description),
        results: [newResult].map(r => {
          return foundry.utils.duplicate(r)
        }),
        rollHTML: rollTable.displayRoll ? await this.rolls[0].render() : null,
        table: rollTable,
        crit,
        fumble
      })

      this.update({ content: newContent })

      // Update the spell item's lastResult if this message is for a specific spell
      const spellId = this.getFlag('dcc', 'ItemId')
      if (spellId && newResult) {
        console.log('Updating spell lastResult:', { spellId, newResultRange: newResult.range[0] })

        // Get the actor from the message speaker
        const actorId = this.speaker?.actor
        if (actorId) {
          const actor = game.actors.get(actorId)
          if (actor) {
            const spellItem = actor.items.get(spellId)
            if (spellItem) {
              console.log('Found spell item, updating lastResult to:', newResult.range[0])
              await spellItem.update({ 'system.lastResult': newResult.range[0] })
            } else {
              console.log('Spell item not found on actor:', actorId)
            }
          } else {
            console.log('Actor not found:', actorId)
          }
        } else {
          console.log('No actor ID in speaker')
          // Fallback to searching all actors
          for (const actor of game.actors) {
            const spellItem = actor.items.get(spellId)
            if (spellItem) {
              console.log('Found spell item via fallback, updating lastResult to:', newResult.range[0])
              await spellItem.update({ 'system.lastResult': newResult.range[0] })
              break
            }
          }
        }
      }
    }
  }
}

export default SpellResult
