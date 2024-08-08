/* eslint-env jest */

/**
 * Mocks for Foundry's Roll class
 */

/**
 * Roll
 */
global.rollToMessageMock = jest.fn((messageData = {}, { rollMode = null, create = true } = {}) => {
  // console.log('Mock Roll: toMessage was called with:')
  // console.log(data)
})
global.rollEvaluateMock = jest.fn(() => {
  // console.log('Mock Roll: roll was called')
  return new Promise((resolve, reject) => {
    process.nextTick(() => {resolve({ total: 2 })})
  })
})
global.rollValidateMock = jest.fn((formula) => {
  return true
})
global.rollTermsMock = [
  {
    "class": "Die",
    "options": {
      "flavor": null
    },
    "evaluated": false,
    "number": 1,
    "faces": 20,
    "modifiers": [],
    "results": []
  }
]
const Roll = jest.fn((formula, data = {}) => {
  return {
    dice: [{ results: [10], options: {} }],
    toMessage: global.rollToMessageMock,
    evaluate: global.rollEvaluateMock,
    roll: global.rollEvaluateMock,
    terms: global.rollTermsMock
  }
}).mockName('Roll')
global.Roll = Roll
global.Roll.validate = global.rollValidateMock

export default Roll
