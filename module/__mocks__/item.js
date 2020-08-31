/* eslint-env jest */

/**
 * DCCItem
 */
global.dccItemRollSpellCheckMock = jest.fn((options) => {})
class DCCItem {
  constructor (name = null, data = {}) {
    this.name = name
    this.data = data
  }

  rollSpellCheck (...args) {
    return global.dccItemRollSpellCheckMock(...args)
  }
}
global.DCCItem = DCCItem
