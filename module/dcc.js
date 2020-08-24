/* global Actors, ActorSheet, Items, ItemSheet, ChatMessage, CONFIG, game, Hooks, Macro, ui, loadTemplates, Handlebars, EntitySheetConfig */
/**
 * DCC
 */

// Import Modules
import DCCActor from './actor.js'
import DCCActorSheet from './actor-sheet.js'
import * as DCCSheets from './actor-sheets-dcc.js'
import DCCItem from './item.js'
import DCCItemSheet from './item-sheet.js'
import DCC from './config.js'
import * as chat from './chat.js'

// Override the template for sheet configuration
class DCCSheetConfig extends EntitySheetConfig {
  /** @override */
  static get defaultOptions () {
    const options = super.defaultOptions
    options.template = 'systems/dcc/templates/sheet-config.html'
    options.tabs.unshift({ navSelector: '.config-tabs', contentSelector: '.config-body', initial: 'this-sheet' })
    return options
  }
}

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */
Hooks.once('init', async function () {
  console.log(`DCC | Initializing Dungeon Crawl Classics System\n${DCC.ASCII}`)

  // Override sheet selection dialog
  EntitySheetConfig = DCCSheetConfig // eslint-disable-line no-global-assign

  CONFIG.DCC = DCC

  game.dcc = {
    DCCActor,
    rollDCCWeaponMacro // This is called from macros, don't remove
  }

  // Define custom Entity classes
  CONFIG.Actor.entityClass = DCCActor
  CONFIG.Item.entityClass = DCCItem

  // Register sheet application classes
  Actors.unregisterSheet('core', ActorSheet)
  Actors.registerSheet('dcc', DCCActorSheet, { makeDefault: true })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetCleric)
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetThief)
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetHalfling)
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetWarrior)
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetWizard)
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetDwarf)
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetElf)
  Items.unregisterSheet('core', ItemSheet)
  Items.registerSheet('dcc', DCCItemSheet)

  // Register shared template for upper level characters
  const templatePaths = [
    'systems/dcc/templates/actor-partial-pc-header.html',
    'systems/dcc/templates/actor-partial-pc-common.html',
    'systems/dcc/templates/actor-partial-pc-equipment.html',
    'systems/dcc/templates/actor-partial-pc-notes.html',
    'systems/dcc/templates/actor-partial-wizard-spells.html',
    'systems/dcc/templates/actor-partial-cleric-spells.html',
    'systems/dcc/templates/item-partial-header.html'
  ]
  loadTemplates(templatePaths)

  // Handlebars helper to format attack bonus correctly
  Handlebars.registerHelper('formatAttackBonus', function (attackBonus) {
    if (!attackBonus) {
      return '+0'
    } else if (attackBonus[0] !== '+' && attackBonus[0] !== '-') {
      return '+' + attackBonus
    }
    return attackBonus
  })

  // Handlebars helper to stringify JSON objects for debugging
  Handlebars.registerHelper('stringify', function (object) {
    return JSON.stringify(object)
  })

  // Register system settings
  game.settings.register('dcc', 'macroShorthand', {
    name: 'Shortened Macro Syntax',
    hint: 'Enable a shortened macro syntax which allows referencing attributes directly, for example @str instead of @attributes.str.value. Disable this setting if you need the ability to reference the full attribute model, for example @attributes.str.label.',
    scope: 'world',
    type: Boolean,
    default: true,
    config: true
  })
})

/* -------------------------------------------- */
/*  Other Hooks                                 */
/* -------------------------------------------- */
// Create a roll weapon macro when a weapon rollable is dropped on the hotbar
Hooks.on('hotbarDrop', (bar, data, slot) => createDCCWeaponMacro(data, slot))

// Highlight 1's and 20's for all regular rolls
Hooks.on('renderChatMessage', (app, html, data) => {
  chat.highlightCriticalSuccessFailure(app, html, data)
})

// Support context menu on chat cards
Hooks.on('getChatLogEntryContext', chat.addChatMessageContextOptions)

/* -------------------------------------------- */
/*  Hotbar Macros                               */

/* -------------------------------------------- */

/**
 * Create a Macro from an weapon drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createDCCWeaponMacro (data, slot) {
  if (data.type !== 'Item') return
  if (!('data' in data)) return ui.notifications.warn('You can only create macro buttons for owned items')
  const item = data.data

  // Create the macro command
  const command = `game.dcc.rollDCCWeaponMacro("${item.id}");`
  let macro = game.macros.entities.find(m => (m.name === item.name) && (m.command === command))
  let img = '/systems/dcc/styles/images/axe-square.png'
  if (item.id[0] === 'r') {
    img = '/systems/dcc/styles/images/bow-square.png'
  }
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: img,
      command: command,
      flags: { 'dcc.itemMacro': true }
    })
  }
  await game.user.assignHotbarMacro(macro, slot)
  return false
}

/**
 * Roll a weapon attack from a macro.
 * @param {string} itemId
 * @return {Promise}
 */
function rollDCCWeaponMacro (itemId) {
  const speaker = ChatMessage.getSpeaker()
  let actor
  if (speaker.token) actor = game.actors.tokens[speaker.token]
  if (!actor) actor = game.actors.get(speaker.actor)
  if (!actor) return ui.notifications.warn('You must select a token to run this macro.')

  // Trigger the weapon roll
  return actor.rollWeaponAttack(itemId)
}
