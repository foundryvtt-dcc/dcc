/**
 * Unit coverage for the native system socket (module/socket.mjs). Stubs
 * game.user / game.users.activeGM / game.socket; no Foundry boot. The
 * module-private handler registry persists across tests, so each test uses a
 * unique action name.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DCC_SOCKET, registerSocket, registerSocketHandler, executeAsGM, onSocketMessage } from '../socket.mjs'

let originalGame
let originalUI

/** Configure the current client: 'activeGM' | 'player' | 'secondaryGM' | 'noGM'. */
function setClient (role) {
  const activeGm = { isGM: true }
  const me = role === 'activeGM' ? activeGm : { isGM: role === 'secondaryGM' }
  globalThis.game = {
    user: me,
    users: { activeGM: role === 'noGM' ? null : activeGm },
    socket: { on: vi.fn(), emit: vi.fn() },
    i18n: { localize: (k) => k }
  }
}

beforeEach(() => {
  originalGame = globalThis.game
  originalUI = globalThis.ui
  globalThis.ui = { notifications: { warn: vi.fn() } }
})

afterEach(() => {
  globalThis.game = originalGame
  globalThis.ui = originalUI
})

describe('registerSocket', () => {
  test('subscribes the dispatcher to the system.dcc channel', () => {
    setClient('activeGM')
    registerSocket()
    expect(globalThis.game.socket.on).toHaveBeenCalledWith(DCC_SOCKET, onSocketMessage)
  })
})

describe('executeAsGM', () => {
  test('runs the handler locally (no emit) when this client is the active GM', async () => {
    setClient('activeGM')
    const handler = vi.fn(() => 42)
    registerSocketHandler('local-run', handler)

    const result = await executeAsGM('local-run', { x: 1 })

    expect(result).toBe(42)
    expect(handler).toHaveBeenCalledWith({ x: 1 })
    expect(globalThis.game.socket.emit).not.toHaveBeenCalled()
  })

  test('emits to the GM (and does not run the handler) from a player client', async () => {
    setClient('player')
    const handler = vi.fn()
    registerSocketHandler('emit-player', handler)

    await executeAsGM('emit-player', { dmg: 3 })

    expect(globalThis.game.socket.emit).toHaveBeenCalledWith(DCC_SOCKET, { action: 'emit-player', payload: { dmg: 3 } })
    expect(handler).not.toHaveBeenCalled()
  })

  test('a secondary (non-active) GM also emits rather than running locally', async () => {
    setClient('secondaryGM')
    await executeAsGM('emit-secondary', {})
    expect(globalThis.game.socket.emit).toHaveBeenCalledOnce()
  })

  test('warns and does not emit when no GM is connected', async () => {
    setClient('noGM')
    await executeAsGM('no-gm', {})
    expect(globalThis.ui.notifications.warn).toHaveBeenCalledWith('DCC.SocketNoGMWarning')
    expect(globalThis.game.socket.emit).not.toHaveBeenCalled()
  })
})

describe('onSocketMessage', () => {
  test('the active GM runs the registered handler', async () => {
    setClient('activeGM')
    const handler = vi.fn()
    registerSocketHandler('incoming', handler)

    await onSocketMessage({ action: 'incoming', payload: { a: 1 } })

    expect(handler).toHaveBeenCalledWith({ a: 1 })
  })

  test('non-active-GM clients ignore incoming messages', async () => {
    setClient('player')
    const handler = vi.fn()
    registerSocketHandler('ignored', handler)

    await onSocketMessage({ action: 'ignored', payload: {} })

    expect(handler).not.toHaveBeenCalled()
  })

  test('an unknown action is a no-op (no throw)', async () => {
    setClient('activeGM')
    await expect(onSocketMessage({ action: 'never-registered', payload: {} })).resolves.toBeUndefined()
  })
})
