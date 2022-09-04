/* eslint-env jest */

/**
 * DCCItem
 */
global.dccItemRollSpellCheckMock = jest.fn((options) => {})
class DCCItem {
  constructor (name = null, type = undefined, systemData = {}) {
    this.name = name
    this.type = type
    this.system = systemData
  }

  rollSpellCheck (...args) {
    return global.dccItemRollSpellCheckMock(...args)
  }
}
global.DCCItem = DCCItem
