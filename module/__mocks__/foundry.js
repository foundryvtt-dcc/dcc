/* global foundry */

import { vi } from 'vitest'
import DCC from '../config.js'
import DCCRoll from './dcc-roll.js'

// console.log('Loading Foundry Mocks')

/**
 * Item
 */
const Item = vi.fn().mockImplementation(() => {
}).mockName('Item')
global.Item = Item

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
global.itemTypesMock = vi.fn().mockName('Actor.itemTypes getter')
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
            str: { value: 6, mod: -1, label: 'DCC.AbilityStr' },
            agl: { value: 8, mod: -1, label: 'DCC.AbilityAgl' },
            sta: { value: 12, mod: 0, label: 'DCC.AbilitySta' },
            int: { value: 14, mod: 1, label: 'DCC.AbilityInt' },
            per: { value: 16, mod: 2, label: 'DCC.AbilityPer' },
            lck: { value: 18, mod: 3, label: 'DCC.AbilityLck' }
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
            frt: { value: -1 },
            ref: { value: 0 },
            wil: { value: +2 }
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
            level: {
              value: 1
            }
          },
          class: {
            luckDie: '1d3',
            spellCheck: 3,
            spellCheckAbility: 'int'
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
            capLevel: false,
            maxLevel: 0,
            rollAttackBonus: false,
            computeAC: false,
            baseACAbility: 'agl',
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
    // console.log('Mock Actor: super prepareData was called')
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

global.actor = new ActorMock()
global.Actor = ActorMock

/**
 * ChatMessage
 */
class ChatMessageMock {
  static getSpeaker = vi.fn(({ scene, actor, token, alias } = {}) => { return actor })
  static applyRollMode = vi.fn()

  constructor (data, options = {}) { if (data) { this.data = data } }
}

global.ChatMessage = ChatMessageMock

/**
 * CONFIG
 */
global.CONFIG = { DCC }
global.CONFIG.sounds = { dice: 'diceSound' }
global.CONST = { CHAT_MESSAGE_STYLES: { EMOTE: 'emote' } }

/**
 * Localization
 */
class Localization {
  localize (stringId) {
    // Just strip the DCC off the string ID to simulate the lookup
    return stringId.replace('DCC.', '')
  }

  format (stringId, data = {}) {
    let returnString = stringId.replace('DCC.', '')
    for (const datum in data) {
      returnString += `,${datum}:${data[datum]}`
    }
    returnString += data.toString()
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
}

global.Game = Game
global.game = new Game()
global.game.user = { _id: 1 }
global.getDCCSkillTableMock = vi.fn((skillName) => { return null }).mockName('game.dcc.getSkillTable')
global.processSpellCheckMock = vi.fn((actor, spellData) => { }).mockName('game.dcc.processSpellCheck')
global.calculateCritAdjustment = vi.fn((original, adjusted) => { return 0 }).mockName('game.dcc.DiceChain.calculateCritAdjustment')
global.updateFlagsMock = vi.fn((flags, roll) => { }).mockName('game.dcc.FleetingLuck.updateFlags')
global.game.dcc = {
  DCCRoll,
  getSkillTable: global.getDCCSkillTableMock,
  processSpellCheck: global.processSpellCheckMock,
  DiceChain: {
    calculateCritAdjustment: global.calculateCritAdjustment
  },
  FleetingLuck: {
    updateFlags: global.updateFlagsMock
  }
}

/**
 * Settings
 */
global.gameSettingsGetMock = vi.fn((module, key) => {}).mockName('game.settings.get')

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
const Notifications = vi.fn().mockImplementation(() => {
  return {
    warn: global.uiNotificationsWarnMock,
    error: global.uiNotificationsErrorMock
  }
}).mockName('Notifications')
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
 */
global.loadTemplates = vi.fn((templateList) => {}).mockName('loadTemplates')
