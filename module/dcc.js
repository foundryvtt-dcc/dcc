/* global ChatMessage, CONFIG, foundry, game, Hooks, Macro, ui, Handlebars, Roll */

/**
 * DCC
 */

// Import Modules
import DCCActiveEffect from './active-effect.js'
import DCCActor from './actor.js'
import DCCActorSheet from './actor-sheet.js'
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
import SpellDuel from './spell-duel.js'
import parser from './parser.js'
import TablePackManager from './table-pack-manager.js'
import EntityImages from './entity-images.js'
import SpellResult from './spell-result.js'
import ReleaseNotes from './release-notes.js'
import KeyState from './key-state.js'
import { defineStatusIcons } from './status-icons.js'

import { pubConstants, registerSystemSettings } from './settings.js'
import WelcomeDialog from './welcomeDialog.js'
import DCCPartySheet from './party-sheet.js'

import { setupItemPilesForDCC } from './item-piles-support.js'

// Import data models
import {
  // Actor data models
  PlayerData,
  NPCData,
  PartyData,
  // Item data models
  WeaponData,
  AmmunitionData,
  ArmorData,
  EquipmentData,
  LevelData,
  MountData,
  SpellData,
  TreasureData,
  SkillData
} from './data/_module.mjs'

const { Actors } = foundry.documents.collections
const { ActorSheetV2 } = foundry.applications.sheets
const { loadTemplates } = foundry.applications.handlebars
const { Items } = foundry.documents.collections
const { ItemSheetV2 } = foundry.applications.sheets

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */
Hooks.once('init', async function () {
  console.log(`DCC | Initializing Dungeon Crawl Classics System\n${DCC.ASCII}`)

  CONFIG.DCC = DCC

  // Enable Active Effects
  CONFIG.ActiveEffect.legacyTransferral = false

  // Register Active Effect application phases (required for V14)
  CONFIG.ActiveEffect.phases = {
    initial: { priority: 0, label: 'Initial' },
    final: { priority: 100, label: 'Final' }
  }

  // Register custom ActiveEffect document class for DCC-specific behavior
  CONFIG.ActiveEffect.documentClass = DCCActiveEffect

  // Register Actor data models
  CONFIG.Actor.dataModels = {
    Player: PlayerData,
    NPC: NPCData,
    Party: PartyData
  }

  // Register Item data models
  CONFIG.Item.dataModels = {
    weapon: WeaponData,
    ammunition: AmmunitionData,
    armor: ArmorData,
    equipment: EquipmentData,
    level: LevelData,
    mount: MountData,
    spell: SpellData,
    treasure: TreasureData,
    skill: SkillData
  }

  // noinspection JSUndefinedPropertyAssignment,JSUnusedGlobalSymbols
  game.dcc = {
    DCCActor,
    DCCRoll,
    DiceChain,
    FleetingLuck,
    SpellDuel,
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
  Actors.unregisterSheet('core', ActorSheetV2)

  // NPC sheets - DCCActorSheet as default, with Generic as option
  Actors.registerSheet('dcc', DCCActorSheet, {
    types: ['NPC'],
    label: 'DCC.DCCActorSheet',
    makeDefault: true
  })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetGeneric, {
    types: ['NPC'],
    label: 'DCC.DCCActorSheetGeneric'
  })

  // PC sheets - class-specific sheets only
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetCleric, {
    types: ['Player'],
    label: 'DCC.DCCActorSheetCleric'
  })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetThief, {
    types: ['Player'],
    label: 'DCC.DCCActorSheetThief'
  })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetHalfling, {
    types: ['Player'],
    label: 'DCC.DCCActorSheetHalfling'
  })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetWarrior, {
    types: ['Player'],
    label: 'DCC.DCCActorSheetWarrior'
  })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetWizard, {
    types: ['Player'],
    label: 'DCC.DCCActorSheetWizard'
  })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetDwarf, {
    types: ['Player'],
    label: 'DCC.DCCActorSheetDwarf'
  })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetElf, {
    types: ['Player'],
    label: 'DCC.DCCActorSheetElf'
  })
  Actors.registerSheet('dcc', DCCSheets.DCCActorSheetGeneric, {
    types: ['Player'],
    label: 'DCC.DCCActorSheetGeneric'
  })

  Items.unregisterSheet('core', ItemSheetV2)
  Actors.registerSheet('dcc', DCCPartySheet, {
    makeDefault: true,
    types: ['Party'],
    label: 'DCC.DCCPartySheet'
  })

  Items.registerSheet('dcc', DCCItemSheet, {
    label: 'DCC.DCCItemSheet',
    makeDefault: true
  })

  // Register template paths
  const templatePaths = [
    'systems/dcc/templates/actor-partial-pc-common.html',
    'systems/dcc/templates/actor-partial-npc-common.html',
    'systems/dcc/templates/actor-partial-pc-equipment.html',
    'systems/dcc/templates/actor-partial-npc-equipment.html',
    'systems/dcc/templates/actor-partial-pc-notes.html',
    'systems/dcc/templates/actor-partial-skills.html',
    'systems/dcc/templates/actor-partial-wizard-spells.html',
    'systems/dcc/templates/actor-partial-cleric-spells.html',
    'systems/dcc/templates/actor-partial-dwarf.html',
    'systems/dcc/templates/actor-partial-elf.html',
    'systems/dcc/templates/actor-partial-halfling.html',
    'systems/dcc/templates/actor-partial-thief.html',
    'systems/dcc/templates/actor-partial-warrior.html',
    'systems/dcc/templates/actor-partial-wizard.html',
    'systems/dcc/templates/item-sheet-partial-description.html',
    'systems/dcc/templates/item-sheet-partial-judge-description.html',
    'systems/dcc/templates/item-sheet-partial-tabs.html',
    'systems/dcc/templates/item-sheet-partial-values.html',
    'systems/dcc/templates/item-sheet-armor.html',
    'systems/dcc/templates/item-sheet-ammunition.html',
    'systems/dcc/templates/item-sheet-level.html',
    'systems/dcc/templates/item-sheet-mount.html',
    'systems/dcc/templates/item-sheet-treasure.html',
    'systems/dcc/templates/item-sheet-weapon.html',
    'systems/dcc/templates/item-sheet-weapon-npc.html',
    'systems/dcc/templates/item-sheet-weapon-pc.html',
    'systems/dcc/templates/roll-modifier-partial-die.html',
    'systems/dcc/templates/roll-modifier-partial-disapproval-die.html',
    'systems/dcc/templates/roll-modifier-partial-modifiers.html',
    'systems/dcc/templates/roll-modifier-partial-none.html',
    'systems/dcc/templates/roll-modifier-partial-check-penalty.html',
    'systems/dcc/templates/roll-modifier-partial-spellburn.html',
    'systems/dcc/templates/party-sheet-partial-party.html',
    'systems/dcc/templates/party-sheet-partial-tabs.html'
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

/* --------------------------------------------- */
/*  Initialize Fleeting Luck Button              */
/*  In v13, has to happen before ready hook      */
/*  The button is removed in FleetingLuck.init() */
/*  If Fleeting Luck is disabled                 */
/* --------------------------------------------- */
Hooks.on('getSceneControlButtons', (controls) => {
  controls.tokens.tools.fleetingLuck = {
    name: 'fleetingLuck',
    title: game.i18n.localize('DCC.FleetingLuck'),
    icon: 'fas fa-balance-scale-left',
    onChange: (event, active) => {
      game.dcc.FleetingLuck.show()
    },
    button: true,
    active: true
  }
  controls.tokens.tools.spellDuel = {
    name: 'spellDuel',
    title: game.i18n.localize('DCC.SpellDuel'),
    icon: 'fas fa-hat-wizard',
    onChange: (event, active) => {
      game.dcc.SpellDuel.show()
    },
    button: true,
    active: true
  }
})

/* -------------------------------------------- */
/*  Post initialization hook                    */
/* -------------------------------------------- */
Hooks.once('ready', async function () {
  // Register system settings - needs to happen after packs are initialised
  await registerSystemSettings()

  // Turn Map Notes on by default
  game.settings.settings.get('core.notesDisplayToggle').default = true

  // Register the KeyState tracker
  game.dcc.KeyState = new KeyState()

  checkReleaseNotes()
  checkMigrations()
  registerTables()

  // Initialise Fleeting Luck
  game.dcc.FleetingLuck.init()

  // Initialise Spell Duel
  game.dcc.SpellDuel.init()

  // Add status icons
  defineStatusIcons()

  // Apply dark theme icon filter settings
  if (game.settings.get('dcc', 'disableDarkThemeIconFilter')) {
    document.body.classList.add('disable-dark-theme-icon-filter')
  }

  // Apply chat cards theme settings
  if (!game.settings.get('dcc', 'chatCardsUseAppTheme')) {
    document.body.classList.add('chat-cards-use-ui-theme')
  }

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
  document.addEventListener('click', (event) => {
    const action = event.target.dataset.action
    if (action === 'dcc-release-notes') {
      _onShowURI('https://github.com/foundryvtt-dcc/dcc/releases')
    } else if (action === 'dcc-credits') {
      _onShowJournal('dcc.dcc-userguide', 'Credits')
    } else if (action === 'dcc-user-guide') {
      _onShowURI('https://github.com/foundryvtt-dcc/dcc/wiki/FoundryVTT-DCC-System-User-Guide')
    }
  })
}

async function _onShowJournal (packName, journalName) {
  const pack = game.packs.get(packName)
  const metadata = await pack.index.getName(journalName)
  const doc = await pack.getDocument(metadata._id)
  await doc.sheet.render(true)
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
  // Helper function to check if a table name contains "Disapproval" or the localized version
  const isDisapprovalTable = (tableName) => {
    const disapprovalText = game.i18n.localize('DCC.Disapproval')
    return tableName.includes('Disapproval') || tableName.includes(disapprovalText)
  }

  // Create manager for disapproval tables and register the system setting
  CONFIG.DCC.disapprovalPacks = new TablePackManager({
    updateHook: async (manager) => {
      // Clear disapproval tables
      CONFIG.DCC.disapprovalTables = {}

      // For each valid pack, update the list of disapproval tables available to a cleric
      // Using table name as key to enable de-duplication
      for (const packName of manager.packs) {
        const pack = game.packs.get(packName)
        if (pack) {
          for (const value of pack.index.values()) {
            // Use table name as key for de-duplication
            CONFIG.DCC.disapprovalTables[value.name] = {
              name: value.name,
              path: `${packName}.${value.name}`
            }
          }
        }
      }

      // Add world tables to the disapproval tables list if they contain "Disapproval" in their name
      // World tables will overwrite compendium tables with the same name (preferred)
      // If multiple world tables have the same name, the last one processed wins
      for (const table of game.tables) {
        if (isDisapprovalTable(table.name)) {
          // Use table name as key - this overwrites compendium tables with same name
          CONFIG.DCC.disapprovalTables[table.name] = {
            name: table.name,
            path: table.name
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
      const entry = pack.index.find((entity) => entity.name === tablePath[2])
      if (entry) {
        return pack.getDocument(entry._id)
      }
    }
  }

  return null
}

Hooks.once('importAdventure', async function () {
  // This is a client side setting so only the GM user is affected
  game.settings.set('core', foundry.canvas.layers.NotesLayer.TOGGLE_SETTING, true)

  // Regenerate all the scene thumbnails, since the adventure packer doesn't do that
  for (const scene of game.scenes) {
    const t = await scene.createThumbnail({ img: scene.img || undefined })
    if (t?.thumb) {
      console.log(`Regenerated thumbnail for ${scene.name}`)
      await scene.update({ thumb: t.thumb })
    }
  }
})

/**
 * Handle the results of a spell check cast through any mechanism
 * Apply a roll to a table and apply spell check logic for crits and fumbles
 * @param {Actor} actor        The actor rolling the check
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
  const roll = spellData.roll
  const item = spellData.item
  const flavor = spellData.flavor
  const forceCrit = spellData.forceCrit || false

  let crit = false
  let fumble = false
  let result = null

  // Make sure we evaluate the roll
  if (!roll._evaluated) {
    await roll.evaluate()
  }

  let naturalRoll = roll.dice[0].total

  // Force a critical for testing (shift-click)
  if (forceCrit && naturalRoll !== 1) {
    const originalDieRoll = naturalRoll
    naturalRoll = 20
    roll.terms[0].results[0].result = 20
    roll.terms[0]._total = 20
    roll._total += (20 - originalDieRoll)
  }

  // Check for Patron Taint
  let patronTaint = null
  if (item && actor) {
    const patronField = actor.system.class?.patron
    const spellName = item.name || ''
    const associatedPatron = item.system?.associatedPatron || ''

    // Check if actor has a patron and spell is patron-related
    if (patronField && (spellName.includes('Patron') || associatedPatron)) {
      // Roll d100 for patron taint
      const patronTaintRoll = new Roll('1d100')
      await patronTaintRoll.evaluate()

      // Get current patron taint chance (parse percentage string like "1%")
      const patronTaintChanceStr = actor.system.class?.patronTaintChance || '1%'
      const currentChance = parseInt(patronTaintChanceStr) || 1

      // Check if taint occurred (roll <= chance)
      const tainted = patronTaintRoll.total <= currentChance

      // Calculate new patron taint chance
      const newChance = currentChance + 1

      // Store patron taint data for display
      patronTaint = {
        roll: patronTaintRoll.total,
        tainted,
        oldChance: currentChance,
        newChance,
        description: tainted
          ? `<strong>${game.i18n.localize('DCC.PatronTaintChance')}!</strong>`
          : game.i18n.localize('DCC.NoPatronTaint')
      }

      // Update actor's patron taint chance
      await actor.update({ 'system.class.patronTaintChance': `${newChance}%` })
    }
  }

  try {
    // Apply the roll to the table if present
    if (rollTable) {
      result = rollTable.getResultsForRoll(roll.total)

      if (roll.dice.length > 0) {
        if (naturalRoll === 1) {
          const fumbleResult = rollTable.getResultsForRoll(1)
          result.results = fumbleResult.results
          fumble = true
        } else if (naturalRoll === 20) {
          if (actor.type === 'Player') {
            const levelValue = parseInt(actor.system.details.level.value)
            const critRoll = roll.total + levelValue
            result = rollTable.getResultsForRoll(critRoll)
            roll.terms.push(new foundry.dice.terms.OperatorTerm({ operator: '+' }))
            roll.terms.push(new foundry.dice.terms.NumericTerm({ number: levelValue }))
            roll._formula += ` + ${levelValue}`
            roll._total += levelValue
            crit = true
          }
        }
      }
      await game.dcc.SpellResult.addChatMessage(roll, rollTable, result, { crit, fumble, item, patronTaint })
      // Otherwise just roll the dice
    } else {
      if (!roll._evaluated) {
        await roll.evaluate()
      }

      // Generate flags for the roll
      const flags = {
        'dcc.RollType': 'SpellCheck',
        'dcc.isSpellCheck': true,
        'dcc.isSkillCheck': true,
        'dcc.ItemId': item?.id
      }
      game.dcc.FleetingLuck.updateFlags(flags, roll)

      // Display the roll
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor,
        flags,
        system: { spellId: item?.id }
      })
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
        await actor.loseSpell(item)
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

    // Store the roll result in the item for display on the spells tab
    if (item) {
      await item.update({ 'system.lastResult': roll.total })
    }
  } catch (ex) {
    console.error(ex)
  }
}

/* -------------------------------------------- */
/*  Other Hooks                                 */
/* -------------------------------------------- */
// Create a macro when a rollable is dropped on the hotbar
Hooks.on('hotbarDrop', (bar, data, slot) => {
  return createDCCMacro(data, slot)
})

// Highlight 1's and 20's for all regular rolls, special spell check handling
Hooks.on('renderChatMessageHTML', (message, html, data) => {
  if (!message.isRoll || !message.isContentVisible || !message.rolls.length) return

  if (game.user.isGM) {
    message.setFlag('core', 'canPopout', true)
  }
  chat.highlightCriticalSuccessFailure(message, html, data)
  SpellResult.processChatMessage(message, html, data)

  // Add data-item-id for modules that want to use it
  const itemId = message.getFlag('dcc', 'ItemId')
  if (itemId !== undefined) {
    const messageContent = html.querySelector('.message-content')
    if (messageContent) {
      messageContent.setAttribute('data-item-id', itemId)
    }
  }

  let emoteRolls = false
  try {
    emoteRolls = game.settings.get('dcc', 'emoteRolls')
  } catch {
    if (message.getFlag('dcc', 'emoteRoll') === true) {
      emoteRolls = true
    }
  }

  let automateDamageFumblesCrits
  try {
    automateDamageFumblesCrits = game.settings.get('dcc', 'automateDamageFumblesCrits')
  } catch {
    automateDamageFumblesCrits = false
  }

  if (emoteRolls === true) {
    if (game.user.isGM) {
      message.setFlag('dcc', 'emoteRoll', true)
    }
    chat.emoteAbilityRoll(message, html, data)
    chat.emoteApplyDamageRoll(message, html, data)
    chat.emoteAttackRoll(message, html, data)
    chat.emoteCritRoll(message, html, data)
    chat.emoteFumbleRoll(message, html, data)
    chat.emoteDamageRoll(message, html, data)
    chat.emoteInitiativeRoll(message, html, data)
    chat.emoteSavingThrowRoll(message, html, data)
    chat.emoteSkillCheckRoll(message, html, data)
  }

  if (emoteRolls === false || (emoteRolls === true && automateDamageFumblesCrits === false)) {
    chat.lookupCriticalRoll(message, html)
    chat.lookupFumbleRoll(message, html, data)
  }
})

// Support context menu on chat cards
Hooks.on('getChatMessageContextOptions', chat.addChatMessageContextOptions)

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

// Level Data packs
Hooks.on('dcc.registerLevelDataPack', (value, fromSystemSetting = false) => {
  if (!CONFIG.DCC.levelDataPacks) {
    // Create manager for level data packs
    CONFIG.DCC.levelDataPacks = new TablePackManager()
  }
  CONFIG.DCC.levelDataPacks.addPack(value, fromSystemSetting)
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

// Entity pre-creation hooks - set default images before creation to avoid race conditions
Hooks.on('preCreateActor', (document, data, options) => {
  // Assign an appropriate DCC actor image if not set
  if (game.user.isGM && !data.img) {
    const img = EntityImages.imageForActor(document.type)
    if (img) {
      document.updateSource({ img })
    }
  }

  // Set Player actor prototype tokens to Link Actor Data by default
  // Only for brand-new actors (not duplicates or imports)
  if (!options.keepId && document.type === 'Player' && !document.name.includes('Item Pile')) {
    document.updateSource({ 'prototypeToken.actorLink': true })
  }
})

Hooks.on('preCreateItem', (document, data, options) => {
  if (!game.user.isGM || data.img) { return }

  // Assign an appropriate DCC item image
  const img = EntityImages.imageForItem(document.type)
  if (img) {
    document.updateSource({ img })
  }
})

// Add newly created world RollTables to disapproval tables list if they contain "Disapproval"
Hooks.on('createRollTable', (table) => {
  const disapprovalText = game.i18n.localize('DCC.Disapproval')
  if (table.name.includes('Disapproval') || table.name.includes(disapprovalText)) {
    // Use table name as key for de-duplication with compendium tables
    CONFIG.DCC.disapprovalTables[table.name] = {
      name: table.name,
      path: table.name
    }
  }
})

// Remove deleted world RollTables from disapproval tables list
Hooks.on('deleteRollTable', (table) => {
  // Use table name as key to find and delete
  delete CONFIG.DCC.disapprovalTables[table.name]
})

// Update world RollTable entries when name changes
Hooks.on('updateRollTable', (table, changes) => {
  if (changes.name) {
    const disapprovalText = game.i18n.localize('DCC.Disapproval')

    // Helper function to check if a table name contains "Disapproval"
    const isDisapprovalTable = (tableName) => {
      return tableName.includes('Disapproval') || tableName.includes(disapprovalText)
    }

    // Rebuild world tables list to handle renames correctly
    // First, remove all world table entries (we'll re-add the valid ones)
    const compendiumTables = {}
    for (const [key, value] of Object.entries(CONFIG.DCC.disapprovalTables)) {
      // Keep compendium tables (they have paths with dots like "pack.table")
      if (value.path.includes('.')) {
        compendiumTables[key] = value
      }
    }

    // Reset to only compendium tables
    CONFIG.DCC.disapprovalTables = compendiumTables

    // Re-add all world disapproval tables
    for (const worldTable of game.tables) {
      if (isDisapprovalTable(worldTable.name)) {
        CONFIG.DCC.disapprovalTables[worldTable.name] = {
          name: worldTable.name,
          path: worldTable.name
        }
      }
    }
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

// Sync prototype token image with actor image when actor image is changed
Hooks.on('preUpdateActor', async (actor, changes, options, userId) => {
  // Only process if this client initiated the change
  if (userId !== game.user.id) return

  // Check if the actor image is being changed
  if (!changes.img) return

  // Get the current prototype token texture
  const currentTokenImg = actor.prototypeToken?.texture?.src || ''

  // Define default images that should be replaced
  const defaultImages = [
    'icons/svg/mystery-man.svg',
    EntityImages.imageForActor(actor.type),
    EntityImages.imageForActor('default')
  ]

  // Only update token if it's using a default image or is empty
  if (!currentTokenImg || defaultImages.includes(currentTokenImg)) {
    // Update the prototype token image to match the new actor image
    changes['prototypeToken.texture.src'] = changes.img
  }
})

// Handle Active Effect duration automation
Hooks.on('updateCombat', async (combat, changed, options, userId) => {
  // Only process on the GM's client to avoid duplicates
  if (!game.user.isGM) return

  // Only process when round changes
  if (!('round' in changed)) return

  console.log(`DCC | Combat advanced to round ${combat.round}, checking for expired Active Effects...`)

  // Check all actors for expired effects
  for (const actor of game.actors) {
    if (actor.effects.size === 0) continue

    const expiredEffects = []

    for (const effect of actor.effects) {
      // Skip effects with no duration
      if (!effect.duration) continue

      // For round-based effects
      if (effect.duration.rounds && effect.duration.startRound !== undefined) {
        const startRound = effect.duration.startRound
        const durationRounds = effect.duration.rounds
        const endRound = startRound + durationRounds

        console.log(`DCC | Effect "${effect.name}": start=${startRound}, duration=${durationRounds}, end=${endRound}, current=${combat.round}`)

        if (combat.round >= endRound) {
          expiredEffects.push(effect.id)
          console.log(`DCC | Effect "${effect.name}" on ${actor.name} has expired (round ${combat.round} >= ${endRound})`)
        }
      } else if (effect.duration.seconds && effect.isExpired) {
        // For time-based effects, use Foundry's built-in expiration check
        expiredEffects.push(effect.id)
        console.log(`DCC | Time-based effect "${effect.name}" on ${actor.name} has expired`)
      }
    }

    // Remove expired effects
    if (expiredEffects.length > 0) {
      // Get effect names before deletion
      const effectNames = expiredEffects.map(id => {
        const effect = actor.effects.get(id)
        return effect?.name || 'Unknown'
      }).join(', ')

      await actor.deleteEmbeddedDocuments('ActiveEffect', expiredEffects)

      // Notify about expired effects
      ui.notifications.info(game.i18n.format('DCC.EffectsExpired', {
        actor: actor.name,
        effects: effectNames
      }))
    }
  }
})

// Set up Item Piles module compatibility
Hooks.once('item-piles-ready', setupItemPilesForDCC)

// Add custom ProseMirror menu dropdown for sidebar style
Hooks.on('getProseMirrorMenuDropDowns', (menu, items) => {
  if ('format' in items) {
    items.format.entries.push({
      action: 'dcc-custom',
      title: 'DCC.CustomStyles',
      active: (state) => {
        const { $from } = state.selection
        const preserveAttrs = $from.parent.attrs._preserve || {}
        return preserveAttrs.class?.includes('sidebar') || false
      },
      children: [
        {
          action: 'sidebar',
          title: 'DCC.SidebarText',
          node: menu.schema.nodes.paragraph,
          active: (state) => {
            const { $from } = state.selection
            const preserveAttrs = $from.parent.attrs._preserve || {}
            return preserveAttrs.class?.includes('sidebar') || false
          },
          cmd: () => {
            const { state, dispatch } = menu.view
            const { $from } = state.selection
            const currentNode = $from.parent
            const preserveAttrs = currentNode.attrs._preserve || {}
            const hasSidebarClass = preserveAttrs.class?.includes('sidebar')

            let newClass
            if (hasSidebarClass) {
              // Remove sidebar class
              newClass = preserveAttrs.class.split(' ').filter(c => c !== 'sidebar').join(' ') || null
            } else {
              // Add sidebar class
              newClass = preserveAttrs.class ? `${preserveAttrs.class} sidebar` : 'sidebar'
            }

            const newPreserve = { ...preserveAttrs }
            if (newClass) newPreserve.class = newClass
            else delete newPreserve.class

            return foundry.prosemirror.commands.setBlockType(menu.schema.nodes.paragraph, {
              ...currentNode.attrs,
              _preserve: newPreserve
            })(state, dispatch)
          }
        }
      ]
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
    Item: _createDCCItemMacro,
    'DCC Item': _createDCCItemMacro,
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
    // Create or reuse existing macro
    let macro = game.macros.contents.find(m => (m.name === macroData.name) && (m.command === macroData.command))
    if (!macro) {
      macro = await Macro.create({
        name: `${macroData.name}-${data.actorId}`,
        type: 'script',
        img: macroData.img,
        command: macroData.command,
        flags: { 'dcc.itemMacro': true }
      })
    }

    // Assign the macro to the hotbar slot
    await game.user.assignHotbarMacro(macro, slot)
    return false // Prevent Foundry's default behavior
  }
  return true
}

/**
 * Create a macro from an ability check drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
function _createDCCAbilityMacro (data) {
  if (data.type !== 'Ability') return

  // Create the macro command
  const abilityId = data.data.abilityId
  const rollUnder = data.data.rollUnder
  const macroData = {
    name: game.i18n.localize(CONFIG.DCC.abilities[abilityId]),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollAbilityCheck("${abilityId}", Object.assign({ rollUnder: ${rollUnder} }, game.dcc.getMacroOptions())) }`,
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
 * @returns {Object}
 */
function _createDCCInitiativeMacro (data) {
  if (data.type !== 'Initiative') return

  // Create the macro command
  return {
    name: game.i18n.localize('DCC.Initiative'),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollInit(event, token) }`,
    img: EntityImages.imageForMacro('initiative')
  }
}

/**
 * Create a macro from a hit dice drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
function _createDCCHitDiceMacro (data) {
  if (data.type !== 'Hit Dice') return

  // Create the macro command
  return {
    name: game.i18n.localize('DCC.HitDiceRoll'),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollHitDice(game.dcc.getMacroOptions()) }`,
    img: EntityImages.imageForMacro(game.dcc.DiceChain.getPrimaryDie(data.data.dice), 'hitDice')
  }
}

/**
 * Create a macro from a saving throw drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
function _createDCCSaveMacro (data) {
  if (data.type !== 'Save') return

  // Create the macro command
  const saveId = data.data
  return {
    name: game.i18n.localize(CONFIG.DCC.saves[saveId]),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollSavingThrow("${saveId}", game.dcc.getMacroOptions()) }`,
    img: EntityImages.imageForMacro(saveId, 'savingThrow')
  }
}

/**
 * Create a macro from a skill roll drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
function _createDCCSkillMacro (data) {
  if (data.type !== 'Skill') return

  // Create the macro command
  const skillId = data.data.skillId
  const skillName = game.i18n.localize(data.data.skillName)
  return {
    name: skillName,
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollSkillCheck("${skillId}", game.dcc.getMacroOptions()) }`,
    img: EntityImages.imageForMacro(skillId, 'skillCheck')
  }
}

/**
 * Create a macro from a luck die drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
function _createDCCLuckDieMacro (data) {
  if (data.type !== 'Luck Die') return
  const die = data.data.die

  // Create the macro command
  return {
    name: game.i18n.localize('DCC.LuckDie'),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollLuckDie(game.dcc.getMacroOptions()) }`,
    img: EntityImages.imageForMacro(game.dcc.DiceChain.getPrimaryDie(die), 'luckDie')
  }
}

/**
 * Create a macro from a spell check drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
function _createDCCSpellCheckMacro (data) {
  if (data.type !== 'Spell Check') return

  // Create the macro command
  const spell = data.data.name || null
  const img = data.data.img || null
  const itemId = data.data.itemId || null

  const macroData = {
    name: spell || game.i18n.localize('DCC.SpellCheck'),
    img: img || EntityImages.imageForMacro('spellCheck')
  }

  // If we have an itemId, create an item-based macro
  if (itemId) {
    const uuid = `Actor.${data.actorId}.Item.${itemId}`
    macroData.command = `const _item = await fromUuid("${uuid}"); if (_item) { _item.rollSpellCheck() }`
  } else if (spell) {
    // Fallback to actor-based spell check with spell name
    macroData.command = `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollSpellCheck(Object.assign({ spell: "${spell}" }, game.dcc.getMacroOptions())) }`
  } else {
    // Generic spell check
    macroData.command = `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollSpellCheck() }`
  }

  return macroData
}

/**
 * Create a macro from an attack bonus drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
function _createDCCAttackBonusMacro (data) {
  if (data.type !== 'Attack Bonus') return
  const die = data.data.die

  // Create the macro command
  return {
    name: game.i18n.localize('DCC.AttackBonus'),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollAttackBonus(game.dcc.getMacroOptions()) }`,
    img: EntityImages.imageForMacro(game.dcc.DiceChain.getPrimaryDie(die), 'attackBonus')
  }
}

/**
 * Create a macro from an action die drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
function _createDCCActionDiceMacro (data) {
  if (data.type !== 'Action Dice') return
  const die = data.data.die

  // Create the macro command
  return {
    name: game.i18n.format('DCC.ActionDiceMacroName', { die }),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.setActionDice('${die}') }`,
    img: EntityImages.imageForMacro(game.dcc.DiceChain.getPrimaryDie(die), 'defaultDice')
  }
}

/**
 * Create a Macro from a weapon drop.
 * Get an existing macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
function _createDCCWeaponMacro (data) {
  if (data.type !== 'Weapon') return
  const weapon = data.system.weapon
  const backstab = data.system?.backstab
  const options = {
    backstab
  }

  const macroData = {
    name: weapon.name,
    command: `game.dcc.rollDCCWeaponMacro("${weapon._id}", "${data.actorId}", Object.assign(${JSON.stringify(options)}, game.dcc.getMacroOptions()));`,
    img: weapon.img
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
 * Create a macro from an item drop.
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
function _createDCCItemMacro (data) {
  if (data.type !== 'Item' && data.type !== 'DCC Item') return

  const item = data.system.item || data.data
  if (!item) return

  // Generate the UUID for the item
  const uuid = `Actor.${data.actorId}.Item.${item._id}`

  // Handle spell items
  if (item.type === 'spell') {
    return {
      name: item.name,
      command: `const _item = await fromUuid("${uuid}"); if (_item) { _item.rollSpellCheck() }`,
      img: item.img
    }
  }

  // For other item types, create a generic macro
  return {
    name: item.name,
    command: `const _item = await fromUuid("${uuid}"); if (_item) { _item.roll() }`,
    img: item.img || EntityImages.imageForItem(item.type)
  }
}

/**
 * Apply disapproval to an actor
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
function _createDCCApplyDisapprovalMacro (data) {
  if (data.type !== 'Apply Disapproval') return

  // Create the macro command
  return {
    name: game.i18n.format('DCC.ApplyDisapprovalMacroName'),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.applyDisapproval() }`,
    img: EntityImages.imageForMacro('applyDisapproval')
  }
}

/**
 * Roll disapproval for an actor
 * @param {Object} data     The dropped data
 * @returns {Object}
 */
function _createDCCRollDisapprovalMacro (data) {
  if (data.type !== 'Roll Disapproval') return

  // Create the macro command
  return {
    name: game.i18n.format('DCC.RollDisapprovalMacroName'),
    command: `const _actor = game.dcc.getMacroActor('${data.actorId}'); if (_actor) { _actor.rollDisapproval() }`,
    img: EntityImages.imageForMacro('rollDisapproval')
  }
}

/**
 * Roll a weapon attack from a macro.
 * @param {string} itemId
 * @param {string} actorId
 * @param {Object} options
 * @return {Promise}
 */
function rollDCCWeaponMacro (itemId, actorId, options = {}) {
  /** @type {DCCActor} */
  const actor = game.actors.get(actorId)

  // Trigger the weapon roll
  return actor.rollWeaponAttack(itemId, options)
}

/**
 * Get the current actor - for use in macros
 * @return {Object}
 */
function getMacroActor (actorId = null) {
  if (actorId) {
    return game.actors.get(actorId)
  }
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
