/* eslint-env jest */

import Roll from './roll.js'

/**
 * Mocks for DCCRoll
 */
global.dccRollCreateRollMock = jest.fn((formula, data, options) => {
  if (formula instanceof String) {
    return new Roll(formula, data)
  } else {
    return new Roll('1d20')
  }
})
global.dccRollCleanFormulaMock = jest.fn((terms) => {})
global.dccRollCleanTermsMock = jest.fn((terms) => {})
class DCCRoll {
  static async createRoll (formula, data = {}, options = {}) {
    return global.dccRollCreateRollMock(formula, data, options)
  }

  static cleanFormula (terms) {
    return global.dccRollCleanFormulaMock(terms)
  }

  static cleanTerms (terms) {
    return global.dccRollCleanTermsMock(terms)
  }
}

export default DCCRoll
