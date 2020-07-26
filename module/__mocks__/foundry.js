/* eslint-env jest */
import DCC from '../config.js'

//console.log('Loading Foundry Mocks')

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
            str: { value: 6 },
            agl: { value: 8 },
            sta: { value: 12 },
            int: { value: 14 },
            per: { value: 16 },
            lck: { value: 18 }
          },
          attributes: {
            init: { value: -1 }
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
          }
        }
      }
    }
    this.prepareData()
  }

  prepareData () {
    //console.log('Mock Actor: super prepareData was called')
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
  //console.log('Mock Roll: toMessage was called with:')
  //console.log(data)
})
global.rollRollMock = jest.fn(() => {
  //console.log('Mock Roll: roll was called')
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
    create: jest.fn(((messageData = {}) => {
      // console.log(messageData)
    }))
  }
}