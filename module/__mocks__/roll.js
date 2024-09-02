/**
 * Mocks for Foundry's Roll class
 */

import { vi } from 'vitest'

/**
 * Roll
 */
global.rollToMessageMock = vi.fn((messageData = {}, { rollMode = null, create = true } = {}) => {
  // console.log('Mock Roll: toMessage was called with:')
  // console.log(data)
})
global.rollEvaluateMock = vi.fn(() => {
  // console.log('Mock Roll: roll was called')
  return new Promise((resolve, reject) => {
    process.nextTick(() => { resolve({ total: 2 }) })
  })
})
global.rollValidateMock = vi.fn((formula) => {
  return true
})
const Roll = vi.fn((formula, data = {}) => {
  return {
    dice: [{ results: [10], options: {} }],
    toMessage: global.rollToMessageMock,
    evaluate: global.rollEvaluateMock,
    roll: global.rollEvaluateMock,
    terms: [
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
}).mockName('Roll')
global.Roll = Roll
global.Roll.validate = global.rollValidateMock

export default Roll
