/**
 * Unit coverage for the Death Clock tracker (issue #843, phase 2) — the
 * DCC Tools sidebar tool listing bleeding-out PCs with judge controls.
 * The death-clock state helpers are mocked so the assertions drive the
 * tracker's own wiring: the sidebar-tool listener, the dialog context,
 * and the refresh hooks.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'

vi.mock('../death-clock.mjs', () => ({
  DYING_STATUS_ID: 'dying',
  adjustDeathClock: vi.fn(),
  expireDeathClock: vi.fn(),
  getDeathClockRemaining: vi.fn(() => 2),
  getDyingEffect: vi.fn(actor => actor?.dying),
  stabilizeDeathClock: vi.fn(),
  tickDeathClock: vi.fn()
}))

const deathClock = await import('../death-clock.mjs')
const {
  DeathClockTracker,
  onGetSidebarToolsForDeathClock,
  registerDeathClockTracker
} = await import('../death-clock-tracker.mjs')

let original

function makeActor ({ dying = null, type = 'Player' } = {}) {
  return { id: 'a1', name: 'Test PC', img: 'img.webp', type, dying }
}

beforeEach(() => {
  vi.clearAllMocks()
  deathClock.getDeathClockRemaining.mockReturnValue(2)
  deathClock.getDyingEffect.mockImplementation(actor => actor?.dying)
  original = { game: globalThis.game, Hooks: globalThis.Hooks }
  globalThis.game = {
    settings: { get: vi.fn((scope, key) => key === 'enableDeathClock') },
    user: { isGM: true },
    actors: []
  }
  globalThis.Hooks = { on: vi.fn() }
  DeathClockTracker.dialog = null
})

afterEach(() => {
  globalThis.game = original.game
  globalThis.Hooks = original.Hooks
})

describe('onGetSidebarToolsForDeathClock', () => {
  test('contributes the Death Clock tool while the setting is enabled', () => {
    const tools = {}
    onGetSidebarToolsForDeathClock(tools)
    expect(tools.deathClock).toMatchObject({
      label: 'DCC.DeathClock',
      icon: 'fas fa-heart-pulse',
      help: expect.stringContaining('Death-Clock')
    })
    expect(tools.deathClock.onClick).toBeInstanceOf(Function)
  })

  test('contributes nothing while the setting is off', () => {
    globalThis.game.settings.get.mockReturnValue(false)
    const tools = {}
    onGetSidebarToolsForDeathClock(tools)
    expect(tools.deathClock).toBeUndefined()
  })
})

describe('registerDeathClockTracker', () => {
  test('wires the sidebar-tool listener and the effect refresh hooks', () => {
    registerDeathClockTracker()
    const hookNames = globalThis.Hooks.on.mock.calls.map(c => c[0])
    expect(hookNames).toContain('dcc.getSidebarTools')
    expect(hookNames).toEqual(expect.arrayContaining(
      ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect']))
    expect(globalThis.Hooks.on).toHaveBeenCalledWith('dcc.getSidebarTools', onGetSidebarToolsForDeathClock)
  })

  test('the effect hooks refresh only for Dying effects', async () => {
    registerDeathClockTracker()
    const refresh = vi.spyOn(DeathClockTracker, 'refresh').mockResolvedValue(undefined)
    try {
      const effectListener = globalThis.Hooks.on.mock.calls.find(c => c[0] === 'createActiveEffect')[1]
      effectListener({ statuses: new Set(['dying']) })
      expect(refresh).toHaveBeenCalledTimes(1)
      effectListener({ statuses: new Set(['stunned']) })
      expect(refresh).toHaveBeenCalledTimes(1)
    } finally {
      refresh.mockRestore()
    }
  })
})

describe('DeathClockTracker dialog', () => {
  test('_prepareContext lists only dying Players with their countdowns', async () => {
    const dyingPc = makeActor({ dying: {} })
    const healthyPc = { ...makeActor(), id: 'a2' }
    const dyingNpc = { ...makeActor({ dying: {} }), id: 'a3', type: 'NPC' }
    globalThis.game.actors = [dyingPc, healthyPc, dyingNpc]

    await DeathClockTracker.show()
    const context = await DeathClockTracker.dialog._prepareContext()
    expect(context.dying).toEqual([expect.objectContaining({ id: 'a1', remaining: 2, lastChance: false })])
    expect(context.isGM).toBe(true)
  })

  test('flags the final-chance round in context', async () => {
    deathClock.getDeathClockRemaining.mockReturnValue(0)
    globalThis.game.actors = [makeActor({ dying: {} })]
    await DeathClockTracker.show()
    const context = await DeathClockTracker.dialog._prepareContext()
    expect(context.dying[0].lastChance).toBe(true)
  })

  test('show() toggles the dialog open and closed', async () => {
    await DeathClockTracker.show()
    expect(DeathClockTracker.dialog).not.toBeNull()
    const dialog = DeathClockTracker.dialog
    dialog.close = vi.fn().mockResolvedValue(undefined)
    await DeathClockTracker.show()
    expect(dialog.close).toHaveBeenCalledTimes(1)
    expect(DeathClockTracker.dialog).toBeNull()
  })
})
