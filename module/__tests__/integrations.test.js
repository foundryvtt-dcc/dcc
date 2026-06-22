/**
 * Unit coverage for the module-integration guards
 * (`module/integrations.mjs`). Stubs `globalThis.game.modules.get`; no live
 * Foundry boot. Mirrors the mocking pattern in `table-loading.test.js`.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DCC_QOL_MODULE_ID, qolHandlingCombat } from '../integrations.mjs'

let originalGame

beforeEach(() => {
  originalGame = globalThis.game
  globalThis.game = { modules: { get: vi.fn() } }
})

afterEach(() => {
  globalThis.game = originalGame
})

describe('qolHandlingCombat', () => {
  test('queries the dcc-qol module by id', () => {
    globalThis.game.modules.get.mockReturnValue({ active: true })

    qolHandlingCombat()

    expect(globalThis.game.modules.get).toHaveBeenCalledWith(DCC_QOL_MODULE_ID)
    expect(DCC_QOL_MODULE_ID).toBe('dcc-qol')
  })

  test('returns true when dcc-qol is installed and active', () => {
    globalThis.game.modules.get.mockReturnValue({ active: true })
    expect(qolHandlingCombat()).toBe(true)
  })

  test('returns false when dcc-qol is installed but disabled', () => {
    globalThis.game.modules.get.mockReturnValue({ active: false })
    expect(qolHandlingCombat()).toBe(false)
  })

  test('returns false when dcc-qol is not installed', () => {
    globalThis.game.modules.get.mockReturnValue(undefined)
    expect(qolHandlingCombat()).toBe(false)
  })
})
