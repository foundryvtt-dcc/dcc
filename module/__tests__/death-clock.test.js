/**
 * Unit coverage for the death clock (issue #843, phase 1). The handlers are
 * thin adapters over dcc-core-lib's death-and-dying math, so the assertions
 * stub `game` / actors per-test and drive them as plain functions.
 *
 * Mirrors the pattern in auto-dead-status.test.js.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import {
  getDeathClockRemaining,
  getDyingEffect,
  onRenderCombatTrackerForDeathClock,
  onUpdateActorForDeathClock,
  onUpdateCombatForDeathClock,
  tickDeathClock
} from '../death-clock.mjs'

let original

/** Build a Dying effect stub carrying the given clock state. */
function makeDyingEffect (roundsRemaining) {
  return {
    statuses: new Set(['dying']),
    getFlag: vi.fn((scope, key) => (scope === 'dcc' && key === 'deathClock') ? { roundsRemaining } : undefined),
    setFlag: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined)
  }
}

/** Build a Player actor stub. */
function makeActor ({ level = 2, effects = [], statuses = new Set(), type = 'Player' } = {}) {
  return {
    type,
    name: 'Test PC',
    system: { details: { level: { value: level } } },
    effects,
    statuses,
    toggleStatusEffect: vi.fn().mockResolvedValue(undefined),
    createEmbeddedDocuments: vi.fn().mockResolvedValue([])
  }
}

beforeEach(() => {
  original = { game: globalThis.game, ChatMessage: globalThis.ChatMessage, error: console.error }
  const user = { isGM: true }
  globalThis.game = {
    settings: { get: vi.fn((scope, key) => key === 'enableDeathClock') },
    user,
    users: { activeGM: user },
    i18n: {
      localize: vi.fn(key => key),
      format: vi.fn((key, data) => `${key}:${JSON.stringify(data)}`)
    }
  }
  globalThis.game.users.activeGM = globalThis.game.user
  globalThis.ChatMessage = {
    create: vi.fn().mockResolvedValue(undefined),
    getSpeaker: vi.fn(() => ({}))
  }
  console.error = vi.fn()
})

afterEach(() => {
  globalThis.game = original.game
  globalThis.ChatMessage = original.ChatMessage
  console.error = original.error
})

describe('onUpdateActorForDeathClock', () => {
  test('starts the clock when a leveled Player drops to 0 HP', async () => {
    const actor = makeActor({ level: 3 })
    await onUpdateActorForDeathClock(actor, { system: { attributes: { hp: { value: 0 } } } })
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [expect.objectContaining({
      name: 'DCC.StatusDying',
      statuses: ['dying'],
      flags: { dcc: { deathClock: { roundsRemaining: 3 } } }
    })])
    expect(globalThis.ChatMessage.create).toHaveBeenCalledTimes(1)
    expect(globalThis.game.i18n.format).toHaveBeenCalledWith('DCC.DeathClockStarted', expect.objectContaining({ rounds: 3 }))
  })

  test('a 0-level Player dies immediately (no clock)', async () => {
    const actor = makeActor({ level: 0 })
    await onUpdateActorForDeathClock(actor, { system: { attributes: { hp: { value: 0 } } } })
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled()
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('dead', { active: true })
    expect(globalThis.game.i18n.format).toHaveBeenCalledWith('DCC.DeathClockInstantDeath', expect.anything())
  })

  test('does not start a second clock while one is running', async () => {
    const actor = makeActor({ effects: [makeDyingEffect(2)] })
    await onUpdateActorForDeathClock(actor, { system: { attributes: { hp: { value: -2 } } } })
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled()
    expect(globalThis.ChatMessage.create).not.toHaveBeenCalled()
  })

  test('does not start a clock on an already-dead actor', async () => {
    const actor = makeActor({ statuses: new Set(['dead']) })
    await onUpdateActorForDeathClock(actor, { system: { attributes: { hp: { value: 0 } } } })
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled()
  })

  test('healing above 0 clears a running clock', async () => {
    const dying = makeDyingEffect(1)
    const actor = makeActor({ effects: [dying] })
    await onUpdateActorForDeathClock(actor, { system: { attributes: { hp: { value: 4 } } } })
    expect(dying.delete).toHaveBeenCalledTimes(1)
    expect(globalThis.game.i18n.format).toHaveBeenCalledWith('DCC.DeathClockStopped', expect.anything())
  })

  test('ignores non-Player actors, non-HP updates, and runs only when enabled', async () => {
    const npc = makeActor({ type: 'NPC' })
    await onUpdateActorForDeathClock(npc, { system: { attributes: { hp: { value: 0 } } } })
    expect(npc.createEmbeddedDocuments).not.toHaveBeenCalled()

    const actor = makeActor()
    await onUpdateActorForDeathClock(actor, { name: 'renamed' })
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled()

    globalThis.game.settings.get.mockReturnValue(false)
    await onUpdateActorForDeathClock(actor, { system: { attributes: { hp: { value: 0 } } } })
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled()
  })
})

describe('tickDeathClock', () => {
  test('decrements the clock while rounds remain', async () => {
    const dying = makeDyingEffect(3)
    const actor = makeActor({ effects: [dying] })
    await tickDeathClock(actor)
    expect(dying.setFlag).toHaveBeenCalledWith('dcc', 'deathClock', { roundsRemaining: 2 })
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled()
  })

  test('at zero: removes the effect, applies dead status, announces the death', async () => {
    const dying = makeDyingEffect(1)
    const actor = makeActor({ effects: [dying] })
    await tickDeathClock(actor)
    expect(dying.delete).toHaveBeenCalledTimes(1)
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('dead', { active: true })
    expect(globalThis.game.i18n.format).toHaveBeenCalledWith('DCC.DeathClockExpired', expect.anything())
  })

  test('an effect without clock state falls back to the level window', async () => {
    const dying = makeDyingEffect(2)
    dying.getFlag.mockReturnValue(undefined)
    const actor = makeActor({ level: 4, effects: [dying] })
    expect(getDeathClockRemaining(actor)).toBe(4)
    await tickDeathClock(actor)
    expect(dying.setFlag).toHaveBeenCalledWith('dcc', 'deathClock', { roundsRemaining: 3 })
  })
})

describe('onUpdateCombatForDeathClock', () => {
  test('ticks every dying Player combatant on round advance only', async () => {
    const dying = makeDyingEffect(2)
    const pc = makeActor({ effects: [dying] })
    const npc = makeActor({ type: 'NPC', effects: [makeDyingEffect(2)] })
    const combat = { combatants: [{ actor: pc }, { actor: npc }, { actor: null }] }

    await onUpdateCombatForDeathClock(combat, { turn: 2 })
    expect(dying.setFlag).not.toHaveBeenCalled()

    await onUpdateCombatForDeathClock(combat, { round: 2 })
    expect(dying.setFlag).toHaveBeenCalledWith('dcc', 'deathClock', { roundsRemaining: 1 })
    // The NPC's effect is untouched — the clock is a Player rule.
    expect(npc.effects[0].setFlag).not.toHaveBeenCalled()
  })
})

describe('onRenderCombatTrackerForDeathClock', () => {
  test('appends a remaining-rounds badge to dying combatant rows', () => {
    const dying = makeDyingEffect(2)
    const actor = makeActor({ effects: [dying] })
    const nameEl = { appendChild: vi.fn() }
    const li = { dataset: { combatantId: 'c1' }, querySelector: vi.fn(() => nameEl), appendChild: vi.fn() }
    const root = { querySelectorAll: vi.fn(() => [li]) }
    const app = { viewed: { combatants: { get: vi.fn(() => ({ actor })) } } }

    const madeEls = []
    globalThis.document = {
      createElement: vi.fn(tag => {
        const el = { tag, classList: { add: vi.fn() }, dataset: {}, append: vi.fn(), inert: false, className: '' }
        madeEls.push(el)
        return el
      })
    }
    try {
      onRenderCombatTrackerForDeathClock(app, root)
    } finally {
      delete globalThis.document
    }

    const badge = madeEls.find(e => e.tag === 'span')
    expect(badge.classList.add).toHaveBeenCalledWith('dcc-death-clock')
    expect(badge.append).toHaveBeenCalledWith(expect.objectContaining({ tag: 'i' }), '2')
    expect(nameEl.appendChild).toHaveBeenCalledWith(badge)
  })
})

describe('getDyingEffect', () => {
  test('finds the effect by its dying status and tolerates missing actors', () => {
    const dying = makeDyingEffect(1)
    expect(getDyingEffect(makeActor({ effects: [dying] }))).toBe(dying)
    expect(getDyingEffect(makeActor())).toBeUndefined()
    expect(getDyingEffect(null)).toBeUndefined()
  })
})
