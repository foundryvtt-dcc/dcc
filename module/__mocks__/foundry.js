/* eslint-env jest */
import DCC from '../config.js'

// console.log('Loading Foundry Mocks')

/**
 * Item
 */
const Item = jest.fn().mockImplementation(() => {
}).mockName('Item')
global.Item = Item

/**
 * Collection
 */
global.collectionFindMock = jest.fn()
const Collection = jest.fn().mockImplementation(() => {
  return {
    find: global.collectionFindMock
  }
}).mockName('Collection')
global.Collection = Collection

/**
 * Actor
 */
class Actor {
  constructor (data, options) {
    // If test-specific data is passed in use it, otherwise use default data
    if (data) {
      this.data = data
    } else {
      this._id = 1
      this.name = 'test character'
      this.data = {
        data: {
          abilities: {
            str: { value: 6, label: 'DCC.AbilityStr' },
            agl: { value: 8, label: 'DCC.AbilityAgl' },
            sta: { value: 12, label: 'DCC.AbilitySta' },
            int: { value: 14, label: 'DCC.AbilityInt' },
            per: { value: 16, label: 'DCC.AbilityPer' },
            lck: { value: 18, label: 'DCC.AbilityLck' }
          },
          attributes: {
            init: { value: -1 },
            actionDice: { value: '1d20' }
          },
          items: {
            weapons: {
              m1: { toHit: 1, name: 'longsword' }
            }
          },
          saves: {
            frt: { value: -1 },
            ref: { value: 0 },
            wil: { value: +12 }
          },
          details: {
            attackBonus: 0
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
            actionDieSkillWithLck: {
              label: 'Action Die Skill With Lck',
              ability: 'lck',
              value: +4
            }
          }
        }
      }
    }
    this.items = new Collection()
    this.prepareData()
  }

  prepareData () {
    // console.log('Mock Actor: super prepareData was called')
  }
}

global.actor = new Actor()
global.Actor = Actor

/**
 * ChatMessage
 */
class ChatMessage {
  constructor (data, options) {
    // If test-specific data is passed in use it, otherwise use default data
    if (data) {
      this.data = data
    }
  }

  static getSpeaker ({ scene, actor, token, alias } = {}) {
    return actor
  }
}

global.ChatMessage = ChatMessage

/**
 * CONFIG
 */
global.CONFIG = { DCC: DCC }
global.CONFIG.sounds = { dice: 'diceSound' }
global.CONST = { CHAT_MESSAGE_TYPES: { EMOTE: 'emote' } }

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

/**
 * Roll
 */
global.rollToMessageMock = jest.fn((messageData = {}, { rollMode = null, create = true } = {}) => {
  // console.log('Mock Roll: toMessage was called with:')
  // console.log(data)
})
global.rollRollMock = jest.fn(() => {
  // console.log('Mock Roll: roll was called')
  return { total: 1 }
})
global.Roll = jest.fn((formula, data = {}) => {
  return {
    dice: [{ results: [10] }],
    toMessage: global.rollToMessageMock,
    roll: global.rollRollMock
  }
}).mockName('Roll')

/**
 * ChatMessage
 */
global.CONFIG.ChatMessage = {
  entityClass: {
    create: jest.fn((messageData = {}) => {
      // console.log(messageData)
    })
  }
}

/**
 * Notifications
 */
global.uiNotificationsWarnMock = jest.fn((message, options) => {})
global.uiNotificationsErrorMock = jest.fn((message, type, permenant) => {})
const Notifications = jest.fn().mockImplementation(() => {
  return {
    warn: global.uiNotificationsWarnMock,
    error: global.uiNotificationsErrorMock
  }
}).mockName('Notifications')
global.ui = {
  notifications: new Notifications()
}

/**
 * Handlebars
 */
global.loadTemplates = jest.fn((templateList) => {}).mockName('loadTemplates')
