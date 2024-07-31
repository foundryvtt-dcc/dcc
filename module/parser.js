/* global CONFIG, Dialog, expandObject, fromUuid, FormApplication, game, Hooks, ui, $ */

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
    const context = {}
    context.user = game.user
    context.config = CONFIG.DCC
    context.folders = []

    // Gather the list of actor folders
    for (const folder of game.actors.directory.folders) {
      context.folders.push({ id: folder._id, name: folder.name })
    }

    return context
  }

  /**
   * Handle form submission
   * @param {Object} event     Submission event
   * @param {Object} formData  Data from the form
   * @return {Object}
   */
  async _updateObject (event, formData) {
    event.preventDefault()

    await createActors(formData.type, formData.folderId, formData.statblocks)
  }
}

/**
 * Create and import actors from PSG text, JSON, or a DCC statline
 * @param {string} type      - Player or NPC entity?
 * @param {string} folderId  - ID of the folder to import actors into
 * @param {string} actorData - Actor data (PSG text or JSON for Players, or a DCC statline for NPCs)
 * @return {Promise}
 */
async function createActors (type, folderId, actorData) {
  // Process the stat block
  let parsedCharacters
  try {
    parsedCharacters = (type === 'Player') ? await parsePCs(actorData) : await parseNPCs(actorData)
  } catch (e) {
    console.error(e)
    if (type === 'Player') {
      return ui.notifications.warn(game.i18n.localize('DCC.ParsePlayerWarning'))
    } else {
      return ui.notifications.warn(game.i18n.localize('DCC.ParseNPCWarning'))
    }
  }

  const actors = []

  // Prompt if we're importing a lot of actors
  if (parsedCharacters.length > CONFIG.DCC.actorImporterPromptThreshold) {
    let importConfirmed = false

    const context = {
      number: parsedCharacters.length
    }
    await new Promise((resolve, reject) => {
      new Dialog({
        title: game.i18n.format('DCC.ActorImportConfirmationPrompt', context),
        content: `<p>${game.i18n.format('DCC.ActorImportConfirmationMessage', context)}</p>`,
        buttons: {
          yes: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize('DCC.Yes'),
            callback: () => {
              importConfirmed = true
              resolve()
            }
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize('DCC.No'),
            callback: () => {
              importConfirmed = false
              resolve()
            }
          }
        }
      }).render(true)
    })

    // Abort the import
    if (!importConfirmed) {
      return []
    }
  }

  // Cache available items if importing players
  // @TODO Implement a configuration mechanism for providing additional packs
  const itemMap = {}
  if (type === 'Player') {
    for (const packPath of CONFIG.DCC.actorImporterItemPacks) {
      const pack = game.packs.get(packPath)
      if (!pack) continue

      const index = await pack.getIndex()
      for (const entry of index) {
        itemMap[entry.name] = entry
      }
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
      if (parsedCharacter['details.occupation.value']) {
        nameParts.push(parsedCharacter['details.occupation.value'])
      }
      if (parsedCharacter['class.className']) {
        nameParts.push(parsedCharacter['class.className'])
      }
      name = nameParts.join(' ')
    }

    // Enable Compute AC for imported player actors since they have armor items
    if (type === 'Player') {
      parsedCharacter['config.computeAC'] = true
    }

    // Create the actor
    const actor = await DCCActor.create({
      name,
      type,
      folder: folderId,
      system: foundry.utils.expandObject(parsedCharacter),
      items
    })

    // Try and pick a sheet of player characters by matching sheet names to the actor's class name
    if (type === 'Player' && parsedCharacter['class.className']) {
      const classes = Object.keys(CONFIG.Actor.sheetClasses[type])
      for (const sheetClass of classes) {
        if (sheetClass.includes(parsedCharacter['class.className'])) {
          actor.setFlag('core', 'sheetClass', sheetClass)
        }
      }
    }

    // Try and remap items to compendium items
    if (type === 'Player') {
      const items = [...actor.items] // Copy the actor's items array
      for (const originalItem of items) {
        // Strip '+X ' if present on the front of high level items
        const cleanName = originalItem.name.replace(/^\+\d+ /, '')

        // Apply name remapping
        const names = CONFIG.DCC.actorImporterNameMap[cleanName] ?? [cleanName]
        const newItems = []

        for (const name of names) {
          // Check for an item of this type in the cache
          const mapEntry = itemMap[name]
          if (mapEntry && mapEntry.type === originalItem.type) {
            // Lookup the item document
            const compendiumItem = await fromUuid(mapEntry.uuid)
            const newItem = compendiumItem.toObject()

            // Keep the original item name if we're remapping to a single item
            if (names.length === 1) {
              newItem.name = originalItem.name
            }

            // Copy relevant fields from the original object to maintain modifiers and stats
            if (originalItem.type === 'weapon') {
              newItem.system.toHit = originalItem.system.toHit
              newItem.system.damage = originalItem.system.damage
              newItem.system.melee = originalItem.system.melee
              newItem.system.equipped = true
            } else if (originalItem.type === 'armor') {
              newItem.system.acBonus = originalItem.system.acBonus
              newItem.system.checkPenalty = originalItem.system.checkPenalty
              newItem.system.fumbleDie = originalItem.system.fumbleDie
            }

            newItems.push(newItem)
          }
        }

        // Remove the old object and add the new one
        if (newItems.length > 0) {
          actor.deleteEmbeddedDocuments('Item', [originalItem.id])
          actor.createEmbeddedDocuments('Item', newItems)
        }
      }
    }

    actors.push(actor)

    // Call a hook for postprocessing of actors
    Hooks.callAll('dcc.postActorImport', { actor })
  }

  return actors
}

/**
 * Hook to create the Actor Directory buttons for quick import
 * @param {object} app
 * @param {object}   html
 * @return {Promise}
 */
function onRenderActorDirectory (app, html) {
  if (!game.user.hasPermission("ACTOR_CREATE")) {
    return Promise.resolve()
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

export default { onRenderActorDirectory, createActors }
