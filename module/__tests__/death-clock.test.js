/**
 * Unit coverage for the death clock (issue #843, phase 1). The handlers are
 * thin adapters over dcc-core-lib's death-and-dying math, so the assertions
 * stub `game` / actors per-test and drive them as plain functions.
 *
 * Mirrors the pattern in auto-dead-status.test.js.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'

vi.mock('../ability-score-log.js', () => ({ logAbilityChange: vi.fn() }))

const { logAbilityChange } = await import('../ability-score-log.js')
const {
  getDeathClockRemaining,
  getDyingEffect,
  onRenderChatMessageHTMLForDeathClock,
  onRenderCombatTrackerForDeathClock,
  onUpdateActorForDeathClock,
  onUpdateCombatForDeathClock,
  rollTheBody,
  tickDeathClock
} = await import('../death-clock.mjs')

/** A Roll stub fed from a test-set queue of results. */
class RollMock {
  static queue = []
  constructor (formula) { this.formula = formula }
  async evaluate () { this.total = RollMock.queue.shift() }
}

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
function makeActor ({ level = 2, luck = 10, effects = [], statuses = new Set(), type = 'Player' } = {}) {
  return {
    type,
    name: 'Test PC',
    uuid: 'Actor.test',
    system: { details: { level: { value: level } }, abilities: { lck: { value: luck } } },
    effects,
    statuses,
    toggleStatusEffect: vi.fn().mockResolvedValue(undefined),
    createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(undefined)
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
  original.Roll = globalThis.Roll
  original.ui = globalThis.ui
  globalThis.Roll = RollMock
  RollMock.queue = []
  globalThis.ui = { notifications: { warn: vi.fn() } }
  console.error = vi.fn()
})

afterEach(() => {
  globalThis.game = original.game
  globalThis.ChatMessage = original.ChatMessage
  globalThis.Roll = original.Roll
  globalThis.ui = original.ui
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
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('dead', { active: true, overlay: true })
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

  test('healing above 0 clears a running clock and applies the bleed-out trauma', async () => {
    const dying = makeDyingEffect(1)
    const actor = makeActor({ effects: [dying] })
    await onUpdateActorForDeathClock(actor, { system: { attributes: { hp: { value: 4 } } } })
    expect(dying.delete).toHaveBeenCalledTimes(1)
    // Saved from bleeding out: permanent -1 Stamina, terrible scar.
    expect(logAbilityChange).toHaveBeenCalledWith(actor, expect.objectContaining({
      ability: 'sta',
      change: -1,
      maxChange: -1,
      type: 'otherPermanent'
    }), { announce: false })
    expect(globalThis.game.i18n.format).toHaveBeenCalledWith('DCC.DeathClockSaved',
      expect.objectContaining({ scar: expect.any(String) }))
  })

  test('healing a dead PC above 0 revives them (un-dead + revival card)', async () => {
    const actor = makeActor({ statuses: new Set(['dead']) })
    await onUpdateActorForDeathClock(actor, { system: { attributes: { hp: { value: 2 } } } })
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('dead', { active: false })
    expect(globalThis.game.i18n.format).toHaveBeenCalledWith('DCC.DeathClockRevived', expect.anything())
  })

  test('healing a living, un-clocked PC does nothing', async () => {
    const actor = makeActor()
    await onUpdateActorForDeathClock(actor, { system: { attributes: { hp: { value: 5 } } } })
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled()
    expect(globalThis.ChatMessage.create).not.toHaveBeenCalled()
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
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('dead', { active: true, overlay: true })
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
  test('appends a remaining-rounds badge at the end of the action-dice pip row', () => {
    const dying = makeDyingEffect(2)
    const actor = makeActor({ effects: [dying] })
    const pipRow = { appendChild: vi.fn() }
    const nameEl = { appendChild: vi.fn() }
    const li = {
      dataset: { combatantId: 'c1' },
      querySelector: vi.fn(selector => selector === '.dcc-action-dice-pips' ? pipRow : nameEl),
      appendChild: vi.fn()
    }
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
    expect(pipRow.appendChild).toHaveBeenCalledWith(badge)
    expect(nameEl.appendChild).not.toHaveBeenCalled()
  })

  test('falls back to the name block when there is no pip row', () => {
    const dying = makeDyingEffect(2)
    const actor = makeActor({ effects: [dying] })
    const nameEl = { appendChild: vi.fn() }
    const li = {
      dataset: { combatantId: 'c1' },
      querySelector: vi.fn(selector => selector === '.token-name' ? nameEl : null),
      appendChild: vi.fn()
    }
    const root = { querySelectorAll: vi.fn(() => [li]) }
    const app = { viewed: { combatants: { get: vi.fn(() => ({ actor })) } } }

    globalThis.document = {
      createElement: vi.fn(tag => ({ tag, classList: { add: vi.fn() }, dataset: {}, append: vi.fn(), inert: false, className: '' }))
    }
    try {
      onRenderCombatTrackerForDeathClock(app, root)
    } finally {
      delete globalThis.document
    }

    expect(nameEl.appendChild).toHaveBeenCalledTimes(1)
  })
})

describe('rollTheBody', () => {
  test('warns and does nothing when the actor is not dead', async () => {
    const actor = makeActor()
    await rollTheBody(actor)
    expect(globalThis.ui.notifications.warn).toHaveBeenCalledTimes(1)
    expect(globalThis.ChatMessage.create).not.toHaveBeenCalled()
  })

  test('a failed Luck check leaves them truly dead', async () => {
    const actor = makeActor({ luck: 5, statuses: new Set(['dead']) })
    RollMock.queue = [15, 1]
    await rollTheBody(actor)
    expect(globalThis.game.i18n.format).toHaveBeenCalledWith('DCC.DeathClockBodyLost',
      expect.objectContaining({ roll: 15, target: 5 }))
    // No recovery: status untouched, HP untouched.
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled()
    expect(actor.update).not.toHaveBeenCalled()
  })

  test('a successful Luck check revives at 1 HP with groggy + a random permanent -1', async () => {
    const actor = makeActor({ luck: 15, statuses: new Set(['dead']) })
    RollMock.queue = [10, 2] // d20 10 <= 15; d3 2 → Agility
    await rollTheBody(actor)
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('dead', { active: false })
    expect(actor.update).toHaveBeenCalledWith({ 'system.attributes.hp.value': 1 })
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [expect.objectContaining({
      name: 'DCC.DeathClockGroggy',
      duration: { seconds: 3600 }
    })])
    expect(logAbilityChange).toHaveBeenCalledWith(actor, expect.objectContaining({
      ability: 'agl',
      change: -1,
      maxChange: -1,
      type: 'otherPermanent'
    }), { announce: false })
    expect(globalThis.game.i18n.format).toHaveBeenCalledWith('DCC.DeathClockBodyRecovered',
      expect.objectContaining({ roll: 10, target: 15 }))
  })
})

describe('onRenderChatMessageHTMLForDeathClock', () => {
  function makeCard (button) {
    return { querySelector: vi.fn(sel => sel === 'button[data-action="rollTheBody"]' ? button : null) }
  }

  test('binds a click listener for the GM', () => {
    const button = { dataset: { actorUuid: 'Actor.test' }, addEventListener: vi.fn(), disabled: false }
    onRenderChatMessageHTMLForDeathClock({}, makeCard(button))
    expect(button.addEventListener).toHaveBeenCalledWith('click', expect.any(Function))
    expect(button.disabled).toBe(false)
  })

  test('disables the button for non-GMs', () => {
    globalThis.game.user.isGM = false
    const button = { dataset: { actorUuid: 'Actor.test' }, addEventListener: vi.fn(), disabled: false }
    onRenderChatMessageHTMLForDeathClock({}, makeCard(button))
    expect(button.disabled).toBe(true)
    expect(button.addEventListener).not.toHaveBeenCalled()
  })

  test('is a no-op on cards without the button', () => {
    expect(() => onRenderChatMessageHTMLForDeathClock({}, makeCard(null))).not.toThrow()
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
