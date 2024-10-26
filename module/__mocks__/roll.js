/**
 * Mocks for Foundry's Roll class
 */

import { vi } from 'vitest'

/**
 * Roll
 */
global.rollToMessageMock = vi.fn((messageData = {}, { rollMode = null, create = true } = {}) => {
  // console.log('Mock Roll: toMessage was called with:')
  // console.log(messageData)
})
global.rollEvaluateMock = vi.fn(() => {
  // console.log('Mock Roll: roll was called')
  return new Promise((resolve, reject) => {
    process.nextTick(() => { resolve({ total: 2 }) })
  })
})
global.rollParseMock = vi.fn((formula) => {
  return [{ die: { faces: 4 } }]
})
global.rollRenderMock = vi.fn((formula) => {
  return ''
})
global.rollValidateMock = vi.fn((formula) => {
  return true
}).mockName('validate')

class RollMock {
  dice = [{ results: [10], options: {} }]
  toMessage = global.rollToMessageMock
  evaluate = global.rollEvaluateMock
  parse = global.rollParseMock
  render = global.rollRenderMock
  roll = global.rollEvaluateMock

  static validate () {
    return true
  }

  constructor (rollData) {
    this.rollData = rollData
  }

  options = {}
  terms = [
    {
      class: 'Die',
      options: {
        flavor: null
      },
      evaluated: false,
      number: 1,
      faces: 20,
      modifiers: [],
      results: []
    }
  ]
}

global.Roll = RollMock

export default RollMock
