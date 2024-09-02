import { vi } from 'vitest'

/**
 * DCCItem
 */
global.dccItemRollSpellCheckMock = vi.fn((options) => {})
class DCCItemMock {
  constructor (name = null, type = undefined, systemData = {}) {
    this.name = name
    this.type = type
    this.system = systemData
  }

  rollSpellCheck (...args) {
    return global.dccItemRollSpellCheckMock(...args)
  }
}
global.DCCItem = DCCItemMock
