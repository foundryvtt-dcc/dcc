/* global Dialog, game, expandObject ui, $ */

import DCCActor from './actor.js'
import parsePCs from './pc-parser.js'
import parseNPCs from './npc-parser.js'

class DCCActorParser extends FormApplication {
  /**
   * Specify the default options for this class
   * @return {Object}
   */
  static get defaultOptions () {
    const options = super.defaultOptions
    options.id = 'actor-parser'
    options.width = 600
    options.height = 800
    options.template = 'systems/dcc/templates/dialog-actor-import.html'
    return options
  }

  /**
   * Title
   * @type {String}
   */
  get title () {
    return 'Import Actors'
  }

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  getData () {
    const data = {}
    data.user = game.user
    data.config = CONFIG.DCC
    data.folders = []

    // Gather the list of actor folders
    for (const folder of game.actors.directory.folders) {
      data.folders.push({ id: folder.data._id, name: folder.data.name })
    }

    return data
  }

  /**
   * Handle form submission
   * @param {Object} event     Submission event
   * @param {Object} formData  Data from the form
   * @return {Object}
   */
  async _updateObject (event, formData) {
    event.preventDefault()

    _createActors(formData.type, formData.folderId, formData.statblocks)
  }
}

/**
 * Create and import actors from PSG text, JSON, or a DCC statline
 * @param {string} type      - Player or NPC entity?
 * @param {string} folderId  - ID of the folder to import actors into
 * @param {string} actorData - Actor data (PSG text or JSON for Players, or a DCC statline for NPCs)
 * @return {Promise}
 */
async function _createActors (type, folderId, actorData) {
  // Process the statblock
  let parsedCharacters
  try {
    parsedCharacters = (type === 'Player') ? parsePCs(actorData) : parseNPCs(actorData)
  } catch (e) {
    if (type === 'Player') {
      return ui.notifications.warn(game.i18n.localize('DCC.ParsePlayerWarning'))
    } else {
      return ui.notifications.warn(game.i18n.localize('DCC.ParseNPCWarning'))
    }
  }

  for (const parsedCharacter of parsedCharacters) {
    // Separate out owned items
    const items = parsedCharacter.items
    delete parsedCharacter.items

    // Figure out the name
    let name = game.i18n.format('DCC.NewActorName', { type })
    const nameParts = []
    // If there's a name (from NPCs or Player imports with a name added) then use it
    if (parsedCharacter.name) {
      name = parsedCharacter.name
    } else {
      // Otherwise combine the occupation and class if available to come up with something descriptive
      if (parsedCharacter['data.details.occupation.value']) {
        nameParts.push(parsedCharacter['data.details.occupation.value'])
      }
      if (parsedCharacter['data.class.className']) {
        nameParts.push(parsedCharacter['data.class.className'])
      }
      name = nameParts.join(' ')
    }

    // Create the actor
    await DCCActor.create({
      name,
      type,
      folder: folderId,
      data: expandObject(parsedCharacter).data,
      items
    })
  }
}

/**
 * Hook to create the Actor Directory buttons for quick import
 * @param {object} app
 * @param {object}   html
 * @return {Promise}
 */
function onRenderActorDirectory (app, html) {
  if (!game.user.isGM) {
    return
  }
  const button = $(`<button class="import-actors"><i class="fas fa-user"></i> ${game.i18n.localize('DCC.ActorImport')}</button>`)
  button.on('click', () => {
    new DCCActorParser().render(true)
  })
  let footer = html.find('.directory-footer')
  if (footer.length === 0) {
    footer = $('<footer class="directory-footer"></footer>')
    html.append(footer)
  }
  footer.append(button)
}

export default { onRenderActorDirectory }
