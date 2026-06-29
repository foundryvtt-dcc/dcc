/**
 * Unit coverage for the Handlebars helpers extracted from `module/dcc.js`.
 *
 * The helpers are pure modulo the `Handlebars` / `game.packs` globals,
 * which we stub here so the assertions don't need a live Foundry boot.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { actionDieLabel, add, dccPackExists, distanceFormat, registerDCCHandlebarsHelpers, stringify } from '../handlebars-helpers.mjs'

describe('add', () => {
  test('sums two integers', () => {
    expect(add(2, 3)).toBe(5)
  })

  test('parseInt-coerces string operands', () => {
    expect(add('7', '4')).toBe(11)
  })

  test('handles negative values', () => {
    expect(add(-2, 5)).toBe(3)
  })
})

describe('stringify', () => {
  test('returns JSON for a plain object', () => {
    expect(stringify({ a: 1, b: 'x' })).toBe('{"a":1,"b":"x"}')
  })

  test('returns JSON for an array', () => {
    expect(stringify([1, 2, 3])).toBe('[1,2,3]')
  })
})

describe('distanceFormat', () => {
  test('strips trailing apostrophe and re-adds it', () => {
    expect(distanceFormat("30'")).toBe("30'")
  })

  test('appends apostrophe when missing', () => {
    expect(distanceFormat('30')).toBe("30'")
  })

  test('handles negative distances', () => {
    expect(distanceFormat("-10'")).toBe("-10'")
  })

  test('returns empty string when no integer matches', () => {
    expect(distanceFormat('abc')).toBe('')
  })
})

describe('dccPackExists', () => {
  let originalGame
  let originalHandlebars

  beforeEach(() => {
    originalGame = globalThis.game
    originalHandlebars = globalThis.Handlebars
    globalThis.Handlebars = {
      SafeString: class SafeString {
        constructor (value) { this.value = value }
        toString () { return this.value }
      }
    }
  })

  afterEach(() => {
    globalThis.game = originalGame
    globalThis.Handlebars = originalHandlebars
  })

  test('emits the fn branch when the pack exists', () => {
    globalThis.game = { packs: { get: vi.fn(() => ({ id: 'present' })) } }
    const options = { fn: vi.fn(() => 'present'), inverse: vi.fn(() => 'absent') }

    const result = dccPackExists('dcc.someTable', options)

    expect(globalThis.game.packs.get).toHaveBeenCalledWith('dcc.someTable')
    expect(options.fn).toHaveBeenCalledTimes(1)
    expect(options.inverse).not.toHaveBeenCalled()
    expect(result.toString()).toBe('present')
  })

  test('emits the inverse branch when the pack is missing', () => {
    globalThis.game = { packs: { get: vi.fn(() => undefined) } }
    const options = { fn: vi.fn(() => 'present'), inverse: vi.fn(() => 'absent') }

    const result = dccPackExists('dcc.missing', options)

    expect(options.fn).not.toHaveBeenCalled()
    expect(options.inverse).toHaveBeenCalledTimes(1)
    expect(result.toString()).toBe('absent')
  })
})

describe('registerDCCHandlebarsHelpers', () => {
  let originalHandlebars

  beforeEach(() => {
    originalHandlebars = globalThis.Handlebars
    globalThis.Handlebars = { registerHelper: vi.fn() }
  })

  afterEach(() => {
    globalThis.Handlebars = originalHandlebars
  })

  test('registers add / stringify / distanceFormat / dccPackExists / actionDieLabel by name', () => {
    registerDCCHandlebarsHelpers()

    const registered = Object.fromEntries(globalThis.Handlebars.registerHelper.mock.calls)
    expect(Object.keys(registered).sort()).toEqual(['actionDieLabel', 'add', 'dccPackExists', 'distanceFormat', 'stringify'])
    expect(registered.add).toBe(add)
    expect(registered.stringify).toBe(stringify)
    expect(registered.distanceFormat).toBe(distanceFormat)
    expect(registered.dccPackExists).toBe(dccPackExists)
    expect(registered.actionDieLabel).toBe(actionDieLabel)
  })

  describe('actionDieLabel', () => {
    test('prefixes a bare die with 1 and renders a positive rider', () => {
      expect(actionDieLabel({ die: 'd20', modifier: 0 })).toBe('1d20')
      expect(actionDieLabel({ die: 'd20', modifier: 4 })).toBe('1d20+4')
    })

    test('renders a negative rider and leaves explicit counts alone', () => {
      expect(actionDieLabel({ die: 'd16', modifier: -1 })).toBe('1d16-1')
      expect(actionDieLabel({ die: '2d6', modifier: 0 })).toBe('2d6')
    })

    test('is defensive against malformed slots', () => {
      expect(actionDieLabel(undefined)).toBe('')
      expect(actionDieLabel({})).toBe('')
    })
  })
})
