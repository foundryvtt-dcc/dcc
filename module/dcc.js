/* global $, Actors, ActorSheet, Items, ItemSheet, ChatMessage, CONFIG, game, Hooks, Macro, ui, loadTemplates, Handlebars, EntitySheetConfig, TextEditor */
/**
 * DCC
 */

// Import Modules
import DCCActor from './actor.js'
import DCCActorSheet from './actor-sheet.js'
import * as DCCSheets from './actor-sheets-dcc.js'
import DCCItem from './item.js'
import DCCItemSheet from './item-sheet.js'
import DCCRoll from './dcc-roll.js'
import DCC from './config.js'
import * as chat from './chat.js'
import * as migrations from './migrations.js'
import DiceChain from './dice-chain.js'
import parser from './parser.js'
import TablePackManager from './table-pack-manager.js'
import EntityImages from './entity-images.js'
import SpellResult from './spell-result.js'
import ReleaseNotes from './release-notes.js'

import { registerSystemSettings } from './settings.js'

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
    DCCRoll,
    DiceChain,
    rollDCCWeaponMacro, // This is called from macros, don't remove
    getMacroActor // This is called from macros, don't remove
  }

  // Define custom Entity classes
  CONFIG.Actor.documentClass = DCCActor
  CONFIG.Item.documentClass = DCCItem

  // Register sheet application classes
  Actors.unregisterSheet('core', ActorSheet)
  Actors.registerSheet('dcc', DCCActorSheet, { makeDefault: true })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetCleric, { types: ['Player'] })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetThief, { types: ['Player'] })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetHalfling, { types: ['Player'] })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetWarrior, { types: ['Player'] })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetWizard, { types: ['Player'] })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetDwarf, { types: ['Player'] })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetElf, { types: ['Player'] })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetGeneric, { types: ['Player'] })
  Items.unregisterSheet('core', ItemSheet)
  Items.registerSheet('dcc', DCCItemSheet)

  // Register shared template for upper level characters
  const templatePaths = [
    'systems/dcc/templates/actor-partial-pc-header.html',
    'systems/dcc/templates/actor-partial-pc-common.html',
    'systems/dcc/templates/actor-partial-pc-equipment.html',
    'systems/dcc/templates/actor-partial-pc-notes.html',
    'systems/dcc/templates/actor-partial-skills.html',
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

  // Handlebars helper for simple addition
  Handlebars.registerHelper('add', function (object1, object2) {
    return parseInt(object1) + parseInt(object2)
  })

  // Handlebars helper to stringify JSON objects for debugging
  Handlebars.registerHelper('stringify', function (object) {
    return JSON.stringify(object)
  })

  // Handlebars helper for distances with an apostrophe
  Handlebars.registerHelper('distanceFormat', function (object) {
    const fields = String(object).match(/(-?\d+)'?/)
    if (fields) {
      return fields[1] + '\''
    } else {
      return ''
    }
  })

  // Handlebars helper to check if a pack exists
  Handlebars.registerHelper('dccPackExists', function (pack, options) {
    return new Handlebars.SafeString(game.packs.get(pack) ? options.fn(this) : options.inverse(this))
  })

  // Handlebars helper to enrich HTML
  Handlebars.registerHelper('dccLocalizeAndEnrich', function (object) {
    return TextEditor.enrichHTML(game.i18n.localize(object))
  })
})

/* -------------------------------------------- */
/*  Post initialization hook                    */
/* -------------------------------------------- */
Hooks.once('ready', async function () {
  // Register system settings - needs to happen after packs are initialised
  await registerSystemSettings()

  checkReleaseNotes()
  checkMigrations()
  registerTables()

  // Let modules know the DCC system is ready
  Hooks.callAll('dcc.ready')
})

function checkReleaseNotes () {
  // Determine if we should show the Release Notes/Credits chat card per user
  const lastSeenVersion = game.user.getFlag('dcc', 'lastSeenSystemVersion')
  const currentVersion = game.system.data.version

  if (lastSeenVersion !== currentVersion) {
    ReleaseNotes.addChatCard()
    game.user.setFlag('dcc', 'lastSeenSystemVersion', currentVersion)
  }

  // Register listeners for the buttons
  $(document).on('click', '.dcc-release-notes', () => _onShowJournal('dcc.dcc-userguide', 'DCC System Changelog'))
  $(document).on('click', '.dcc-credits', () => _onShowJournal('dcc.dcc-userguide', 'Credits'))
}

async function _onShowJournal (packName, journalName) {
  const pack = game.packs.get(packName)
  const index = await pack.getIndex()
  const metadata = await index.getName(journalName)
  const doc = await pack.getDocument(metadata._id)
  doc.sheet.render(true)
}

function checkMigrations () {
  // Determine whether a system migration is required and feasible
  const currentVersion = game.settings.get('dcc', 'systemMigrationVersion')
  const NEEDS_MIGRATION_VERSION = 0.22
  const needMigration = (currentVersion <= NEEDS_MIGRATION_VERSION) || (currentVersion === null)

  // Perform the migration
  if (needMigration && game.user.isGM) {
    migrations.migrateWorld()
  }
}

function registerTables () {
  // Create manager for disapproval tables and register the system setting
  CONFIG.DCC.disapprovalPacks = new TablePackManager({
    updateHook: async (manager) => {
      // Clear disapproval tables
      CONFIG.DCC.disapprovalTables = {}

      // For each valid pack, update the list of disapproval tables available to a cleric
      for (const packName of manager.packs) {
        const pack = game.packs.get(packName)
        if (pack) {
          await pack.getIndex()
          for (const [key, value] of pack.index.entries()) {
            CONFIG.DCC.disapprovalTables[key] = {
              name: value.name,
              path: `${packName}.${value.name}`
            }
          })
        }
      }
    }
  })
  CONFIG.DCC.disapprovalPacks.addPack(game.settings.get('dcc', 'disapprovalCompendium'), true)

  // Create manager for critical hit table packs and register the system setting
  CONFIG.DCC.criticalHitPacks = new TablePackManager()
  CONFIG.DCC.criticalHitPacks.addPack(game.settings.get('dcc', 'critsCompendium'), true)

  // Set fumble table from the system setting
  const fumbleTable = game.settings.get('dcc', 'fumbleTable')
  if (fumbleTable) {
    CONFIG.DCC.fumbleTable = fumbleTable
  }

  // Set mercurial magic table from the system setting
  const mercurialMagicTable = game.settings.get('dcc', 'mercurialMagicTable')
  if (mercurialMagicTable) {
    CONFIG.DCC.mercurialMagicTable = mercurialMagicTable
  }
}

/* -------------------------------------------- */
/*  Other Hooks                                 */
/* -------------------------------------------- */
// Create a macro when a rollable is dropped on the hotbar
Hooks.on('hotbarDrop', (bar, data, slot) => createDCCMacro(data, slot))

// Highlight 1's and 20's for all regular rolls, special spell check handling
Hooks.on('renderChatMessage', (message, html, data) => {
  if (game.user.isGM) {
    message.setFlag('core', 'canPopout', true)
  }
  chat.highlightCriticalSuccessFailure(message, html, data)
  SpellResult.processChatMessage(message, html, data)
})

// Support context menu on chat cards
Hooks.on('getChatLogEntryContext', chat.addChatMessageContextOptions)

// Quick import for actors
Hooks.on('renderActorDirectory', (app, html) => {
  parser.onRenderActorDirectory(app, html)
})

// Disapproval table packs
Hooks.on('dcc.registerDisapprovalPack', (value, fromSystemSetting) => {
  const disapprovalPacks = CONFIG.DCC.disapprovalPacks

  if (disapprovalPacks) {
    disapprovalPacks.addPack(value, fromSystemSetting)
  }
})

// Critical hit table packs
Hooks.on('dcc.registerCriticalHitsPack', (value, fromSystemSetting) => {
  const criticalHitPacks = CONFIG.DCC.criticalHitPacks

  if (criticalHitPacks) {
    criticalHitPacks.addPack(value, fromSystemSetting)
  }
})

// Fumble table
Hooks.on('dcc.setFumbleTable', (value, fromSystemSetting = false) => {
  // Set fumble table if unset, or if applying the system setting (which takes precedence)
  if (fromSystemSetting || !CONFIG.DCC.fumbleTable) {
    CONFIG.DCC.fumbleTable = value
  }
})

// Mercurial Magic mable
Hooks.on('dcc.setMercurialMagicTable', (value, fromSystemSetting = false) => {
  // Set mercurial magic table if unset, or if applying the system setting (which takes precedence)
  if (fromSystemSetting || !CONFIG.DCC.mercurialMagicTable) {
    CONFIG.DCC.mercurialMagicTable = value
  }
})

// Entity creation hook
Hooks.on('createActor', (entity, options, userId) => {
  if (!game.user.isGM || entity.data.img) { return }

  // Assign an appropriate DCC actor image
  const img = EntityImages.imageForActor(entity.type)
  if (img) {
    entity.update({
      img
    })
  }
})

Hooks.on('createItem', (entity, options, userId) => {
  if (!game.user.isGM || entity.data.img) { return }

  // Assign an appropriate DCC item image
  const img = EntityImages.imageForItem(entity.type)
  if (img) {
    entity.update({
      img
    })
  }
})

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from a hotbar drop.
 * Dispatch to the appropriate function for the item type
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createDCCMacro (data, slot) {
  const handlers = {
    Ability: _createDCCAbilityMacro,
    Initiative: _createDCCInitiativeMacro,
    'Hit Dice': _createDCCHitDiceMacro,
    Save: _createDCCSaveMacro,
    Skill: _createDCCSkillMacro,
    'Luck Die': _createDCCLuckDieMacro,
    'Spell Check': _createDCCSpellCheckMacro,
    'Attack Bonus': _createDCCAttackBonusMacro,
    'Action Dice': _createDCCActionDiceMacro,
    Weapon: _createDCCWeaponMacro,
    'Apply Disapproval': _createDCCApplyDisapprovalMacro,
    'Roll Disapproval': _createDCCRollDisapprovalMacro
  }
  // Pull out the DCC data from the drop handler (it may be packaged inside Foundry Item data)
  if (data.dccType) {
    data.type = data.dccType
    delete data.dccType
  }
  if (data.dccData) {
    data.data = data.dccData
    delete data.dccData
  }
  if (!data.type || data.type === 'Macro') return
  if (!('data' in data)) return ui.notifications.warn(game.i18n.localize('DCC.CreateMacroNotOwnedWarning'))
  if (!handlers[data.type]) return ui.notifications.warn(game.i18n.localize('DCC.CreateMacroNoHandlerWarning'))

  // Call the appropriate function to generate a macro
  const macroData = handlers[data.type](data, slot)
  if (macroData) {
    // Create or reuse existing macro
    let macro = game.macros.contents.find(
      m => (m.name === macroData.name) && (m.command === macroData.command)
    )
    if (!macro) {
      macro = await Macro.create({
        name: macroData.name,
        type: 'script',
        img: macroData.img,
        command: macroData.command,
        flags: { 'dcc.itemMacro': true }
      })
    }
    await game.user.assignHotbarMacro(macro, slot)
  }
  return false
}

/**
 * Create a macro from an ability check drop.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
function _createDCCAbilityMacro (data, slot) {
  if (data.type !== 'Ability') return

  // Create the macro command
  const abilityId = data.data.abilityId
  const rollUnder = data.data.rollUnder
  const macroData = {
    name: game.i18n.localize(CONFIG.DCC.abilities[abilityId]),
    command: `const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollAbilityCheck("${abilityId}", { rollUnder: ${rollUnder} } ) }`,
    img: EntityImages.imageForMacro(abilityId, rollUnder ? 'abilityRollUnder' : 'ability')
  }

  // If this is a roll under check make it clear in the macro name
  if (rollUnder) {
    macroData.name = game.i18n.format('DCC.RollUnder', { name: macroData.name })
  }

  return macroData
}

/**
 * Create a macro from an initiative drop.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
function _createDCCInitiativeMacro (data, slot) {
  if (data.type !== 'Initiative') return

  // Create the macro command
  const macroData = {
    name: game.i18n.localize('DCC.Initiative'),
    command: 'const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollInitiative(token) }',
    img: EntityImages.imageForMacro('initiative')
  }

  return macroData
}

/**
 * Create a macro from a hit dice drop.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
function _createDCCHitDiceMacro (data, slot) {
  if (data.type !== 'Hit Dice') return

  // Create the macro command
  const macroData = {
    name: game.i18n.localize('DCC.HitDiceRoll'),
    command: 'const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollHitDice() }',
    img: EntityImages.imageForMacro(DiceChain.getPrimaryDie(data.data.dice), 'hitDice')
  }

  return macroData
}

/**
 * Create a macro from a saving throw drop.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
function _createDCCSaveMacro (data, slot) {
  if (data.type !== 'Save') return

  // Create the macro command
  const saveId = data.data
  const macroData = {
    name: game.i18n.localize(CONFIG.DCC.saves[saveId]),
    command: `const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollSavingThrow("${saveId}") }`,
    img: EntityImages.imageForMacro(saveId, 'savingThrow')
  }

  return macroData
}

/**
 * Create a macro from a skill roll drop.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
function _createDCCSkillMacro (data, slot) {
  if (data.type !== 'Skill') return

  // Create the macro command
  const skillId = data.data.skillId
  const skillName = game.i18n.localize(data.data.skillName)
  const macroData = {
    name: skillName,
    command: `const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollSkillCheck("${skillId}") }`,
    img: EntityImages.imageForMacro(skillId, 'skillCheck')
  }

  return macroData
}

/**
 * Create a macro from a luck die drop.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
function _createDCCLuckDieMacro (data, slot) {
  if (data.type !== 'Luck Die') return
  const die = data.data.die

  // Create the macro command
  const macroData = {
    name: game.i18n.localize('DCC.LuckDie'),
    command: 'const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollLuckDie() }',
    img: EntityImages.imageForMacro(DiceChain.getPrimaryDie(die), 'luckDie')
  }

  return macroData
}

/**
 * Create a macro from a spell check drop.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
function _createDCCSpellCheckMacro (data, slot) {
  if (data.type !== 'Spell Check') return

  // Create the macro command
  const spell = data.data.spell || null
  const img = data.data.img || null
  const macroData = {
    name: spell || game.i18n.localize('DCC.SpellCheck'),
    command: 'const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollSpellCheck() }',
    img: img || EntityImages.imageForMacro('spellCheck')
  }

  if (spell) {
    macroData.command = `const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollSpellCheck({ spell: "${spell}" }) }`
  }

  return macroData
}

/**
 * Create a macro from an attack bonus drop.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
function _createDCCAttackBonusMacro (data, slot) {
  if (data.type !== 'Attack Bonus') return
  const die = data.data.die

  // Create the macro command
  const macroData = {
    name: game.i18n.localize('DCC.AttackBonus'),
    command: 'const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollAttackBonus() }',
    img: EntityImages.imageForMacro(DiceChain.getPrimaryDie(die), 'attackBonus')
  }

  return macroData
}

/**
 * Create a macro from an action die drop.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
function _createDCCActionDiceMacro (data, slot) {
  if (data.type !== 'Action Dice') return
  const die = data.data.die

  // Create the macro command
  const macroData = {
    name: game.i18n.format('DCC.ActionDiceMacroName', { die }),
    command: `const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.setActionDice('${die}') }`,
    img: EntityImages.imageForMacro(DiceChain.getPrimaryDie(die), 'defaultDice')
  }

  return macroData
}

/**
 * Create a Macro from a weapon drop.
 * Get an existing macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
function _createDCCWeaponMacro (data, slot) {
  if (data.type !== 'Weapon') return
  const item = data.data.weapon
  const weaponSlot = data.data.slot
  const backstab = data.data.backstab
  const options = {
    backstab: backstab
  }

  const macroData = {
    name: item.name,
    command: `game.dcc.rollDCCWeaponMacro("${weaponSlot}", ${JSON.stringify(options)});`,
    img: data.data.weapon.img
  }

  // Replace missing or default weapon icon with our default
  if (!macroData.img || macroData.img === 'icons/svg/mystery-man.svg') {
    macroData.img = EntityImages.imageForItem(data.data.weapon.type)
  }

  // If dragging a backstab use the backstab icon
  if (backstab) {
    macroData.img = EntityImages.imageForMacro('backstab')
  }

  return macroData
}

/**
 * Apply disapproval to an actor
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Object}
 */
function _createDCCApplyDisapprovalMacro (data, slot) {
  if (data.type !== 'Apply Disapproval') return

  // Create the macro command
  const macroData = {
    name: game.i18n.format('DCC.ApplyDisapprovalMacroName'),
    command: 'const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.applyDisapproval() }',
    img: EntityImages.imageForMacro('applyDisapproval')
  }

  return macroData
}

/**
 * Roll disapproval for an actor
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Object}
 */
function _createDCCRollDisapprovalMacro (data, slot) {
  if (data.type !== 'Roll Disapproval') return

  // Create the macro command
  const macroData = {
    name: game.i18n.format('DCC.RollDisapprovalMacroName'),
    command: 'const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollDisapproval() }',
    img: EntityImages.imageForMacro('rollDisapproval')
  }

  return macroData
}

/**
 * Roll a weapon attack from a macro.
 * @param {string} itemId
 * @return {Promise}
 */
function rollDCCWeaponMacro (itemId, options = {}) {
  const speaker = ChatMessage.getSpeaker()
  let actor
  if (speaker.token) actor = game.actors.tokens[speaker.token]
  if (!actor) actor = game.actors.get(speaker.actor)
  if (!actor) return ui.notifications.warn('You must select a token to run this macro.')

  // Trigger the weapon roll
  return actor.rollWeaponAttack(itemId, options)
}

/**
 * Get the current actor - for use in macros
 * @return {Promise}
 */
function getMacroActor () {
  const speaker = ChatMessage.getSpeaker()
  let actor
  if (speaker.token) actor = game.actors.tokens[speaker.token]
  if (!actor) actor = game.actors.get(speaker.actor)
  if (!actor) return ui.notifications.warn('You must select a token to run this macro.')

  // Return the actor if found
  return actor
}
