/* global $, Actors, ActorSheet, Items, ItemSheet, ChatMessage, CONFIG, foundry, game, Hooks, Macro, Roll, ui, loadTemplates, Handlebars */

/**
 * DCC
 */

// Import Modules
import DCCActor from './actor.js'
import * as DCCSheets from './actor-sheets-dcc.js'
import DCCCombatant from './combatant.js'
import DCCItem from './item.js'
import DCCItemSheet from './item-sheet.js'
import DCCRoll from './dcc-roll.js'
import DCC from './config.js'
import * as chat from './chat.js'
import * as migrations from './migrations.js'
import DiceChain from './dice-chain.js'
import FleetingLuck from './fleeting-luck.js'
import parser from './parser.js'
import TablePackManager from './table-pack-manager.js'
import EntityImages from './entity-images.js'
import SpellResult from './spell-result.js'
import ReleaseNotes from './release-notes.js'
import KeyState from './key-state.js'
import { defineStatusIcons } from './status-icons.js'

import { pubConstants, registerSystemSettings } from './settings.js'
import WelcomeDialog from './welcomeDialog.js'
import DCCActorSheet from './actor-sheet.js'

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */
Hooks.once('init', async function () {
  console.log(`DCC | Initializing Dungeon Crawl Classics System\n${DCC.ASCII}`)

  CONFIG.DCC = DCC

  // noinspection JSUndefinedPropertyAssignment,JSUnusedGlobalSymbols
  game.dcc = {
    DCCActor,
    DCCRoll,
    DiceChain,
    FleetingLuck,
    SpellResult,
    getSkillTable,
    processSpellCheck,
    rollDCCWeaponMacro, // This is called from macros, don't remove
    getMacroActor, // This is called from macros, don't remove
    getMacroOptions // This is called from macros, don't remove
  }

  // Add DCC Dice Types
  CONFIG.Dice.fulfillment.dice = CONFIG.DCC.diceTypes

  // Define custom Entity classes
  CONFIG.Actor.documentClass = DCCActor
  CONFIG.Item.documentClass = DCCItem
  CONFIG.Combatant.documentClass = DCCCombatant

  // Register sheet application classes
  Actors.unregisterSheet('core', ActorSheet)
  Actors.registerSheet('dcc', DCCActorSheet, {
    types: ['NPC'],
    label: 'DCC.DCCActorSheet',
    makeDefault: true
  })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetCleric, {
    types: ['NPC', 'Player'],
    label: 'DCC.DCCActorSheetCleric'
  })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetThief, {
    types: ['NPC', 'Player'],
    label: 'DCC.DCCActorSheetThief'
  })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetHalfling, {
    types: ['NPC', 'Player'],
    label: 'DCC.DCCActorSheetHalfling'
  })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetWarrior, {
    types: ['NPC', 'Player'],
    label: 'DCC.DCCActorSheetWarrior'
  })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetWizard, {
    types: ['NPC', 'Player'],
    label: 'DCC.DCCActorSheetWizard'
  })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetDwarf, {
    types: ['NPC', 'Player'],
    label: 'DCC.DCCActorSheetDwarf'
  })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetElf, {
    types: ['NPC', 'Player'],
    label: 'DCC.DCCActorSheetElf'
  })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetGeneric, {
    types: ['NPC', 'Player'],
    label: 'DCC.DCCActorSheetGeneric'
  })
  Items.unregisterSheet('core', ItemSheet)
  Items.registerSheet('dcc', DCCItemSheet, {
    label: 'DCC.DCCItemSheet',
    makeDefault: true
  })

  // Register shared template for upper level characters
  const templatePaths = [
    'systems/dcc/templates/actor-partial-pc-common.html',
    'systems/dcc/templates/actor-partial-npc-common.html',
    'systems/dcc/templates/actor-partial-pc-equipment.html',
    'systems/dcc/templates/actor-partial-npc-equipment.html',
    'systems/dcc/templates/actor-partial-pc-notes.html',
    'systems/dcc/templates/actor-partial-skills.html',
    'systems/dcc/templates/actor-partial-wizard-spells.html',
    'systems/dcc/templates/actor-partial-cleric-spells.html',
    'systems/dcc/templates/item-sheet-partial-description.html',
    'systems/dcc/templates/item-sheet-partial-values.html',
    'systems/dcc/templates/roll-modifier-partial-die.html',
    'systems/dcc/templates/roll-modifier-partial-disapproval-die.html',
    'systems/dcc/templates/roll-modifier-partial-modifiers.html',
    'systems/dcc/templates/roll-modifier-partial-none.html',
    'systems/dcc/templates/roll-modifier-partial-check-penalty.html',
    'systems/dcc/templates/roll-modifier-partial-spellburn.html'
  ]
  await loadTemplates(templatePaths)

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
})

/* -------------------------------------------- */
/*  Post initialization hook                    */
/* -------------------------------------------- */
Hooks.once('ready', async function () {
  // Register system settings - needs to happen after packs are initialised
  await registerSystemSettings()

  // Register the KeyState tracker
  game.dcc.KeyState = new KeyState()

  checkReleaseNotes()
  checkMigrations()
  registerTables()

  // Initialise Fleeting Luck
  game.dcc.FleetingLuck.init()

  // Add status icons
  defineStatusIcons()

  // Show welcome dialog if enabled
  if (game.user.isGM && game.settings.get(pubConstants.name, 'showWelcomeDialog')) {
    new WelcomeDialog().render(true)
  }

  // Let modules know the DCC system is ready
  Hooks.callAll('dcc.ready')
})

function checkReleaseNotes () {
  // Determine if we should show the Release Notes/Credits chat card per user
  const lastSeenVersion = game.user.getFlag('dcc', 'lastSeenSystemVersion')
  const currentVersion = game.system.version

  if (lastSeenVersion !== currentVersion) {
    ReleaseNotes.addChatCard()
    game.user.setFlag('dcc', 'lastSeenSystemVersion', currentVersion)
  }

  // Register listeners for the buttons
  $(document).on('click', '.dcc-release-notes', () => _onShowJournal('dcc.dcc-userguide', 'DCC System Changelog'))
  $(document).on('click', '.dcc-credits', () => _onShowJournal('dcc.dcc-userguide', 'Credits'))
  $(document).on('click', '.dcc-user-guide', () => _onShowURI('https://github.com/foundryvtt-dcc/dcc/wiki/DCC-System-User-Guide'))
}

async function _onShowJournal (packName, journalName) {
  const pack = game.packs.get(packName)
  const index = await pack.getIndex()
  const metadata = await index.getName(journalName)
  const doc = await pack.getDocument(metadata._id)
  doc.sheet.render(true)
}

async function _onShowURI (uri) {
  window.open(uri)
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
          }
        }
      }
    }
  })
  CONFIG.DCC.disapprovalPacks.addPack(game.settings.get('dcc', 'disapprovalCompendium'), true)

  // Create manager for critical hit table packs and register the system setting
  CONFIG.DCC.criticalHitPacks = new TablePackManager()
  CONFIG.DCC.criticalHitPacks.addPack(game.settings.get('dcc', 'critsCompendium'), true)

  // Set divine aid table from the system setting
  const divineAidTable = game.settings.get('dcc', 'divineAidTable')
  if (divineAidTable) {
    CONFIG.DCC.divineAidTable = divineAidTable
  }

  // Set fumble table from the system setting
  const fumbleTable = game.settings.get('dcc', 'fumbleTable')
  if (fumbleTable) {
    CONFIG.DCC.fumbleTable = fumbleTable
  }

  // Set lay on hands table from the system setting
  const layOnHandsTable = game.settings.get('dcc', 'layOnHandsTable')
  if (layOnHandsTable) {
    CONFIG.DCC.layOnHandsTable = layOnHandsTable
  }

  // Set mercurial magic table from the system setting
  const mercurialMagicTable = game.settings.get('dcc', 'mercurialMagicTable')
  if (mercurialMagicTable) {
    CONFIG.DCC.mercurialMagicTable = mercurialMagicTable
  }

  // Set turn unholy table from the system setting
  const turnUnholyTable = game.settings.get('dcc', 'turnUnholyTable')
  if (turnUnholyTable) {
    CONFIG.DCC.turnUnholyTable = turnUnholyTable
  }
}

Hooks.on('diceSoNiceReady', (dice3d) => {
  // Show the d3, d5, d7, d14, d16, d24, and d30 in Dice So Nice's customization dialog
  dice3d.showExtraDiceByDefault(true)
})

/**
 * Look up a table for a given skill, if present
 * @param {string} skillName     The name of the skill
 * @returns {Promise}            RollTable object or null
 */
async function getSkillTable (skillName) {
  // Convert skill name to a property name on CONFIG.DCC
  const tableProperty = CONFIG.DCC.skillTables[skillName] || null

  // Look up the property if the skill was found
  const tableName = tableProperty ? (CONFIG.DCC[tableProperty] || null) : null

  // Load the table defined by the property if available
  if (tableName) {
    const tablePath = tableName.split('.')
    let pack
    if (tablePath.length === 3) {
      pack = game.packs.get(tablePath[0] + '.' + tablePath[1])
    }
    if (pack) {
      await pack.getIndex() // Load the compendium index
      const entry = pack.index.find((entity) => entity.name === tablePath[2])
      if (entry) {
        return pack.getDocument(entry._id)
      }
    }
  }

  return null
}

/**
 * Handle the results of a spell check cast through any mechanism
 * Apply a roll to a table and apply spell check logic for crits and fumbles
 * @param {Object} actor        The actor rolling the check
 * @param {Object} spellData    Information about the spell being cast
 * @returns {Object}            Table result object
 */
async function processSpellCheck (actor, spellData) {
  // Unpack spellData
  // - rollTable (optional): the roll table for the spell's results
  // - roll: the roll object to evaluate for the spell
  // - item (optional): the item representing the spell or spell-like skill
  // - flavor: flavor text for the spell if no table is available to provide it
  const rollTable = spellData.rollTable
  let roll = spellData.roll
  const item = spellData.item
  const flavor = spellData.flavor

  let crit = false
  let fumble = false
  let naturalRoll = null

  try {
    // Apply the roll to the table if present
    if (rollTable) {
      const results = await rollTable.draw({ roll, displayChat: false })

      if (results.roll.dice.length > 0) {
        roll = results.roll
        naturalRoll = roll.dice[0].total
        if (naturalRoll === 1) {
          const fumbleResult = await rollTable.draw({ roll: new Roll('1'), displayChat: false })
          roll = fumbleResult.roll
          results.results = fumbleResult.results
          fumble = true
        } else if (naturalRoll === 20) {
          if (actor.type === 'Player') {
            const critRoll = results.roll.total + actor.system.details.level.value
            const critRollObject = new Roll(String(critRoll))
            const critResult = await rollTable.draw({ roll: critRollObject, displayChat: false })
            roll = critResult.roll
            results.results = critResult.results
            crit = true
          }
        }
      }
      await game.dcc.SpellResult.addChatMessage(rollTable, results, { crit, fumble, itemId: item?.id })
      // Otherwise just roll the dice
    } else {
      if (!roll._evaluated) {
        await roll.evaluate({ async: true })
      }

      // Generate flags for the roll
      const flags = {
        'dcc.RollType': 'SpellCheck',
        'dcc.ItemId': item?.id
      }
      game.dcc.FleetingLuck.updateFlags(flags, roll)

      // Display the roll
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor,
        flags
      })
    }

    // Determine the natural value of the roll if not yet known
    if (!naturalRoll && roll.terms.length > 0 && roll.terms[0].results) {
      naturalRoll = roll.terms[0].results[0].result
    }

    // Determine casting mode from the item or actor - default to wizard
    let castingMode = item ? item.system.config.castingMode : 'wizard'
    if (!item && actor.system.details.sheetClass === 'Cleric') {
      // Cleric sheets will use the cleric casting mode if not set by the item
      castingMode = 'cleric'
    }

    // Spell check threshold is 10 + spell level * 2, anything below this is a failure
    const level = item ? item.system.level : 1
    let success = roll.total >= (10 + level * 2)

    // Handle spell failure based on casting mode
    if (castingMode === 'wizard') {
      // Check if automation is enabled for Wizard spells
      const automate = game.settings.get('dcc', 'automateWizardSpellLoss')

      // Check for failed casting
      if (automate && !success) {
        // Lose the spell
        actor.loseSpell(item)
      }
    } else if (castingMode === 'cleric') {
      // Check if automation is enabled for Cleric spells
      const automate = game.settings.get('dcc', 'automateClericDisapproval')

      // Check if our natural roll was inside the disapproval range
      if (automate && naturalRoll <= actor.system.class.disapproval) {
        // Trigger disapproval
        await actor.rollDisapproval(naturalRoll)

        // This is an automatic failure!
        success = false
      }

      // Check for a failure to cast
      if (automate && !success) {
        // Add a point of disapproval
        await actor.applyDisapproval()
      }
    }
  } catch (ex) {
    console.error(ex)
  }
}

/* -------------------------------------------- */
/*  Other Hooks                                 */
/* -------------------------------------------- */
// Create a macro when a rollable is dropped on the hotbar
Hooks.on('hotbarDrop', (bar, data, slot) => { return createDCCMacro(data, slot) })

// Highlight 1's and 20's for all regular rolls, special spell check handling
Hooks.on('renderChatMessage', (message, html, data) => {
  if (!message.isRoll || !message.isContentVisible || !message.rolls.length) return

  if (game.user.isGM) {
    message.setFlag('core', 'canPopout', true)
  }
  chat.highlightCriticalSuccessFailure(message, html, data)
  SpellResult.processChatMessage(message, html, data)

  // Add data-item-id for modules that want to use it
  const itemId = message.getFlag('dcc', 'ItemId')
  if (itemId !== undefined) {
    html.find('.message-content').attr('data-item-id', itemId)
  }
})

// Support context menu on chat cards
Hooks.on('getChatLogEntryContext', chat.addChatMessageContextOptions)

// Quick import for actors
Hooks.on('renderActorDirectory', (app, html) => {
  parser.onRenderActorDirectory(app, html)
})

// Disapproval table packs
Hooks.on('dcc.registerDisapprovalPack', (value, fromSystemSetting = false) => {
  const disapprovalPacks = CONFIG.DCC.disapprovalPacks

  if (disapprovalPacks) {
    disapprovalPacks.addPack(value, fromSystemSetting)
  }
})

// Critical hit table packs
Hooks.on('dcc.registerCriticalHitsPack', (value, fromSystemSetting = false) => {
  const criticalHitPacks = CONFIG.DCC.criticalHitPacks

  if (criticalHitPacks) {
    criticalHitPacks.addPack(value, fromSystemSetting)
  }
})

// Divine aid table
Hooks.on('dcc.setDivineAidTable', (value, fromSystemSetting = false) => {
  // Set divine aid table if unset, or if applying the system setting (which takes precedence)
  if (fromSystemSetting || !CONFIG.DCC.divineAidTable) {
    CONFIG.DCC.divineAidTable = value
  }
})

// Fumble table
Hooks.on('dcc.setFumbleTable', (value, fromSystemSetting = false) => {
  // Set fumble table if unset, or if applying the system setting (which takes precedence)
  if (fromSystemSetting || !CONFIG.DCC.fumbleTable) {
    CONFIG.DCC.fumbleTable = value
  }
})

// Lay on hands table
Hooks.on('dcc.setLayOnHandsTable', (value, fromSystemSetting = false) => {
  // Set lay on hands table if unset, or if applying the system setting (which takes precedence)
  if (fromSystemSetting || !CONFIG.DCC.layOnHandsTable) {
    CONFIG.DCC.layOnHandsTable = value
  }
})

// Mercurial Magic table
Hooks.on('dcc.setMercurialMagicTable', (value, fromSystemSetting = false) => {
  // Set mercurial magic table if unset, or if applying the system setting (which takes precedence)
  if (fromSystemSetting || !CONFIG.DCC.mercurialMagicTable) {
    CONFIG.DCC.mercurialMagicTable = value
  }
})

// Turn unholy table
Hooks.on('dcc.setTurnUnholyTable', (value, fromSystemSetting = false) => {
  // Set turn unholy table if unset, or if applying the system setting (which takes precedence)
  if (fromSystemSetting || !CONFIG.DCC.turnUnholyTable) {
    CONFIG.DCC.turnUnholyTable = value
  }
})

// Entity creation hook
Hooks.on('createActor', (entity, options, userId) => {
  if (!game.user.isGM || entity.img) { return }

  // Assign an appropriate DCC actor image
  const img = EntityImages.imageForActor(entity.type)
  if (img) {
    entity.update({
      img
    })
  }
})

Hooks.on('createItem', (entity, options, userId) => {
  if (!game.user.isGM || entity.img) { return }

  // Assign an appropriate DCC item image
  const img = EntityImages.imageForItem(entity.type)
  if (img) {
    entity.update({
      img
    })
  }
})

Hooks.on('applyActiveEffect', (actor, change) => {
  const { key, value } = change
  let update = null
  // We're only interested in strings (dice expressions)
  const current = foundry.utils.getProperty(actor, key) ?? null
  if (typeof (current) === 'string') {
    // If this is a dice chain pattern (e.g. +1d) then we're interested
    const diceChainPattern = /([+-]?\d+)[dD]/
    const match = value.match(diceChainPattern)
    if (match) {
      update = game.dcc.DiceChain.bumpDie(current, parseInt(match[1]))
      foundry.utils.setProperty(actor, key, update)
    }
  }
  return update
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
function createDCCMacro (data, slot) {
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
    data.system = data.dccData
    delete data.dccData
  }
  if (!data.type || data.type === 'Macro') return true
  if (!('data' in data)) return true
  if (!handlers[data.type]) return true

  // Call the appropriate function to generate a macro
  const macroData = handlers[data.type](data, slot)
  if (macroData) {
    // Create and assign the macro in an async context, but hooks aren't async so we need to return immediately
    (async () => {
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
      game.user.assignHotbarMacro(macro, slot)
    })()

    // Prevent the default handler
    return false
  }
  // Let the default handler run
  return true
}

/**
 * Create a macro from an ability check drop.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Object}
 */
function _createDCCAbilityMacro (data, slot) {
  if (data.type !== 'Ability') return

  // Create the macro command
  const abilityId = data.data.abilityId
  const rollUnder = data.data.rollUnder
  const macroData = {
    name: game.i18n.localize(CONFIG.DCC.abilities[abilityId]),
    command: `const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollAbilityCheck("${abilityId}", Object.assign({ rollUnder: ${rollUnder} }, game.dcc.getMacroOptions())) }`,
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
 * @returns {Object}
 */
function _createDCCInitiativeMacro (data, slot) {
  if (data.type !== 'Initiative') return

  // Create the macro command
  return {
    name: game.i18n.localize('DCC.Initiative'),
    command: 'const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollInitiative(token, game.dcc.getMacroOptions()) }',
    img: EntityImages.imageForMacro('initiative')
  }
}

/**
 * Create a macro from a hit dice drop.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Object}
 */
function _createDCCHitDiceMacro (data, slot) {
  if (data.type !== 'Hit Dice') return

  // Create the macro command
  return {
    name: game.i18n.localize('DCC.HitDiceRoll'),
    command: 'const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollHitDice(game.dcc.getMacroOptions()) }',
    img: EntityImages.imageForMacro(game.dcc.DiceChain.getPrimaryDie(data.data.dice), 'hitDice')
  }
}

/**
 * Create a macro from a saving throw drop.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Object}
 */
function _createDCCSaveMacro (data, slot) {
  if (data.type !== 'Save') return

  // Create the macro command
  const saveId = data.data
  return {
    name: game.i18n.localize(CONFIG.DCC.saves[saveId]),
    command: `const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollSavingThrow("${saveId}", game.dcc.getMacroOptions()) }`,
    img: EntityImages.imageForMacro(saveId, 'savingThrow')
  }
}

/**
 * Create a macro from a skill roll drop.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Object}
 */
function _createDCCSkillMacro (data, slot) {
  if (data.type !== 'Skill') return

  // Create the macro command
  const skillId = data.data.skillId
  const skillName = game.i18n.localize(data.data.skillName)
  return {
    name: skillName,
    command: `const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollSkillCheck("${skillId}", game.dcc.getMacroOptions()) }`,
    img: EntityImages.imageForMacro(skillId, 'skillCheck')
  }
}

/**
 * Create a macro from a luck die drop.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Object}
 */
function _createDCCLuckDieMacro (data, slot) {
  if (data.type !== 'Luck Die') return
  const die = data.data.die

  // Create the macro command
  return {
    name: game.i18n.localize('DCC.LuckDie'),
    command: 'const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollLuckDie(game.dcc.getMacroOptions()) }',
    img: EntityImages.imageForMacro(game.dcc.DiceChain.getPrimaryDie(die), 'luckDie')
  }
}

/**
 * Create a macro from a spell check drop.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Object}
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
    macroData.command = `const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollSpellCheck(Object.assign({ spell: "${spell}" }, game.dcc.getMacroOptions())) }`
  }

  return macroData
}

/**
 * Create a macro from an attack bonus drop.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Object}
 */
function _createDCCAttackBonusMacro (data, slot) {
  if (data.type !== 'Attack Bonus') return
  const die = data.data.die

  // Create the macro command
  return {
    name: game.i18n.localize('DCC.AttackBonus'),
    command: 'const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollAttackBonus(game.dcc.getMacroOptions()) }',
    img: EntityImages.imageForMacro(game.dcc.DiceChain.getPrimaryDie(die), 'attackBonus')
  }
}

/**
 * Create a macro from an action die drop.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Object}
 */
function _createDCCActionDiceMacro (data, slot) {
  if (data.type !== 'Action Dice') return
  const die = data.data.die

  // Create the macro command
  return {
    name: game.i18n.format('DCC.ActionDiceMacroName', { die }),
    command: `const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.setActionDice('${die}') }`,
    img: EntityImages.imageForMacro(game.dcc.DiceChain.getPrimaryDie(die), 'defaultDice')
  }
}

/**
 * Create a Macro from a weapon drop.
 * Get an existing macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Object}
 */
function _createDCCWeaponMacro (data, slot) {
  if (data.type !== 'Weapon') return
  const item = data.system.weapon
  const weaponSlot = data.system.slot
  const backstab = data.data.backstab
  const options = {
    backstab
  }

  const macroData = {
    name: item.name,
    command: `game.dcc.rollDCCWeaponMacro("${weaponSlot}", Object.assign(${JSON.stringify(options)}, game.dcc.getMacroOptions()));`,
    img: item.img
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
  return {
    name: game.i18n.format('DCC.ApplyDisapprovalMacroName'),
    command: 'const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.applyDisapproval() }',
    img: EntityImages.imageForMacro('applyDisapproval')
  }
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
  return {
    name: game.i18n.format('DCC.RollDisapprovalMacroName'),
    command: 'const _actor = game.dcc.getMacroActor(); if (_actor) { _actor.rollDisapproval() }',
    img: EntityImages.imageForMacro('rollDisapproval')
  }
}

/**
 * Roll a weapon attack from a macro.
 * @param {string} itemId
 * @param {Object} options
 * @return {Promise}
 */
function rollDCCWeaponMacro (itemId, options = {}) {
  const speaker = ChatMessage.getSpeaker()
  let actor
  if (speaker.token) actor = game.actors.tokens[speaker.token]
  if (!actor) actor = game.actors.get(speaker.actor)
  if (!actor) return ui.notifications.warn(game.i18n.localize('DCC.MacroNoTokenSelected'))

  // Trigger the weapon roll
  return actor.rollWeaponAttack(itemId, options)
}

/**
 * Get the current actor - for use in macros
 * @return {Object}
 */
function getMacroActor () {
  const speaker = ChatMessage.getSpeaker()
  let actor
  if (speaker.token) actor = game.actors.tokens[speaker.token]
  if (!actor) actor = game.actors.get(speaker.actor)
  if (!actor) return ui.notifications.warn(game.i18n.localize('DCC.MacroNoTokenSelected'))

  // Return the actor if found
  return actor
}

/**
 * Get global options for use in macros
 * @return {Object}
 */
function getMacroOptions () {
  const rollModifierDefault = game.settings.get('dcc', 'showRollModifierByDefault')
  return {
    showModifierDialog: rollModifierDefault ^ game.dcc.KeyState.ctrlKey
  }
}
