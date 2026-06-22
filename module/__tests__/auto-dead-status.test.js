/**
 * Unit coverage for module/auto-dead-status.mjs. The socket module is mocked so
 * the active-GM gate can be toggled; no Foundry boot.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../socket.mjs', () => ({ isActiveGM: vi.fn(() => true) }))

const { isActiveGM } = await import('../socket.mjs')
const { onUpdateActorForDeath } = await import('../auto-dead-status.mjs')

let originalGame

function makeNpc ({ statuses = [], effects = [], type = 'NPC' } = {}) {
  return {
    type,
    statuses: new Set(statuses),
    effects: effects.map(s => ({ statuses: new Set([s]) })),
    toggleStatusEffect: vi.fn()
  }
}

const hpChange = (value) => ({ system: { attributes: { hp: { value } } } })

beforeEach(() => {
  vi.clearAllMocks()
  isActiveGM.mockReturnValue(true)
  originalGame = globalThis.game
  globalThis.game = {
    modules: { get: vi.fn(() => undefined) }, // dcc-qol inactive
    settings: { get: vi.fn(() => true) } // autoApplyDeadStatus on
  }
})

afterEach(() => {
  globalThis.game = originalGame
})

describe('onUpdateActorForDeath', () => {
  test('applies dead to an NPC dropped to 0 HP', async () => {
    const npc = makeNpc()
    await onUpdateActorForDeath(npc, hpChange(0))
    expect(npc.toggleStatusEffect).toHaveBeenCalledWith('dead', { active: true })
  })

  test('applies dead when HP goes negative', async () => {
    const npc = makeNpc()
    await onUpdateActorForDeath(npc, hpChange(-4))
    expect(npc.toggleStatusEffect).toHaveBeenCalledOnce()
  })

  test('does nothing when HP stays above 0', async () => {
    const npc = makeNpc()
    await onUpdateActorForDeath(npc, hpChange(3))
    expect(npc.toggleStatusEffect).not.toHaveBeenCalled()
  })

  test('does nothing when the update does not change HP', async () => {
    const npc = makeNpc()
    await onUpdateActorForDeath(npc, { system: { attributes: { ac: { value: 12 } } } })
    expect(npc.toggleStatusEffect).not.toHaveBeenCalled()
  })

  test('does not re-apply when already dead (via the status set)', async () => {
    const npc = makeNpc({ statuses: ['dead'] })
    await onUpdateActorForDeath(npc, hpChange(0))
    expect(npc.toggleStatusEffect).not.toHaveBeenCalled()
  })

  test('does not re-apply when a dead effect is already present (status set lagging)', async () => {
    const npc = makeNpc({ effects: ['dead'] }) // statuses empty, but the effect exists
    await onUpdateActorForDeath(npc, hpChange(0))
    expect(npc.toggleStatusEffect).not.toHaveBeenCalled()
  })

  test('ignores player characters (they are dying, not dead)', async () => {
    const pc = makeNpc({ type: 'Player' })
    await onUpdateActorForDeath(pc, hpChange(0))
    expect(pc.toggleStatusEffect).not.toHaveBeenCalled()
  })

  test('stands down when dcc-qol is active', async () => {
    globalThis.game.modules.get.mockReturnValue({ active: true })
    const npc = makeNpc()
    await onUpdateActorForDeath(npc, hpChange(0))
    expect(npc.toggleStatusEffect).not.toHaveBeenCalled()
  })

  test('does nothing when the setting is off', async () => {
    globalThis.game.settings.get.mockReturnValue(false)
    const npc = makeNpc()
    await onUpdateActorForDeath(npc, hpChange(0))
    expect(npc.toggleStatusEffect).not.toHaveBeenCalled()
  })

  test('only the active GM applies the status', async () => {
    isActiveGM.mockReturnValue(false)
    const npc = makeNpc()
    await onUpdateActorForDeath(npc, hpChange(0))
    expect(npc.toggleStatusEffect).not.toHaveBeenCalled()
  })
})
