/* global foundry */
// noinspection JSUnusedLocalSymbols

import { vi } from 'vitest'
import DCC from '../config.js'
import DCCRoll from './dcc-roll.js'
import path from 'path'
import fs from 'fs'

// console.log('Loading Foundry Mocks')

/**
 * FormApplication
 */
class FormApplicationMock {}
global.FormApplication = FormApplicationMock

/**
 * Item - Enhanced to better simulate real item behavior
 */
class MockItem {
  constructor (data = {}, context = {}) {
    this._id = data._id || 'mock-item-id'
    this.name = data.name || 'Mock Item'

    if (data.type) {
      this.system = getTemplateData('Item', data.type) || {}
      this.type = data.type
    }

    // Enhanced system defaults for common item types (applied after template but before explicit data)
    if (this.type === 'weapon') {
      // Set enhanced defaults, overriding template defaults where needed
      const weaponDefaults = {
        melee: true,
        damage: '1d6',
        attackBonus: '+0',
        toHit: '+0',
        critRange: 20,
        critDie: '1d6',
        critTable: 'III'
      }
      // Apply our defaults over template data
      this.system = Object.assign({}, this.system, weaponDefaults)
    }

    Object.assign(this, data)

    // Apply any explicit system data from constructor
    if (this.type === 'weapon' && data.system) {
      Object.assign(this.system, data.system)
    } else if (this.type === 'armor') {
      const armorDefaults = {
        equipped: false,
        checkPenalty: 0,
        fumbleDie: '1d4'
      }
      this.system = Object.assign({}, this.system, armorDefaults)
      if (data.system) {
        Object.assign(this.system, data.system)
      }
    }
    this.actor = null // Will be set when added to an actor
  }

  prepareBaseData () {
    // Enhanced preparation for weapons and armor
    if (this.type === 'weapon' && this.actor) {
      this._prepareWeaponData()
    } else if (this.type === 'armor') {
      this._prepareArmorData()
    }
  }

  _prepareWeaponData () {
    // Simulate basic weapon preparation
    if (!this.system.initiativeDie) {
      this.system.initiativeDie = this.actor.system.attributes.actionDice?.value || '1d20'
    }
  }

  _prepareArmorData () {
    // Simulate basic armor preparation
    if (!this.system.fumbleDie) {
      this.system.fumbleDie = '1d4'
    }
  }
}

global.Item = MockItem

/**
 * Collection
 */
global.collectionFindMock = vi.fn().mockName('Collection.find')
const CollectionMock = vi.fn().mockImplementation(() => {
  return {
    find: global.collectionFindMock
  }
}).mockName('Collection')
global.Collection = CollectionMock

/**
 * Actor
 */
// Enhanced itemTypes mock that returns proper collections by type
global.itemTypesMock = vi.fn(() => {
  return {
    armor: [],
    weapon: [],
    equipment: [],
    spell: [],
    skill: [],
    treasure: []
  }
}).mockName('Actor.itemTypes getter')
global.actorUpdateMock = vi.fn(data => {}).mockName('Actor.update')

class ActorMock {
  constructor (data, options) {
    // If test-specific data is passed in use it, otherwise use default data
    if (data) {
      Object.assign(this, data)
    } else {
      this._id = 1
      this.name = 'test character'
      Object.assign(this, {
        system: {
          abilities: {
            str: { value: 6, label: 'DCC.AbilityStr' },
            agl: { value: 8, label: 'DCC.AbilityAgl' },
            sta: { value: 12, label: 'DCC.AbilitySta' },
            int: { value: 14, label: 'DCC.AbilityInt' },
            per: { value: 16, label: 'DCC.AbilityPer' },
            lck: { value: 18, label: 'DCC.AbilityLck' }
          },
          attributes: {
            ac: {
              checkPenalty: 0
            },
            init: { value: -1 },
            actionDice: { value: '1d20' },
            fumble: { die: '1d4' },
            speed: {
              value: 30
            },
            hp: {
              value: 3,
              max: 3
            }
          },
          saves: {
            frt: { value: '-1' },
            ref: { value: '0' },
            wil: { value: '+2' }
          },
          details: {
            attackBonus: '+0',
            attackHitBonus: {
              melee: {
                value: '+0',
                adjustment: '+0'
              },
              missile: {
                value: '+0',
                adjustment: '+0'
              }
            },
            attackDamageBonus: {
              melee: {
                value: '+0',
                adjustment: '+0'
              },
              missile: {
                value: '+0',
                adjustment: '+0'
              }
            },
            lastRolledAttackBonus: '',
            level: {
              value: 1
            }
          },
          class: {
            corruption: '',
            luckDie: '1d3',
            spellCheck: 3,
            spellCheckAbility: 'int',
            spellCheckOverride: '',
            spellCheckOverrideDie: ''
          },
          skills: {
            customDieSkill: {
              label: 'Custom Die Skill',
              die: '1d14'
            },
            customDieAndValueSkill: {
              label: 'Custom Die And Value Skill',
              die: '1d14',
              value: +3
            },
            actionDieSkill: {
              label: 'Action Die Skill',
              value: -4
            },
            customDieSkillWithInt: {
              label: 'Custom Die Skill With Int',
              ability: 'int',
              die: '1d24'
            },
            customDieAndValueSkillWithPer: {
              label: 'Custom Die And Value Skill With Per',
              ability: 'per',
              die: '1d24',
              value: +3
            },
            actionDieAndValueSkillWithLck: {
              label: 'Action Die And Value Skill With Lck',
              ability: 'lck',
              value: +1
            }
          },
          config: {
            actionDice: '1d20',
            attackBonusMode: 'flat',
            maxLevel: 0,
            rollAttackBonus: false,
            computeAC: false,
            computeCheckPenalty: true,
            baseACAbility: 'agl',
            initiativeDieOverride: '',
            sortInventory: true,
            removeEmptyItems: true
          }
        }
      })
    }
    this.items = new global.Collection()
    this.prepareData()
    Object.defineProperty(this, 'itemTypes', {
      get: global.itemTypesMock
    })
  }

  prepareData () {
    // Simulate the real prepareBaseData behavior for ability modifiers
    this.prepareBaseData()
  }

  prepareBaseData () {
    // Calculate ability modifiers using CONFIG.DCC.abilityModifiers like the real actor
    const abilities = this.system.abilities
    for (const abilityId in abilities) {
      const config = global.CONFIG?.DCC?.abilityModifiers || DCC.abilityModifiers
      abilities[abilityId].mod = config[abilities[abilityId].value] || 0
      abilities[abilityId].maxMod = config[abilities[abilityId].max] || abilities[abilityId].mod
    }
  }

  getRollData () {
    return this.system
  }

  rollInitiative (createCombatants, rerollInitiative, initiativeOptions) {
    return this.getInitiativeRoll()
  }

  update (data) {
    return global.actorUpdateMock(data)
  }
}

global.Actor = ActorMock

/**
 * ChatMessage
 */
class ChatMessageMock {
  static getSpeaker = vi.fn(({ scene, actor, token, alias } = {}) => { return actor })
  static applyRollMode = vi.fn()

  static create (data, options = {}) { if (data) { this.data = data } }

  constructor (data, options = {}) { if (data) { this.data = data } }
}

global.ChatMessage = ChatMessageMock

// noinspection JSConstantReassignment
/**
 * CONFIG - Enhanced to better simulate Foundry environment
 */
global.CONFIG = {
  DCC: JSON.parse(JSON.stringify(DCC)), // Deep copy to avoid mutations
  sounds: { dice: 'diceSound' },
  Actor: {
    documentClass: ActorMock
  },
  Item: {
    documentClass: MockItem
  }
}

// Enhanced CONST to include more Foundry constants
global.CONST = {
  CHAT_MESSAGE_STYLES: {
    EMOTE: 'emote',
    IC: 'ic',
    OOC: 'ooc'
  },
  DICE_ROLL_MODES: {
    PUBLIC: 'roll',
    PRIVATE: 'gmroll',
    BLIND: 'blindroll',
    SELF: 'selfroll'
  },
  ENTITY_TYPES: {
    ACTOR: 'Actor',
    ITEM: 'Item'
  }
}

// Create global actor instance after CONFIG is set up
global.actor = new ActorMock()

/**
 * Localization - Enhanced with common DCC localizations
 */
class Localization {
  constructor () {
    // Common DCC localization strings for more realistic testing
    this.translations = {
      'DCC.AbilityStr': 'Strength',
      'DCC.AbilityAgl': 'Agility',
      'DCC.AbilitySta': 'Stamina',
      'DCC.AbilityPer': 'Personality',
      'DCC.AbilityInt': 'Intelligence',
      'DCC.AbilityLck': 'Luck',
      'DCC.ActionDie': 'Action Die',
      'DCC.RollModifierTitleInitiative': 'Initiative',
      'DCC.ToHit': 'Attack',
      'DCC.SavesReflex': 'Reflex',
      'DCC.SavesFortitude': 'Fortitude',
      'DCC.SavesWill': 'Will',
      'DCC.SpellCheck': 'Spell Check',
      'DCC.LuckDie': 'Luck Die',
      'DCC.Level': 'Level',
      'DCC.AbilityMod': 'Ability Modifier',
      'DCC.SpellCheckOtherMod': 'Other Modifier',
      'DCC.CheckPenalty': 'Check Penalty',
      'DCC.Spellburn': 'Spellburn',
      'DCC.StartingFunds': 'Starting Funds',
      'DCC.Equipment': 'Equipment',
      'DCC.TradeGoods': 'Trade Goods',
      'DCC.BirthAugur': 'Birth Augur',
      'DCC.Languages': 'Languages'
    }
  }

  localize (stringId) {
    // Return actual translation if available, otherwise strip DCC prefix
    return this.translations[stringId] || stringId.replace('DCC.', '')
  }

  format (stringId, data = {}) {
    let returnString = this.localize(stringId)
    for (const datum in data) {
      returnString = returnString.replace(`{${datum}}`, data[datum])
    }
    return returnString
  }
}

global.Localization = Localization

/**
 * Game
 */
class Game {
  constructor (worldData, sessionId, socket) {
    this.i18n = new Localization()
  }

  user = {} // Set up below

  dcc = {} // Set up below
}

global.Game = Game
global.game = new Game()
global.game.user = { _id: 1 }
global.getDCCSkillTableMock = vi.fn((skillName) => { return null }).mockName('game.dcc.getSkillTable')
global.processSpellCheckMock = vi.fn((actor, spellData) => { }).mockName('game.dcc.processSpellCheck')
global.calculateCritAdjustment = vi.fn((original, adjusted) => { return 0 }).mockName('game.dcc.DiceChain.calculateCritAdjustment')
global.updateFlagsMock = vi.fn((flags, roll) => { }).mockName('game.dcc.FleetingLuck.updateFlags')

// Enhanced DiceChain mock with actual DCC dice chain logic
global.rankDiceExpressionMock = vi.fn((expression) => {
  // Simulate the ranking of dice expressions based on the DCC dice chain
  const diceChain = [3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30]
  const match = expression.match(/d(\d+)/)
  if (match) {
    const dieSize = parseInt(match[1])
    const rank = diceChain.indexOf(dieSize)
    return rank >= 0 ? rank : 0
  }
  return 0
}).mockName('game.dcc.DiceChain.rankDiceExpression')

global.game.dcc = {
  DCCRoll,
  getSkillTable: global.getDCCSkillTableMock,
  processSpellCheck: global.processSpellCheckMock,
  DiceChain: {
    calculateCritAdjustment: global.calculateCritAdjustment,
    rankDiceExpression: global.rankDiceExpressionMock,
    DICE_CHAIN: [3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30]
  },
  FleetingLuck: {
    updateFlags: global.updateFlagsMock
  }
}
global.renderTemplate = vi.fn((template, data) => { return '' }).mockName('renderTemplate')

/**
 * Settings - Enhanced with common DCC setting defaults
 */
global.gameSettingsGetMock = vi.fn((module, key) => {
  // Return realistic defaults for common DCC settings
  if (module === 'dcc') {
    switch (key) {
      case 'criticalHitPacks':
        return 'dcc-core-book.dcc-crits'
      case 'fumbleTable':
        return 'dcc-core-book.dcc-fumbles'
      case 'disapprovalPacks':
        return 'dcc-core-book.dcc-disapproval'
      case 'divineAidTable':
        return 'dcc-core-book.dcc-divine-aid'
      case 'mercurialMagicTable':
        return 'dcc-core-book.dcc-mercurial-magic'
      case 'turnUnholyTable':
        return 'dcc-core-book.dcc-turn-unholy'
      case 'layOnHandsTable':
        return 'dcc-core-book.dcc-lay-on-hands'
      case 'levelData':
        return 'dcc-core-book.dcc-level-data'
      default:
        return undefined
    }
  }
  return undefined
}).mockName('game.settings.get')

class ClientSettings {
  constructor (worldSettings) {
    this.get = global.gameSettingsGetMock
  }
}

global.game.settings = new ClientSettings()

/**
 * ChatMessage
 */
global.CONFIG.ChatMessage = {
  documentClass: {
    create: vi.fn((messageData = {}) => {
      // console.log(messageData)
    })
  }
}

/**
 * Notifications
 */
global.uiNotificationsWarnMock = vi.fn((message, options) => {}).mockName('ui.notifications.warn')
global.uiNotificationsErrorMock = vi.fn((message, type, permanent) => {}).mockName('ui.notifications.error')

class Notifications {
  warn = global.uiNotificationsWarnMock
  error = global.uiNotificationsErrorMock
}

global.ui = {
  notifications: new Notifications()
}

/**
 * Global helper functions
 */

// Namespace for Foundry helper functions
global.foundry = {
  utils: {}
}

// Foundry's implementation of getType
global.getType = function (token) {
  const tof = typeof token
  if (tof === 'object') {
    if (token === null) return 'null'
    const cn = token.constructor.name
    if (['String', 'Number', 'Boolean', 'Array', 'Set'].includes(cn)) return cn
    else if (/^HTML/.test(cn)) return 'HTMLElement'
    else return 'Object'
  }
  return tof
}

// Foundry's implementation of setProperty
global.setProperty = function (object, key, value) {
  let target = object
  let changed = false

  // Convert the key to an object reference if it contains dot notation
  if (key.indexOf('.') !== -1) {
    const parts = key.split('.')
    key = parts.pop()
    target = parts.reduce((o, i) => {
      if (!Object.prototype.hasOwnProperty.call(o, i)) o[i] = {}
      return o[i]
    }, object)
  }

  // Update the target
  if (target[key] !== value) {
    changed = true
    target[key] = value
  }

  // Return changed status
  return changed
}

// Foundry's implementation of expandObject
global.foundry.utils.expandObject = function (obj, _d = 0) {
  const expanded = {}
  if (_d > 10) throw new Error('Maximum depth exceeded')
  for (let [k, v] of Object.entries(obj)) {
    if (v instanceof Object && !Array.isArray(v)) v = global.foundry.utils.expandObject(v, _d + 1)
    global.setProperty(expanded, k, v)
  }
  return expanded
}

// Foundry's implementation of duplicate
global.foundry.utils.duplicate = function (original) {
  return JSON.parse(JSON.stringify(original))
}

// Foundry's implementation of mergeObject
global.foundry.utils.mergeObject = function (original, other = {}, {
  insertKeys = true,
  insertValues = true,
  overwrite = true,
  recursive = true,
  inplace = true,
  enforceTypes = false
} = {}, _d = 0) {
  other = other || {}
  if (!(original instanceof Object) || !(other instanceof Object)) {
    throw new Error('One of original or other are not Objects!')
  }
  const depth = _d + 1

  // Maybe copy the original data at depth 0
  if (!inplace && (_d === 0)) original = foundry.utils.duplicate(original)

  // Enforce object expansion at depth 0
  if ((_d === 0) && Object.keys(original).some(k => /\./.test(k))) original = global.foundry.utils.expandObject(original)
  if ((_d === 0) && Object.keys(other).some(k => /\./.test(k))) other = global.foundry.utils.expandObject(other)

  // Iterate over the other object
  for (let [k, v] of Object.entries(other)) {
    const tv = global.getType(v)

    // Prepare to delete
    let toDelete = false
    if (k.startsWith('-=')) {
      k = k.slice(2)
      toDelete = (v === null)
    }

    // Get the existing object
    let x = original[k]
    let has = Object.prototype.hasOwnProperty.call(original, k)
    let tx = global.getType(x)

    // Ensure that inner objects exist
    if (!has && (tv === 'Object')) {
      x = original[k] = {}
      has = true
      tx = 'Object'
    }

    // Case 1 - Key exists
    if (has) {
      // 1.1 - Recursively merge an inner object
      if ((tv === 'Object') && (tx === 'Object') && recursive) {
        global.foundry.utils.mergeObject(x, v, {
          insertKeys,
          insertValues,
          overwrite,
          inplace: true,
          enforceTypes
        }, depth)

        // 1.2 - Remove an existing key
      } else if (toDelete) {
        delete original[k]

        // 1.3 - Overwrite existing value
      } else if (overwrite) {
        if (tx && (tv !== tx) && enforceTypes) {
          throw new Error('Mismatched data types encountered during object merge.')
        }
        original[k] = v

        // 1.4 - Insert new value
      } else if ((x === undefined) && insertValues) {
        original[k] = v
      }

      // Case 2 - Key does not exist
    } else if (!toDelete) {
      const canInsert = (depth === 1 && insertKeys) || (depth > 1 && insertValues)
      if (canInsert) original[k] = v
    }
  }

  // Return the object for use
  return original
}

/**
 * Handlebars
 * @templateList {Array<string>} A list of template paths to load
 */
global.loadTemplates = vi.fn((templateList) => {}).mockName('loadTemplates')

class TextEditorMock {
  static async enrichHTML (content, options = {}) {
    return content
  }
}

global.TextEditor = TextEditorMock

/**
 * Hooks
 */
class HooksMock {
  static async callAll (hook, rolls, messageData) {
    return true
  }

  static call (hook, ...args) {
    return true
  }
}

global.Hooks = HooksMock

export function getTemplateData (documentClass, type) {
  if (!documentClass || !type) {
    return null
  }

  const filePath = path.join(__dirname, '..', '..', 'template.json')
  const fileContent = fs.readFileSync(filePath, 'utf-8')
  const templateData = JSON.parse(fileContent)
  const templateDataForClass = templateData[documentClass]
  const templateDataForType = templateDataForClass[type] || {}

  const documentData = {}

  // Loop over all the templates for the class and merge them together
  for (const template of templateDataForType.templates || []) {
    Object.assign(documentData, templateDataForClass.templates[template])
  }
  // Add in the data from the type itself
  Object.assign(documentData, templateDataForType)
  return documentData || null
}

// Mock DCCActorLevelChange
global.DCCActorLevelChange = class DCCActorLevelChange {
  constructor (actor) {
    this.actor = actor
  }

  render (force) {
    return true
  }
}
