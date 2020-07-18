/* global Actors, ActorSheet, ChatMessage, CONFIG, game, Hooks, Macro, ui */
/**
 * DCC
 */

// Import Modules
import DCCActor from './actor.js'
import DCCActorSheet from './actor-sheet.js'
import DCC from './config.js'
import * as chat from './chat.js'

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */
Hooks.once('init', async function () {
  console.log(`DCC | Initializing Dungeon Crawl Classics System\n${DCC.ASCII}`)

  CONFIG.DCC = DCC

  game.dcc = {
    DCCActor,
    rollDCCWeaponMacro // This is called from macros, don't remove
  }

  // Define custom Entity classes
  CONFIG.Actor.entityClass = DCCActor

  // Register sheet application classes
  Actors.unregisterSheet('core', ActorSheet)
  Actors.registerSheet('dcc', DCCActorSheet, { makeDefault: true })

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
