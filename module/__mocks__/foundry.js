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
global
  .CONFIG = { DCC: DCC }

/**
 * Localization
 */
class Localization {
  localize (stringId) {
    // Just strip the DCC off the string ID to simulate the lookup
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
global.rollToMessageMock = jest.fn((data) => {
  //console.log('Mock Roll: toMessage was called with:')
  //console.log(data)
})
global.Roll = jest.fn(() => {
  return {
    toMessage: global.rollToMessageMock
  }
}).mockName('Roll')
