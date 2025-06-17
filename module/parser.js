/* global CONFIG, foundry, fromUuid, game, Hooks, ui */

import DCCActor from './actor.js'
import parsePCs from './pc-parser.js'
import parseNPCs from './npc-parser.js'
import EntityImages from './entity-images.js'

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api

class DCCActorParser extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'actor-parser', 'themed', 'theme-light'],
    tag: 'form',
    position: {
      width: 600,
      height: 800
    },
    window: {
      title: 'DCC.ActorImport',
      resizable: true
    },
    form: {
      handler: DCCActorParser.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: true
    }
  }

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: 'systems/dcc/templates/dialog-actor-import.html'
    }
  }

  /* -------------------------------------------- */

  /**
   * Get the window title
   * @type {String}
   */
  get title () {
    return game.i18n.localize('DCC.ActorImport')
  }

  /* -------------------------------------------- */

  /**
   * Prepare context data for rendering the HTML template
   * @param {Object} options - Rendering options
   * @return {Object} The context data
   */
  async _prepareContext (options = {}) {
    const context = await super._prepareContext(options)

    context.user = game.user
    context.config = CONFIG.DCC
    context.folders = {}

    context.importType = game.settings.get('dcc', 'lastImporterType')
    context.importFolderId = game.settings.get('dcc', 'lastImporterFolderId')

    // Gather the list of actor folders
    for (const folder of game.folders.filter(folder => folder.type === 'Actor')) {
      context.folders[folder.id] = folder.name
    }

    return context
  }

  /**
   * Handle form submission
   * @this {DCCActorParser}
   * @param {SubmitEvent} event - The form submission event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - The processed form data
   * @private
   */
  static async #onSubmitForm (event, form, formData) {
    event.preventDefault()

    game.settings.set('dcc', 'lastImporterType', formData.object.type)
    game.settings.set('dcc', 'lastImporterFolderId', formData.object.folderId)

    await createActors(formData.object.type, formData.object.folderId, formData.object.statblocks)
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
  if (type === 'Player') {
    try {
      parsedCharacters = parsePCs(actorData)
    } catch (e) {
      console.error(e)
      return ui.notifications.warn(game.i18n.localize('DCC.ParsePlayerWarning'))
    }
  }

  if (type === 'NPC') {
    try {
      parsedCharacters = await parseNPCs(actorData)
    } catch (e) {
      console.error(e)
      return ui.notifications.warn(game.i18n.localize('DCC.ParsePlayerWarning'))
    }
  }

  const actors = []

  // Prompt if we're importing a lot of actors
  if (parsedCharacters.length > CONFIG.DCC.actorImporterPromptThreshold) {
    const context = {
      number: parsedCharacters.length
    }

    const importConfirmed = await DialogV2.confirm({
      window: {
        title: game.i18n.format('DCC.ActorImportConfirmationPrompt', context)
      },
      content: `<p>${game.i18n.format('DCC.ActorImportConfirmationMessage', context)}</p>`,
      yes: {
        icon: 'fas fa-check',
        label: game.i18n.localize('DCC.Yes')
      },
      no: {
        icon: 'fas fa-times',
        label: game.i18n.localize('DCC.No')
      }
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

      for (const entry of pack.index) {
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
      img: EntityImages.imageForActor(type),
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
              newItem.system.attackBonusWeapon = originalItem.system.attackBonusWeapon
              newItem.system.toHit = originalItem.system.toHit
              newItem.system.config = originalItem.system.config
              newItem.system.damage = originalItem.system.damage
              newItem.system.damageWeapon = originalItem.system.damageWeapon
              newItem.system.damageWeaponBonus = originalItem.system.damageWeaponBonus
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
          await actor.deleteEmbeddedDocuments('Item', [originalItem.id])
          await actor.createEmbeddedDocuments('Item', newItems)
        }
      }
    }

    // Link Actor Data by Default
    if (type === 'Player') {
      actor.updateSource({ prototypeToken: { actorLink: true } })
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
  if (!game.user.hasPermission('ACTOR_CREATE')) {
    return Promise.resolve()
  }

  // Create a new button element using vanilla JavaScript
  const button = document.createElement('button')
  button.classList.add('import-actors')
  button.classList.add('p-8')
  button.innerHTML = `<i class="fas fa-user"></i> ${game.i18n.localize('DCC.ActorImport')}`

  // Add the click event listener
  button.addEventListener('click', () => {
    new DCCActorParser().render(true)
  })

  // Find the footer element in the html (DocumentElement)
  let footer = html.querySelector('.directory-footer')

  // If no footer exists, create one and append it to the html
  if (!footer) {
    footer = document.createElement('footer')
    footer.classList.add('directory-footer')
    html.appendChild(footer) // Append the new footer
  }

  // Append the button to the footer
  footer.appendChild(button)
}

export default { onRenderActorDirectory, createActors }
