/**
 * Unit coverage for the owned-token-vision feature (issue #872).
 *
 * `isOwnedTokenVisionSource` is exercised against the shared foundry mock's
 * `game` / `canvas` globals with plain token stubs; `registerTokenVision` is
 * checked against a stand-in core Token class, and the setting's onChange
 * perception refresh against the mock's captured registration. The
 * live-Foundry behavior (vision-source evaluation during canvas draw) is
 * covered by `browser-tests/e2e/token-vision.spec.js`.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

import '../__mocks__/foundry.js'

import { isOwnedTokenVisionSource, registerTokenVision } from '../token-vision.mjs'

vi.mock('../settings-menus.mjs', () => ({
  DCCEnhancedCombatSettings: class {},
  DCCTableSettings: class {},
  DCCActionDiceSettings: class {}
}))

/** A token stub satisfying every owned-token-vision requirement. */
function makeToken (overrides = {}) {
  return {
    hasSight: true,
    document: { level: 0, hidden: false },
    actor: { testUserPermission: vi.fn().mockReturnValue(true) },
    ...overrides
  }
}

beforeEach(() => {
  global.game.user = { _id: 1, isGM: false }
  global.canvas.visibility.tokenVision = true
  global.canvas.level = { id: 0 }
  global.gameSettingsGetMock.mockClear()
})

describe('isOwnedTokenVisionSource', () => {
  test('an owned, sighted, visible token on the viewed level provides vision', () => {
    const token = makeToken()
    expect(isOwnedTokenVisionSource(token)).toBe(true)
    expect(token.actor.testUserPermission).toHaveBeenCalledWith(global.game.user, 'OBSERVER')
  })

  test('never applies to GM users', () => {
    global.game.user.isGM = true
    expect(isOwnedTokenVisionSource(makeToken())).toBe(false)
  })

  test('does nothing while the ownedTokenVision setting is off', () => {
    global.gameSettingsGetMock.mockReturnValueOnce(false)
    expect(isOwnedTokenVisionSource(makeToken())).toBe(false)
    expect(global.gameSettingsGetMock).toHaveBeenCalledWith('dcc', 'ownedTokenVision')
  })

  test('requires scene token vision', () => {
    global.canvas.visibility.tokenVision = false
    expect(isOwnedTokenVisionSource(makeToken())).toBe(false)
  })

  test('requires the token to have sight enabled', () => {
    expect(isOwnedTokenVisionSource(makeToken({ hasSight: false }))).toBe(false)
  })

  test('ignores tokens on a different scene level', () => {
    expect(isOwnedTokenVisionSource(makeToken({ document: { level: 1, hidden: false } }))).toBe(false)
  })

  test('ignores hidden tokens', () => {
    expect(isOwnedTokenVisionSource(makeToken({ document: { level: 0, hidden: true } }))).toBe(false)
  })

  test('requires OBSERVER permission on the actor', () => {
    const token = makeToken()
    token.actor.testUserPermission.mockReturnValue(false)
    expect(isOwnedTokenVisionSource(token)).toBe(false)
  })

  test('tolerates tokens with no actor', () => {
    expect(isOwnedTokenVisionSource(makeToken({ actor: null }))).toBe(false)
  })
})

describe('registerTokenVision', () => {
  test('registers a Token subclass that ORs the owned-token rule into _isVisionSource', () => {
    class CoreToken {
      _isVisionSource () {
        return this.coreResult
      }
    }
    global.foundry.canvas = { placeables: { Token: CoreToken } }
    global.CONFIG.Token = {}

    registerTokenVision()

    const DCCToken = global.CONFIG.Token.objectClass
    expect(Object.getPrototypeOf(DCCToken)).toBe(CoreToken)

    const token = Object.assign(new DCCToken(), makeToken())

    // Core's own rule (e.g. a controlled token) still wins outright
    token.coreResult = true
    expect(token._isVisionSource()).toBe(true)

    // Core says no (another token is controlled) → owned-token rule applies
    token.coreResult = false
    expect(token._isVisionSource()).toBe(true)

    // ... but not when the setting is off
    global.gameSettingsGetMock.mockReturnValueOnce(false)
    expect(token._isVisionSource()).toBe(false)
  })
})

describe('ownedTokenVision setting onChange', () => {
  test('re-initializes vision sources on change, only while the canvas is ready', async () => {
    const registrations = {}
    global.game.settings.register = vi.fn((namespace, key, config) => { registrations[key] = config })
    const { registerEarlySystemSettings } = await import('../settings.js')
    registerEarlySystemSettings()

    const config = registrations.ownedTokenVision
    expect(config.scope).toBe('world')
    expect(config.default).toBe(true)

    global.canvasPerceptionUpdateMock.mockClear()
    global.canvas.ready = true
    config.onChange()
    expect(global.canvasPerceptionUpdateMock).toHaveBeenCalledWith({ initializeVision: true })

    global.canvasPerceptionUpdateMock.mockClear()
    global.canvas.ready = false
    config.onChange()
    expect(global.canvasPerceptionUpdateMock).not.toHaveBeenCalled()
    global.canvas.ready = true
  })
})
