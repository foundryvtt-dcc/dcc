/**
 * Unit coverage for module/defeated.mjs — the shared "mark dead like the
 * combat tracker's skull button" helper used by auto-dead-status.mjs and
 * death-clock.mjs.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { isActorDefeated, markActorDefeated, markActorRecovered } from '../defeated.mjs'

let original

function makeActor ({ statuses = [], effects = [] } = {}) {
  return {
    statuses: new Set(statuses),
    effects: effects.map(s => ({ statuses: new Set([s]) })),
    toggleStatusEffect: vi.fn().mockResolvedValue(undefined)
  }
}

beforeEach(() => {
  original = { game: globalThis.game, CONFIG: globalThis.CONFIG }
  globalThis.game = { combats: { contents: [] } }
  globalThis.CONFIG = { specialStatusEffects: { DEFEATED: 'dead' } }
})

afterEach(() => {
  globalThis.game = original.game
  globalThis.CONFIG = original.CONFIG
})

describe('markActorDefeated', () => {
  test('applies the dead status as a token overlay', async () => {
    const actor = makeActor()
    await markActorDefeated(actor)
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('dead', { active: true, overlay: true })
  })

  test('leaves an already-dead actor\'s effect alone', async () => {
    await markActorDefeated(makeActor({ statuses: ['dead'] }))
    await markActorDefeated(makeActor({ effects: ['dead'] }))
    expect(true).toBe(true) // neither call throws...
    const dead = makeActor({ statuses: ['dead'] })
    await markActorDefeated(dead)
    expect(dead.toggleStatusEffect).not.toHaveBeenCalled()
  })

  test('sets defeated on the actor\'s combatants in every active combat, like the skull button', async () => {
    const actor = makeActor()
    const mine = { actor, defeated: false, update: vi.fn().mockResolvedValue(undefined) }
    const alreadyDefeated = { actor, defeated: true, update: vi.fn() }
    const other = { actor: makeActor(), defeated: false, update: vi.fn() }
    globalThis.game.combats.contents = [
      { combatants: { filter: (fn) => [mine, alreadyDefeated, other].filter(fn) } },
      { combatants: { filter: (fn) => [].filter(fn) } }
    ]

    await markActorDefeated(actor)
    expect(mine.update).toHaveBeenCalledWith({ defeated: true })
    expect(alreadyDefeated.update).not.toHaveBeenCalled()
    expect(other.update).not.toHaveBeenCalled()
  })

  test('respects a system-configured DEFEATED status id', async () => {
    globalThis.CONFIG.specialStatusEffects.DEFEATED = 'unconscious'
    const actor = makeActor()
    await markActorDefeated(actor)
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('unconscious', { active: true, overlay: true })
  })
})

describe('markActorRecovered', () => {
  test('removes the dead status from a dead actor', async () => {
    const actor = makeActor({ statuses: ['dead'] })
    await markActorRecovered(actor)
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('dead', { active: false })
  })

  test('leaves a living actor\'s effects alone', async () => {
    const actor = makeActor()
    await markActorRecovered(actor)
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled()
  })

  test('clears defeated on the actor\'s combatants, like un-clicking the skull button', async () => {
    const actor = makeActor({ statuses: ['dead'] })
    const mine = { actor, defeated: true, update: vi.fn().mockResolvedValue(undefined) }
    const alive = { actor, defeated: false, update: vi.fn() }
    const other = { actor: makeActor(), defeated: true, update: vi.fn() }
    globalThis.game.combats.contents = [
      { combatants: { filter: (fn) => [mine, alive, other].filter(fn) } }
    ]

    await markActorRecovered(actor)
    expect(mine.update).toHaveBeenCalledWith({ defeated: false })
    expect(alive.update).not.toHaveBeenCalled()
    expect(other.update).not.toHaveBeenCalled()
  })
})

describe('isActorDefeated', () => {
  test('reads the derived status set and the live effects', () => {
    expect(isActorDefeated(makeActor())).toBe(false)
    expect(isActorDefeated(makeActor({ statuses: ['dead'] }))).toBe(true)
    expect(isActorDefeated(makeActor({ effects: ['dead'] }))).toBe(true)
  })
})
