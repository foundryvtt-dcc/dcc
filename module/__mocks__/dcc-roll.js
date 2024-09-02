import { vi } from 'vitest'
import Roll from './roll.js'

/**
 * Mocks for DCCRoll
 */
global.dccRollCreateRollMock = vi.fn((formula, data, options) => {
  if (formula instanceof String) {
    return new Roll(formula, data)
  } else {
    return new Roll('1d20')
  }
})
global.dccRollCleanFormulaMock = vi.fn((terms) => {})
global.dccRollCleanTermsMock = vi.fn((terms) => {})
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
