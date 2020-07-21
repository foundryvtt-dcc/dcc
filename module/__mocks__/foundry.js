console.log('Loading Foundry Mocks')

import DCC from '../config.js'

/**
 * Actor
 */
class Actor {
  constructor (data, options) {
    // If test-specific data is passed in use it, otherwise use default data
    if (data) {
      this.data = data
    } else {
      this.data = {
        'data': {
          'abilities': {
            'str': { 'value': 6 },
            'agl': { 'value': 8 },
            'sta': { 'value': 12 },
            'int': { 'value': 14 },
            'per': { 'value': 16 },
            'lck': { 'value': 18 }
          }
        }
      }
    }
    this.prepareData()
  }

  prepareData () {
    console.log('Mock Actor: super prepareData was called')
  }
}

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
    return global.Actor
  }
}

global.ChatMessage = ChatMessage

/**
 * CONFIG
 */
global
  .CONFIG = { 'DCC': DCC }

/**
 * Localization
 */
class Localization {
  localize (stringId) {
    //Just strip the DCC off the string ID to simulate the lookup
    return stringId.replace('DCC.', '')
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

/**
 * Roll
 */
class Roll {
  constructor (formula, data = {}) {
    this.formula = formula
    this.data = data
    console.log('Mock Roll: constructor was called')
  }

  roll () {
    console.log('Mock Roll: roll was called')
  }

  toMessage (messageData = {}, { rollMode = null, create = true } = {}) {
    console.log(messageData)
  }
}

global.Roll = jest.fn(() => {
  return {
    toMessage: (data) => {console.log(data)}
  }
})